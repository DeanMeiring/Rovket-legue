import { prisma } from "@/lib/prisma";
import { fetchReplay } from "@/lib/ballchasing";

export type ImportResult =
  | { status: "pending" }
  | { status: "failed" }
  | { status: "ok"; matched: string[]; unmatched: string[] };

// Pulls a processed replay from ballchasing and stores one stat row per
// player it can match to the tryout roster by gamertag. Safe to run again:
// it replaces the game's previous stats.
export async function importReplayStats(gameId: string, ballchasingId: string): Promise<ImportResult> {
  const replay = await fetchReplay(ballchasingId);

  if (replay.status && replay.status !== "ok") {
    const status = replay.status === "failed" ? "failed" : "pending";
    await prisma.tryoutGame.update({ where: { id: gameId }, data: { ballchasingId, replayStatus: status } });
    return { status };
  }

  const game = await prisma.tryoutGame.findUniqueOrThrow({ where: { id: gameId } });
  const roster = await prisma.tryoutPlayer.findMany({ select: { id: true, tag: true } });
  const inGame = new Set([...game.blueIds, ...game.orangeIds]);

  // Prefer players scheduled in this game, in case two tags only differ by case.
  const byTag = (name: string) => {
    const lower = name.trim().toLowerCase();
    const hits = roster.filter((p) => p.tag.trim().toLowerCase() === lower);
    return hits.find((p) => inGame.has(p.id)) ?? hits[0];
  };

  const blueGoals = replay.blue?.goals ?? 0;
  const orangeGoals = replay.orange?.goals ?? 0;
  const matched: string[] = [];
  const unmatched: string[] = [];
  const rows = [];
  const seen = new Set<string>();

  for (const [side, team, won] of [
    ["blue", replay.blue, blueGoals > orangeGoals],
    ["orange", replay.orange, orangeGoals > blueGoals],
  ] as const) {
    for (const p of team?.players ?? []) {
      const player = byTag(p.name);
      if (!player || seen.has(player.id)) {
        unmatched.push(p.name);
        continue;
      }
      seen.add(player.id);
      matched.push(player.tag);
      const st = p.stats ?? { core: {} };
      rows.push({
        gameId,
        playerId: player.id,
        side,
        win: won,
        goals: st.core?.goals ?? 0,
        assists: st.core?.assists ?? 0,
        saves: st.core?.saves ?? 0,
        shots: st.core?.shots ?? 0,
        score: st.core?.score ?? 0,
        mvp: !!st.core?.mvp,
        boostPerMinute: st.boost?.bpm ?? null,
        avgSpeed: st.movement?.avg_speed ?? null,
        percentBehindBall: st.positioning?.percent_behind_ball ?? null,
        demosInflicted: st.demo?.inflicted ?? null,
        raw: st as object,
      });
    }
  }

  await prisma.$transaction([
    prisma.tryoutGameStat.deleteMany({ where: { gameId } }),
    prisma.tryoutGameStat.createMany({ data: rows }),
    prisma.tryoutGame.update({
      where: { id: gameId },
      data: { ballchasingId, replayStatus: "ok", blueGoals, orangeGoals },
    }),
  ]);

  return { status: "ok", matched, unmatched };
}
