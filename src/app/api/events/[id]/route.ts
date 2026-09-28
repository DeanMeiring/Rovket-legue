import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";
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
  return NextResponse.json(event);
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
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const data = parsed.data;
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
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await quietly("delete event posts", () => deleteEventMessages(params.id));
  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
