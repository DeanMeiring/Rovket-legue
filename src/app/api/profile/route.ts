import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { RANKS } from "@/lib/ranks";
import { copyAccountRanksToBoard } from "@/lib/rankSync";

const rankField = z
  .enum(RANKS.map((r) => r.label) as [string, ...string[]])
  .optional()
  .or(z.literal(""));

const schema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  rlTrackerUrl: z.string().trim().url().optional().or(z.literal("")),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  discordTag: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  rank1v1: rankField,
  rank2v2: rankField,
  rank3v3: rankField,
  // Precise numeric values (Tier+SubRank+Division), used by the profile
  // completion flow — bypasses the coarse label mapping above.
  rank1v1Value: z.number().int().min(0).max(3000).nullable().optional(),
  rank2v2Value: z.number().int().min(0).max(3000).nullable().optional(),
  rank3v3Value: z.number().int().min(0).max(3000).nullable().optional(),
  profileCompleted: z.boolean().optional(),
});

function rankValue(label: string | undefined): number | null {
  if (!label) return null;
  return RANKS.find((r) => r.label === label)?.value ?? null;
}

export async function PATCH(req: Request) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.rlTrackerUrl !== undefined && { rlTrackerUrl: data.rlTrackerUrl || null }),
      ...(data.platform !== undefined && { platform: data.platform || null }),
      ...(data.discordTag !== undefined && { discordTag: data.discordTag || null }),
      ...(data.bio !== undefined && { bio: data.bio || null }),
      ...(data.rank1v1 !== undefined && { rank1v1: rankValue(data.rank1v1) }),
      ...(data.rank2v2 !== undefined && { rank2v2: rankValue(data.rank2v2) }),
      ...(data.rank3v3 !== undefined && { rank3v3: rankValue(data.rank3v3) }),
      ...(data.rank1v1Value !== undefined && { rank1v1: data.rank1v1Value }),
      ...(data.rank2v2Value !== undefined && { rank2v2: data.rank2v2Value }),
      ...(data.rank3v3Value !== undefined && { rank3v3: data.rank3v3Value }),
      ...(data.profileCompleted !== undefined && { profileCompleted: data.profileCompleted }),
    },
  });

  // Tryout games are balanced from the board, so it follows rank changes here.
  await copyAccountRanksToBoard(updated.id, updated);

  return NextResponse.json(updated);
}
