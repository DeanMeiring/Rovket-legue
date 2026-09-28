import Link from "next/link";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, formatEventWhen, RSVP_COLOR, RSVP_LABEL } from "@/lib/format";
import { visibleEventsWhere } from "@/lib/eventAudience";
import CompleteProfileModal from "@/components/CompleteProfileModal";
import { PLAYLISTS, preciseRankLabel } from "@/lib/ranks";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.status === "PENDING") {
    return (
      <div className="max-w-lg mx-auto mt-12 card text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold mb-2">Waiting on admin approval</h1>
        <p className="text-slate-400">
          Your account request is in the queue. Once a team admin approves you and
          assigns you to a team, you'll get full access to events and performance
          tracking.
        </p>
      </div>
    );
  }

  if (user.status === "REJECTED") {
    return (
      <div className="max-w-lg mx-auto mt-12 card text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold mb-2">Account not approved</h1>
        <p className="text-slate-400">
          An admin marked this account as not approved. Reach out to your team
          manager if you think this is a mistake.
        </p>
      </div>
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      team: {
        include: {
          members: {
            where: { status: "APPROVED", isPlayer: true },
            orderBy: { rank3v3: { sort: "desc", nulls: "last" } },
            select: { id: true, username: true, displayName: true, rank3v3: true },
          },
        },
      },
    },
  });
  const teammates = dbUser?.team?.members.filter((m) => m.id !== user.id) ?? [];

  const upcomingEvents = await prisma.event.findMany({
    where: {
      AND: [
        { OR: [{ startTime: { gte: new Date() } }, { endTime: { gte: new Date() } }] },
        await visibleEventsWhere(user),
      ],
    },
    orderBy: { startTime: "asc" },
    take: 5,
    include: {
      rsvps: { where: { userId: user.id } },
    },
  });

  const recentPerformances = await prisma.performance.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { event: true },
  });

  return (
    <div className="space-y-8">
      <CompleteProfileModal
        initialOpen={user.role === "PLAYER" && !dbUser?.profileCompleted}
        needsTracker={!dbUser?.rlTrackerUrl}
        initialRanks={{
          rank1v1: dbUser?.rank1v1 ?? null,
          rank2v2: dbUser?.rank2v2 ?? null,
          rank3v3: dbUser?.rank3v3 ?? null,
        }}
      />

      <div>
        <h1 className="text-3xl font-bold">Welcome back, {dbUser?.displayName || user.username} 👋</h1>
        <p className="text-slate-400 mt-1">
          {dbUser?.team ? (
            <>
              Team: <span className="text-accent font-semibold">{dbUser.team.name}</span>
            </>
          ) : (
            "You haven't been assigned to a team yet."
          )}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {dbUser?.isPlayer && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{dbUser?.team ? dbUser.team.name : "Your team"}</h2>
              <Link href={`/players/${user.id}`} className="text-sm text-accent2 hover:underline">
                Your profile
              </Link>
            </div>
            {dbUser?.team ? (
              teammates.length > 0 ? (
                <ul className="space-y-2 text-sm mb-4">
                  {teammates.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <Link href={`/players/${m.id}`} className="hover:underline">
                        {m.displayName || m.username}
                      </Link>
                      <span className="text-slate-400">{preciseRankLabel(m.rank3v3) ?? "No rank set"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-sm mb-4">No teammates assigned yet.</p>
              )
            ) : (
              <p className="text-slate-500 text-sm mb-4">An admin will place you on a team after tryouts.</p>
            )}
            <div className="border-t border-border/60 pt-3 space-y-1 text-sm">
              {PLAYLISTS.map((p) => (
                <p key={p.key} className="flex justify-between">
                  <span className="text-slate-400">{p.label}</span>
                  <span>{preciseRankLabel(dbUser?.[p.key]) ?? "Not set"}</span>
                </p>
              ))}
              {dbUser?.rlTrackerUrl && (
                <a href={dbUser.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-accent2 hover:underline text-xs">
                  RL Tracker profile
                </a>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Upcoming events</h2>
            <Link href="/events" className="text-sm text-accent2 hover:underline">
              View all
            </Link>
          </div>
          {upcomingEvents.length === 0 && (
            <p className="text-slate-500 text-sm">No events scheduled yet.</p>
          )}
          <ul className="space-y-3">
            {upcomingEvents.map((ev) => {
              const rsvp = ev.rsvps[0]?.status || "PENDING";
              return (
                <li key={ev.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${EVENT_TYPE_COLOR[ev.type]}`}>
                        {EVENT_TYPE_LABEL[ev.type]}
                      </span>
                      <span className="font-medium">{ev.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ev.endTime ? formatEventWhen(ev.startTime, ev.endTime) : format(ev.startTime, "EEE d MMM, HH:mm")}
                    </p>
                  </div>
                  <span className={`badge ${RSVP_COLOR[rsvp]}`}>{RSVP_LABEL[rsvp]}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Recent performance</h2>
            <Link href="/performance" className="text-sm text-accent2 hover:underline">
              Full history
            </Link>
          </div>
          {recentPerformances.length === 0 && (
            <p className="text-slate-500 text-sm">No performance stats logged yet.</p>
          )}
          <ul className="space-y-3">
            {recentPerformances.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {p.event?.title || "Untitled session"}
                  {p.mvp && <span className="badge bg-accent/20 text-accent ml-2">MVP</span>}
                </span>
                <span className="text-slate-400">
                  {p.goals}G {p.assists}A {p.saves}S · {p.score} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
