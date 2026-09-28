import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { tryoutPlayerSchema } from "@/lib/tryoutSchema";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = tryoutPlayerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.tryoutPlayer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const player = await prisma.tryoutPlayer.update({ where: { id: params.id }, data: parsed.data });
  // The tracker link also belongs on the player's app profile, if they have one.
  if (parsed.data.trackerUrl !== undefined && player.userId) {
    await prisma.user.update({ where: { id: player.userId }, data: { rlTrackerUrl: player.trackerUrl } });
  }
  return NextResponse.json(player);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.tryoutPlayer.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
