// Games played at events of type Tryout, shaped like the Tryout games page's
// own rows so both can be shown and evaluated together. Players are keyed by
// their tryout board entry when they have one, otherwise by account.

import { prisma } from "@/lib/prisma";
import type { StatRow } from "@/lib/tryoutStats";

export type EventGameSide = { names: string[]; goals: number; won: boolean };
export type TryoutEventGame = { id: string; event: string; date: string; sides: EventGameSide[] };
export type ExtraPlayer = { id: string; tag: string; name: string | null; rank2v2: number | null; rank3v3: number | null };

export async function loadTryoutEventGames() {
  const where = { event: { type: "TRYOUT" as const }, replayId: { not: null }, win: { not: null } };
  const [rows, pending, board] = await Promise.all([
    prisma.performance.findMany({
      where,
      include: {
        event: { select: { title: true, startTime: true } },
        user: { select: { id: true, username: true, displayName: true, rank2v2: true, rank3v3: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pendingPerformance.findMany({
      where: { event: { type: "TRYOUT" } },
      select: { replayId: true, playerName: true, goals: true, win: true },
    }),
    prisma.tryoutPlayer.findMany({ where: { userId: { not: null } }, select: { id: true, tag: true, userId: true } }),
  ]);

  const boardId = new Map(board.map((b) => [b.userId!, b]));
  const extra = new Map<string, ExtraPlayer>();
  const keyOf = (u: (typeof rows)[number]["user"]) => {
    const b = boardId.get(u.id);
    if (b) return { key: b.id, label: b.tag };
    extra.set(`u:${u.id}`, {
      id: `u:${u.id}`,
      tag: u.displayName || u.username,
      name: u.displayName,
      rank2v2: u.rank2v2,
      rank3v3: u.rank3v3,
    });
    return { key: `u:${u.id}`, label: u.displayName || u.username };
  };

  const statRows: StatRow[] = [];
  const games = new Map<string, TryoutEventGame>();
  for (const r of rows) {
    const { key, label } = keyOf(r.user);
    const raw = r.stats as {
      boost?: { bpm?: number };
      movement?: { avg_speed?: number };
      positioning?: { percent_behind_ball?: number };
      demo?: { inflicted?: number };
    } | null;
    statRows.push({
      playerId: key,
      win: !!r.win,
      goals: r.goals,
      assists: r.assists,
      saves: r.saves,
      shots: r.shots,
      score: r.score,
      mvp: r.mvp,
      boostPerMinute: raw?.boost?.bpm ?? null,
      avgSpeed: raw?.movement?.avg_speed ?? null,
      percentBehindBall: raw?.positioning?.percent_behind_ball ?? null,
      demosInflicted: raw?.demo?.inflicted ?? null,
      raw: r.stats,
    });

    const id = r.replayId!;
    const game = games.get(id) ?? {
      id,
      event: r.event?.title ?? "Tryout",
      date: (r.event?.startTime ?? r.createdAt).toISOString(),
      sides: [
        { names: [], goals: 0, won: true },
        { names: [], goals: 0, won: false },
      ],
    };
    const side = game.sides[r.win ? 0 : 1];
    side.names.push(label);
    side.goals += r.goals;
    games.set(id, game);
  }
  // Names nobody has matched yet still count towards the score.
  for (const p of pending) {
    const side = games.get(p.replayId)?.sides[p.win ? 0 : 1];
    if (!side) continue;
    side.names.push(`${p.playerName} (unmatched)`);
    side.goals += p.goals;
  }

  return { statRows, games: [...games.values()], extraPlayers: [...extra.values()] };
}
