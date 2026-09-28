import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

// Creates (or, with {renew: true}, replaces) the private claim link for a
// board player who doesn't have an app account yet.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const player = await prisma.tryoutPlayer.findUnique({ where: { id: params.id } });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (player.userId) {
    return NextResponse.json({ error: `${player.tag} already has an account.` }, { status: 409 });
  }
  if (player.claimToken && !body?.renew) return NextResponse.json({ claimToken: player.claimToken });

  const updated = await prisma.tryoutPlayer.update({
    where: { id: player.id },
    data: { claimToken: randomBytes(18).toString("base64url") },
  });
  return NextResponse.json({ claimToken: updated.claimToken });
}
