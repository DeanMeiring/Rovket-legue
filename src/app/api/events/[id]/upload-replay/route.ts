import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { BallchasingBusy, uploadReplay } from "@/lib/ballchasing";

// Uploads one .replay file to ballchasing (privately, into the club group) and
// returns its ballchasing id. The event page sends files one at a time, then
// imports the ids it got back.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Choose a .replay file." }, { status: 400 });
  }
  const name = (file as File).name || "game.replay";
  if (!name.toLowerCase().endsWith(".replay")) {
    return NextResponse.json({ error: `${name} isn't a .replay file.` }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: `${name} is too big to be a replay.` }, { status: 400 });
  }

  try {
    return NextResponse.json({ id: await uploadReplay(file, name) });
  } catch (err) {
    if (err instanceof BallchasingBusy) return NextResponse.json({ error: err.message }, { status: 429 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 502 });
  }
}
