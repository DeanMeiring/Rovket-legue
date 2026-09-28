import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { BallchasingReplay, fetchReplay, listGroupReplays, parseBallchasingLink } from "@/lib/ballchasing";

const schema = z.object({
  replayUrl: z.string().trim().min(1),
});

// Ballchasing allows about two requests a second on a free key.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a ballchasing.com replay or group link." }, { status: 400 });
  }

  const link = parseBallchasingLink(parsed.data.replayUrl);
  if (!link) {
    return NextResponse.json({ error: "That doesn't look like a ballchasing.com replay or group link." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  let replayIds: string[];
  try {
    replayIds = link.kind === "group" ? (await listGroupReplays(link.id)).map((r) => r.id) : [link.id];
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to read the group." }, { status: 502 });
  }
  if (!replayIds.length) {
    return NextResponse.json({ error: "That group has no replays in it yet." }, { status: 400 });
  }

  // Replays already imported for this event are skipped, so a group can be
  // imported again after more replays are added to it.
  const done = new Set(
    (
      await prisma.performance.findMany({
        where: { eventId: event.id, replayId: { in: replayIds } },
        select: { replayId: true },
      })
    ).map((p) => p.replayId),
  );

  const users = await prisma.user.findMany({
    where: { status: "APPROVED", isPlayer: true },
    select: { id: true, username: true, displayName: true, tryoutEntry: { select: { tag: true } } },
  });

  function findUser(name: string) {
    const lower = name.trim().toLowerCase();
    return users.find(
      (u) =>
        u.username.toLowerCase() === lower ||
        u.displayName?.toLowerCase() === lower ||
        u.tryoutEntry?.tag.toLowerCase() === lower,
    );
  }

  const imported = new Set<string>();
  const unmatched = new Set<string>();
  let games = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const [i, replayId] of replayIds.entries()) {
    if (done.has(replayId)) {
      skipped++;
      continue;
    }
    if (i > 0 && link.kind === "group") await wait(600);

    let replay: BallchasingReplay;
    try {
      replay = await fetchReplay(replayId);
    } catch (err) {
      if (link.kind === "replay") {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch replay." }, { status: 502 });
      }
      failed.push(replayId);
      continue;
    }
    if (replay.status && replay.status !== "ok") {
      if (link.kind === "replay") {
        return NextResponse.json(
          { error: "Ballchasing is still processing that replay. Try again in a minute." },
          { status: 409 },
        );
      }
      failed.push(replay.title || replayId);
      continue;
    }

    const blueGoals = replay.blue?.goals ?? 0;
    const orangeGoals = replay.orange?.goals ?? 0;
    const teams = [
      { players: replay.blue?.players || [], won: blueGoals > orangeGoals },
      { players: replay.orange?.players || [], won: orangeGoals > blueGoals },
    ];

    const rows = [];
    for (const team of teams) {
      for (const p of team.players) {
        const user = findUser(p.name);
        if (!user) {
          unmatched.add(p.name);
          continue;
        }
        const core = p.stats?.core || {};
        rows.push({
          eventId: event.id,
          userId: user.id,
          replayId,
          goals: core.goals ?? 0,
          assists: core.assists ?? 0,
          saves: core.saves ?? 0,
          shots: core.shots ?? 0,
          score: core.score ?? 0,
          mvp: !!core.mvp,
          win: team.won,
        });
        imported.add(user.displayName || user.username);
      }
    }
    await prisma.performance.createMany({ data: rows, skipDuplicates: true });
    games++;
  }

  if (link.kind === "replay" && skipped) {
    return NextResponse.json({ error: "That replay is already imported for this event." }, { status: 409 });
  }

  return NextResponse.json({
    imported: [...imported],
    unmatched: [...unmatched],
    games,
    skipped,
    failed,
  });
}
