import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { RANKS } from "@/lib/ranks";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be 40 characters or fewer")
    // In-game names (Epic, PSN, Xbox, Steam) often include spaces, accents,
    // brackets, or other symbols — only block control characters.
    .regex(/^[^\x00-\x1F\x7F]+$/, "Username contains invalid characters"),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80),
  rlTrackerUrl: z.string().trim().url().optional().or(z.literal("")),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  rank1v1: z
    .enum(RANKS.map((r) => r.label) as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  rank2v2: z
    .enum(RANKS.map((r) => r.label) as [string, ...string[]])
    .optional()
    .or(z.literal("")),
  rank3v3: z
    .enum(RANKS.map((r) => r.label) as [string, ...string[]])
    .optional()
    .or(z.literal("")),
});

function rankValue(label: string | undefined): number | null {
  if (!label) return null;
  return RANKS.find((r) => r.label === label)?.value ?? null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const { username, email, password, displayName, rlTrackerUrl, platform, rank1v1, rank2v2, rank3v3 } =
    parsed.data;
  const normalizedUsername = username.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: normalizedUsername }, { email: normalizedEmail }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That username or email is already registered." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      displayName,
      rlTrackerUrl: rlTrackerUrl || null,
      platform: platform || null,
      rank1v1: rankValue(rank1v1),
      rank2v2: rankValue(rank2v2),
      rank3v3: rankValue(rank3v3),
      role: "PLAYER",
      status: "PENDING",
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "APPROVED" },
    select: { email: true },
  });
  for (const admin of admins) {
    void sendEmail(
      admin.email,
      "New tryout signup pending approval",
      `<p><strong>${displayName}</strong> (@${normalizedUsername}) just requested an account.</p>
       <p>Review it in the admin panel to approve and assign them to a team.</p>`
    );
  }

  return NextResponse.json({ ok: true });
}
