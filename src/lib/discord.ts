import { createHmac, createPublicKey, timingSafeEqual, verify } from "crypto";
import { prisma } from "@/lib/prisma";
import { EVENT_TYPE_LABEL } from "@/lib/format";

// The BC Discord bot. It runs over Discord's HTTP API only: Discord calls
// /api/discord/interactions when someone presses a button or uses /link, and
// the app calls Discord to post events, ping reminders and manage team roles.
// Nothing here throws into the caller: if Discord is down or not set up, the
// website keeps working and the error is logged.
//
// Railway variables:
//   DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY (from the
//   Discord developer portal), DISCORD_GUILD_ID (the BC server) and
//   DISCORD_EVENTS_CHANNEL_ID (where events for everyone are posted).

// DISCORD_API_BASE is only for pointing tests at a fake Discord.
const API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";

export function discordConfig() {
  const c = {
    token: process.env.DISCORD_BOT_TOKEN,
    applicationId: process.env.DISCORD_APPLICATION_ID,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    guildId: process.env.DISCORD_GUILD_ID,
    eventsChannelId: process.env.DISCORD_EVENTS_CHANNEL_ID,
  };
  return { ...c, enabled: !!(c.token && c.applicationId && c.publicKey && c.guildId) };
}

export class DiscordError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T = unknown>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const { token } = discordConfig();
  if (!token) throw new DiscordError(0, "DISCORD_BOT_TOKEN isn't set.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && !retried) {
    const data = await res.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, Math.min(5000, (data.retry_after ?? 1) * 1000)));
    return api(method, path, body, true);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new DiscordError(res.status, `Discord ${method} ${path}: ${res.status} ${data.message ?? ""}`);
  return data as T;
}

// Runs a Discord side effect without letting it break the request that caused it.
export async function quietly(label: string, fn: () => Promise<unknown>) {
  if (!discordConfig().enabled) return;
  try {
    await fn();
  } catch (err) {
    console.error(`[discord] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

// Sends a private message from the bot. Fails when the player has closed DMs
// from server members, which the caller should treat as "not delivered".
export async function sendDirectMessage(discordId: string, content: string) {
  const dm = await api<{ id: string }>("POST", "/users/@me/channels", { recipient_id: discordId });
  await api("POST", `/channels/${dm.id}/messages`, { content: content.slice(0, 2000), allowed_mentions: { parse: [] } });
}

// ---- Request signatures ------------------------------------------------

// Discord signs every interaction with Ed25519; anything unsigned is rejected.
export function verifyDiscordRequest(body: string, signature: string | null, timestamp: string | null): boolean {
  const { publicKey } = discordConfig();
  if (!publicKey || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

// ---- Account linking ---------------------------------------------------

const LINK_TTL_MS = 60 * 60 * 1000;

function linkSig(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`discord-link:${payload}`).digest("base64url");
}

// A one-hour link that attaches this Discord account to whoever opens it while logged in.
export function discordLinkUrl(discordId: string, username: string): string | null {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "");
  if (!base) return null;
  const payload = Buffer.from(JSON.stringify({ d: discordId, u: username, e: Date.now() + LINK_TTL_MS })).toString(
    "base64url",
  );
  return `${base}/discord/link/${payload}.${linkSig(payload)}`;
}

export function readDiscordLinkToken(token: string): { discordId: string; username: string } | null {
  const [payload, sig, ...rest] = token.split(".");
  if (!payload || !sig || rest.length) return null;
  const expected = Buffer.from(linkSig(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.d !== "string" || typeof data.e !== "number" || data.e < Date.now()) return null;
    return { discordId: data.d, username: String(data.u ?? "") };
  } catch {
    return null;
  }
}

// ---- Slash commands ----------------------------------------------------

export async function registerCommands() {
  const { applicationId, guildId } = discordConfig();
  await api("PUT", `/applications/${applicationId}/guilds/${guildId}/commands`, [
    { name: "link", description: "Link your Discord to your RL Team Hub account", type: 1 },
  ]);
}

// ---- Team roles and channels -------------------------------------------

type DiscordChannel = { id: string; name: string; type: number; parent_id?: string | null };

// Permission bits, all small enough for plain numbers.
const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const READ_MESSAGE_HISTORY = 1 << 16;
const CONNECT = 1 << 20;
const SPEAK = 1 << 21;
const TEAM_ALLOW = String(VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | CONNECT | SPEAK);

// Where the first version put every team's channels. Removed once it's empty.
const OLD_SHARED_CATEGORY = "Team channels";

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "team"
  );
}

// Makes sure a team has its role plus its own private category holding a text
// and a voice channel that only that role (and server admins) can see. Safe to
// run again: it only creates what's missing, and moves channels made by the
// first version into the team's category.
export async function ensureTeamDiscord(teamId: string) {
  const { guildId, applicationId } = discordConfig();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return;

  const roles = await api<{ id: string }[]>("GET", `/guilds/${guildId}/roles`);
  let roleId = team.discordRoleId && roles.some((r) => r.id === team.discordRoleId) ? team.discordRoleId : null;
  if (!roleId) {
    const color = team.colorHex ? parseInt(team.colorHex.replace("#", ""), 16) : 0;
    const role = await api<{ id: string }>("POST", `/guilds/${guildId}/roles`, {
      name: team.name,
      mentionable: true,
      hoist: true,
      color: Number.isFinite(color) ? color : 0,
    });
    roleId = role.id;
  }

  const channels = await api<DiscordChannel[]>("GET", `/guilds/${guildId}/channels`);
  const overwrites = [
    { id: guildId, type: 0, allow: "0", deny: String(VIEW_CHANNEL) },
    { id: roleId, type: 0, allow: TEAM_ALLOW, deny: "0" },
    { id: applicationId, type: 1, allow: TEAM_ALLOW, deny: "0" },
  ];
  const find = (id: string | null) => (id ? channels.find((c) => c.id === id) : undefined);

  let categoryId = find(team.discordCategoryId)?.id ?? null;
  if (!categoryId) {
    const c = await api<DiscordChannel>("POST", `/guilds/${guildId}/channels`, {
      name: team.name,
      type: 4,
      permission_overwrites: overwrites,
    });
    categoryId = c.id;
  }

  const ensureChannel = async (existing: DiscordChannel | undefined, name: string, type: number) => {
    if (!existing) {
      const c = await api<DiscordChannel>("POST", `/guilds/${guildId}/channels`, {
        name,
        type,
        parent_id: categoryId,
        permission_overwrites: overwrites,
      });
      return c.id;
    }
    if (existing.parent_id !== categoryId)
      await api("PATCH", `/channels/${existing.id}`, { parent_id: categoryId, permission_overwrites: overwrites });
    return existing.id;
  };
  const textId = await ensureChannel(find(team.discordTextChannelId), slug(team.name), 0);
  const voiceId = await ensureChannel(find(team.discordVoiceChannelId), team.name, 2);

  await prisma.team.update({
    where: { id: team.id },
    data: {
      discordRoleId: roleId,
      discordCategoryId: categoryId,
      discordTextChannelId: textId,
      discordVoiceChannelId: voiceId,
    },
  });

  // Everyone already on the team gets the new role.
  const members = await prisma.user.findMany({
    where: { teamId: team.id, discordId: { not: null } },
    select: { id: true },
  });
  for (const m of members) await syncMemberRoles(m.id);
}

// Moves the team roles up to just under the bot's own role, so a player shows
// under their team in the member list and takes its colour, even when they
// also have other roles. "Team <number>" roles go first in number order, then
// the rest by name. Discord only lets the bot move roles below its own, so the
// bot's role has to sit near the top of the list for this to work.
export async function positionTeamRoles() {
  const { guildId, applicationId } = discordConfig();
  const teams = await prisma.team.findMany({
    where: { discordRoleId: { not: null } },
    select: { name: true, discordRoleId: true },
  });
  const teamNumber = (name: string) => {
    const m = name.match(/^team\s*(\d+)$/i);
    return m ? Number(m[1]) : Infinity;
  };
  teams.sort(
    (a, b) => teamNumber(a.name) - teamNumber(b.name) || a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const teamRoleIds = teams.map((t) => t.discordRoleId!);

  const [roles, me] = await Promise.all([
    api<{ id: string; position: number }[]>("GET", `/guilds/${guildId}/roles`),
    api<{ roles: string[] }>("GET", `/guilds/${guildId}/members/${applicationId}`),
  ]);
  const botTop = Math.max(0, ...roles.filter((r) => me.roles.includes(r.id)).map((r) => r.position));
  // Every role the bot may move, highest first, with @everyone (position 0) left out.
  const movable = roles
    .filter((r) => r.position > 0 && r.position < botTop)
    .sort((a, b) => b.position - a.position)
    .map((r) => r.id);
  const inTeamOrder = teamRoleIds.filter((id) => movable.includes(id));
  if (!inTeamOrder.length) return;
  const order = [...inTeamOrder, ...movable.filter((id) => !inTeamOrder.includes(id))];
  if (order.every((id, i) => id === movable[i])) return;
  await api(
    "PATCH",
    `/guilds/${guildId}/roles`,
    order.map((id, i) => ({ id, position: botTop - 1 - i })),
  );
}

// Deletes the shared "Team channels" category from the first version once
// every team's channels have moved out of it. Leaves it alone if anything is
// still inside.
export async function removeOldSharedCategory() {
  const { guildId } = discordConfig();
  const channels = await api<DiscordChannel[]>("GET", `/guilds/${guildId}/channels`);
  const old = channels.find((c) => c.type === 4 && c.name.toLowerCase() === OLD_SHARED_CATEGORY.toLowerCase());
  if (!old || channels.some((c) => c.parent_id === old.id)) return;
  await api("DELETE", `/channels/${old.id}`);
}

// Gives a linked player the Discord role of their team and takes away the
// roles of every other team. Only touches roles the bot made for teams.
// removeAll takes every team role away (used when they unlink).
export async function syncMemberRoles(userId: string, { removeAll = false } = {}) {
  const { guildId } = discordConfig();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true, teamId: true, status: true },
  });
  if (!user?.discordId) return;

  const teams = await prisma.team.findMany({
    where: { discordRoleId: { not: null } },
    select: { id: true, discordRoleId: true },
  });
  let member: { roles: string[] };
  try {
    member = await api<{ roles: string[] }>("GET", `/guilds/${guildId}/members/${user.discordId}`);
  } catch (err) {
    if (err instanceof DiscordError && err.status === 404) return; // not in the server
    throw err;
  }

  for (const t of teams) {
    const should = !removeAll && user.status === "APPROVED" && t.id === user.teamId;
    const has = member.roles.includes(t.discordRoleId!);
    if (should && !has) await api("PUT", `/guilds/${guildId}/members/${user.discordId}/roles/${t.discordRoleId}`);
    if (!should && has) await api("DELETE", `/guilds/${guildId}/members/${user.discordId}/roles/${t.discordRoleId}`);
  }
}

// ---- Event posts -------------------------------------------------------

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

export const RSVP_BUTTONS = [
  { status: "GOING", label: "Going", style: 3 },
  { status: "MAYBE", label: "Maybe", style: 2 },
  { status: "DECLINED", label: "Can't make it", style: 4 },
] as const;

async function eventMessage(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { audienceTeams: { select: { name: true } }, rsvps: { select: { status: true } } },
  });
  if (!event) return null;
  const count = (s: string) => event.rsvps.filter((r) => r.status === s).length;
  const over = new Date(event.endTime ?? event.startTime).getTime() < Date.now();
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "");

  // <t:…> timestamps show in each reader's own timezone.
  const when = event.endTime
    ? `<t:${unix(event.startTime)}:F> to <t:${unix(event.endTime)}:${sameDay(event.startTime, event.endTime) ? "t" : "F"}>`
    : `<t:${unix(event.startTime)}:F> (<t:${unix(event.startTime)}:R>)`;
  const lines = [
    `**When:** ${when}`,
    event.location && `**Where:** ${event.location}`,
    !event.forEveryone && `**For:** ${event.audienceTeams.map((t) => t.name).join(", ")}`,
    event.description,
    "",
    `✅ ${count("GOING")} going · 🤔 ${count("MAYBE")} maybe · ❌ ${count("DECLINED")} can't`,
    !event.rsvpOpen && !over && "_RSVPs open once the teams are confirmed._",
  ].filter((l) => l !== false && l !== null && l !== undefined);

  const buttons =
    event.rsvpOpen && !over
      ? RSVP_BUTTONS.map((b) => ({
          type: 2,
          style: b.style,
          label: b.label,
          custom_id: `rsvp:${event.id}:${b.status}`,
        }))
      : [];
  if (base) buttons.push({ type: 2, style: 5, label: "Open in team hub", url: `${base}/events/${event.id}` } as never);

  return {
    event,
    body: {
      embeds: [
        {
          title: `${EVENT_TYPE_LABEL[event.type] ?? event.type}: ${event.title}`.slice(0, 256),
          description: lines.join("\n").slice(0, 4000),
          color: 0xff8a00,
        },
      ],
      components: buttons.length ? [{ type: 1, components: buttons }] : [],
    },
  };
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// The server's "Players" role, pinged on events for everyone. Found by name,
// so renaming the role in Discord stops the ping until it's named back.
async function playersRoleId(): Promise<string | null> {
  const { guildId } = discordConfig();
  const roles = await api<{ id: string; name: string }[]>("GET", `/guilds/${guildId}/roles`);
  return roles.find((r) => r.name.trim().toLowerCase() === "players")?.id ?? null;
}

// Posts a new event: team events go to each team's own channel (pinging the
// team role), events for everyone go to DISCORD_EVENTS_CHANNEL_ID.
// resend swaps the earlier posts for fresh ones, so there's only ever one set
// of RSVP buttons. mentionUserIds pings those players (by Discord id) instead
// of the team roles, for a nudge to people who haven't replied.
export async function announceEvent(
  eventId: string,
  { resend = false, mentionUserIds }: { resend?: boolean; mentionUserIds?: string[] } = {},
): Promise<number> {
  const { eventsChannelId } = discordConfig();
  const msg = await eventMessage(eventId);
  if (!msg) return 0;
  const { event, body } = msg;

  if (resend) {
    await deleteEventMessages(event.id);
    await prisma.eventDiscordMessage.deleteMany({ where: { eventId: event.id } });
  }

  const teams = event.forEveryone
    ? []
    : await prisma.team.findMany({
        where: { events: { some: { id: event.id } } },
        select: { discordRoleId: true, discordTextChannelId: true },
      });

  const targets: { channelId: string; roleIds: string[] }[] = [];
  if (event.forEveryone) {
    if (eventsChannelId) {
      const players = await playersRoleId();
      targets.push({ channelId: eventsChannelId, roleIds: players ? [players] : [] });
    }
  } else {
    const leftover: string[] = [];
    for (const t of teams) {
      if (t.discordTextChannelId)
        targets.push({ channelId: t.discordTextChannelId, roleIds: t.discordRoleId ? [t.discordRoleId] : [] });
      else if (t.discordRoleId) leftover.push(t.discordRoleId);
    }
    // Teams without their own channel yet are pinged in the main events channel.
    if (eventsChannelId && (leftover.length || !targets.length))
      targets.push({ channelId: eventsChannelId, roleIds: leftover });
  }

  const heading = resend ? "Reminder" : "New event";
  for (const t of targets) {
    let content: string;
    let allowed: { roles?: string[]; users?: string[] };
    if (mentionUserIds) {
      // Discord allows at most 100 mentions per message.
      const users = mentionUserIds.slice(0, 100);
      content = users.length
        ? `${heading}, still waiting on your answer: ${users.map((u) => `<@${u}>`).join(" ")}`.slice(0, 2000)
        : `${heading} 📅`;
      allowed = { users };
    } else {
      content = t.roleIds.length ? `${heading} for ${t.roleIds.map((r) => `<@&${r}>`).join(" ")}` : `${heading} 📅`;
      allowed = { roles: t.roleIds };
    }
    const sent = await api<{ id: string }>("POST", `/channels/${t.channelId}/messages`, {
      ...body,
      content,
      allowed_mentions: allowed,
    });
    await prisma.eventDiscordMessage.create({
      data: { eventId: event.id, channelId: t.channelId, messageId: sent.id },
    });
  }
  return targets.length;
}

// Re-draws every post of an event (new counts, edits, RSVPs opening).
export async function refreshEventMessages(eventId: string) {
  const posts = await prisma.eventDiscordMessage.findMany({ where: { eventId } });
  if (!posts.length) return;
  const msg = await eventMessage(eventId);
  if (!msg) return;
  for (const p of posts) {
    try {
      await api("PATCH", `/channels/${p.channelId}/messages/${p.messageId}`, msg.body);
    } catch (err) {
      if (err instanceof DiscordError && err.status === 404) {
        await prisma.eventDiscordMessage.delete({ where: { id: p.id } });
      } else throw err;
    }
  }
}

// Removes the posts before an event is deleted.
export async function deleteEventMessages(eventId: string) {
  const posts = await prisma.eventDiscordMessage.findMany({ where: { eventId } });
  for (const p of posts) {
    await api("DELETE", `/channels/${p.channelId}/messages/${p.messageId}`).catch(() => undefined);
  }
}

// ---- Reminders ---------------------------------------------------------

const REMINDER_LEAD_MS = 60 * 60 * 1000;

// About an hour before each event, posts a reminder where the event was
// announced, pinging the linked players who said Going or Maybe. When none of
// them have linked Discord, a team event pings its team roles instead.
export async function sendDiscordReminders() {
  const { eventsChannelId } = discordConfig();
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { startTime: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) }, discordReminderSentAt: null },
    include: {
      discordMessages: true,
      audienceTeams: { select: { discordRoleId: true, discordTextChannelId: true } },
      rsvps: {
        where: { status: { in: ["GOING", "MAYBE"] } },
        select: { status: true, user: { select: { discordId: true, displayName: true, username: true } } },
      },
    },
  });

  for (const event of events) {
    // Claim it first so a slow Discord call can't double-ping on the next run.
    const claimed = await prisma.event.updateMany({
      where: { id: event.id, discordReminderSentAt: null },
      data: { discordReminderSentAt: now },
    });
    if (!claimed.count) continue;

    const channelIds = new Set(event.discordMessages.map((m) => m.channelId));
    if (!channelIds.size) {
      for (const t of event.audienceTeams) if (t.discordTextChannelId) channelIds.add(t.discordTextChannelId);
      if (!channelIds.size && eventsChannelId) channelIds.add(eventsChannelId);
    }
    if (!channelIds.size) continue;

    const people = event.rsvps.filter((r) => r.user.discordId).map((r) => r.user.discordId!);
    const roles = event.forEveryone
      ? []
      : event.audienceTeams.flatMap((t) => (t.discordRoleId ? [t.discordRoleId] : []));
    const mentions = people.length ? people.map((id) => `<@${id}>`).join(" ") : roles.map((r) => `<@&${r}>`).join(" ");
    const content = [
      `⏰ **${event.title}** starts <t:${unix(event.startTime)}:R> (<t:${unix(event.startTime)}:t>).`,
      event.location && `📍 ${event.location}`,
      mentions,
    ]
      .filter(Boolean)
      .join("\n");

    for (const channelId of Array.from(channelIds)) {
      await quietly(`reminder for ${event.id}`, () =>
        api("POST", `/channels/${channelId}/messages`, {
          content: content.slice(0, 2000),
          allowed_mentions: { users: people.slice(0, 100), roles: people.length ? [] : roles },
        }),
      );
    }
  }
  return events.length;
}
