// One-shot reminder run for a Railway cron service.
//
// The web service used to check for reminders every 5 minutes from inside
// the app (src/instrumentation.ts). That database query every 5 minutes is
// outbound traffic, so Railway's Serverless mode could never put the app to
// sleep. Run this script on a schedule instead, set DISABLE_REMINDER_CRON=true
// on the web service, and the site can sleep while nobody is using it.
//
// It sends the same Discord pings and reminder emails, then exits, which is
// what Railway cron services expect.
import { prisma } from "@/lib/prisma";
import { quietly, sendDiscordReminders } from "@/lib/discord";
import { sendEventReminders } from "@/lib/reminders";

async function main() {
  await quietly("reminders", () => sendDiscordReminders());
  const count = await sendEventReminders();
  console.log(`[reminders] Run finished, email reminders sent for ${count} event(s).`);
}

main()
  .catch((err) => {
    console.error("[reminders] Failed to send reminders:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
