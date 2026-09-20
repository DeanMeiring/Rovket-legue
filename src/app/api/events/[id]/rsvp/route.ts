import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

const schema = z.object({
  status: z.enum(["GOING", "MAYBE", "DECLINED"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: params.id, userId: user.id } },
    update: { status: parsed.data.status },
    create: { eventId: params.id, userId: user.id, status: parsed.data.status },
  });

  return NextResponse.json(rsvp);
}
