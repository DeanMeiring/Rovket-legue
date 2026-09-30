import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const schema = z.object({ captainId: z.string().nullable() });

// Pick (or clear) the team's captain. The captain must be an approved player on the team.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { captainId } = parsed.data;

  if (captainId) {
    const member = await prisma.user.findFirst({
      where: { id: captainId, teamId: params.id, status: "APPROVED" },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: "The captain has to be a player on this team." }, { status: 400 });
  }

  // One team per captain: moving the armband clears it from any other team.
  const team = await prisma.$transaction(async (tx) => {
    if (captainId) {
      await tx.team.updateMany({ where: { captainId, id: { not: params.id } }, data: { captainId: null } });
    }
    return tx.team.update({ where: { id: params.id }, data: { captainId } });
  });
  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.team.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
