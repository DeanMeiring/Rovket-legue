import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { preciseRankLabel } from "@/lib/ranks";
import { summarize } from "@/lib/tryoutStats";
import { loadTryoutEventGames } from "@/lib/tryoutEventGames";

const MODEL = "claude-opus-5";

const SYSTEM = `You help the captains of a university Rocket League club evaluate 3v3 tryouts.
You get per-player stats from ballchasing.com replays of balanced tryout games, plus each player's self-reported ranks.
Write a short evaluation for the captains:
1. A ranked shortlist of the strongest performers, with the stats that justify each spot.
2. Rotation and positioning notes per player where the numbers stand out: time behind the ball, time as last back, distance to teammates (low can mean double commits), goals conceded as last defender.
3. Pairs or trios that won together or combined well, if the game list shows it.
4. Players whose tryout stats are well above or below what their rank suggests.
Be direct and specific. Say when a sample is too small (fewer than 3 games) to judge. Use plain text with short headings and bullets, no tables.`;

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI evaluation is off. Set ANTHROPIC_API_KEY in Railway to turn it on." },
      { status: 400 }
    );
  }

  const [boardPlayers, games, events] = await Promise.all([
    prisma.tryoutPlayer.findMany(),
    prisma.tryoutGame.findMany({ where: { replayStatus: "ok" }, orderBy: { number: "asc" }, include: { stats: true } }),
    loadTryoutEventGames(),
  ]);
  const players = [...boardPlayers, ...events.extraPlayers];
  if (games.length === 0 && events.games.length === 0) {
    return NextResponse.json({ error: "Import at least one replay first." }, { status: 400 });
  }

  const tag = new Map(players.map((p) => [p.id, p.tag]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const summaries = summarize([...games.flatMap((g) => g.stats), ...events.statRows]);
  const r1 = (n: number | null) => (n == null ? "n/a" : n.toFixed(1));

  const playerLines = summaries.map((s) => {
    const p = byId.get(s.playerId);
    return [
      `${tag.get(s.playerId) ?? "unknown"}`,
      `3v3 ${preciseRankLabel(p?.rank3v3) ?? "n/a"}, 2v2 ${preciseRankLabel(p?.rank2v2) ?? "n/a"}`,
      `games ${s.games}, wins ${s.wins}, MVPs ${s.mvps}, avg score ${r1(s.avgScore)}`,
      `goals ${s.goals}, assists ${s.assists}, saves ${s.saves}, shots ${s.shots}, demos ${s.demos}`,
      `boost/min ${r1(s.avgBoostPerMinute)}, avg speed ${r1(s.avgSpeed)}`,
      `% behind ball ${r1(s.percentBehindBall)}, % most back ${r1(s.percentMostBack)}, avg distance to mates ${r1(s.avgDistanceToMates)}, goals conceded as last defender ${s.goalsConcededAsLastDefender}`,
    ].join(" | ");
  });

  // Sides as actually played in the replay (players may swap colours at kickoff).
  const gameLines = games.map((g) => {
    const side = (name: string) =>
      g.stats
        .filter((st) => st.side === name)
        .map((st) => tag.get(st.playerId) ?? "?")
        .join(", ") || "unmatched players";
    return `Game ${g.number}: blue ${side("blue")} (${g.blueGoals ?? "?"}) vs orange ${side("orange")} (${g.orangeGoals ?? "?"})`;
  });
  // Games played at tryout events; ballchasing doesn't say which side was blue here.
  events.games.forEach((g, i) => {
    const [won, lost] = g.sides;
    gameLines.push(
      `${g.event} game ${i + 1}: ${won.names.join(", ")} (${won.goals}) beat ${lost.names.join(", ")} (${lost.goals})`,
    );
  });

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Players (averages across their tryout games):\n${playerLines.join("\n")}\n\nGames with final goals:\n${gameLines.join("\n")}`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is invalid." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The AI service is busy. Try again in a minute." }, { status: 502 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI request failed (${err.status}).` }, { status: 502 });
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    return NextResponse.json({ error: "The AI declined to evaluate this data." }, { status: 502 });
  }
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  if (!text) return NextResponse.json({ error: "The AI returned an empty evaluation." }, { status: 502 });

  const evaluation = await prisma.tryoutEvaluation.create({ data: { text, model: response.model } });
  return NextResponse.json(evaluation);
}
