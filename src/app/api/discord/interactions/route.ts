import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discordConfig, discordLinkUrl, verifyDiscordRequest } from "@/lib/discord";
import { saveRsvp, type RsvpChoice } from "@/lib/rsvp";
import { RSVP_LABEL } from "@/lib/format";

// Discord calls this for the /link command and for RSVP button presses.
// Set it as the "Interactions Endpoint URL" in the Discord developer portal.

const EPHEMERAL = 64;

function reply(content: string, components?: unknown[]) {
  return NextResponse.json({ type: 4, data: { content, flags: EPHEMERAL, ...(components && { components }) } });
}

function linkReply(discordId: string, username: string, intro: string) {
  const url = discordLinkUrl(discordId, username);
  if (!url) return reply(`${intro} The team hub address isn't set up yet, ask an admin.`);
  return reply(`${intro} Open this link while logged in to the team hub. It works for an hour.`, [
    { type: 1, components: [{ type: 2, style: 5, label: "Link my account", url }] },
  ]);
}

export async function POST(req: Request) {
  if (!discordConfig().enabled) return NextResponse.json({ error: "Discord isn't set up." }, { status: 503 });

  const body = await req.text();
  if (!verifyDiscordRequest(body, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const interaction = JSON.parse(body);

  if (interaction.type === 1) return NextResponse.json({ type: 1 }); // Discord's endpoint check

  const discordUser = interaction.member?.user ?? interaction.user;
  if (!discordUser?.id) return reply("Something went wrong.");
  const discordId: string = discordUser.id;
  const username: string = discordUser.global_name || discordUser.username || "you";

  if (interaction.type === 2 && interaction.data?.name === "link") {
    const already = await prisma.user.findUnique({ where: { discordId }, select: { username: true } });
    return linkReply(
      discordId,
      username,
      already
        ? `This Discord is linked to **${already.username}**. To link a different account:`
        : "Let's link your account.",
    );
  }

  if (interaction.type === 3) {
    const [kind, eventId, status] = String(interaction.data?.custom_id ?? "").split(":");
    if (kind !== "rsvp" || !["GOING", "MAYBE", "DECLINED"].includes(status)) return reply("Unknown button.");

    const user = await prisma.user.findUnique({
      where: { discordId },
      select: { id: true, status: true, isPlayer: true, teamId: true },
    });
    if (!user) return linkReply(discordId, username, "Link your team hub account first, then press the button again.");
    if (user.status !== "APPROVED") return reply("Your team hub account isn't approved yet.");
    if (!user.isPlayer) return reply("Staff accounts don't RSVP.");

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true,
        endTime: true,
        rsvpOpen: true,
        forEveryone: true,
        audienceTeams: { select: { id: true } },
      },
    });
    if (!event) return reply("This event has been removed.");
    if (!event.forEveryone && !event.audienceTeams.some((t) => t.id === user.teamId)) {
      return reply("This event isn't for your team.");
    }
    if (new Date(event.endTime ?? event.startTime).getTime() < Date.now()) return reply("This event is over.");
    if (!event.rsvpOpen) return reply("RSVPs for this event open once the teams are confirmed.");

    await saveRsvp(event.id, event.type, user.id, status as RsvpChoice);
    return reply(`Got it: **${RSVP_LABEL[status]}** for ${event.title}.`);
  }

  return reply("Unknown command.");
}
