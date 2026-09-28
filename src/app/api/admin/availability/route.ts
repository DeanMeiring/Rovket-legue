import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

// Everyone's weekly availability plus the events in the requested week.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = new Date(new URL(req.url).searchParams.get("from") || Date.now());
  if (isNaN(from.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const to = addDays(from, 7);

  const [players, events] = await Promise.all([
    prisma.user.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        team: { select: { id: true, name: true } },
        availability: { select: { slots: true, note: true, updatedAt: true } },
      },
    }),
    prisma.event.findMany({
      where: {
        startTime: { lt: to },
        OR: [{ startTime: { gte: from } }, { endTime: { gte: from } }],
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  return NextResponse.json({ players, events });
}
