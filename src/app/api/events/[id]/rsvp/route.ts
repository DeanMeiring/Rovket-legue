import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { visibleEventsWhere } from "@/lib/eventAudience";

const schema = z.object({
  status: z.enum(["GOING", "MAYBE", "DECLINED"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: params.id, ...(await visibleEventsWhere(user)) },
    select: { rsvpOpen: true, type: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!event.rsvpOpen) {
    return NextResponse.json({ error: "RSVPs for this event open once the teams are confirmed." }, { status: 403 });
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: params.id, userId: user.id } },
    update: { status: parsed.data.status },
    create: { eventId: params.id, userId: user.id, status: parsed.data.status },
  });

  if (event.type === "TRYOUT") await syncTryoutsTeam(user.id, parsed.data.status);

  return NextResponse.json(rsvp);
}

const TRYOUTS_TEAM = "Tryouts";
const HOLDING_TEAM = "BC USSA"; // where newly approved players land

// Saying Going to a tryout puts a player in the "Tryouts" team, but only if
// they have no team yet or are still in the holding team: players already on
// a real team keep it. Declining moves them back out of Tryouts.
async function syncTryoutsTeam(userId: string, status: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlayer: true, team: { select: { name: true } } },
  });
  if (!user?.isPlayer) return;
  const current = user.team?.name ?? null;

  if (status === "GOING" && (current === null || current === HOLDING_TEAM)) {
    const team = await prisma.team.upsert({ where: { name: TRYOUTS_TEAM }, update: {}, create: { name: TRYOUTS_TEAM } });
    await prisma.user.update({ where: { id: userId }, data: { teamId: team.id } });
  } else if (status === "DECLINED" && current === TRYOUTS_TEAM) {
    const team = await prisma.team.upsert({ where: { name: HOLDING_TEAM }, update: {}, create: { name: HOLDING_TEAM } });
    await prisma.user.update({ where: { id: userId }, data: { teamId: team.id } });
  }
}
