// Per-player averages across tryout games, built from TryoutGameStat rows.
// Used by the games page table and fed to the AI evaluation.

export type StatRow = {
  playerId: string;
  win: boolean;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  score: number;
  mvp: boolean;
  boostPerMinute: number | null;
  avgSpeed: number | null;
  percentBehindBall: number | null;
  demosInflicted: number | null;
  raw: unknown;
};

export type PlayerSummary = {
  playerId: string;
  games: number;
  wins: number;
  mvps: number;
  avgScore: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  demos: number;
  avgBoostPerMinute: number | null;
  avgSpeed: number | null;
  percentBehindBall: number | null;
  percentMostBack: number | null;
  avgDistanceToMates: number | null;
  goalsConcededAsLastDefender: number;
};

function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function positioning(raw: unknown): Record<string, number | undefined> {
  const p = (raw as { positioning?: Record<string, number> } | null)?.positioning;
  return p ?? {};
}

export function summarize(rows: StatRow[]): PlayerSummary[] {
  const byPlayer = new Map<string, StatRow[]>();
  rows.forEach((r) => byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r]));

  return [...byPlayer.entries()]
    .map(([playerId, rs]) => ({
      playerId,
      games: rs.length,
      wins: rs.filter((r) => r.win).length,
      mvps: rs.filter((r) => r.mvp).length,
      avgScore: rs.reduce((a, r) => a + r.score, 0) / rs.length,
      goals: rs.reduce((a, r) => a + r.goals, 0),
      assists: rs.reduce((a, r) => a + r.assists, 0),
      saves: rs.reduce((a, r) => a + r.saves, 0),
      shots: rs.reduce((a, r) => a + r.shots, 0),
      demos: rs.reduce((a, r) => a + (r.demosInflicted ?? 0), 0),
      avgBoostPerMinute: mean(rs.map((r) => r.boostPerMinute)),
      avgSpeed: mean(rs.map((r) => r.avgSpeed)),
      percentBehindBall: mean(rs.map((r) => r.percentBehindBall)),
      percentMostBack: mean(rs.map((r) => positioning(r.raw).percent_most_back)),
      avgDistanceToMates: mean(rs.map((r) => positioning(r.raw).avg_distance_to_mates)),
      goalsConcededAsLastDefender: rs.reduce(
        (a, r) => a + (positioning(r.raw).goals_against_while_last_defender ?? 0),
        0
      ),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}
