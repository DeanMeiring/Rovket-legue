import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { RANKS } from "@/lib/ranks";

const schema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  rlTrackerUrl: z.string().trim().url().optional().or(z.literal("")),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  discordTag: z.string().trim().max(60).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  rank: z
    .enum(RANKS.map((r) => r.label) as [string, ...string[]])
    .optional()
    .or(z.literal("")),
});

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
  const skillRating =
    data.rank !== undefined
      ? data.rank
        ? RANKS.find((r) => r.label === data.rank)?.value ?? null
        : null
      : undefined;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.rlTrackerUrl !== undefined && { rlTrackerUrl: data.rlTrackerUrl || null }),
      ...(data.platform !== undefined && { platform: data.platform || null }),
      ...(data.discordTag !== undefined && { discordTag: data.discordTag || null }),
      ...(data.bio !== undefined && { bio: data.bio || null }),
      ...(skillRating !== undefined && { skillRating }),
    },
  });

  return NextResponse.json(updated);
}
