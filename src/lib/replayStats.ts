// The detailed ballchasing numbers shown on events and fed to reviews. Each
// metric reads one field from a player's ballchasing stats block; values are
// averaged across the games a player has them for.

type Block = Record<string, Record<string, number | undefined> | undefined>;

export type Metric = {
  key: string;
  label: string;
  group: "Boost" | "Movement" | "Positioning" | "Demos";
  unit: string;
  // How a coach reads it: higher is usually better, lower is, or it depends on role.
  better: "higher" | "lower" | "role";
  read: (s: Block) => number | undefined;
  digits?: number;
};

// Ballchasing speeds are in unreal units per second; 1 uu is 1 cm.
const kmh = (uu: number | undefined) => (uu == null ? undefined : uu * 0.036);

export const METRICS: Metric[] = [
  { key: "bpm", label: "Boost used / min", group: "Boost", unit: "", better: "role", read: (s) => s.boost?.bpm },
  { key: "avgBoost", label: "Average boost", group: "Boost", unit: "", better: "higher", read: (s) => s.boost?.avg_amount },
  { key: "zeroBoost", label: "Time on 0 boost", group: "Boost", unit: "%", better: "lower", read: (s) => s.boost?.percent_zero_boost },
  { key: "fullBoost", label: "Time on full boost", group: "Boost", unit: "%", better: "lower", read: (s) => s.boost?.percent_full_boost },
  { key: "bigPads", label: "Big pads / game", group: "Boost", unit: "", better: "role", read: (s) => s.boost?.count_collected_big },
  { key: "smallPads", label: "Small pads / game", group: "Boost", unit: "", better: "higher", read: (s) => s.boost?.count_collected_small },
  { key: "stolen", label: "Boost stolen", group: "Boost", unit: "", better: "higher", read: (s) => s.boost?.amount_stolen, digits: 0 },
  { key: "speed", label: "Average speed", group: "Movement", unit: " km/h", better: "higher", read: (s) => kmh(s.movement?.avg_speed) },
  { key: "supersonic", label: "Time supersonic", group: "Movement", unit: "%", better: "higher", read: (s) => s.movement?.percent_supersonic_speed },
  { key: "slow", label: "Time slow", group: "Movement", unit: "%", better: "lower", read: (s) => s.movement?.percent_slow_speed },
  { key: "ground", label: "Time on ground", group: "Movement", unit: "%", better: "role", read: (s) => s.movement?.percent_ground },
  { key: "highAir", label: "Time high in air", group: "Movement", unit: "%", better: "role", read: (s) => s.movement?.percent_high_air },
  { key: "behindBall", label: "Time behind ball", group: "Positioning", unit: "%", better: "higher", read: (s) => s.positioning?.percent_behind_ball },
  { key: "mostBack", label: "Time last back", group: "Positioning", unit: "%", better: "role", read: (s) => s.positioning?.percent_most_back },
  { key: "defThird", label: "Time in defensive third", group: "Positioning", unit: "%", better: "role", read: (s) => s.positioning?.percent_defensive_third },
  { key: "offThird", label: "Time in attacking third", group: "Positioning", unit: "%", better: "role", read: (s) => s.positioning?.percent_offensive_third },
  { key: "toMates", label: "Distance to teammates", group: "Positioning", unit: "", better: "role", read: (s) => s.positioning?.avg_distance_to_mates, digits: 0 },
  { key: "lastDefGoals", label: "Goals conceded as last back", group: "Positioning", unit: "", better: "lower", read: (s) => s.positioning?.goals_against_while_last_defender },
  { key: "demos", label: "Demos made", group: "Demos", unit: "", better: "higher", read: (s) => s.demo?.inflicted },
  { key: "demosTaken", label: "Times demoed", group: "Demos", unit: "", better: "lower", read: (s) => s.demo?.taken },
];

export type Averages = { games: number; values: Record<string, number | null> };

// Per-game averages over every game that has detailed stats.
export function averageStats(blocks: unknown[]): Averages {
  const withStats = blocks.filter((b): b is Block => !!b && typeof b === "object");
  const values: Record<string, number | null> = {};
  for (const m of METRICS) {
    const nums = withStats.map((b) => m.read(b)).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    values[m.key] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }
  return { games: withStats.length, values };
}

export function formatMetric(m: Metric, v: number | null | undefined): string {
  if (v == null) return "–";
  const digits = m.digits ?? (Math.abs(v) >= 100 ? 0 : 1);
  return `${v.toFixed(digits)}${m.unit}`;
}
