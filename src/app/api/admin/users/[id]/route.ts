import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isMainAdmin, requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { quietly, syncMemberRoles } from "@/lib/discord";
import { copyAccountRanksToBoard } from "@/lib/rankSync";

const schema = z.object({
  // Same rules as sign-up. Usernames are the login, so only a main admin changes them.
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be 40 characters or fewer")
    .regex(/^[^\x00-\x1F\x7F]+$/, "Username contains invalid characters")
    .transform((v) => v.toLowerCase())
    .optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  role: z.enum(["ADMIN", "PLAYER"]).optional(),
  isPlayer: z.boolean().optional(),
  notifySignups: z.boolean().optional(),
  isMainAdmin: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  rlTrackerUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Enter a full link, starting with https://")
    .transform((v) => v || null)
    .optional()
    .nullable(),
  rank1v1: z.number().int().min(0).max(3000).nullable().optional(),
  rank2v2: z.number().int().min(0).max(3000).nullable().optional(),
  rank3v3: z.number().int().min(0).max(3000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = { ...parsed.data };

  // Only a main admin may change who gets sign-up emails or who is a main
  // admin, or touch a main admin's account at all.
  const actingIsMain = await isMainAdmin(admin.id);
  if (!actingIsMain && (data.notifySignups !== undefined || data.isMainAdmin !== undefined || before.isMainAdmin)) {
    return NextResponse.json({ error: "Only the main admin can change that." }, { status: 403 });
  }
  if (data.username !== undefined && data.username !== before.username) {
    if (!actingIsMain) return NextResponse.json({ error: "Only the main admin can change usernames." }, { status: 403 });
    // The seed recreates the ADMIN_USERNAME account on every deploy, so renaming it would leave a copy behind.
    if (before.username === (process.env.ADMIN_USERNAME || "admin")) {
      return NextResponse.json(
        { error: "This login's username comes from ADMIN_USERNAME in Railway. Change it there." },
        { status: 400 }
      );
    }
    const taken = await prisma.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  if (data.isMainAdmin === false && params.id === admin.id) {
    return NextResponse.json({ error: "You can't remove your own main admin access." }, { status: 400 });
  }
  const isNewlyApproved = data.status === "APPROVED" && before.status !== "APPROVED";

  // Freshly-approved players with no team land in a default holding squad;
  // admins move them into 1st/2nd/3rd/4th team once tryouts wrap up.
  if (isNewlyApproved && !before.teamId && data.teamId === undefined) {
    const holdingTeam = await prisma.team.upsert({
      where: { name: "BC USSA" },
      update: {},
      create: { name: "BC USSA" },
    });
    data.teamId = holdingTeam.id;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    include: { team: true },
  });

  // Give or take away their team's Discord role.
  if (user.teamId !== before.teamId || user.status !== before.status) {
    void quietly("team role", () => syncMemberRoles(user.id));
  }

  // Tryout games are balanced from the board, so it follows rank changes here.
  if (data.rank2v2 !== undefined || data.rank3v3 !== undefined) {
    await copyAccountRanksToBoard(user.id, user);
  }

  // Keep the tryout board's copy of the tracker link in step.
  if (data.rlTrackerUrl !== undefined) {
    await prisma.tryoutPlayer.updateMany({ where: { userId: user.id }, data: { trackerUrl: user.rlTrackerUrl } });
  }

  if (isNewlyApproved) {
    void sendEmail(
      user.email,
      "You're approved! Welcome to the team hub",
      `<p>Hey ${user.displayName || user.username}, your account has been approved.</p>
       <p>Log in to see upcoming events${user.team ? ` for <strong>${user.team.name}</strong>` : ""} and start tracking your performance.</p>`
    );
  }

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json(safe);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { isMainAdmin: true } });
  if (target?.isMainAdmin && !(await isMainAdmin(admin.id))) {
    return NextResponse.json({ error: "Only the main admin can remove a main admin." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
