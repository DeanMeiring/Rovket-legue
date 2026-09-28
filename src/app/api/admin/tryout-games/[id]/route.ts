import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  blueIds: z.array(z.string().min(1)).length(3),
  orangeIds: z.array(z.string().min(1)).length(3),
});

// Hand edit of a game's sides. Balance is shown to the admin, not enforced.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Each side needs exactly 3 players." }, { status: 400 });

  const ids = [...parsed.data.blueIds, ...parsed.data.orangeIds];
  if (new Set(ids).size !== 6) {
    return NextResponse.json({ error: "A player can only be in a game once." }, { status: 400 });
  }
  const found = await prisma.tryoutPlayer.count({ where: { id: { in: ids } } });
  if (found !== 6) return NextResponse.json({ error: "Some of those players aren't on the board." }, { status: 400 });

  const game = await prisma.tryoutGame.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  if (game.ballchasingId) {
    return NextResponse.json({ error: "This game already has a replay, so its players can't change." }, { status: 409 });
  }

  const updated = await prisma.tryoutGame.update({ where: { id: game.id }, data: parsed.data });
  return NextResponse.json(updated);
}
