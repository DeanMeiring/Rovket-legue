import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const audienceSchema = {
  forEveryone: z.boolean().optional(),
  teamIds: z.array(z.string()).max(50).optional(),
};

// Events a user can see: admins see all; players see events for everyone
// and events for their own team.
export async function visibleEventsWhere(user: { id: string; role: string }): Promise<Prisma.EventWhereInput> {
  if (user.role === "ADMIN") return {};
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { teamId: true } });
  return {
    OR: [{ forEveryone: true }, ...(me?.teamId ? [{ audienceTeams: { some: { id: me.teamId } } }] : [])],
  };
}

// Approved accounts an event is for: everyone approved, or the players in its teams.
export function audienceUsersWhere(forEveryone: boolean, teamIds: string[]): Prisma.UserWhereInput {
  return forEveryone ? { status: "APPROVED" } : { status: "APPROVED", isPlayer: true, teamId: { in: teamIds } };
}
