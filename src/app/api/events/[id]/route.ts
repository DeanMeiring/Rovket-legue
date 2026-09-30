import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { CAPTAIN_EVENT_TYPES, canManageEvent, captainDayTaken } from "@/lib/captain";
import { audienceSchema, visibleEventsWhere } from "@/lib/eventAudience";
import { deleteEventMessages, quietly, refreshEventMessages } from "@/lib/discord";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findFirst({
    where: { id: params.id, ...(await visibleEventsWhere(user)) },
    include: {
      audienceTeams: { select: { id: true, name: true } },
      rsvps: {
        include: { user: { select: { id: true, displayName: true, username: true, teamId: true } } },
      },
      performances: {
        include: { user: { select: { id: true, displayName: true, username: true } } },
        orderBy: { createdAt: "asc" },
      },
      createdBy: { select: { displayName: true, username: true } },
    },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...event, canManage: await canManageEvent(user, event.id) });
}

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["TRYOUT", "SCRIM", "MATCH", "TOURNAMENT", "PRACTICE", "MEETING", "OTHER"]).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startTime: z.string().optional(),
  endTime: z.string().optional().or(z.literal("")),
  rsvpOpen: z.boolean().optional(),
  ...audienceSchema,
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user || !(await canManageEvent(user, params.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = user.role === "ADMIN";

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (!isAdmin) {
    // A captain's event stays a team event, of a type captains can schedule,
    // and one a day.
    delete data.forEveryone;
    delete data.teamIds;
    if (data.type !== undefined && !(CAPTAIN_EVENT_TYPES as readonly string[]).includes(data.type)) {
      return NextResponse.json({ error: "Captains can schedule practices, scrims, matches and tournaments." }, { status: 400 });
    }
    if (data.startTime !== undefined) {
      const team = await prisma.team.findUnique({ where: { captainId: user.id }, select: { id: true } });
      const clash = team && (await captainDayTaken(user.id, team.id, new Date(data.startTime), params.id));
      if (clash) {
        return NextResponse.json({ error: `You already scheduled "${clash}" that day. Captains can schedule one event a day.` }, { status: 400 });
      }
    }
  }
  if (data.forEveryone === false && !data.teamIds?.length) {
    return NextResponse.json({ error: "Pick at least one team, or choose Everyone." }, { status: 400 });
  }
  const event = await prisma.event.update({
    where: { id: params.id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
      ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
      ...(data.rsvpOpen !== undefined && { rsvpOpen: data.rsvpOpen }),
      ...(data.forEveryone !== undefined && { forEveryone: data.forEveryone }),
      ...(data.teamIds !== undefined && {
        audienceTeams: { set: (data.forEveryone ? [] : data.teamIds).map((id) => ({ id })) },
      }),
    },
  });

  void quietly("refresh event posts", () => refreshEventMessages(event.id));

  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user || !(await canManageEvent(user, params.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await quietly("delete event posts", () => deleteEventMessages(params.id));
  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
