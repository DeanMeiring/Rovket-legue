import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  text: z.string().trim().min(1).max(20000).optional(),
  published: z.boolean().optional(),
});

// Edit a review's text, or publish it to (or hide it from) the player.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const review = await prisma.playerReview.update({ where: { id: params.id }, data: parsed.data }).catch(() => null);
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  return NextResponse.json({ review });
}
