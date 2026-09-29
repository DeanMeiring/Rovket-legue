import Link from "next/link";
import TrioBuilder from "@/components/TrioBuilder";
import {
  CONFIDENCE_STYLE,
  combos,
  loadScouting,
  personLabel,
  personStats,
  playstyle,
  type Combo,
  type Scouting,
} from "@/lib/scouting";

export const dynamic = "force-dynamic";

// Which players do well together, from every club and tryout game they shared
// a team in, plus a trio builder. Admins only.
export default async function ChemistryPage() {
  const s = await loadScouting();
  const pairs = combos(s, 2);
  const trios = combos(s, 3);
  const people = [...s.people.values()]
    .map((p) => {
      const st = personStats(s, p.key);
      return { key: p.key, label: personLabel(p), rank3v3: p.rank3v3, style: playstyle(st.avg), games: st.record.games };
    })
    .sort((a, b) => (b.rank3v3 ?? -1) - (a.rank3v3 ?? -1));
  const strip = (c: Combo) => ({ keys: c.keys, games: c.games, wins: c.wins, lift: c.lift });

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/players" className="text-sm text-accent2 hover:underline">
        ← Player portfolios
      </Link>
      <h1 className="text-3xl font-bold">Chemistry</h1>
      <p className="text-sm text-slate-400">
        Built from {s.teams.length} team line-up{s.teams.length === 1 ? "" : "s"} across club practices and tryout games.
        Labels: <span className={`badge ${CONFIDENCE_STYLE["too few"]}`}>too few</span> under 3 shared games,{" "}
        <span className={`badge ${CONFIDENCE_STYLE.early}`}>early</span> 3 to 5,{" "}
        <span className={`badge ${CONFIDENCE_STYLE.solid}`}>solid</span> 6 or more.
      </p>

      <TrioBuilder people={people} pairs={pairs.map(strip)} trios={trios.map(strip)} />

      <ComboTable title="Trios that have played together" rows={trios} s={s} />
      <ComboTable title="Pairs that have played together" rows={pairs} s={s} />
    </div>
  );
}

function ComboTable({ title, rows, s }: { title: string; rows: Combo[]; s: Scouting }) {
  return (
    <div className="card overflow-x-auto">
      <h2 className="font-bold text-lg mb-1">{title}</h2>
      <p className="text-xs text-slate-500 mb-3">
        &quot;Vs usual&quot; is the win rate together minus the players&apos; normal win rates.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">None yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-border">
              <th className="py-2 pr-3 font-medium">Players</th>
              <th className="py-2 pr-3 font-medium text-right">Games</th>
              <th className="py-2 pr-3 font-medium text-right">W-L</th>
              <th className="py-2 pr-3 font-medium text-right">Vs usual</th>
              <th className="py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.keys.join("|")} className="border-b border-border/50">
                <td className="py-2 pr-3">{c.keys.map((k) => personLabel(s.people.get(k)!)).join(" + ")}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{c.games}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {c.wins}-{c.games - c.wins}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {c.lift == null ? "–" : `${c.lift > 0 ? "+" : ""}${Math.round(c.lift * 100)}%`}
                </td>
                <td className="py-2">
                  <span className={`badge ${CONFIDENCE_STYLE[c.confidence]}`}>{c.confidence}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
