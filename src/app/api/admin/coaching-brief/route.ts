import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ReviewError, coachingBrief } from "@/lib/playerReview";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brief = await prisma.coachingBrief.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ brief });
}

// Re-runs the web research that every player review is based on.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ brief: await coachingBrief(true) });
  } catch (err) {
    if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
