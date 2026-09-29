import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Avatar from "@/components/Avatar";
import { PlayerBenchmarkCard } from "@/components/ReplayStats";
import { prisma } from "@/lib/prisma";
import { averageStats, formatMetric, METRICS } from "@/lib/replayStats";
import {
  CONFIDENCE_STYLE,
  clubAverage,
  combos,
  loadScouting,
  personLabel,
  personStats,
  playstyle,
  type Appearance,
} from "@/lib/scouting";

export const dynamic = "force-dynamic";

const TREND = ["bpm", "speed", "behindBall", "mostBack", "mostForward"];

// Everything the club knows about one player, for tryout decisions. Admins only.
export default async function PlayerPortfolioPage({ params }: { params: { key: string } }) {
  const key = decodeURIComponent(params.key);
  const s = await loadScouting();
  const person = s.people.get(key);
  if (!person) notFound();

  const { appearances, record, avg } = personStats(s, key);
  const style = playstyle(avg);
  const club = appearances.filter((a) => a.source === "club").length;
  const mvps = appearances.filter((a) => a.mvp).length;
  const sessions = bySession(appearances);
  const partners = combos(s, 2)
    .filter((c) => c.keys.includes(key))
    .map((c) => ({ ...c, other: s.people.get(c.keys.find((k) => k !== key)!)! }));
  const reviews = person.userId
    ? await prisma.playerReview.findMany({ where: { userId: person.userId }, orderBy: { createdAt: "desc" } })
    : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/players" className="text-sm text-accent2 hover:underline">
        ← All portfolios
      </Link>

      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar
            id={person.userId ?? person.key}
            name={person.name}
            version={person.avatarUpdatedAt?.toISOString()}
            size={72}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold">{personLabel(person)}</h1>
            <p className="text-slate-400 text-sm">
              {person.team ?? "No club team"}
              {person.tryoutTeam ? ` · Tryout board: Team ${person.tryoutTeam}` : " · Tryout board: new"}
              {person.userId && (
                <>
                  {" · "}
                  <Link href={`/players/${person.userId}`} className="text-accent2 hover:underline">
                    Public profile
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center mt-5">
          {[
            ["3v3 MMR", person.rank3v3 ?? "–"],
            ["2v2 MMR", person.rank2v2 ?? "–"],
            ["Games", `${record.games}`],
            ["W-L", record.games ? `${record.wins}-${record.games - record.wins}` : "–"],
            ["MVPs", mvps],
            ["Playstyle", style],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-lg font-bold text-accent">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {club} club game{club === 1 ? "" : "s"} and {record.games - club} tryout game
          {record.games - club === 1 ? "" : "s"}.
        </p>
      </div>

      <PlayerBenchmarkCard stats={appearances.map((a) => a.stats)} clubAvg={clubAverage(s)} />

      <div className="card overflow-x-auto">
        <h2 className="font-bold text-lg mb-1">Session by session</h2>
        <p className="text-xs text-slate-500 mb-3">Per-game averages for each practice or tryout day, newest first.</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No imported games yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-border">
                <th className="py-2 pr-3 font-medium">Session</th>
                <th className="py-2 pr-3 font-medium text-right">W-L</th>
                <th className="py-2 pr-3 font-medium text-right">Score</th>
                <th className="py-2 pr-3 font-medium text-right">G/A/S</th>
                {TREND.map((k) => (
                  <th key={k} className="py-2 pr-3 font-medium text-right">
                    {METRICS.find((m) => m.key === k)!.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    {row.label}
                    <span className="block text-xs text-slate-500">{format(row.date, "d MMM yyyy")}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.wins}-{row.games - row.wins}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Math.round(row.score)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.gas}</td>
                  {TREND.map((k) => (
                    <td key={k} className="py-2 pr-3 text-right tabular-nums">
                      {formatMetric(METRICS.find((m) => m.key === k)!, row.avg.values[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-bold text-lg mb-1">Teammates</h2>
        <p className="text-xs text-slate-500 mb-3">
          &quot;Vs usual&quot; compares the win rate together with each player&apos;s normal win rate. Under 3 shared
          games it is mostly luck.
        </p>
        {partners.length === 0 ? (
          <p className="text-sm text-slate-500">No shared games yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-border">
                <th className="py-2 pr-3 font-medium">With</th>
                <th className="py-2 pr-3 font-medium text-right">Games</th>
                <th className="py-2 pr-3 font-medium text-right">W-L</th>
                <th className="py-2 pr-3 font-medium text-right">Vs usual</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((c) => (
                <tr key={c.other.key} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${encodeURIComponent(c.other.key)}`} className="hover:text-white">
                      {personLabel(c.other)}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.games}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {c.wins}-{c.games - c.wins}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{signedPct(c.lift)}</td>
                  <td className="py-2">
                    <span className={`badge ${CONFIDENCE_STYLE[c.confidence]}`}>{c.confidence}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-3">Reviews</h2>
        {!person.userId && <p className="text-sm text-slate-500">Reviews need the player to have an account.</p>}
        {person.userId && reviews.length === 0 && <p className="text-sm text-slate-500">No reviews written yet.</p>}
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-border/50 pb-4">
              <p className="text-xs text-slate-500 mb-2">
                {format(r.createdAt, "d MMM yyyy HH:mm")} · {r.published ? "Published" : "Draft"}
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function bySession(appearances: Appearance[]) {
  const groups = new Map<string, Appearance[]>();
  for (const a of appearances) {
    const id = `${a.source}:${a.label}:${format(a.date, "yyyy-MM-dd")}`;
    groups.set(id, [...(groups.get(id) ?? []), a]);
  }
  return [...groups.entries()]
    .map(([id, rows]) => {
      const n = rows.length;
      const per = (f: (a: Appearance) => number) => rows.reduce((t, a) => t + f(a), 0) / n;
      return {
        id,
        label: rows[0].label,
        date: rows[0].date,
        games: n,
        wins: rows.filter((a) => a.won).length,
        score: per((a) => a.score),
        gas: [per((a) => a.goals), per((a) => a.assists), per((a) => a.saves)].map((v) => v.toFixed(1)).join(" / "),
        avg: averageStats(rows.map((a) => a.stats)),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function signedPct(v: number | null) {
  if (v == null) return "–";
  const n = Math.round(v * 100);
  return `${n > 0 ? "+" : ""}${n}%`;
}
