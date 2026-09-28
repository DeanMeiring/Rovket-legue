import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { tryoutPlayerSchema } from "@/lib/tryoutSchema";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const players = await prisma.tryoutPlayer.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: { select: { status: true } } },
  });
  return NextResponse.json(
    players.map(({ user, ...p }) => ({ ...p, userStatus: user?.status ?? null }))
  );
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = tryoutPlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const player = await prisma.tryoutPlayer.create({ data: parsed.data });
  return NextResponse.json(player, { status: 201 });
}
