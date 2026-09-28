import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { quietly, syncMemberRoles } from "@/lib/discord";

// Unlinks your Discord account, taking your team role away first.
export async function DELETE() {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await quietly("remove roles", () => syncMemberRoles(user.id, { removeAll: true }));
  await prisma.user.update({ where: { id: user.id }, data: { discordId: null, discordUsername: null } });
  return NextResponse.json({ ok: true });
}
