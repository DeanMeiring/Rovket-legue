import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  role: z.enum(["ADMIN", "PLAYER"]).optional(),
  teamId: z.string().nullable().optional(),
  rlTrackerUrl: z.string().trim().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    include: { team: true },
  });

  if (parsed.data.status === "APPROVED" && before.status !== "APPROVED") {
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
