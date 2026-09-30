import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { captainTeamFor } from "@/lib/captain";
import { averageStats, formatMetric, METRICS } from "@/lib/replayStats";
import { BLOCKS, DAYS, slotKey } from "@/lib/availability";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, formatEventWhen, nameWithTag } from "@/lib/format";
import { preciseRankLabel } from "@/lib/ranks";
import Avatar from "@/components/Avatar";

// The captain's view of their own team: upcoming team events and who's coming,
// when people are free, and how the team has been playing. Tryout games are
// left out: they're judged separately. Admins can open any team's dashboard.

const ALL = "all";
const TEAM_METRICS = ["bpm", "zeroBoost", "speed", "supersonic", "behindBall", "toMates", "demos"];

export default async function CaptainPage({ searchParams }: { searchParams: { team?: string } }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "APPROVED") redirect("/dashboard");
  const isAdmin = user.role === "ADMIN";
  const ownTeam = await captainTeamFor(user);
  if (!isAdmin && !ownTeam) redirect("/dashboard");

  const allTeams = isAdmin
    ? await prisma.team.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, captain: { select: { displayName: true, username: true } } },
      })
    : [];
  // Admins start on every player and can switch to any team; captains only see their own.
  const teamId = isAdmin
    ? (allTeams.find((t) => t.id === searchParams.team)?.id ?? ALL)
    : ownTeam!.id;

  const memberQuery = {
    where: { status: "APPROVED" as const, isPlayer: true },
    orderBy: { rank3v3: { sort: "desc" as const, nulls: "last" as const } },
    select: {
      id: true,
      username: true,
      displayName: true,
      rank2v2: true,
      rank3v3: true,
      discordId: true,
      avatarUpdatedAt: true,
      availability: { select: { slots: true } },
      teamId: true,
      team: { select: { name: true } },
    },
  };
  const team =
    teamId === ALL
      ? { id: ALL, name: "All players", captain: null, members: await prisma.user.findMany(memberQuery) }
      : await prisma.team.findUnique({
          where: { id: teamId },
          include: { captain: { select: { id: true, displayName: true, username: true } }, members: memberQuery },
        });
  if (!team) redirect("/captain");
  const isAll = team.id === ALL;
  const memberIds = team.members.map((m) => m.id);
  const isMyTeam = ownTeam?.id === team.id;
  const now = new Date();
  const notTryout = { OR: [{ eventId: null }, { event: { type: { not: "TRYOUT" as const } } }] };

  const [perfs, clubStats, upcoming] = await Promise.all([
    prisma.performance.findMany({
      where: { userId: { in: memberIds }, ...notTryout },
      include: { event: { select: { id: true, title: true, type: true, startTime: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.performance.findMany({ where: notTryout, select: { stats: true } }),
    prisma.event.findMany({
      where: {
        AND: [
          { OR: [{ startTime: { gte: now } }, { endTime: { gte: now } }] },
          isAll ? {} : { OR: [{ forEveryone: true }, { audienceTeams: { some: { id: team.id } } }] },
        ],
      },
      orderBy: { startTime: "asc" },
      take: 8,
      include: {
        rsvps: { where: { userId: { in: memberIds } }, select: { userId: true, status: true } },
        audienceTeams: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Per player: results, per-game numbers and replay averages.
  const players = team.members.map((m) => {
    const mine = perfs.filter((p) => p.userId === m.id);
    const games = mine.length;
    const per = (f: (p: (typeof mine)[number]) => number) =>
      games ? (mine.reduce((a, p) => a + f(p), 0) / games).toFixed(1) : "–";
    return {
      ...m,
      games,
      wins: mine.filter((p) => p.win === true).length,
      losses: mine.filter((p) => p.win === false).length,
      goals: per((p) => p.goals),
      assists: per((p) => p.assists),
      saves: per((p) => p.saves),
      shots: per((p) => p.shots),
      avg: averageStats(mine.map((p) => p.stats)),
    };
  });

  // Games where two or more of the team were on the same side: same event,
  // same replay, same result.
  const sides = new Map<string, { event: (typeof perfs)[number]["event"]; win: boolean | null; ids: Set<string> }>();
  for (const p of perfs) {
    if (!p.replayId) continue;
    const key = `${p.eventId}|${p.replayId}|${p.win}`;
    const side = sides.get(key) ?? { event: p.event, win: p.win, ids: new Set<string>() };
    side.ids.add(p.userId);
    sides.set(key, side);
  }
  const together = [...sides.values()].filter((s) => s.ids.size >= 2);
  const togetherWins = together.filter((s) => s.win === true).length;
  const togetherLosses = together.filter((s) => s.win === false).length;

  // The last few events the team played together, newest first.
  const byEvent = new Map<string, { title: string; when: Date; type: string; wins: number; losses: number }>();
  for (const s of together) {
    if (!s.event) continue;
    const row = byEvent.get(s.event.id) ?? {
      title: s.event.title,
      when: s.event.startTime,
      type: s.event.type,
      wins: 0,
      losses: 0,
    };
    if (s.win === true) row.wins++;
    if (s.win === false) row.losses++;
    byEvent.set(s.event.id, row);
  }
  const recent = [...byEvent.values()].sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, 6);

  const teamAvg = averageStats(perfs.map((p) => p.stats));
  const clubAvg = averageStats(clubStats.map((p) => p.stats));
  const metrics = METRICS.filter((m) => TEAM_METRICS.includes(m.key));
  const nameOf = new Map(team.members.map((m) => [m.id, nameWithTag(m)]));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{isAdmin ? "Team dashboards" : "Captain\u2019s dashboard"}</h1>
          <p className="text-slate-400 mt-1">
            <span className="text-accent font-semibold">{team.name}</span>
            {isAll
              ? ` · ${team.members.length} players across every team`
              : team.captain
                ? ` · Captain: ${nameWithTag(team.captain)}`
                : " · No captain picked yet"}
          </p>
        </div>
        {(isMyTeam || (isAdmin && !isAll)) && (
          <Link href="/events/new" className="btn-primary">
            + Schedule a team event
          </Link>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ id: ALL, name: "All players" }, ...allTeams].map((t) => (
            <Link
              key={t.id}
              href={t.id === ALL ? "/captain" : `/captain?team=${t.id}`}
              className={`px-3 py-1 rounded-full border ${
                t.id === team.id ? "border-accent bg-accent/15" : "border-border hover:border-accent2"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {isMyTeam && (
        <p className="text-sm text-slate-400">
          You can schedule practices, scrims, matches and tournaments for {team.name}, one a day. You can edit or
          delete the ones you scheduled and run their game roster. Only your team sees them.
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-slate-400">Games together</p>
          <p className="text-3xl font-bold">{together.length}</p>
          <p className="text-xs text-slate-500">
            Two or more {isAll ? "club players" : "of the team"} on the same side
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Record together</p>
          <p className="text-3xl font-bold">
            {togetherWins}-{togetherLosses}
          </p>
          <p className="text-xs text-slate-500">
            {togetherWins + togetherLosses
              ? `${Math.round((togetherWins / (togetherWins + togetherLosses)) * 100)}% wins`
              : "No results yet"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Players</p>
          <p className="text-3xl font-bold">{team.members.length}</p>
          <p className="text-xs text-slate-500">
            {team.members.filter((m) => !m.discordId).length
              ? `${team.members.filter((m) => !m.discordId).length} not linked to Discord`
              : "All linked to Discord"}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-3">{isAll ? "Upcoming events" : `Upcoming for ${team.name}`}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((ev) => {
              const status = new Map(ev.rsvps.map((r) => [r.userId, r.status]));
              // Only the players the event is for: everyone, or the players in its teams.
              const aud = new Set(ev.audienceTeams.map((t) => t.id));
              const invited = team.members
                .filter((m) => ev.forEveryone || (m.teamId != null && aud.has(m.teamId)))
                .map((m) => m.id);
              const count = (s: string) => invited.filter((id) => status.get(id) === s).length;
              const waiting = invited.filter((id) => !status.get(id) || status.get(id) === "PENDING");
              const mine =
                ev.createdById === user.id && !ev.forEveryone && ev.audienceTeams.length === 1 && isMyTeam;
              return (
                <li key={ev.id} className="flex items-start justify-between gap-3 flex-wrap border-b border-border pb-3 last:border-0">
                  <div>
                    <Link href={`/events/${ev.id}`} className="font-semibold hover:underline">
                      {ev.title}
                    </Link>{" "}
                    <span className={`badge ${EVENT_TYPE_COLOR[ev.type]}`}>{EVENT_TYPE_LABEL[ev.type]}</span>
                    {mine && <span className="badge bg-accent/15 text-accent ml-1">Yours</span>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatEventWhen(ev.startTime, ev.endTime)} · {ev.forEveryone ? "Everyone" : isAll ? ev.audienceTeams.map((t) => t.name).join(", ") : "Team only"}
                    </p>
                    {waiting.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Not answered: {waiting.map((id) => nameOf.get(id)).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 whitespace-nowrap">
                    {count("GOING")} going · {count("MAYBE")} maybe · {count("DECLINED")} can&apos;t
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-bold text-lg mb-1">Players</h2>
        <p className="text-xs text-slate-500 mb-3">Club games only (practices, scrims, matches, tournaments). Tryouts are left out.</p>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-slate-400 text-xs text-left">
            <tr>
              <th className="py-1">Player</th>
              {isAll && <th>Team</th>}
              <th>3v3</th>
              <th>2v2</th>
              <th>Games</th>
              <th>W-L</th>
              <th>Goals</th>
              <th>Assists</th>
              <th>Saves</th>
              <th>Shots</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2">
                  <Link href={`/players/${p.id}`} className="flex items-center gap-2 hover:underline">
                    <Avatar id={p.id} name={p.displayName || p.username} version={p.avatarUpdatedAt?.toISOString()} size={28} />
                    {nameWithTag(p)}
                    {team.captain?.id === p.id && <span className="badge bg-accent/15 text-accent">C</span>}
                  </Link>
                </td>
                {isAll && <td className="text-slate-400">{p.team?.name ?? "No team"}</td>}
                <td>{preciseRankLabel(p.rank3v3) ?? "–"}</td>
                <td>{preciseRankLabel(p.rank2v2) ?? "–"}</td>
                <td>{p.games}</td>
                <td>
                  {p.wins}-{p.losses}
                </td>
                <td>{p.goals}</td>
                <td>{p.assists}</td>
                <td>{p.saves}</td>
                <td>{p.shots}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={isAll ? 10 : 9} className="py-3 text-slate-500">
                  No players on this team yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-bold text-lg mb-1">Replay stats</h2>
        <p className="text-xs text-slate-500 mb-3">
          Averages per game from ballchasing, over {teamAvg.games} player-games for the team and {clubAvg.games} for
          the whole club.
        </p>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-slate-400 text-xs text-left">
            <tr>
              <th className="py-1">Stat</th>
              <th>{isAll ? "All players" : "Team"}</th>
              <th>Club</th>
              {!isAll &&
                players.map((p) => (
                  <th key={p.id}>{p.displayName || p.username}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key} className="border-t border-border">
                <td className="py-2 text-slate-300">{m.label}</td>
                <td className="font-semibold">{formatMetric(m, teamAvg.values[m.key])}</td>
                <td className="text-slate-400">{formatMetric(m, clubAvg.values[m.key])}</td>
                {!isAll &&
                  players.map((p) => (
                    <td key={p.id}>{formatMetric(m, p.avg.values[m.key])}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold text-lg mb-3">Recent results together</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No games with two or more of the team on one side yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span>
                    {r.title} <span className="text-slate-500">· {format(r.when, "d MMM")}</span>
                  </span>
                  <span className={r.wins > r.losses ? "text-green-400" : r.wins < r.losses ? "text-red-400" : "text-slate-300"}>
                    {r.wins}-{r.losses}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-bold text-lg mb-1">When the team is free</h2>
          <p className="text-xs text-slate-500 mb-3">
            From each player&apos;s weekly availability.{" "}
            {team.members.filter((m) => !m.availability).length > 0 &&
              `${team.members.filter((m) => !m.availability).length} haven't filled it in.`}
          </p>
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th />
                {DAYS.map((d) => (
                  <th key={d.key} className="text-slate-400 font-normal">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BLOCKS.map((b) => (
                <tr key={b.key}>
                  <td className="text-slate-400 whitespace-nowrap pr-1">{b.hoursShort}</td>
                  {DAYS.map((d) => {
                    const free = team.members.filter((m) => m.availability?.slots.includes(slotKey(d.key, b.key)));
                    const all = team.members.length > 0 && free.length === team.members.length;
                    return (
                      <td
                        key={d.key}
                        title={free.map((m) => nameWithTag(m)).join(", ") || "Nobody"}
                        className={`text-center rounded py-1.5 ${
                          all ? "bg-green-500/30 text-green-200" : free.length ? "bg-panel2 text-slate-200" : "text-slate-600"
                        }`}
                      >
                        {free.length}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
