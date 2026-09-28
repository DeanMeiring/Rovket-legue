import { NextResponse } from "next/server";
import { z } from "zod";
import { loadTokenRsvp, saveRsvp } from "@/lib/rsvp";

// RSVP from an email link, without logging in. Opening the link only reads
// (GET); the answer is saved when the player presses a button (POST), so
// email scanners that follow links can't RSVP for anyone.

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const state = await loadTokenRsvp(params.token);
  if (!state.ok) return NextResponse.json({ error: state.error }, { status: 404 });
  return NextResponse.json(state);
}

const schema = z.object({ status: z.enum(["GOING", "MAYBE", "DECLINED"]) });

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const state = await loadTokenRsvp(params.token);
  if (!state.ok) return NextResponse.json({ error: state.error }, { status: 404 });
  if (!state.open) return NextResponse.json({ error: state.closedReason }, { status: 403 });

  await saveRsvp(state.event.id, state.event.type, state.player.id, parsed.data.status);
  return NextResponse.json({ status: parsed.data.status });
}
