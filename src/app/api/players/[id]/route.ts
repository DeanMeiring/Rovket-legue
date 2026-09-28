import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { averageStats } from "@/lib/replayStats";
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
      avatarUpdatedAt: true,
      rlTrackerUrl: true,
      platform: true,
      discordTag: true,
      discordUsername: true,
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
  // Club average over every imported game with detailed stats, for comparison.
  const all = await prisma.performance.findMany({ where: { stats: { not: Prisma.DbNull } }, select: { stats: true } });
  return NextResponse.json({ ...player, clubAvg: averageStats(all.map((p) => p.stats)) });
}
