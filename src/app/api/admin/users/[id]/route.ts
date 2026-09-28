import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  role: z.enum(["ADMIN", "PLAYER"]).optional(),
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

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
