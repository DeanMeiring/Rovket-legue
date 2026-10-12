import Link from "next/link";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, formatEventWhen, nameWithTag } from "@/lib/format";
import { visibleEventsWhere } from "@/lib/eventAudience";
import CompleteProfileModal from "@/components/CompleteProfileModal";
import Avatar from "@/components/Avatar";
import RsvpButtons from "@/components/RsvpButtons";
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
          captain: { select: { id: true, username: true, displayName: true } },
          members: {
            where: { status: "APPROVED", isPlayer: true },
            orderBy: { rank3v3: { sort: "desc", nulls: "last" } },
            select: { id: true, username: true, displayName: true, rank3v3: true, avatarUpdatedAt: true },
          },
        },
      },
    },
  });
  const team = dbUser?.team ?? null;
  const teammates = team?.members.filter((m) => m.id !== user.id) ?? [];
  const isCaptain = !!team && team.captain?.id === user.id;

  const [upcomingEvents, recentPerformances, review] = await Promise.all([
    prisma.event.findMany({
      where: {
        AND: [
          { OR: [{ startTime: { gte: new Date() } }, { endTime: { gte: new Date() } }] },
          await visibleEventsWhere(user),
        ],
      },
      orderBy: { startTime: "asc" },
      take: 6,
      include: { rsvps: { where: { userId: user.id } } },
    }),
    prisma.performance.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { event: true },
    }),
    prisma.playerReview.findFirst({
      where: { userId: user.id, published: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const [next, ...later] = upcomingEvents;

  return (
    <div className="space-y-6">
      <CompleteProfileModal
        initialOpen={user.role === "PLAYER" && !dbUser?.profileCompleted}
        needsTracker={!dbUser?.rlTrackerUrl}
        initialRanks={{
          rank1v1: dbUser?.rank1v1 ?? null,
          rank2v2: dbUser?.rank2v2 ?? null,
          rank3v3: dbUser?.rank3v3 ?? null,
        }}
      />

      <h1 className="text-3xl font-bold">Welcome back, {dbUser?.displayName || user.username} 👋</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {dbUser?.isPlayer && (
          <div className="card">
            {team ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <p className="text-xs text-slate-400">Your team</p>
                    <h2 className="text-2xl font-bold text-accent">{team.name}</h2>
                  </div>
                  <Link href="/teams" className="text-sm text-accent2 hover:underline whitespace-nowrap">
                    Team page
                  </Link>
                </div>
                <p className="text-sm text-slate-300 mb-4">
                  {isCaptain
                    ? "You're the captain. Schedule team events from the Teams page."
                    : team.captain
                      ? `Captain: ${nameWithTag(team.captain)}`
                      : "Captain to be announced."}
                </p>
                {teammates.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {teammates.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <Link href={`/players/${m.id}`} className="flex items-center gap-2 hover:underline min-w-0">
                          <Avatar id={m.id} name={m.displayName || m.username} version={m.avatarUpdatedAt?.toISOString()} size={28} />
                          <span className="truncate">{nameWithTag(m)}</span>
                          {team.captain?.id === m.id && <span className="badge bg-accent/15 text-accent">C</span>}
                        </Link>
                        <span className="text-slate-400 whitespace-nowrap">{preciseRankLabel(m.rank3v3) ?? "No rank set"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm">No teammates assigned yet.</p>
                )}
              </>
            ) : (
              <>
                <h2 className="font-bold text-lg mb-2">Your team</h2>
                <p className="text-slate-500 text-sm">You haven&apos;t been placed on a team yet.</p>
              </>
            )}
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">Next up</p>
            <Link href="/events" className="text-sm text-accent2 hover:underline">
              All events
            </Link>
          </div>
          {next ? (
            <div className="space-y-3">
              <div>
                <span className={`badge ${EVENT_TYPE_COLOR[next.type]}`}>{EVENT_TYPE_LABEL[next.type]}</span>
                <Link href={`/events/${next.id}`} className="block text-xl font-bold mt-1 hover:underline">
                  {next.title}
                </Link>
                <p className="text-sm text-slate-400">{formatEventWhen(next.startTime, next.endTime)}</p>
                {next.location && <p className="text-sm text-slate-500">{next.location}</p>}
              </div>
              <RsvpButtons eventId={next.id} initial={next.rsvps[0]?.status || "PENDING"} open={next.rsvpOpen} large />
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Nothing scheduled yet.</p>
          )}
        </div>
      </div>

      {review && (
        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="font-bold text-lg">Your coach&apos;s review</h2>
            <span className="text-xs text-slate-500">{format(review.updatedAt, "d MMM yyyy")}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{review.text}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Coming up</h2>
          {later.length === 0 && <p className="text-slate-500 text-sm">Nothing else scheduled.</p>}
          <ul className="space-y-4">
            {later.map((ev) => (
              <li key={ev.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`badge ${EVENT_TYPE_COLOR[ev.type]}`}>{EVENT_TYPE_LABEL[ev.type]}</span>
                  <Link href={`/events/${ev.id}`} className="font-medium hover:underline">
                    {ev.title}
                  </Link>
                </div>
                <p className="text-xs text-slate-500">{formatEventWhen(ev.startTime, ev.endTime)}</p>
                <RsvpButtons eventId={ev.id} initial={ev.rsvps[0]?.status || "PENDING"} open={ev.rsvpOpen} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Recent stats</h2>
            <Link href="/performance" className="text-sm text-accent2 hover:underline">
              My stats
            </Link>
          </div>
          {recentPerformances.length === 0 && <p className="text-slate-500 text-sm">No games logged yet.</p>}
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
          {dbUser?.isPlayer && (
            <div className="border-t border-border/60 mt-4 pt-3 space-y-1 text-sm">
              {PLAYLISTS.map((p) => (
                <p key={p.key} className="flex justify-between">
                  <span className="text-slate-400">{p.label}</span>
                  <span>{preciseRankLabel(dbUser?.[p.key]) ?? "Not set"}</span>
                </p>
              ))}
              <p className="flex gap-3 text-xs pt-1">
                <Link href={`/players/${user.id}`} className="text-accent2 hover:underline">
                  Your profile
                </Link>
                {dbUser?.rlTrackerUrl && (
                  <a href={dbUser.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-accent2 hover:underline">
                    RL Tracker profile
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
