import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { preciseRankLabel } from "@/lib/ranks";
import { summarize } from "@/lib/tryoutStats";
import { coachingReference } from "@/lib/coachingReference";
import { METRICS, averageStats, formatMetric } from "@/lib/replayStats";
import { ClaudeError as ReviewError, askClaude } from "@/lib/claude";

export { ReviewError };

const REVIEW_SYSTEM = `You write player reviews for a university Rocket League club that plays 3v3 (Standard) only. The player reads the review on their own dashboard.
Write to the player directly ("you"), warm but honest, like a good coach. Base every point on their numbers and the coaching reference, which is your only source for benchmarks, and name the number you are going on.
Structure: a two or three line overview; what you're doing well; how you adapt to your teammates (see below); what to work on next, most important first; a short practice plan for the coming week with specific drills or training pack types.
For adapting to teammates, compare their results and stats with stronger, similar and weaker teammates: do they step up and take more responsibility (more saves, more time last back, more boost) with weaker teammates, and do they play a supporting role with stronger ones? Judge adaptability as its own skill, and name the numbers.
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

  // Club-wide averages give the reviewer something local to compare against.
  const clubStats = await prisma.performance.findMany({
    where: { stats: { not: Prisma.DbNull } },
    select: { stats: true },
  });
  const mine = averageStats(games.map((g) => g.stats));
  const club = averageStats(clubStats.map((p) => p.stats));
  const detailLines = mine.games
    ? METRICS.map(
        (m) => `${m.label}: ${formatMetric(m, mine.values[m.key])} (club average ${formatMetric(m, club.values[m.key])})`,
      ).join("\n")
    : "No detailed replay stats.";

  const withMates = await teammateContext(user.id, user.rank3v3, games, tryout);

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

  const prompt = `Coaching reference:\n${coachingReference()}\n\n---\nPlayer: ${user.displayName || user.username}
3v3 rank: ${preciseRankLabel(user.rank3v3) ?? "unknown"}
Team: ${user.team?.name ?? "none"}
Totals: ${totals}
${tryoutLine}

Detailed replay stats, per-game averages over ${mine.games} game(s):
${detailLines}

How they did by teammate strength (teammates' average 3v3 MMR against theirs):
${withMates}

Game by game:
${lines.join("\n") || "none"}`;

  const { text, model } = await askClaude(REVIEW_SYSTEM, [{ role: "user", content: prompt }]);
  return prisma.playerReview.create({ data: { userId, text, model } });
}

// A teammate average this far from the player's own MMR (about half a division
// at Champion) counts as stronger or weaker.
const TEAMMATE_GAP = 50;

type TeamGame = { mates: (number | null)[]; opponents: (number | null)[]; win: boolean | null; score: number; stats: unknown };

// Splits the player's games by how strong their teammates were and summarises
// each group, so the review can judge how they adapt.
async function teammateContext(
  userId: string,
  ownMmr: number | null,
  games: { replayId: string | null; win: boolean | null; score: number; stats: unknown }[],
  tryout: { gameId: string; side: string; win: boolean; score: number; raw: unknown }[],
): Promise<string> {
  const teamGames: TeamGame[] = [];

  // Club games: in a replay, players with the same result were on the same side.
  const replayIds = games.map((g) => g.replayId).filter((id): id is string => !!id);
  if (replayIds.length) {
    const rows = await prisma.performance.findMany({
      where: { replayId: { in: replayIds }, userId: { not: userId } },
      select: { replayId: true, win: true, user: { select: { rank3v3: true } } },
    });
    for (const g of games) {
      if (!g.replayId || g.win == null) continue;
      const others = rows.filter((r) => r.replayId === g.replayId);
      teamGames.push({
        mates: others.filter((r) => r.win === g.win).map((r) => r.user.rank3v3),
        opponents: others.filter((r) => r.win !== g.win).map((r) => r.user.rank3v3),
        win: g.win,
        score: g.score,
        stats: g.stats,
      });
    }
  }

  // Tryout games record each player's side.
  if (tryout.length) {
    const rows = await prisma.tryoutGameStat.findMany({
      where: { gameId: { in: tryout.map((t) => t.gameId) } },
      select: { gameId: true, side: true, player: { select: { rank3v3: true, userId: true } } },
    });
    for (const t of tryout) {
      const others = rows.filter((r) => r.gameId === t.gameId && r.player.userId !== userId);
      teamGames.push({
        mates: others.filter((r) => r.side === t.side).map((r) => r.player.rank3v3),
        opponents: others.filter((r) => r.side !== t.side).map((r) => r.player.rank3v3),
        win: t.win,
        score: t.score,
        stats: t.raw,
      });
    }
  }

  if (!teamGames.length) return "No games with known teammates.";
  if (ownMmr == null) return "The player's own 3v3 rank isn't set, so teammate strength can't be compared.";

  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const buckets: Record<string, TeamGame[]> = { "Stronger teammates": [], "Similar teammates": [], "Weaker teammates": [] };
  let unknown = 0;
  for (const g of teamGames) {
    const m = avg(g.mates);
    if (m == null) {
      unknown++;
      continue;
    }
    const key = m - ownMmr > TEAMMATE_GAP ? "Stronger teammates" : ownMmr - m > TEAMMATE_GAP ? "Weaker teammates" : "Similar teammates";
    buckets[key].push(g);
  }

  const pick = ["saves", "mostBack", "behindBall", "bpm", "avgBoost", "toMates", "offThird"];
  const lines = Object.entries(buckets).map(([label, gs]) => {
    if (!gs.length) return `${label}: no games.`;
    const a = averageStats(gs.map((g) => g.stats));
    const detail = pick
      .map((k) => METRICS.find((m) => m.key === k))
      .filter((m): m is (typeof METRICS)[number] => !!m && a.values[m.key] != null)
      .map((m) => `${m.label.toLowerCase()} ${formatMetric(m, a.values[m.key])}`)
      .join(", ");
    const opp = avg(gs.flatMap((g) => g.opponents));
    return (
      `${label}: ${gs.length} games, ${gs.filter((g) => g.win).length} wins, avg score ${r1(gs.reduce((s, g) => s + g.score, 0) / gs.length)}` +
      (opp != null ? `, opponents avg ${Math.round(opp - ownMmr) >= 0 ? "+" : ""}${Math.round(opp - ownMmr)} MMR vs them` : "") +
      (detail ? `; ${detail}` : "")
    );
  });
  if (unknown) lines.push(`${unknown} game(s) had teammates without a known rank.`);
  return lines.join("\n");
}
