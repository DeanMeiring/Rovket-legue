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
                {m.pro && (
                  <p className="text-[11px] text-emerald-400/80">
                    pro {formatMetric(m, m.pro[0])} to {formatMetric(m, m.pro[1])}
                  </p>
                )}
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

// One player's replay stats over every imported game, each stat drawn on a
// track with the pro range and the club average for comparison.
export function PlayerBenchmarkCard({ stats, clubAvg }: { stats: unknown[]; clubAvg: Averages }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Boost");
  const mine = useMemo(() => averageStats(stats), [stats]);
  if (!mine.games) return null;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-bold text-lg">Replay stats vs pros</h2>
        <span className="text-xs text-slate-500">
          Per-game averages over {mine.games} game{mine.games === 1 ? "" : "s"} from every event
        </span>
      </div>
      <div className="flex gap-2 flex-wrap mb-4" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={`px-3 py-1 rounded-full text-sm border ${
              group === g ? "border-accent2 text-white bg-accent2/15" : "border-border text-slate-400 hover:text-white"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <ul className="space-y-4">
        {METRICS.filter((m) => m.group === group).map((m) => (
          <BenchmarkRow key={m.key} metric={m} value={mine.values[m.key]} club={clubAvg.values[m.key]} />
        ))}
      </ul>
      <div className="flex gap-4 flex-wrap mt-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent2" /> This player
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2 rounded-sm bg-emerald-400/30 border border-emerald-400/60" /> Pro range
          (RLCS 2024 Worlds)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-0.5 h-3 bg-slate-300" /> Club average
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        Pro numbers are a ceiling, not a target. Stats marked &quot;depends on role&quot; aren&apos;t better high or low.
      </p>
    </div>
  );
}

function BenchmarkRow({ metric: m, value, club }: { metric: Metric; value: number | null; club: number | null }) {
  const top = Math.max(value ?? 0, club ?? 0, m.pro?.[1] ?? 0) * 1.15 || 1;
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  const verdict =
    value == null || !m.pro
      ? null
      : value < m.pro[0]
        ? "below pro range"
        : value > m.pro[1]
          ? "above pro range"
          : "in pro range";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
        <span className="text-slate-300">
          {m.label}
          <span className="text-slate-500 text-xs"> · {BETTER[m.better].toLowerCase()}</span>
        </span>
        <span className="tabular-nums font-semibold">{formatMetric(m, value)}</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-slate-800/70"
        title={[
          `${m.label}: ${formatMetric(m, value)}`,
          m.pro && `Pro: ${formatMetric(m, m.pro[0])} to ${formatMetric(m, m.pro[1])}`,
          `Club average: ${formatMetric(m, club)}`,
        ]
          .filter(Boolean)
          .join("\n")}
      >
        {m.pro && (
          <span
            className="absolute inset-y-0 rounded-sm bg-emerald-400/30 border border-emerald-400/60"
            style={{ left: pct(m.pro[0]), width: `max(4px, calc(${pct(m.pro[1])} - ${pct(m.pro[0])}))` }}
          />
        )}
        {club != null && <span className="absolute -inset-y-0.5 w-0.5 bg-slate-300" style={{ left: pct(club) }} />}
        {value != null && (
          <span
            className="absolute top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-accent2 ring-2 ring-panel"
            style={{ left: pct(value) }}
          />
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-1">
        Club avg {formatMetric(m, club)}
        {m.pro ? ` · pro ${formatMetric(m, m.pro[0])} to ${formatMetric(m, m.pro[1])}` : " · no sourced pro number"}
        {verdict && ` · ${verdict}`}
      </p>
    </li>
  );
}
