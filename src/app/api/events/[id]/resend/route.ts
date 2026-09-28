import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { emailEvent, eventAudience } from "@/lib/eventNotify";
import { announceEvent, discordConfig } from "@/lib/discord";

const schema = z
  .object({
    email: z.boolean(),
    discord: z.boolean(),
    onlyNoReply: z.boolean().default(false),
  })
  .refine((d) => d.email || d.discord, { message: "Pick email, Discord or both." });

// Sends an event out again, by email, Discord or both. The Discord post is
// replaced rather than duplicated, so the RSVP buttons stay in one place.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }
  const { email, discord, onlyNoReply } = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (new Date(event.endTime ?? event.startTime).getTime() < Date.now()) {
    return NextResponse.json({ error: "This event is already over." }, { status: 400 });
  }
  if (onlyNoReply && !event.rsvpOpen) {
    return NextResponse.json(
      { error: "RSVPs aren't open for this event yet, so nobody can reply. Open RSVPs first." },
      { status: 400 },
    );
  }
  if (discord && !discordConfig().enabled) {
    return NextResponse.json({ error: "The Discord bot isn't set up in Railway." }, { status: 400 });
  }

  const parts: string[] = [];
  if (email) {
    const sent = await emailEvent(event.id, { onlyNoReply, resend: true });
    parts.push(`Emailed ${sent} ${sent === 1 ? "person" : "people"}.`);
  }
  if (discord) {
    let mentionUserIds: string[] | undefined;
    let notLinked = 0;
    if (onlyNoReply) {
      const audience = await eventAudience(event.id);
      const waiting = (audience?.people ?? []).filter((p) => p.isPlayer && audience!.noReply.has(p.id));
      mentionUserIds = waiting.flatMap((p) => (p.discordId ? [p.discordId] : []));
      notLinked = waiting.length - mentionUserIds.length;
    }
    try {
      const posts = await announceEvent(event.id, { resend: true, mentionUserIds });
      parts.push(
        posts
          ? `Reposted in Discord${mentionUserIds ? `, pinging ${mentionUserIds.length} player(s)` : ""}.`
          : "Nothing posted in Discord: no channel is set for this event.",
      );
      if (notLinked) parts.push(`${notLinked} player(s) who haven't replied haven't linked Discord.`);
    } catch (err) {
      console.error("[discord] resend failed:", err instanceof Error ? err.message : err);
      parts.push("Discord failed. Check the bot's permissions in that channel.");
    }
  }
  return NextResponse.json({ message: parts.join(" ") });
}
