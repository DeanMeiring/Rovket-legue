import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, . _ -"),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80),
  rlTrackerUrl: z.string().trim().url().optional().or(z.literal("")),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const { username, email, password, displayName, rlTrackerUrl, platform } = parsed.data;
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
