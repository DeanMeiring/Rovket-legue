import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  colorHex: z.string().trim().max(20).optional().or(z.literal("")),
});

export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { members: { select: { id: true, displayName: true, username: true } } },
  });

  return NextResponse.json(teams);
}

export async function POST(req: Request) {
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

  const team = await prisma.team.create({
    data: { name: parsed.data.name, colorHex: parsed.data.colorHex || null },
  });

  return NextResponse.json(team, { status: 201 });
}
