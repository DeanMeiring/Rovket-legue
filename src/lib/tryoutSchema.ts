import { z } from "zod";

// Server-side validation for /api/admin/tryout-players.
export const tryoutPlayerSchema = z.object({
  tag: z.string().trim().min(1).max(60),
  name: z.string().trim().max(60).nullable().optional(),
  currentTeam: z.number().int().min(0).max(4).optional(),
  rank2v2: z.number().int().min(0).max(3000).nullable().optional(),
  rank3v3: z.number().int().min(0).max(3000).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
