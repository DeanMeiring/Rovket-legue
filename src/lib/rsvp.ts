import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { quietly, refreshEventMessages, syncMemberRoles } from "@/lib/discord";

export type RsvpChoice = "GOING" | "MAYBE" | "DECLINED";

// Saves a player's RSVP, and for tryouts keeps the "Tryouts" team in step.
export async function saveRsvp(eventId: string, eventType: string, userId: string, status: RsvpChoice) {
  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status },
    create: { eventId, userId, status },
  });
  if (eventType === "TRYOUT") await syncTryoutsTeam(userId, status);
  // Update the counts on the event's Discord posts.
  void quietly("refresh event posts", () => refreshEventMessages(eventId));
  return rsvp;
}

const TRYOUTS_TEAM = "Tryouts";
const HOLDING_TEAM = "BC USSA"; // where newly approved players land

// Saying Going to a tryout puts a player in the "Tryouts" team, but only if
// they have no team yet or are still in the holding team: players already on
// a real team keep it. Declining moves them back out of Tryouts.
async function syncTryoutsTeam(userId: string, status: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlayer: true, team: { select: { name: true } } },
  });
  if (!user?.isPlayer) return;
  const current = user.team?.name ?? null;

  if (status === "GOING" && (current === null || current === HOLDING_TEAM)) {
    const team = await prisma.team.upsert({
      where: { name: TRYOUTS_TEAM },
      update: {},
      create: { name: TRYOUTS_TEAM },
    });
    await prisma.user.update({ where: { id: userId }, data: { teamId: team.id } });
    void quietly("team role", () => syncMemberRoles(userId));
  } else if (status === "DECLINED" && current === TRYOUTS_TEAM) {
    const team = await prisma.team.upsert({
      where: { name: HOLDING_TEAM },
      update: {},
      create: { name: HOLDING_TEAM },
    });
    await prisma.user.update({ where: { id: userId }, data: { teamId: team.id } });
    void quietly("team role", () => syncMemberRoles(userId));
  }
}

// Email RSVP links carry "<eventId>.<userId>.<signature>", signed with
// NEXTAUTH_SECRET, so a link only works for the player it was sent to.
function sign(eventId: string, userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`rsvp:${eventId}:${userId}`).digest("base64url");
}

export function rsvpToken(eventId: string, userId: string): string {
  return `${eventId}.${userId}.${sign(eventId, userId)}`;
}

export function readRsvpToken(token: string): { eventId: string; userId: string } | null {
  const [eventId, userId, sig, ...rest] = token.split(".");
  if (!eventId || !userId || !sig || rest.length) return null;
  const expected = Buffer.from(sign(eventId, userId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { eventId, userId };
}

export type TokenRsvpState =
  | { ok: false; error: string }
  | {
      ok: true;
      event: {
        id: string;
        title: string;
        type: string;
        startTime: Date;
        endTime: Date | null;
        location: string | null;
      };
      player: { id: string; name: string };
      current: string | null;
      open: boolean;
      closedReason: string | null;
    };

// Everything the email RSVP page needs, checked the same way as a logged-in RSVP:
// the player must still be approved and still be in the event's audience.
export async function loadTokenRsvp(token: string): Promise<TokenRsvpState> {
  const ids = readRsvpToken(token);
  if (!ids) return { ok: false, error: "This RSVP link isn't valid." };

  const [event, player] = await Promise.all([
    prisma.event.findUnique({
      where: { id: ids.eventId },
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true,
        endTime: true,
        location: true,
        rsvpOpen: true,
        forEveryone: true,
        audienceTeams: { select: { id: true } },
        rsvps: { where: { userId: ids.userId }, select: { status: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: ids.userId },
      select: { id: true, status: true, isPlayer: true, teamId: true, displayName: true, username: true },
    }),
  ]);
  if (!event) return { ok: false, error: "This event has been removed." };
  if (!player || player.status !== "APPROVED" || !player.isPlayer) {
    return { ok: false, error: "This RSVP link isn't valid any more." };
  }
  const inAudience = event.forEveryone || event.audienceTeams.some((t) => t.id === player.teamId);
  if (!inAudience) return { ok: false, error: "This event is no longer set for your team." };

  const over = new Date(event.endTime ?? event.startTime).getTime() < Date.now();
  const closedReason = over
    ? "This event is over."
    : !event.rsvpOpen
      ? "RSVPs for this event open once the teams are confirmed."
      : null;

  return {
    ok: true,
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
    },
    player: { id: player.id, name: player.displayName || player.username },
    current: event.rsvps[0]?.status ?? null,
    open: !closedReason,
    closedReason,
  };
}

// Going / Maybe / Can't make it buttons for an event email. Each opens the RSVP
// page for this player, which asks them to confirm. Needs NEXTAUTH_URL.
export function rsvpEmailButtons(eventId: string, userId: string): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "");
  if (!base || !process.env.NEXTAUTH_SECRET) return "<p>Log in to the team hub to RSVP.</p>";
  const url = `${base}/rsvp/${rsvpToken(eventId, userId)}`;
  const button = (status: string, label: string, bg: string) =>
    `<a href="${url}?s=${status}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 18px;background:${bg};color:#111;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a>`;
  return `<p><strong>Are you coming?</strong></p><p>${button("GOING", "Going", "#4ade80")}${button(
    "MAYBE",
    "Maybe",
    "#facc15",
  )}${button("DECLINED", "Can&#39;t make it", "#f87171")}</p>`;
}
