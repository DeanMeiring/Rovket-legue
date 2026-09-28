import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { extractReplayId, uploadReplay } from "@/lib/ballchasing";
import { importReplayStats } from "@/lib/tryoutReplay";

// Accepts either a .replay file (uploaded to ballchasing privately) or a
// link to a replay that's already on ballchasing, then imports its stats.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.tryoutGame.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const link = form?.get("link");

  try {
    let ballchasingId: string | null = null;
    if (file instanceof Blob && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "That file is too big to be a replay." }, { status: 400 });
      }
      ballchasingId = await uploadReplay(file, (file as File).name || `game-${game.number}.replay`);
    } else if (typeof link === "string" && link.trim()) {
      ballchasingId = extractReplayId(link);
      if (!ballchasingId) {
        return NextResponse.json({ error: "Couldn't find a replay ID in that link." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Choose a .replay file or paste a ballchasing link." }, { status: 400 });
    }

    const result = await importReplayStats(game.id, ballchasingId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Replay import failed." },
      { status: 502 }
    );
  }
}
