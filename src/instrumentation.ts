export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_REMINDER_CRON === "true") return;

  const cron = await import("node-cron");
  const { sendEventReminders } = await import("@/lib/reminders");
  const { quietly, sendDiscordReminders } = await import("@/lib/discord");

  // Check every 5 minutes for events starting within the reminder windows:
  // emails a few hours ahead, the Discord ping about an hour ahead.
  cron.schedule("*/5 * * * *", async () => {
    await quietly("reminders", () => sendDiscordReminders());
    try {
      const count = await sendEventReminders();
      if (count > 0) console.log(`[reminders] Sent reminders for ${count} event(s).`);
    } catch (err) {
      console.error("[reminders] Failed to send reminders:", err);
    }
  });

  console.log("[reminders] Cron scheduler started (every 5 minutes).");
}
