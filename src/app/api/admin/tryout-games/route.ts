import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { generateGames } from "@/lib/tryoutGames";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [players, games, evaluations] = await Promise.all([
    prisma.tryoutPlayer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tryoutGame.findMany({ orderBy: { number: "asc" }, include: { stats: true } }),
    prisma.tryoutEvaluation.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return NextResponse.json({
    players,
    games,
    evaluations,
    ballchasingEnabled: !!process.env.BALLCHASING_API_KEY,
    aiEnabled: !!process.env.ANTHROPIC_API_KEY,
  });
}

const schema = z.object({ count: z.number().int().min(1).max(60) });

// Replaces every game that has no replay yet with a fresh balanced set.
// Games with a replay are kept and count as history, so repeat teammates
// are still avoided and numbering carries on.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pick between 1 and 60 games." }, { status: 400 });

  const players = await prisma.tryoutPlayer.findMany();
  if (players.length < 6) {
    return NextResponse.json({ error: "Need at least 6 players on the tryout board." }, { status: 400 });
  }

  await prisma.tryoutGame.deleteMany({ where: { ballchasingId: null } });
  const played = await prisma.tryoutGame.findMany({ orderBy: { number: "asc" } });
  const last = played[played.length - 1];

  const games = generateGames(players, parsed.data.count, played, {
    number: (last?.number ?? 0) + 1,
    round: (last?.round ?? 0) + 1,
  });
  await prisma.tryoutGame.createMany({ data: games });

  return NextResponse.json({ created: games.length });
}
