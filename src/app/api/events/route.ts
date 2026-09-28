import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { formatEventWhen } from "@/lib/format";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["TRYOUT", "SCRIM", "MATCH", "TOURNAMENT", "PRACTICE", "MEETING", "OTHER"]),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startTime: z.string().datetime().or(z.string().min(1)),
  endTime: z.string().optional().or(z.literal("")),
});

export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.event.findMany({
    orderBy: { startTime: "asc" },
    include: {
      rsvps: true,
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

  const event = await prisma.event.create({
    data: {
      title,
      type,
      description: description || null,
      location: location || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      rsvpOpen: type !== "TOURNAMENT",
      createdById: admin.id,
    },
  });

  // Everyone approved hears about the event; only players get an RSVP row.
  const players = await prisma.user.findMany({
    where: { status: "APPROVED" },
    select: { email: true, id: true, isPlayer: true },
  });

  await prisma.eventRsvp.createMany({
    data: players.filter((p) => p.isPlayer).map((p) => ({ eventId: event.id, userId: p.id })),
    skipDuplicates: true,
  });

  for (const p of players) {
    void sendEmail(
      p.email,
      `New ${type.toLowerCase()} scheduled: ${title}`,
      `<p><strong>${title}</strong> has been scheduled for ${formatEventWhen(
        startTime,
        endTime || null
      )}.</p>
       ${location ? `<p>Location: ${location}</p>` : ""}
       ${description ? `<p>${description}</p>` : ""}
       <p>${
         event.rsvpOpen
           ? "Log in to the team hub to RSVP."
           : "Teams are still being confirmed. You'll be able to RSVP once they are."
       }</p>`
    );
  }

  return NextResponse.json(event, { status: 201 });
}
