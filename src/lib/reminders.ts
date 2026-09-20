import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { format } from "date-fns";
import { EVENT_TYPE_LABEL } from "@/lib/format";

export async function sendEventReminders() {
  const leadHours = Number(process.env.REMINDER_LEAD_HOURS || 3);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + leadHours * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: now, lte: windowEnd },
      reminderSentAt: null,
    },
    include: {
      rsvps: {
        where: { status: { in: ["GOING", "MAYBE", "PENDING"] } },
        include: { user: { select: { email: true, displayName: true, username: true, status: true } } },
      },
    },
  });

  for (const event of events) {
    const recipients = event.rsvps
      .map((r) => r.user)
      .filter((u) => u.status === "APPROVED");

    for (const user of recipients) {
      void sendEmail(
        user.email,
        `Reminder: ${event.title} starts soon`,
        `<p>Hey ${user.displayName || user.username}, this is a reminder that
         <strong>${event.title}</strong> (${EVENT_TYPE_LABEL[event.type]}) starts at
         ${format(event.startTime, "HH:mm 'on' EEEE d MMM")}.</p>
         ${event.location ? `<p>Location: ${event.location}</p>` : ""}
         <p>See you there!</p>`
      );
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return events.length;
}
