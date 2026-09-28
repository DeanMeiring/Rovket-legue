import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";
import { visibleEventsWhere } from "@/lib/eventAudience";
import { nameWithTag } from "@/lib/format";
import { balanceGap, generateGames, ratingMap, type RatedPlayer } from "@/lib/tryoutGames";

// The event's game roster. Admins build and rebalance it; players see it once
// it's shared.

const playerSelect = {
  id: true,
  displayName: true,
  username: true,
  rank2v2: true,
  rank3v3: true,
} as const;

// Even sides matter more than fresh teammates in a practice session, so a
// repeat pairing costs far less than in tryouts (60): it only breaks near-ties.
const PRACTICE_REPEAT_PENALTY = 5;

// 3v3 leans on the 3v3 rank; for 2v2 the weighting flips so 2v2 counts most.
function rated(u: { id: string; rank2v2: number | null; rank3v3: number | null }, teamSize: number): RatedPlayer {
  return teamSize === 2 ? { id: u.id, rank3v3: u.rank2v2, rank2v2: u.rank3v3 } : u;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = user.role === "ADMIN";

  const event = await prisma.event.findFirst({
    where: { id: params.id, ...(await visibleEventsWhere(user)) },
    include: { games: { orderBy: { number: "asc" } }, rsvps: { select: { userId: true, status: true } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && !event.rosterShared) return NextResponse.json({ shared: false, games: [] });

  const inGames = event.games.flatMap((g) => [...g.blueIds, ...g.orangeIds]);
  const ids = new Set([...event.rosterPool, ...inGames]);
  // Admins pick from every approved player, so walk-ins can be added.
  const people = await prisma.user.findMany({
    where: isAdmin
      ? { OR: [{ status: "APPROVED", isPlayer: true }, { id: { in: [...ids] } }] }
      : { id: { in: [...ids] } },
    select: playerSelect,
    orderBy: { username: "asc" },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const rating = ratingMap(people.map((p) => rated(p, event.rosterTeamSize)));
  const name = (id: string) => {
    const p = byId.get(id);
    return p ? nameWithTag(p) : "Removed player";
  };

  const plays = new Map<string, number>();
  for (const id of inGames) plays.set(id, (plays.get(id) ?? 0) + 1);

  // Who sits out each upcoming round, among the players in the pool. Rounds
  // already played are left out: the pool may have changed since.
  const upcoming = new Set(event.games.filter((g) => !g.played).map((g) => g.round));
  const rounds = new Map<number, Set<string>>();
  for (const g of event.games) {
    if (!upcoming.has(g.round)) continue;
    const set = rounds.get(g.round) ?? new Set<string>();
    [...g.blueIds, ...g.orangeIds].forEach((id) => set.add(id));
    rounds.set(g.round, set);
  }
  const sittingOut = Object.fromEntries(
    [...rounds].map(([round, playing]) => [
      round,
      event.rosterPool.filter((id) => !playing.has(id)).map((id) => ({ id, name: name(id) })),
    ]),
  );

  const rsvp = new Map(event.rsvps.map((r) => [r.userId, r.status]));
  return NextResponse.json({
    shared: event.rosterShared,
    teamSize: event.rosterTeamSize,
    gameCount: event.rosterGames,
    games: event.games.map((g) => ({
      id: g.id,
      number: g.number,
      round: g.round,
      blue: g.blueIds.map((id) => ({ id, name: name(id) })),
      orange: g.orangeIds.map((id) => ({ id, name: name(id) })),
      played: g.played,
      blueGoals: g.blueGoals,
      orangeGoals: g.orangeGoals,
      ...(isAdmin && { gap: Math.round(balanceGap(g, rating)) }),
    })),
    sittingOut,
    plays: Object.fromEntries(plays),
    ...(isAdmin && {
      pool: event.rosterPool,
      candidates: people.map((p) => ({
        id: p.id,
        name: nameWithTag(p),
        rsvp: rsvp.get(p.id) ?? null,
        rating: Math.round(rating.get(p.id) ?? 0),
        hasRank: p.rank2v2 != null || p.rank3v3 != null,
      })),
    }),
  });
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("build"),
    poolIds: z.array(z.string()).max(100),
    gameCount: z.number().int().min(1).max(40),
    teamSize: z.union([z.literal(2), z.literal(3)]),
  }),
  z.object({
    action: z.literal("played"),
    gameId: z.string(),
    played: z.boolean(),
    blueGoals: z.number().int().min(0).max(99).nullable().optional(),
    orangeGoals: z.number().int().min(0).max(99).nullable().optional(),
  }),
  z.object({ action: z.literal("share"), shared: z.boolean() }),
]);

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data.action === "share") {
    await prisma.event.update({ where: { id: event.id }, data: { rosterShared: data.shared } });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "played") {
    await prisma.eventGame.updateMany({
      where: { id: data.gameId, eventId: event.id },
      data: {
        played: data.played,
        ...(data.blueGoals !== undefined && { blueGoals: data.blueGoals }),
        ...(data.orangeGoals !== undefined && { orangeGoals: data.orangeGoals }),
      },
    });
    return NextResponse.json({ ok: true });
  }

  // Build or rebalance: played games stay, every other game is rebuilt from
  // the current pool so the people who've played least go next.
  const pool = await prisma.user.findMany({
    where: { id: { in: [...new Set(data.poolIds)] }, status: "APPROVED" },
    select: playerSelect,
  });
  const perGame = data.teamSize * 2;
  if (pool.length < perGame) {
    return NextResponse.json(
      { error: `A ${data.teamSize}v${data.teamSize} game needs at least ${perGame} players in the pool.` },
      { status: 400 },
    );
  }

  const played = await prisma.eventGame.findMany({
    where: { eventId: event.id, played: true },
    orderBy: { number: "asc" },
  });
  const remaining = Math.max(0, data.gameCount - played.length);
  const games = generateGames(
    pool.map((p) => rated(p, data.teamSize)),
    remaining,
    played,
    {
      number: Math.max(0, ...played.map((g) => g.number)) + 1,
      round: Math.max(0, ...played.map((g) => g.round)) + 1,
    },
    Math.floor(Math.random() * 1e9),
    data.teamSize,
    PRACTICE_REPEAT_PENALTY,
  );

  await prisma.$transaction([
    prisma.eventGame.deleteMany({ where: { eventId: event.id, played: false } }),
    prisma.event.update({
      where: { id: event.id },
      data: { rosterPool: pool.map((p) => p.id), rosterGames: data.gameCount, rosterTeamSize: data.teamSize },
    }),
    prisma.eventGame.createMany({
      data: games.map((g) => ({
        eventId: event.id,
        number: g.number,
        round: g.round,
        blueIds: g.blueIds,
        orangeIds: g.orangeIds,
      })),
    }),
  ]);
  return NextResponse.json({ ok: true, built: games.length, kept: played.length });
}
