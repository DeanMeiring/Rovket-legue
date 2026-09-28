import { format, isSameDay, isSameYear } from "date-fns";

export const EVENT_TYPE_LABEL: Record<string, string> = {
  TRYOUT: "Tryout",
  SCRIM: "Scrim",
  MATCH: "Match",
  TOURNAMENT: "Tournament",
  PRACTICE: "Practice",
  MEETING: "Meeting",
  OTHER: "Other",
};

export const EVENT_TYPE_COLOR: Record<string, string> = {
  TRYOUT: "bg-purple-500/20 text-purple-300",
  SCRIM: "bg-accent2/20 text-accent2",
  MATCH: "bg-accent/20 text-accent",
  TOURNAMENT: "bg-yellow-500/20 text-yellow-300",
  PRACTICE: "bg-green-500/20 text-green-300",
  MEETING: "bg-slate-500/20 text-slate-300",
  OTHER: "bg-slate-500/20 text-slate-300",
};

export const RSVP_LABEL: Record<string, string> = {
  PENDING: "No response",
  GOING: "Going",
  MAYBE: "Maybe",
  DECLINED: "Declined",
};

export const RSVP_COLOR: Record<string, string> = {
  PENDING: "bg-slate-500/20 text-slate-300",
  GOING: "bg-green-500/20 text-green-300",
  MAYBE: "bg-yellow-500/20 text-yellow-300",
  DECLINED: "bg-red-500/20 text-red-300",
};

// "Saturday 5 Dec 2026, 10:00", plus the end when there is one: a time on
// the same day, or the full end date for multi-day events like tournaments.
export function formatEventWhen(start: Date | string, end?: Date | string | null): string {
  const s = new Date(start);
  const from = format(s, "EEEE d MMM yyyy, HH:mm");
  if (!end) return from;
  const e = new Date(end);
  if (isSameDay(s, e)) return `${from} to ${format(e, "HH:mm")}`;
  const fromShort = format(s, isSameYear(s, e) ? "EEE d MMM, HH:mm" : "EEE d MMM yyyy, HH:mm");
  return `${fromShort} to ${format(e, "EEE d MMM yyyy, HH:mm")}`;
}

// An event counts as finished once its end (or start, if it has no end) is past.
export function eventIsOver(start: Date | string, end?: Date | string | null): boolean {
  return new Date(end ?? start).getTime() < Date.now();
}

// "Everyone" or the names of the teams an event is for.
export function audienceLabel(event: { forEveryone: boolean; audienceTeams?: { name: string }[] }) {
  if (event.forEveryone) return "Everyone";
  const names = (event.audienceTeams ?? []).map((t) => t.name);
  return names.length ? names.join(", ") : "No team";
}

// "Michael (medicmike)": the display name with the gamertag they log in with,
// so two players with the same name can be told apart.
export function nameWithTag(u: { displayName?: string | null; username: string }): string {
  const name = u.displayName?.trim();
  return name && name.toLowerCase() !== u.username.toLowerCase() ? `${name} (${u.username})` : u.username;
}
