import Link from "next/link";
import Avatar from "@/components/Avatar";
import ScopeSwitch from "@/components/ScopeSwitch";
import { loadScouting, parseScope, personLabel, personStats, playstyle } from "@/lib/scouting";

export const dynamic = "force-dynamic";

// Admin list of every player with a portfolio: club members and tryout players.
export default async function PlayerPortfoliosPage({ searchParams }: { searchParams: { data?: string } }) {
  const scope = parseScope(searchParams.data);
  const q = scope === "practice" ? "?data=practice" : "";
  const s = await loadScouting(scope);
  const rows = [...s.people.values()]
    .map((p) => {
      const st = personStats(s, p.key);
      return { p, record: st.record, style: playstyle(st.avg) };
    })
    .sort((a, b) => (b.p.rank3v3 ?? -1) - (a.p.rank3v3 ?? -1) || a.p.name.localeCompare(b.p.name));

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/admin" className="text-sm text-accent2 hover:underline">
        ← Back to admin
      </Link>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Player portfolios</h1>
        <Link href={`/admin/chemistry${q}`} className="btn-secondary">
          🧩 Chemistry and trio builder
        </Link>
      </div>
      <ScopeSwitch scope={scope} path="/admin/players" />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-border">
              <th className="py-2 pr-3 font-medium">Player</th>
              <th className="py-2 pr-3 font-medium text-right">3v3</th>
              <th className="py-2 pr-3 font-medium text-right">2v2</th>
              <th className="py-2 pr-3 font-medium text-right">Games</th>
              <th className="py-2 pr-3 font-medium text-right">W-L</th>
              <th className="py-2 font-medium">Playstyle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, record, style }) => (
              <tr key={p.key} className="border-b border-border/50">
                <td className="py-2 pr-3">
                  <Link
                    href={`/admin/players/${encodeURIComponent(p.key)}${q}`}
                    className="flex items-center gap-2 hover:text-white"
                  >
                    <Avatar id={p.userId ?? p.key} name={p.name} version={p.avatarUpdatedAt?.toISOString()} size={28} />
                    <span className="truncate">{personLabel(p)}</span>
                    {!p.userId && <span className="badge bg-slate-700/40 text-slate-400">Tryout only</span>}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.rank3v3 ?? "–"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.rank2v2 ?? "–"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{record.games}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {record.games ? `${record.wins}-${record.games - record.wins}` : "–"}
                </td>
                <td className="py-2 text-slate-300">{style}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Ranks are MMR from the tryout board or the player&apos;s account. Playstyle is a rough read from ballchasing
        positioning (time as last back against time furthest forward) and needs at least 3 games with replay stats.
      </p>
    </div>
  );
}
