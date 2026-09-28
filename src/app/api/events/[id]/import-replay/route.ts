import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { BallchasingReplay, fetchReplay, teamGoals, listGroupReplays, parseBallchasingLink } from "@/lib/ballchasing";

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
      await prisma.eventReplay.findMany({
        where: { eventId: event.id, replayId: { in: replayIds } },
        select: { replayId: true },
      })
    ).map((r) => r.replayId),
  );
  // Games imported before the detailed stats were kept, or before wins were
  // read correctly (every game has a winner), get fetched again to fix them.
  const [missingStats, withWinner, pendingWinner] = await Promise.all([
    prisma.performance.findMany({
      where: { eventId: event.id, replayId: { in: replayIds }, stats: { equals: Prisma.DbNull } },
      select: { replayId: true },
      distinct: ["replayId"],
    }),
    prisma.performance.findMany({
      where: { eventId: event.id, replayId: { in: replayIds }, win: true },
      select: { replayId: true },
      distinct: ["replayId"],
    }),
    prisma.pendingPerformance.findMany({
      where: { eventId: event.id, replayId: { in: replayIds }, win: true },
      select: { replayId: true },
      distinct: ["replayId"],
    }),
  ]);
  const hasWinner = new Set([...withWinner, ...pendingWinner].map((r) => r.replayId));
  const refill = new Set<string>();
  for (const m of missingStats) {
    if (m.replayId && done.delete(m.replayId)) refill.add(m.replayId);
  }
  for (const id of [...done]) {
    if (!hasWinner.has(id)) {
      done.delete(id);
      refill.add(id);
    }
  }

  const users = await prisma.user.findMany({
    where: { status: "APPROVED", isPlayer: true },
    select: { id: true, username: true, displayName: true, tryoutEntry: { select: { tag: true } } },
  });
  // In-game names an admin has already told us about.
  const aliases = new Map((await prisma.playerAlias.findMany()).map((a) => [a.name, a.userId]));

  function findUser(name: string) {
    const lower = name.trim().toLowerCase();
    const aliased = aliases.get(lower);
    if (aliased) return users.find((u) => u.id === aliased);
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

    const blueGoals = teamGoals(replay.blue);
    const orangeGoals = teamGoals(replay.orange);
    const teams = [
      { players: replay.blue?.players || [], won: blueGoals > orangeGoals },
      { players: replay.orange?.players || [], won: orangeGoals > blueGoals },
    ];

    const rows = [];
    const pending = [];
    const winners: string[] = [];
    for (const team of teams) {
      for (const p of team.players) {
        const core = p.stats?.core || {};
        const stats = {
          eventId: event.id,
          replayId,
          goals: core.goals ?? 0,
          assists: core.assists ?? 0,
          saves: core.saves ?? 0,
          shots: core.shots ?? 0,
          score: core.score ?? 0,
          mvp: !!core.mvp,
          win: team.won,
          stats: p.stats as object,
        };
        const user = findUser(p.name);
        if (team.won) winners.push(p.name.trim());
        if (!user) {
          // A refill doesn't ask again about names already dealt with.
          if (refill.has(replayId)) continue;
          unmatched.add(p.name);
          pending.push({ ...stats, playerName: p.name.trim() });
          continue;
        }
        rows.push({ ...stats, userId: user.id });
        imported.add(user.displayName || user.username);
      }
    }
    // Unmatched names are kept so an admin can say who they are afterwards.
    await prisma.$transaction([
      prisma.performance.createMany({ data: rows, skipDuplicates: true }),
      // Fills in detailed stats on rows that were imported without them.
      ...rows.map((r) =>
        prisma.performance.updateMany({
          where: { eventId: event.id, replayId, userId: r.userId },
          data: { stats: r.stats, win: r.win },
        }),
      ),
      prisma.pendingPerformance.createMany({ data: pending, skipDuplicates: true }),
      ...winners.map((name) =>
        prisma.pendingPerformance.updateMany({ where: { eventId: event.id, replayId, playerName: name }, data: { win: true } }),
      ),
      prisma.eventReplay.createMany({ data: [{ eventId: event.id, replayId }], skipDuplicates: true }),
    ]);
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

// Clears everything imported from ballchasing for this event, so the group can
// be imported again from scratch. Stats logged by hand stay.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [removed] = await prisma.$transaction([
    prisma.performance.deleteMany({ where: { eventId: params.id, replayId: { not: null } } }),
    prisma.pendingPerformance.deleteMany({ where: { eventId: params.id } }),
    prisma.eventReplay.deleteMany({ where: { eventId: params.id } }),
  ]);
  return NextResponse.json({ removed: removed.count });
}

