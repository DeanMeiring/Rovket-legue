import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { extractReplayId, fetchReplay } from "@/lib/ballchasing";

const schema = z.object({
  replayUrl: z.string().trim().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a ballchasing.com replay link." }, { status: 400 });
  }

  const replayId = extractReplayId(parsed.data.replayUrl);
  if (!replayId) {
    return NextResponse.json({ error: "Couldn't find a replay ID in that link." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  let replay;
  try {
    replay = await fetchReplay(replayId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch replay." },
      { status: 502 }
    );
  }

  const users = await prisma.user.findMany({
    where: { status: "APPROVED" },
    select: { id: true, username: true, displayName: true },
  });

  function findUser(name: string) {
    const lower = name.trim().toLowerCase();
    return users.find(
      (u) => u.username.toLowerCase() === lower || u.displayName?.toLowerCase() === lower
    );
  }

  const blueGoals = replay.blue?.goals ?? 0;
  const orangeGoals = replay.orange?.goals ?? 0;

  const teams = [
    { players: replay.blue?.players || [], won: blueGoals > orangeGoals },
    { players: replay.orange?.players || [], won: orangeGoals > blueGoals },
  ];

  const imported: string[] = [];
  const unmatched: string[] = [];

  for (const team of teams) {
    for (const p of team.players) {
      const user = findUser(p.name);
      if (!user) {
        unmatched.push(p.name);
        continue;
      }
      const core = p.stats?.core || {};
      await prisma.performance.create({
        data: {
          eventId: event.id,
          userId: user.id,
          goals: core.goals ?? 0,
          assists: core.assists ?? 0,
          saves: core.saves ?? 0,
          shots: core.shots ?? 0,
          score: core.score ?? 0,
          mvp: !!core.mvp,
          win: team.won,
        },
      });
      imported.push(user.displayName || user.username);
    }
  }

  return NextResponse.json({ imported, unmatched });
}
