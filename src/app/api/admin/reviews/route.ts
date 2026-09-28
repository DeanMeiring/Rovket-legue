import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ReviewError, writeReview } from "@/lib/playerReview";

// The newest review for a player, draft or published.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing player." }, { status: 400 });
  const review = await prisma.playerReview.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ review });
}

// Writes a new draft review. Players don't see it until it's published.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing player." }, { status: 400 });
  try {
    const review = await writeReview(parsed.data.userId);
    return NextResponse.json({ review });
  } catch (err) {
    if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
