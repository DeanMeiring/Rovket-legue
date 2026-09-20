import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await prisma.user.findUnique({
    where: { id: params.id, status: "APPROVED" },
    select: {
      id: true,
      username: true,
      displayName: true,
      rlTrackerUrl: true,
      platform: true,
      discordTag: true,
      bio: true,
      role: true,
      rank1v1: true,
      rank2v2: true,
      rank3v3: true,
      team: { select: { id: true, name: true, colorHex: true } },
      performances: {
        orderBy: { createdAt: "desc" },
        include: { event: { select: { id: true, title: true, startTime: true, type: true } } },
      },
    },
  });

  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(player);
}
