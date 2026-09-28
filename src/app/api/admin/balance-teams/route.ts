import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { quietly, syncMemberRoles } from "@/lib/discord";

const schema = z.object({
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        playerIds: z.array(z.string().min(1)),
      })
    )
    .min(2, "Need at least two teams to balance across"),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const results = [];
  for (const group of parsed.data.groups) {
    const team = await prisma.team.upsert({
      where: { name: group.name },
      update: {},
      create: { name: group.name },
    });

    if (group.playerIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: group.playerIds } },
        data: { teamId: team.id },
      });
    }

    results.push({ id: team.id, name: team.name, playerCount: group.playerIds.length });
    for (const id of group.playerIds) void quietly("team role", () => syncMemberRoles(id));
  }

  return NextResponse.json({ teams: results });
}
