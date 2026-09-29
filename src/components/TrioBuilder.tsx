"use client";

import { useMemo, useState } from "react";

export type BuilderPerson = { key: string; label: string; rank3v3: number | null; style: string; games: number };
export type BuilderCombo = { keys: string[]; games: number; wins: number; lift: number | null };

type Scored = {
  keys: string[];
  total: number;
  strength: number;
  mix: number;
  chem: number;
  avgMmr: number | null;
  notes: string[];
};

const NEUTRAL = 12.5;

// Ranks possible trios from the players an admin ticks: 3v3 rank (up to 50
// points), playstyle mix (25) and shared-game results (25). Unknown parts
// score the neutral middle so missing data neither helps nor hurts.
export default function TrioBuilder({
  people,
  pairs,
  trios,
}: {
  people: BuilderPerson[];
  pairs: BuilderCombo[];
  trios: BuilderCombo[];
}) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(people.filter((p) => p.rank3v3 != null || p.games > 0).map((p) => p.key)),
  );
  const [separate, setSeparate] = useState(true);
  const byKey = useMemo(() => new Map(people.map((p) => [p.key, p])), [people]);

  const scored = useMemo(() => {
    const pool = people.filter((p) => picked.has(p.key));
    if (pool.length < 3) return [];
    const ranks = pool.map((p) => p.rank3v3).filter((r): r is number => r != null).sort((a, b) => a - b);
    const median = ranks.length ? ranks[Math.floor(ranks.length / 2)] : null;
    const pairMap = new Map(pairs.map((c) => [c.keys.join("|"), c]));
    const trioMap = new Map(trios.map((c) => [c.keys.join("|"), c]));

    const out: Scored[] = [];
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++)
        for (let k = j + 1; k < pool.length; k++) {
          const members = [pool[i], pool[j], pool[k]];
          const keys = members.map((m) => m.key).sort();
          const notes: string[] = [];

          const mmrs = members.map((m) => m.rank3v3 ?? median);
          if (members.some((m) => m.rank3v3 == null)) notes.push("a rank is missing, counted as the pool middle");
          const avgMmr = mmrs.every((v) => v != null) ? (mmrs as number[]).reduce((a, b) => a + b, 0) / 3 : null;

          const styles = members.map((m) => m.style).filter((st) => st !== "Not enough games");
          const pushers = styles.filter((st) => st === "Pushes up").length;
          let mix = NEUTRAL;
          if (styles.length < 2) notes.push("playstyle unknown");
          else if (pushers >= 2) {
            mix = 5;
            notes.push("two or more push up");
          } else if (styles.includes("Stays back")) mix = 25;
          else mix = 15;

          let chem = NEUTRAL;
          const trio = trioMap.get(keys.join("|"));
          const known = [
            [keys[0], keys[1]],
            [keys[0], keys[2]],
            [keys[1], keys[2]],
          ]
            .map((p) => pairMap.get(p.join("|")))
            .filter((c): c is BuilderCombo => !!c && c.games >= 3 && c.lift != null);
          if (trio && trio.games >= 3) {
            chem = (25 * trio.wins) / trio.games;
            notes.push(`played together ${trio.games} times, won ${trio.wins}`);
          } else if (known.length) {
            const lift = known.reduce((t, c) => t + (c.lift ?? 0), 0) / known.length;
            chem = Math.max(0, Math.min(25, NEUTRAL + lift * 25));
            notes.push(`${known.length} pair${known.length === 1 ? "" : "s"} with 3+ shared games`);
          } else notes.push("not enough shared games yet");

          out.push({ keys, total: 0, strength: 0, mix, chem, avgMmr, notes });
        }

    // 25 is the pool's average rank; every 100 MMR above or below moves it 12.5.
    const poolMean = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
    for (const t of out) {
      t.strength =
        t.avgMmr == null || poolMean == null ? 25 : Math.max(0, Math.min(50, 25 + ((t.avgMmr - poolMean) / 100) * 12.5));
      t.total = t.strength + t.mix + t.chem;
    }
    out.sort((a, b) => b.total - a.total);
    if (!separate) return out.slice(0, 10);
    // Greedy: best trio first, then the best one left with none of the same players.
    const used = new Set<string>();
    const teams: Scored[] = [];
    for (const t of out) {
      if (t.keys.some((key) => used.has(key))) continue;
      teams.push(t);
      t.keys.forEach((key) => used.add(key));
    }
    return teams;
  }, [people, picked, pairs, trios, separate]);

  function toggle(key: string) {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
  }

  return (
    <div className="card">
      <h2 className="font-bold text-lg mb-1">Trio builder</h2>
      <p className="text-sm text-slate-400 mb-3">
        Tick the players you&apos;re considering. Trios score up to 100: 3v3 rank against the ticked players' average (50, where 100 MMR is 12.5 points), playstyle mix
        (25) and results playing together (25). Missing data scores the middle. It&apos;s a starting point for a
        discussion, not a decision.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {people.map((p) => (
          <label
            key={p.key}
            className={`px-2 py-1 rounded-full text-xs border cursor-pointer ${
              picked.has(p.key) ? "border-accent2 bg-accent2/15 text-white" : "border-border text-slate-400"
            }`}
          >
            <input type="checkbox" className="hidden" checked={picked.has(p.key)} onChange={() => toggle(p.key)} />
            {p.label}
            {p.rank3v3 != null && <span className="text-slate-500"> {p.rank3v3}</span>}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300 mb-4">
        <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
        Split into separate trios (no player in two)
      </label>
      {scored.length === 0 ? (
        <p className="text-sm text-slate-500">Tick at least 3 players.</p>
      ) : (
        <ol className="space-y-3">
          {scored.map((t, i) => (
            <li key={t.keys.join("|")} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="font-semibold">
                  {separate ? `Trio ${i + 1}: ` : `${i + 1}. `}
                  {t.keys.map((k) => byKey.get(k)!.label).join(", ")}
                </span>
                <span className="text-accent font-bold tabular-nums">{Math.round(t.total)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Rank {Math.round(t.strength)}/50{t.avgMmr != null && ` (avg ${Math.round(t.avgMmr)} MMR)`} · Mix{" "}
                {Math.round(t.mix)}/25 ({t.keys.map((k) => byKey.get(k)!.style).join(", ")}) · Together{" "}
                {Math.round(t.chem)}/25
              </p>
              <p className="text-xs text-slate-500">{t.notes.join(" · ")}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
