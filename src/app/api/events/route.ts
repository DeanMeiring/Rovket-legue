import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";
import { emailEvent } from "@/lib/eventNotify";
import { announceEvent, quietly } from "@/lib/discord";
import { audienceSchema, visibleEventsWhere } from "@/lib/eventAudience";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["TRYOUT", "SCRIM", "MATCH", "TOURNAMENT", "PRACTICE", "MEETING", "OTHER"]),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startTime: z.string().datetime().or(z.string().min(1)),
  endTime: z.string().optional().or(z.literal("")),
  ...audienceSchema,
});

export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.event.findMany({
    where: await visibleEventsWhere(user),
    orderBy: { startTime: "asc" },
    include: {
      rsvps: true,
      audienceTeams: { select: { id: true, name: true } },
      createdBy: { select: { displayName: true, username: true } },
    },
  });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
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

  const { title, type, description, location, startTime, endTime } = parsed.data;
  const forEveryone = parsed.data.forEveryone ?? true;
  const teamIds = forEveryone ? [] : (parsed.data.teamIds ?? []);
  if (!forEveryone && teamIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one team, or choose Everyone." }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title,
      type,
      description: description || null,
      location: location || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      rsvpOpen: type !== "TOURNAMENT",
      forEveryone,
      audienceTeams: { connect: teamIds.map((id) => ({ id })) },
      createdById: admin.id,
    },
  });

  // Everyone approved hears about the event; only players get an RSVP row.
  await emailEvent(event.id);

  void quietly("announce event", () => announceEvent(event.id));

  return NextResponse.json(event, { status: 201 });
}
