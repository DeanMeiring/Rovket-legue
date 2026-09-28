import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  discordConfig,
  ensureTeamDiscord,
  positionTeamRoles,
  registerCommands,
  removeOldSharedCategory,
  syncMemberRoles,
} from "@/lib/discord";

// Admin: Discord bot status and one-off setup actions.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = discordConfig();
  const [linked, players, teams] = await Promise.all([
    prisma.user.count({ where: { status: "APPROVED", isPlayer: true, discordId: { not: null } } }),
    prisma.user.count({ where: { status: "APPROVED", isPlayer: true } }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        discordRoleId: true,
        discordCategoryId: true,
        discordTextChannelId: true,
        discordVoiceChannelId: true,
      },
    }),
  ]);
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "");
  return NextResponse.json({
    enabled: c.enabled,
    missing: [
      !c.token && "DISCORD_BOT_TOKEN",
      !c.applicationId && "DISCORD_APPLICATION_ID",
      !c.publicKey && "DISCORD_PUBLIC_KEY",
      !c.guildId && "DISCORD_GUILD_ID",
      !c.eventsChannelId && "DISCORD_EVENTS_CHANNEL_ID",
    ].filter(Boolean),
    interactionsUrl: base ? `${base}/api/discord/interactions` : null,
    linked,
    players,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      ready: !!(t.discordRoleId && t.discordCategoryId && t.discordTextChannelId && t.discordVoiceChannelId),
    })),
  });
}

const schema = z.object({ action: z.enum(["register-commands", "sync-teams"]) });

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!discordConfig().enabled)
    return NextResponse.json({ error: "Set the Discord variables in Railway first." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  try {
    if (parsed.data.action === "register-commands") {
      await registerCommands();
      return NextResponse.json({ message: "The /link command is registered in your server." });
    }
    const teams = await prisma.team.findMany({ select: { id: true } });
    for (const t of teams) await ensureTeamDiscord(t.id);
    await removeOldSharedCategory();
    await positionTeamRoles();
    // Re-check everyone linked, in case roles were changed by hand in Discord.
    const linked = await prisma.user.findMany({ where: { discordId: { not: null } }, select: { id: true } });
    for (const u of linked) await syncMemberRoles(u.id);
    return NextResponse.json({
      message: `Set up ${teams.length} team(s) and checked ${linked.length} linked player(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discord request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
