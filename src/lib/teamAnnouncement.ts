import { prisma } from "@/lib/prisma";
import { appButton, escapeHtml, sendEmail } from "@/lib/email";
import { discordConfig, sendDirectMessage } from "@/lib/discord";

// Telling players which team they made: an email plus a Discord DM, sent when
// an admin presses Send. Each player is remembered against the team they were
// told about, so only new or moved players are picked by default.

// Where approved players wait before teams are picked. Nobody is told about these.
const HOLDING = ["tryouts", "bc ussa"];

export const isHoldingTeam = (name: string) => HOLDING.includes(name.trim().toLowerCase());
export const isSubTeam = (name: string) => /\bsubs?\b/i.test(name);

type Person = { id: string; username: string; displayName: string | null };
const nameOf = (p: Person) => p.displayName || p.username;

export function teamMessage(player: Person, team: { name: string; captain: Person | null }) {
  const first = nameOf(player);
  if (isSubTeam(team.name)) {
    return {
      subject: "You made the club as a sub",
      lines: [
        `Congrats ${first}, you made the club as a sub!`,
        "You'll step in when a team is short and train with the club, so keep your availability up to date and watch for events.",
      ],
    };
  }
  const captain = team.captain;
  return {
    subject: `You made ${team.name}`,
    lines: [
      `Congrats ${first}, you made ${team.name}!`,
      captain?.id === player.id
        ? `You're the team captain. You can schedule your team's practices, scrims and matches from the Captain tab.`
        : captain
          ? `Your team captain is ${nameOf(captain)}.`
          : "Your team captain will be announced soon.",
    ],
  };
}

export async function teamAnnouncementRows() {
  const players = await prisma.user.findMany({
    where: { status: "APPROVED", isPlayer: true, teamId: { not: null } },
    select: {
      id: true,
      username: true,
      displayName: true,
      discordId: true,
      teamId: true,
      teamAnnouncedId: true,
      team: { select: { name: true, captain: { select: { id: true, username: true, displayName: true } } } },
    },
    orderBy: [{ team: { name: "asc" } }, { username: "asc" }],
  });
  return players
    .filter((p) => p.team && !isHoldingTeam(p.team.name))
    .map((p) => {
      const msg = teamMessage(p, p.team!);
      return {
        id: p.id,
        name: nameOf(p),
        team: p.team!.name,
        sub: isSubTeam(p.team!.name),
        captain: p.team!.captain ? nameOf(p.team!.captain) : null,
        discord: !!p.discordId,
        status: p.teamAnnouncedId === p.teamId ? "told" : p.teamAnnouncedId ? "moved" : "new",
        message: msg.lines.join(" "),
      };
    });
}

// Sends to each player that is still on a team that isn't a holding team.
export async function sendTeamAnnouncements(userIds: string[]) {
  const players = await prisma.user.findMany({
    where: { id: { in: userIds }, status: "APPROVED", isPlayer: true, teamId: { not: null } },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      discordId: true,
      teamId: true,
      team: { select: { name: true, captain: { select: { id: true, username: true, displayName: true } } } },
    },
  });
  let sent = 0;
  const noDm: string[] = [];
  for (const p of players) {
    if (!p.team || isHoldingTeam(p.team.name)) continue;
    const msg = teamMessage(p, p.team);
    await sendEmail(
      p.email,
      msg.subject,
      `${msg.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}${appButton("/dashboard", "Open the team hub")}`,
    );
    if (p.discordId && discordConfig().enabled) {
      try {
        await sendDirectMessage(p.discordId, `🎉 ${msg.lines.join("\n")}`);
      } catch (err) {
        console.error(`[team-announce] DM to ${p.username} failed:`, err instanceof Error ? err.message : err);
        noDm.push(nameOf(p));
      }
    } else {
      noDm.push(nameOf(p));
    }
    await prisma.user.update({ where: { id: p.id }, data: { teamAnnouncedId: p.teamId } });
    sent++;
  }
  return { sent, noDm };
}
