import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { nameWithTag } from "@/lib/format";

// In-game names from imported replays that didn't match an account, with the
// players an admin can pick from. "Undesignated" players are the ones who have
// no stats for this event yet, so they're the likeliest match.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, users, withStats] = await Promise.all([
    prisma.pendingPerformance.findMany({ where: { eventId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { status: "APPROVED", isPlayer: true },
      select: { id: true, username: true, displayName: true },
    }),
    prisma.performance.findMany({ where: { eventId: params.id }, select: { userId: true }, distinct: ["userId"] }),
  ]);

  const byName = new Map<string, { name: string; games: number; goals: number; saves: number; score: number }>();
  for (const p of pending) {
    const row = byName.get(p.playerName) ?? { name: p.playerName, games: 0, goals: 0, saves: 0, score: 0 };
    row.games++;
    row.goals += p.goals;
    row.saves += p.saves;
    row.score += p.score;
    byName.set(p.playerName, row);
  }

  const designated = new Set(withStats.map((p) => p.userId));
  return NextResponse.json({
    names: [...byName.values()],
    players: users
      .map((u) => ({ id: u.id, name: nameWithTag(u), designated: designated.has(u.id) }))
      .sort((a, b) => Number(a.designated) - Number(b.designated) || a.name.localeCompare(b.name)),
  });
}

const schema = z.object({
  name: z.string().min(1),
  // null means "not one of ours": the stats are dropped.
  userId: z.string().nullable(),
  remember: z.boolean().default(true),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a player." }, { status: 400 });
  const { name, userId, remember } = parsed.data;

  const pending = await prisma.pendingPerformance.findMany({ where: { eventId: params.id, playerName: name } });
  if (!pending.length) return NextResponse.json({ error: "Nothing left to assign for that name." }, { status: 404 });

  if (!userId) {
    await prisma.pendingPerformance.deleteMany({ where: { eventId: params.id, playerName: name } });
    return NextResponse.json({ ok: true, added: 0 });
  }

  const user = await prisma.user.findFirst({ where: { id: userId, status: "APPROVED" } });
  if (!user) return NextResponse.json({ error: "That player wasn't found." }, { status: 404 });

  // A player already in a replay under another name keeps that row; the
  // duplicate is skipped rather than counted twice.
  const [created] = await prisma.$transaction([
    prisma.performance.createMany({
      data: pending.map(({ id: _id, playerName: _n, createdAt: _c, stats, ...rest }) => ({
        ...rest,
        userId,
        stats: stats ?? undefined,
      })),
      skipDuplicates: true,
    }),
    prisma.pendingPerformance.deleteMany({ where: { eventId: params.id, playerName: name } }),
    ...(remember
      ? [
          prisma.playerAlias.upsert({
            where: { name: name.trim().toLowerCase() },
            create: { name: name.trim().toLowerCase(), userId },
            update: { userId },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, added: created.count, skipped: pending.length - created.count });
}
