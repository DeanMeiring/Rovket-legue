import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { newAdminSchema } from "@/lib/adminSchema";
import { appButton, escapeHtml, sendEmail } from "@/lib/email";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { team: true },
  });

  return NextResponse.json(users);
}

// Creates an approved admin account straight away.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = newAdminSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const { displayName, password, isPlayer } = parsed.data;
  const username = parsed.data.username.toLowerCase();
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) {
    return NextResponse.json({ error: "That username or email is already registered." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      displayName,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      status: "APPROVED",
      isPlayer,
      profileCompleted: true,
    },
  });

  void sendEmail(
    email,
    "You've been added as an admin on the team hub",
    `<p>Hey ${escapeHtml(displayName)}, ${escapeHtml(admin.name || "an admin")} added you as an admin.</p>
     <p>Log in with the username <strong>${escapeHtml(username)}</strong> and the password they gave you. You can change it from your profile page.</p>
     ${appButton("/login", "Log in")}`
  );

  return NextResponse.json({ id: user.id }, { status: 201 });
}
