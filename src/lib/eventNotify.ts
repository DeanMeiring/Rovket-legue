import { prisma } from "@/lib/prisma";
import { escapeHtml, sendEmail } from "@/lib/email";
import { rsvpEmailButtons } from "@/lib/rsvp";
import { formatEventWhen } from "@/lib/format";
import { audienceUsersWhere } from "@/lib/eventAudience";

// Everyone in an event's audience, making sure each player has an RSVP row
// (someone who joined a team after the event was made won't have one yet).
export async function eventAudience(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { audienceTeams: { select: { id: true } } },
  });
  if (!event) return null;
  const people = await prisma.user.findMany({
    where: audienceUsersWhere(
      event.forEveryone,
      event.audienceTeams.map((t) => t.id),
    ),
    select: { id: true, email: true, isPlayer: true, discordId: true },
  });
  await prisma.eventRsvp.createMany({
    data: people.filter((p) => p.isPlayer).map((p) => ({ eventId: event.id, userId: p.id })),
    skipDuplicates: true,
  });
  const pending = await prisma.eventRsvp.findMany({
    where: { eventId: event.id, status: "PENDING" },
    select: { userId: true },
  });
  const noReply = new Set(pending.map((r) => r.userId));
  return { event, people, noReply };
}

// Emails the event to its audience. onlyNoReply keeps it to players who
// haven't answered yet. Returns how many emails were sent.
export async function emailEvent(eventId: string, { onlyNoReply = false, resend = false } = {}) {
  const audience = await eventAudience(eventId);
  if (!audience) return 0;
  const { event, noReply } = audience;
  const people = onlyNoReply ? audience.people.filter((p) => p.isPlayer && noReply.has(p.id)) : audience.people;

  const kind = event.type.toLowerCase();
  const subject = resend
    ? onlyNoReply
      ? `Can you make it? ${event.title}`
      : `Reminder: ${event.title}`
    : `New ${kind} scheduled: ${event.title}`;
  const intro = resend
    ? `<p>A reminder about <strong>${escapeHtml(event.title)}</strong> on ${formatEventWhen(event.startTime, event.endTime)}.</p>`
    : `<p><strong>${escapeHtml(event.title)}</strong> has been scheduled for ${formatEventWhen(event.startTime, event.endTime)}.</p>`;

  for (const p of people) {
    // Players get RSVP buttons; staff only hear about it.
    const rsvpPart = !event.rsvpOpen
      ? "<p>Teams are still being confirmed. You'll be able to RSVP once they are.</p>"
      : p.isPlayer
        ? rsvpEmailButtons(event.id, p.id)
        : "";
    void sendEmail(
      p.email,
      subject,
      `${intro}
       ${event.location ? `<p>Location: ${escapeHtml(event.location)}</p>` : ""}
       ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
       ${rsvpPart}`,
    );
  }
  return people.length;
}
