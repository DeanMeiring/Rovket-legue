import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isMainAdmin, requireAdmin } from "@/lib/session";

const schema = z.object({
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  // Otherwise any admin could take over the main admin's login.
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { isMainAdmin: true } });
  if (target?.isMainAdmin && params.id !== admin.id && !(await isMainAdmin(admin.id))) {
    return NextResponse.json({ error: "Only the main admin can reset a main admin's password." }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: params.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
