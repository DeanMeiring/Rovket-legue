import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { importReplayStats } from "@/lib/tryoutReplay";

// Re-reads a replay from ballchasing, e.g. once a fresh upload finishes processing.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.tryoutGame.findUnique({ where: { id: params.id } });
  if (!game?.ballchasingId) return NextResponse.json({ error: "This game has no replay yet." }, { status: 400 });

  try {
    return NextResponse.json(await importReplayStats(game.id, game.ballchasingId));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Replay import failed." },
      { status: 502 }
    );
  }
}
