import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { visibleEventsWhere } from "@/lib/eventAudience";
import { saveRsvp } from "@/lib/rsvp";

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

  const event = await prisma.event.findFirst({
    where: { id: params.id, ...(await visibleEventsWhere(user)) },
    select: { rsvpOpen: true, type: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!event.rsvpOpen) {
    return NextResponse.json({ error: "RSVPs for this event open once the teams are confirmed." }, { status: 403 });
  }

  const rsvp = await saveRsvp(params.id, event.type, user.id, parsed.data.status);
  return NextResponse.json(rsvp);
}
