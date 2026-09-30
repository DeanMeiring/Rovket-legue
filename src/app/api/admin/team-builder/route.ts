import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { loadScouting } from "@/lib/scouting";
import { cleanSlots, defaultSlots, saveDraft, tryoutPool } from "@/lib/teamBuilder";

// Saves the shared line-up after an admin moves or swaps players.
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const s = await loadScouting("tryout");
  const slots = cleanSlots(body?.slots, new Set(tryoutPool(s)));
  await saveDraft(slots);
  return NextResponse.json({ slots });
}

// Starts again from the tryout board's current teams.
export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slots = defaultSlots(await loadScouting("tryout"));
  await saveDraft(slots);
  return NextResponse.json({ slots });
}
