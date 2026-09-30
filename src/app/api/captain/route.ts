import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/session";
import { captainTeamFor } from "@/lib/captain";

// The team the signed-in user captains, or null.
export async function GET() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ team: null });
  return NextResponse.json({ team: await captainTeamFor(user) });
}
