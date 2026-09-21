// Approximate 3v3 Standard MMR ranges per rank tier/sub-rank, based on
// community-tracked data (strafe.com's Rocket League ranks guide, cross-checked
// against esportnow.gg). These shift a little every season — good enough for
// internal team balancing, not meant to match live tracker.gg numbers exactly.
export type Tier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Champion"
  | "Grand Champion"
  | "Supersonic Legend";

export type SubRank = "I" | "II" | "III";
export type Division = 1 | 2 | 3 | 4;

type TierRange = { tier: Tier; sub: SubRank | null; min: number; max: number };

const TIER_RANGES: TierRange[] = [
  { tier: "Bronze", sub: "I", min: 0, max: 170 },
  { tier: "Bronze", sub: "II", min: 171, max: 230 },
  { tier: "Bronze", sub: "III", min: 231, max: 290 },
  { tier: "Silver", sub: "I", min: 291, max: 350 },
  { tier: "Silver", sub: "II", min: 351, max: 410 },
  { tier: "Silver", sub: "III", min: 411, max: 470 },
  { tier: "Gold", sub: "I", min: 471, max: 530 },
  { tier: "Gold", sub: "II", min: 531, max: 590 },
  { tier: "Gold", sub: "III", min: 591, max: 650 },
  { tier: "Platinum", sub: "I", min: 651, max: 710 },
  { tier: "Platinum", sub: "II", min: 711, max: 770 },
  { tier: "Platinum", sub: "III", min: 771, max: 834 },
  { tier: "Diamond", sub: "I", min: 835, max: 901 },
  { tier: "Diamond", sub: "II", min: 902, max: 970 },
  { tier: "Diamond", sub: "III", min: 971, max: 1040 },
  { tier: "Champion", sub: "I", min: 1041, max: 1150 },
  { tier: "Champion", sub: "II", min: 1151, max: 1260 },
  { tier: "Champion", sub: "III", min: 1261, max: 1434 },
  { tier: "Grand Champion", sub: "I", min: 1435, max: 1560 },
  { tier: "Grand Champion", sub: "II", min: 1561, max: 1690 },
  { tier: "Grand Champion", sub: "III", min: 1691, max: 1860 },
  { tier: "Supersonic Legend", sub: null, min: 1861, max: 2200 },
];

export const TIERS: Tier[] = TIER_RANGES.reduce<Tier[]>((acc, r) => {
  if (!acc.includes(r.tier)) acc.push(r.tier);
  return acc;
}, []);

export const SUB_RANKS: SubRank[] = ["I", "II", "III"];

export function tierHasSubRanks(tier: Tier): boolean {
  return tier !== "Supersonic Legend";
}

function findRange(tier: Tier, sub: SubRank | null): TierRange {
  return (
    TIER_RANGES.find((r) => r.tier === tier && r.sub === sub) ??
    TIER_RANGES[TIER_RANGES.length - 1]
  );
}

export function midValue(tier: Tier, sub: SubRank | null): number {
  const r = findRange(tier, sub);
  return Math.round((r.min + r.max) / 2);
}

export function divisionValue(tier: Tier, sub: SubRank | null, division: Division): number {
  const r = findRange(tier, sub);
  const width = (r.max - r.min + 1) / 4;
  const start = r.min + width * (division - 1);
  return Math.round(start + width / 2);
}

// Coarse Tier+SubRank picker (used at signup — quick, low-friction).
export const RANKS: { label: string; value: number }[] = TIER_RANGES.map((r) => ({
  label: r.sub ? `${r.tier} ${r.sub}` : r.tier,
  value: Math.round((r.min + r.max) / 2),
}));

export function rankLabelForValue(value: number | null | undefined): string | null {
  if (value == null) return null;
  const match =
    TIER_RANGES.find((r) => value >= r.min && value <= r.max) ??
    (value < TIER_RANGES[0].min ? TIER_RANGES[0] : TIER_RANGES[TIER_RANGES.length - 1]);
  return match.sub ? `${match.tier} ${match.sub}` : match.tier;
}

// More precise label once a division has been set, e.g. "Champion III Div 2".
export function preciseRankLabel(value: number | null | undefined): string | null {
  if (value == null) return null;
  const match =
    TIER_RANGES.find((r) => value >= r.min && value <= r.max) ??
    (value < TIER_RANGES[0].min ? TIER_RANGES[0] : TIER_RANGES[TIER_RANGES.length - 1]);
  if (!match.sub) return match.tier;
  const width = (match.max - match.min + 1) / 4;
  const division = Math.min(4, Math.max(1, Math.floor((value - match.min) / width) + 1));
  return `${match.tier} ${match.sub} Div ${division}`;
}

export function decomposeValue(
  value: number | null | undefined
): { tier: Tier; sub: SubRank | null; division: Division | null } | null {
  if (value == null) return null;
  const match =
    TIER_RANGES.find((r) => value >= r.min && value <= r.max) ??
    (value < TIER_RANGES[0].min ? TIER_RANGES[0] : TIER_RANGES[TIER_RANGES.length - 1]);
  if (!match.sub) return { tier: match.tier, sub: null, division: null };
  const width = (match.max - match.min + 1) / 4;
  const division = Math.min(4, Math.max(1, Math.floor((value - match.min) / width) + 1)) as Division;
  return { tier: match.tier, sub: match.sub, division };
}

export const PLAYLISTS: { key: "rank1v1" | "rank2v2" | "rank3v3"; label: string }[] = [
  { key: "rank1v1", label: "1v1 (Duel)" },
  { key: "rank2v2", label: "2v2 (Doubles)" },
  { key: "rank3v3", label: "3v3 (Standard)" },
];
