import { z } from "zod";

// Weekly availability is stored as "<day>-<block>" keys, e.g. "mon-evening".
// Times are the club's local time.

export const DAYS = [
  { key: "mon", label: "Mon", short: "M" },
  { key: "tue", label: "Tue", short: "T" },
  { key: "wed", label: "Wed", short: "W" },
  { key: "thu", label: "Thu", short: "T" },
  { key: "fri", label: "Fri", short: "F" },
  { key: "sat", label: "Sat", short: "S" },
  { key: "sun", label: "Sun", short: "S" },
] as const;

export const BLOCKS = [
  {
    key: "morning",
    label: "Morning",
    hours: "08:00 to 12:00",
    hoursShort: "08-12",
    start: 8,
    end: 12,
  },
  {
    key: "afternoon",
    label: "Afternoon",
    hours: "12:00 to 17:00",
    hoursShort: "12-17",
    start: 12,
    end: 17,
  },
  {
    key: "evening",
    label: "Evening",
    hours: "17:00 to 20:00",
    hoursShort: "17-20",
    start: 17,
    end: 20,
  },
  { key: "night", label: "Night", hours: "20:00 to 00:00", hoursShort: "20-24", start: 20, end: 24 },
] as const;

export const ALL_SLOTS: string[] = DAYS.flatMap((d) => BLOCKS.map((b) => `${d.key}-${b.key}`));

export function slotKey(day: string, block: string) {
  return `${day}-${block}`;
}

// The slot a moment in time falls in, or null before 08:00.
export function slotFor(date: Date): string | null {
  const day = DAYS[(date.getDay() + 6) % 7].key; // getDay() is 0 for Sunday
  const hour = date.getHours();
  const block = BLOCKS.find((b) => hour >= b.start && hour < b.end);
  return block ? slotKey(day, block.key) : null;
}

export const availabilitySchema = z.object({
  slots: z
    .array(z.string())
    .max(ALL_SLOTS.length)
    .refine((s) => s.every((k) => ALL_SLOTS.includes(k)), "Unknown time slot."),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
