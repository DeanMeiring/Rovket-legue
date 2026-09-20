import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireApprovedUser } from "@/lib/session";

const schema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1).optional().or(z.literal("")),
  goals: z.coerce.number().int().min(0).default(0),
  assists: z.coerce.number().int().min(0).default(0),
  saves: z.coerce.number().int().min(0).default(0),
  shots: z.coerce.number().int().min(0).default(0),
  score: z.coerce.number().int().min(0).default(0),
  mvp: z.boolean().default(false),
  win: z.boolean().optional().nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function GET(req: Request) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || user.id;

  // Non-admins can only view their own performance.
  if (userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const performances = await prisma.performance.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { event: true },
  });

  return NextResponse.json(performances);
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

  const { userId, eventId, ...stats } = parsed.data;

  const performance = await prisma.performance.create({
    data: {
      userId,
      eventId: eventId || null,
      ...stats,
      notes: stats.notes || null,
    },
  });

  return NextResponse.json(performance, { status: 201 });
}
