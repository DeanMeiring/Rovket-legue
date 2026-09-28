"use client";

import { useMemo, useState } from "react";
import { METRICS, averageStats, formatMetric, type Averages, type Metric } from "@/lib/replayStats";

type PlayerStats = { id: string; name: string; stats: unknown[] };

const GROUPS = ["Boost", "Movement", "Positioning", "Demos"] as const;
const BETTER: Record<Metric["better"], string> = {
  higher: "Higher is usually better",
  lower: "Lower is usually better",
  role: "Depends on role",
};

// Compares every player on one ballchasing stat at a time, as bars.
export function ReplayStatsCard({ players }: { players: PlayerStats[] }) {
  const [key, setKey] = useState("bpm");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Boost");
  const rows = useMemo(
    () => players.map((p) => ({ ...p, avg: averageStats(p.stats) })).filter((p) => p.avg.games > 0),
    [players],
  );
  if (!rows.length) return null;

  const metric = METRICS.find((m) => m.key === key)!;
  const values = rows
    .map((r) => ({ id: r.id, name: r.name, v: r.avg.values[key], games: r.avg.games }))
    .filter((r): r is { id: string; name: string; v: number; games: number } => r.v != null)
    .sort((a, b) => b.v - a.v);
  const max = Math.max(...values.map((r) => r.v), 0) || 1;
  const avg = values.length ? values.reduce((s, r) => s + r.v, 0) / values.length : null;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-bold text-lg">Replay stats</h2>
        <span className="text-xs text-slate-500">Per-game averages from ballchasing</span>
      </div>
      <div className="flex gap-2 flex-wrap mb-2" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={group === g}
            onClick={() => {
              setGroup(g);
              setKey(METRICS.find((m) => m.group === g)!.key);
            }}
            className={`px-3 py-1 rounded-full text-sm border ${
              group === g ? "border-accent2 text-white bg-accent2/15" : "border-border text-slate-400 hover:text-white"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {METRICS.filter((m) => m.group === group).map((m) => (
          <button
            key={m.key}
            onClick={() => setKey(m.key)}
            className={`px-2 py-0.5 rounded text-xs ${key === m.key ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-300 mb-3">
        {metric.label}
        <span className="text-slate-500">
          {" "}
          · {BETTER[metric.better]}
          {avg != null && ` · average ${formatMetric(metric, avg)}`}
        </span>
      </p>
      <ul className="space-y-1.5">
        {values.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem] items-center gap-3 text-sm group"
            title={`${r.name}: ${formatMetric(metric, r.v)} (${r.games} game${r.games === 1 ? "" : "s"})`}
          >
            <span className="truncate text-slate-300">{r.name}</span>
            <span className="h-3 rounded-r bg-slate-800/60">
              <span
                className="block h-3 rounded-r bg-accent2/80 group-hover:bg-accent2"
                style={{ width: `${Math.max(2, (r.v / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-300">{formatMetric(metric, r.v)}</span>
          </li>
        ))}
        {!values.length && <p className="text-sm text-slate-500">No one has this stat in the imported replays.</p>}
      </ul>
    </div>
  );
}

// Stat tiles for one player, each next to the event average.
export function PlayerStatTiles({ stats, eventAvg }: { stats: unknown[]; eventAvg: Averages }) {
  const mine = averageStats(stats);
  if (!mine.games) {
    return <p className="text-xs text-slate-500">No detailed replay stats yet. Import the group again to fill them in.</p>;
  }
  return (
    <div className="space-y-3">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{g}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {METRICS.filter((m) => m.group === g).map((m) => (
              <div key={m.key} className="rounded-lg border border-border px-3 py-2">
                <p className="text-[11px] text-slate-400 truncate">{m.label}</p>
                <p className="text-base font-semibold tabular-nums">{formatMetric(m, mine.values[m.key])}</p>
                <p className="text-[11px] text-slate-500">event avg {formatMetric(m, eventAvg.values[m.key])}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">
        Averaged over {mine.games} game{mine.games === 1 ? "" : "s"} with replay stats.
      </p>
    </div>
  );
}
