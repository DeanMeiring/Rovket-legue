import { prisma } from "@/lib/prisma";

// Event types a captain may schedule for their own team.
export const CAPTAIN_EVENT_TYPES = ["PRACTICE", "SCRIM", "MATCH", "TOURNAMENT"] as const;
export type CaptainEventType = (typeof CAPTAIN_EVENT_TYPES)[number];

// The team this user captains, if any. Only approved accounts count.
export async function captainTeamFor(user: { id: string; status?: string } | null) {
  if (!user || (user.status && user.status !== "APPROVED")) return null;
  return prisma.team.findUnique({ where: { captainId: user.id }, select: { id: true, name: true } });
}

// A captain manages an event they created that is only for their own team.
// Admins manage every event.
export async function canManageEvent(
  user: { id: string; role: string; status?: string } | null,
  eventId: string,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN" && user.status === "APPROVED") return true;
  const team = await captainTeamFor(user);
  if (!team) return false;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdById: true, forEveryone: true, audienceTeams: { select: { id: true } } },
  });
  return (
    !!event &&
    event.createdById === user.id &&
    !event.forEveryone &&
    event.audienceTeams.length === 1 &&
    event.audienceTeams[0].id === team.id
  );
}

// South Africa has no daylight saving, so a club day is always UTC+2.
const SA_OFFSET_MS = 2 * 60 * 60 * 1000;

export function saDayBounds(when: Date) {
  const local = new Date(when.getTime() + SA_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - SA_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

// Captains may schedule one event per day for their team. Returns the clashing
// event's title, or null when the day is free.
export async function captainDayTaken(
  captainId: string,
  teamId: string,
  startTime: Date,
  ignoreEventId?: string,
): Promise<string | null> {
  const { start, end } = saDayBounds(startTime);
  const clash = await prisma.event.findFirst({
    where: {
      createdById: captainId,
      audienceTeams: { some: { id: teamId } },
      startTime: { gte: start, lt: end },
      ...(ignoreEventId && { id: { not: ignoreEventId } }),
    },
    select: { title: true },
  });
  return clash?.title ?? null;
}
