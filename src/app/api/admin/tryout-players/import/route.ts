import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { STARTER_ROSTER } from "@/lib/tryoutBoard";
import { copyBoardRanksToAccount } from "@/lib/rankSync";

const schema = z.object({ source: z.enum(["starter", "signups"]) });

// "starter": one-off load of the pre-app roster, only into an empty board.
// "signups": brings every pending/approved account onto the board.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  if (parsed.data.source === "starter") {
    const count = await prisma.tryoutPlayer.count();
    if (count > 0) {
      return NextResponse.json({ error: "The board already has players." }, { status: 409 });
    }
    const result = await prisma.tryoutPlayer.createMany({ data: STARTER_ROSTER });
    return NextResponse.json({ added: result.count });
  }

  const users = await prisma.user.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] }, tryoutEntry: null },
    orderBy: { createdAt: "asc" },
  });
  const unlinked = await prisma.tryoutPlayer.findMany({ where: { userId: null } });

  // Someone already on the board by gamertag gets linked to their account.
  // Ranks on the account win, and the board fills any the account is missing.
  // Other players are added as new. Admin accounts are only linked, so the
  // seeded admin login doesn't show up.
  let added = 0;
  let linked = 0;
  for (const u of users) {
    const tag = u.username.trim().toLowerCase();
    const match = unlinked.find((p) => p.tag.trim().toLowerCase() === tag);
    if (match) {
      const board = await prisma.tryoutPlayer.update({
        where: { id: match.id },
        data: { userId: u.id, rank2v2: u.rank2v2 ?? match.rank2v2, rank3v3: u.rank3v3 ?? match.rank3v3 },
      });
      await copyBoardRanksToAccount(u.id, board);
      unlinked.splice(unlinked.indexOf(match), 1);
      linked++;
    } else if (u.role !== "ADMIN") {
      await prisma.tryoutPlayer.create({
        data: {
          tag: u.username,
          name: u.displayName,
          rank2v2: u.rank2v2,
          rank3v3: u.rank3v3,
          userId: u.id,
        },
      });
      added++;
    }
  }
  return NextResponse.json({ added, linked });
}
