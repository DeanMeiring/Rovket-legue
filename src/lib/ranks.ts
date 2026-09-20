// Simplified ordinal scale for internal team balancing — not real MMR.
// What matters is that higher ranks sort above lower ones consistently.
export const RANKS: { label: string; value: number }[] = [
  { label: "Bronze I", value: 100 },
  { label: "Bronze II", value: 150 },
  { label: "Bronze III", value: 200 },
  { label: "Silver I", value: 250 },
  { label: "Silver II", value: 300 },
  { label: "Silver III", value: 350 },
  { label: "Gold I", value: 400 },
  { label: "Gold II", value: 450 },
  { label: "Gold III", value: 500 },
  { label: "Platinum I", value: 550 },
  { label: "Platinum II", value: 600 },
  { label: "Platinum III", value: 650 },
  { label: "Diamond I", value: 700 },
  { label: "Diamond II", value: 750 },
  { label: "Diamond III", value: 800 },
  { label: "Champion I", value: 850 },
  { label: "Champion II", value: 900 },
  { label: "Champion III", value: 950 },
  { label: "Grand Champion I", value: 1000 },
  { label: "Grand Champion II", value: 1050 },
  { label: "Grand Champion III", value: 1100 },
  { label: "Supersonic Legend", value: 1150 },
];

export function rankLabelForValue(value: number | null | undefined): string | null {
  if (value == null) return null;
  let closest = RANKS[0];
  for (const rank of RANKS) {
    if (Math.abs(rank.value - value) < Math.abs(closest.value - value)) closest = rank;
  }
  return closest.label;
}
