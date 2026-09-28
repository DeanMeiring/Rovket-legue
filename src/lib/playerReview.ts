import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { preciseRankLabel } from "@/lib/ranks";
import { summarize } from "@/lib/tryoutStats";

const MODEL = "claude-opus-5-5";

export class ReviewError extends Error {}

// One Claude call. Web search runs server side, so a long search can pause the
// turn; the paused turn is sent back to let it carry on.
async function ask(
  system: string,
  prompt: string,
  tools: Anthropic.Beta.BetaToolUnion[] = [],
  effort: "medium" | "high" = "medium",
): Promise<{ text: string; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ReviewError("AI reviews are off. Set ANTHROPIC_API_KEY in Railway to turn them on.");
  }
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await client.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 32000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort },
          system,
          tools,
          messages,
        })
        .finalMessage();

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal") throw new ReviewError("The AI declined to write this.");
      const text = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("")
        .trim();
      if (!text) throw new ReviewError("The AI returned nothing.");
      return { text, model: response.model };
    }
  } catch (err) {
    if (err instanceof ReviewError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new ReviewError("ANTHROPIC_API_KEY is invalid.");
    if (err instanceof Anthropic.RateLimitError) throw new ReviewError("The AI service is busy. Try again in a minute.");
    if (err instanceof Anthropic.APIError) throw new ReviewError(`AI request failed (${err.status}).`);
    throw err;
  }
  throw new ReviewError("The research ran too long. Try again.");
}

const RESEARCH_SYSTEM = `You are researching for the coaches of a university Rocket League club in South Africa.
Search the web for current, credible material and write a reference brief the coaches' review tool will use to judge players.`;

const RESEARCH_PROMPT = `Research and write a coaching brief on how strong Rocket League players play 3v3 and 2v2, and how coaches assess them. Cover:
1. What pro and high-level players' ballchasing-style numbers look like per game (goals, assists, saves, shots, score, boost per minute, time behind the ball, time as last back) and how they differ by rank band (Diamond, Champion, Grand Champion, pro), with the sources you found.
2. Rotation, positioning and decision-making principles top coaches teach, and the common mistakes at Diamond to Champion level.
3. How to read the stats honestly: which numbers mean something from a few games, and which are noisy or depend on role.
4. Concrete, well-known ways to improve each area (training packs by type, free play drills, replay review habits, workshop maps), with names where they're widely known.
Keep it under 1200 words, plain text with short headings and "-" bullets, no markdown symbols like ** or #. Say where sources disagree or numbers are rough.`;

// The newest research brief, or a fresh one when there is none yet.
export async function coachingBrief(refresh = false) {
  if (!refresh) {
    const latest = await prisma.coachingBrief.findFirst({ orderBy: { createdAt: "desc" } });
    if (latest) return latest;
  }
  const { text, model } = await ask(
    RESEARCH_SYSTEM,
    RESEARCH_PROMPT,
    [
      { type: "web_search_20260209", name: "web_search", max_uses: 8 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
    ],
    "high",
  );
  return prisma.coachingBrief.create({ data: { text, model } });
}

const REVIEW_SYSTEM = `You write player reviews for a university Rocket League club. The player reads the review on their own dashboard.
Write to the player directly ("you"), warm but honest, like a good coach. Base every point on their numbers and the coaching brief, and name the number you are going on.
Structure: a two or three line overview; what you're doing well; what to work on next, most important first; a short practice plan for the coming week with specific drills or training pack types.
Say plainly when there are too few games to judge something. Don't guess at things the stats can't show. Don't mention team selection, other players by name, or rankings within the club.
Plain text with short headings and "-" bullets, no markdown symbols like ** or #, under 450 words.`;

const r1 = (n: number | null | undefined) => (n == null ? "n/a" : n.toFixed(1));

export async function writeReview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: { select: { name: true } },
      performances: {
        include: { event: { select: { title: true, type: true, startTime: true } } },
        orderBy: { createdAt: "asc" },
      },
      tryoutEntry: { include: { gameStats: true } },
    },
  });
  if (!user) throw new ReviewError("Player not found.");
  const games = user.performances;
  const tryout = user.tryoutEntry?.gameStats ?? [];
  if (!games.length && !tryout.length) throw new ReviewError("This player has no stats yet. Import some replays first.");

  const brief = await coachingBrief();

  const lines = games.map((g) =>
    [
      g.event ? `${g.event.title} (${g.event.type.toLowerCase()}, ${g.event.startTime.toISOString().slice(0, 10)})` : "No event",
      g.win == null ? "result n/a" : g.win ? "win" : "loss",
      `goals ${g.goals}, assists ${g.assists}, saves ${g.saves}, shots ${g.shots}, score ${g.score}${g.mvp ? ", MVP" : ""}`,
    ].join(" | "),
  );
  const n = games.length || 1;
  const sum = (k: "goals" | "assists" | "saves" | "shots" | "score") => games.reduce((s, g) => s + g[k], 0);
  const totals = games.length
    ? `${games.length} games, ${games.filter((g) => g.win).length} wins, ${games.filter((g) => g.mvp).length} MVPs. ` +
      `Per game: goals ${r1(sum("goals") / n)}, assists ${r1(sum("assists") / n)}, saves ${r1(sum("saves") / n)}, ` +
      `shots ${r1(sum("shots") / n)}, score ${r1(sum("score") / n)}.`
    : "No club games logged.";

  const t = tryout.length ? summarize(tryout)[0] : null;
  const tryoutLine = t
    ? `Tryout games (${t.games}): wins ${t.wins}, avg score ${r1(t.avgScore)}, boost/min ${r1(t.avgBoostPerMinute)}, ` +
      `avg speed ${r1(t.avgSpeed)}, % behind ball ${r1(t.percentBehindBall)}, % most back ${r1(t.percentMostBack)}, ` +
      `avg distance to mates ${r1(t.avgDistanceToMates)}, goals conceded as last defender ${t.goalsConcededAsLastDefender}.`
    : "No tryout positioning stats.";

  const prompt = `Coaching brief:\n${brief.text}\n\n---\nPlayer: ${user.displayName || user.username}
Ranks: 3v3 ${preciseRankLabel(user.rank3v3) ?? "unknown"}, 2v2 ${preciseRankLabel(user.rank2v2) ?? "unknown"}
Team: ${user.team?.name ?? "none"}
Totals: ${totals}
${tryoutLine}

Game by game:
${lines.join("\n") || "none"}`;

  const { text, model } = await ask(REVIEW_SYSTEM, prompt);
  return prisma.playerReview.create({ data: { userId, text, model } });
}
