import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { visibleEventsWhere } from "@/lib/eventAudience";

const MAX_SPAN_MS = 8 * 24 * 60 * 60 * 1000;

// Events a player is part of between ?from and ?to (the browser's week, so
// days match the viewer's clock), with that player's RSVP. Only events the
// viewer can see themselves are included.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_SPAN_MS) {
    return NextResponse.json({ error: "Invalid week." }, { status: 400 });
  }

  const player = await prisma.user.findUnique({
    where: { id: params.id, status: "APPROVED" },
    select: { id: true, teamId: true },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await prisma.event.findMany({
    where: {
      AND: [
        // Overlaps the week: starts before it ends, and ends (or starts) after it begins.
        { startTime: { lt: to } },
        { OR: [{ startTime: { gte: from } }, { endTime: { gte: from } }] },
        { OR: [{ forEveryone: true }, ...(player.teamId ? [{ audienceTeams: { some: { id: player.teamId } } }] : [])] },
        await visibleEventsWhere(user),
      ],
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      startTime: true,
      endTime: true,
      rsvpOpen: true,
      rsvps: { where: { userId: player.id }, select: { status: true } },
    },
  });

  return NextResponse.json({
    events: events.map(({ rsvps, ...e }) => ({ ...e, rsvp: rsvps[0]?.status ?? null })),
  });
}
