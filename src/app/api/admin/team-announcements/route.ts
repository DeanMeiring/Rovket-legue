import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { sendTeamAnnouncements, teamAnnouncementRows } from "@/lib/teamAnnouncement";

// Who has been told which team they made, and the message each would get.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ players: await teamAnnouncementRows() });
}

const schema = z.object({ userIds: z.array(z.string()).min(1).max(200) });

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick at least one player." }, { status: 400 });
  return NextResponse.json(await sendTeamAnnouncements(parsed.data.userIds));
}
