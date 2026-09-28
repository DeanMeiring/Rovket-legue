import { z } from "zod";

// Weekly availability is stored as "<day>-<block>" keys, e.g. "mon-evening".
// Times are the club's local time.

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export const BLOCKS = [
  {
    key: "morning",
    label: "Morning",
    hours: "08:00 to 12:00",
    start: 8,
    end: 12,
  },
  {
    key: "afternoon",
    label: "Afternoon",
    hours: "12:00 to 17:00",
    start: 12,
    end: 17,
  },
  {
    key: "evening",
    label: "Evening",
    hours: "17:00 to 20:00",
    start: 17,
    end: 20,
  },
  { key: "night", label: "Night", hours: "20:00 to 00:00", start: 20, end: 24 },
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
