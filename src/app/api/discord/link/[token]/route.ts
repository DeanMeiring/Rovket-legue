import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";
import { quietly, readDiscordLinkToken, syncMemberRoles } from "@/lib/discord";

// The link the bot's /link command hands out. Opening it only shows who is
// being linked; the logged-in player confirms with a POST.

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const link = readDiscordLinkToken(params.token);
  if (!link) return NextResponse.json({ error: "This link has expired. Use /link in Discord again." }, { status: 404 });
  return NextResponse.json({ username: link.username });
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Log in to the team hub first." }, { status: 401 });
  const link = readDiscordLinkToken(params.token);
  if (!link) return NextResponse.json({ error: "This link has expired. Use /link in Discord again." }, { status: 404 });

  // One Discord account per app account: moving it clears the old link.
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { discordId: link.discordId, id: { not: user.id } },
      data: { discordId: null, discordUsername: null },
    }),
    prisma.user.update({ where: { id: user.id }, data: { discordId: link.discordId, discordUsername: link.username } }),
  ]);
  await quietly("roles after link", () => syncMemberRoles(user.id));
  return NextResponse.json({ ok: true, username: link.username });
}
