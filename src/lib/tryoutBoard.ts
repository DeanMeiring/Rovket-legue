import { divisionValue, midValue, Tier, SubRank, Division } from "@/lib/ranks";

// Pure helpers behind /admin/tryout-board. Everything works in the app's own
// MMR scale (see ranks.ts) so the board and the team balancer agree.

export type BoardPlayer = {
  id: string;
  tag: string;
  name: string | null;
  currentTeam: number; // 0 = new, 1 = first team (locked), 2-4 = other teams
  rank2v2: number | null;
  rank3v3: number | null;
  notes: string | null;
  userId: string | null;
};

// A bit over one sub-rank at Champion level (C1 ≈ 1041-1150). Higher ranks
// have wider MMR bands, so a tighter cutoff flags half the roster. A 2v2/3v3
// gap this far from the roster's usual gap is worth a second look.
export const GAP_FLAG_MMR = 150;

// Teams 2-4 are trios; first team stays locked.
export const OPEN_TEAMS = 3;
export const OPEN_SPOTS = OPEN_TEAMS * 3;

export type Flag = "understated" | "specialist" | "challenger";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function gapOf(p: BoardPlayer): number | null {
  return p.rank2v2 != null && p.rank3v3 != null ? p.rank2v2 - p.rank3v3 : null;
}

export function medianGap(players: BoardPlayer[]): number | null {
  return median(players.map(gapOf).filter((g): g is number => g != null));
}

export function firstTeamFloor(players: BoardPlayer[]): number | null {
  const ranks = players
    .filter((p) => p.currentTeam === 1 && p.rank3v3 != null)
    .map((p) => p.rank3v3 as number);
  return ranks.length ? Math.min(...ranks) : null;
}

export function flagsFor(p: BoardPlayer, medGap: number | null, t1Floor: number | null): Flag[] {
  const flags: Flag[] = [];
  const gap = gapOf(p);
  if (gap != null && medGap != null) {
    if (gap - medGap >= GAP_FLAG_MMR) flags.push("understated");
    if (medGap - gap >= GAP_FLAG_MMR) flags.push("specialist");
  }
  if (p.currentTeam !== 1 && t1Floor != null && p.rank3v3 != null && p.rank3v3 >= t1Floor) {
    flags.push("challenger");
  }
  return flags;
}

export function byRank(a: BoardPlayer, b: BoardPlayer): number {
  return (b.rank3v3 ?? -1) - (a.rank3v3 ?? -1) || (b.rank2v2 ?? -1) - (a.rank2v2 ?? -1);
}

export function avg3v3(team: BoardPlayer[]): number | null {
  const r = team.map((p) => p.rank3v3).filter((v): v is number => v != null);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
}

export type Layouts = {
  firstTeam: BoardPlayer[];
  tiered: BoardPlayer[][];
  balanced: BoardPlayer[][];
  subs: BoardPlayer[];
};

// Tiered: strongest remaining trio is team 2, next is team 3, and so on.
// Balanced: snake draft, then pairwise swaps until the spread stops shrinking.
export function buildLayouts(players: BoardPlayer[]): Layouts {
  const firstTeam = players.filter((p) => p.currentTeam === 1).sort(byRank);
  const pool = players.filter((p) => p.currentTeam !== 1).sort(byRank);
  const starters = pool.slice(0, OPEN_SPOTS);
  const subs = pool.slice(OPEN_SPOTS);

  const tiered = Array.from({ length: OPEN_TEAMS }, (_, i) => starters.slice(i * 3, i * 3 + 3));

  const balanced: BoardPlayer[][] = Array.from({ length: OPEN_TEAMS }, () => []);
  const snake = [0, 1, 2, 2, 1, 0, 0, 1, 2];
  starters.forEach((p, i) => balanced[snake[i]].push(p));

  const spread = (teams: BoardPlayer[][]) => {
    const a = teams.map((t) => avg3v3(t) ?? 0);
    return Math.max(...a) - Math.min(...a);
  };
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < OPEN_TEAMS; a++)
      for (let b = a + 1; b < OPEN_TEAMS; b++)
        for (let i = 0; i < balanced[a].length; i++)
          for (let j = 0; j < balanced[b].length; j++) {
            const before = spread(balanced);
            [balanced[a][i], balanced[b][j]] = [balanced[b][j], balanced[a][i]];
            if (spread(balanced) < before - 1e-9) improved = true;
            else [balanced[a][i], balanced[b][j]] = [balanced[b][j], balanced[a][i]];
          }
  }
  balanced.sort((x, y) => (avg3v3(y) ?? 0) - (avg3v3(x) ?? 0));

  return { firstTeam, tiered, balanced, subs };
}

// Converts the "C2 d3" shorthand from the original Tryout Board to MMR.
// A missing division counts as mid-rank; "2.5" (between divs) averages 2 and 3.
const SHORT_TIER: Record<string, [Tier, SubRank | null]> = {
  D1: ["Diamond", "I"],
  D2: ["Diamond", "II"],
  D3: ["Diamond", "III"],
  C1: ["Champion", "I"],
  C2: ["Champion", "II"],
  C3: ["Champion", "III"],
  GC1: ["Grand Champion", "I"],
  GC2: ["Grand Champion", "II"],
  GC3: ["Grand Champion", "III"],
  SSL: ["Supersonic Legend", null],
};

function shortToMmr(rank: string, div: number | null): number {
  const [tier, sub] = SHORT_TIER[rank];
  if (div == null || sub == null) return midValue(tier, sub);
  if (!Number.isInteger(div)) {
    const lo = divisionValue(tier, sub, Math.floor(div) as Division);
    const hi = divisionValue(tier, sub, Math.ceil(div) as Division);
    return Math.round((lo + hi) / 2);
  }
  return divisionValue(tier, sub, div as Division);
}

// Roster as of 28 Sep 2026, from the project's Tryout Board. Only used by the
// one-off "Load starting roster" button when the board is empty.
const STARTER: [string, string, number, string, number | null, string, number | null][] = [
  ["xd Artix", "Pieter", 1, "C3", null, "GC2", null],
  ["321881", "Sergio", 1, "C2", 3, "GC1", 4],
  ["The Deniboy", "Dean", 1, "C2", 4, "GC1", 4],
  ["za_Rivalz", "Robert", 2, "C2", 3, "C3", 4],
  ["Øctaシ", "Ethan", 2, "C1", 4, "C3", 4],
  ["MedicMike", "Michael", 2, "C1", 2, "C3", 2.5],
  ["Fire火.", "Armand", 3, "C1", 2, "C3", 2],
  ["GoatedCrayons_YT", "Chraeten", 3, "C1", 2, "C2", null],
  ["ily Psycho.", "Kian", 3, "C2", 1, "C3", 4],
  ["Err0r_x4o4", "Michael", 4, "D2", 4, "C1", 4],
  ["Cyb0rg8", "Ivahn", 4, "D1", 4, "D3", 4],
  ["Solo_Vortexツ", "Thorne", 4, "C1", 1, "C2", 3],
  ["DisguisedPittie", "Wynand", 0, "D1", 1, "D1", 1],
  ["Rainy.µ", "Seitshiro", 0, "D3", 1, "GC1", 1],
];

export const STARTER_ROSTER = STARTER.map(([tag, name, currentTeam, r3, d3, r2, d2]) => ({
  tag,
  name,
  currentTeam,
  rank3v3: shortToMmr(r3, d3),
  rank2v2: shortToMmr(r2, d2),
}));
