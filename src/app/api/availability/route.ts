import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { availabilitySchema } from "@/lib/availability";

export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.playerAvailability.findUnique({
    where: { userId: user.id },
  });
  return NextResponse.json(row ?? { slots: [], note: null, updatedAt: null });
}

export async function PUT(req: Request) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = availabilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const slots = Array.from(new Set(parsed.data.slots));
  const note = parsed.data.note || null;
  const row = await prisma.playerAvailability.upsert({
    where: { userId: user.id },
    update: { slots, note },
    create: { userId: user.id, slots, note },
  });
  return NextResponse.json(row);
}
