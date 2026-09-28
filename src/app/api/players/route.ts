import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const players = await prisma.user.findMany({
    where: { status: "APPROVED", isPlayer: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      rlTrackerUrl: true,
      platform: true,
      discordTag: true,
      role: true,
      team: { select: { id: true, name: true, colorHex: true } },
    },
  });

  return NextResponse.json(players);
}
