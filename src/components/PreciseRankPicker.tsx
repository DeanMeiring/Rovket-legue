"use client";

import {
  TIERS,
  SUB_RANKS,
  tierHasSubRanks,
  midValue,
  divisionValue,
  decomposeValue,
  Tier,
  SubRank,
  Division,
} from "@/lib/ranks";

export default function PreciseRankPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const decomposed = decomposeValue(value);
  const tier = decomposed?.tier ?? "";
  const sub = decomposed?.sub ?? "";
  const division = decomposed?.division ?? "";

  function setTier(newTier: string) {
    if (!newTier) {
      onChange(null);
      return;
    }
    const t = newTier as Tier;
    onChange(tierHasSubRanks(t) ? midValue(t, "I") : midValue(t, null));
  }

  function setSub(newSub: string) {
    if (!tier || !newSub) return;
    onChange(midValue(tier as Tier, newSub as SubRank));
  }

  function setDivision(newDiv: string) {
    if (!tier || !sub) return;
    if (!newDiv) {
      onChange(midValue(tier as Tier, sub as SubRank));
      return;
    }
    onChange(divisionValue(tier as Tier, sub as SubRank, Number(newDiv) as Division));
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className="input !py-1.5 text-sm" value={tier} onChange={(e) => setTier(e.target.value)}>
        <option value="">Not sure</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="input !py-1.5 text-sm"
        value={sub}
        disabled={!tier || !tierHasSubRanks(tier as Tier)}
        onChange={(e) => setSub(e.target.value)}
      >
        <option value="">—</option>
        {SUB_RANKS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="input !py-1.5 text-sm"
        value={division}
        disabled={!tier || !sub}
        onChange={(e) => setDivision(e.target.value)}
      >
        <option value="">Div?</option>
        {[1, 2, 3, 4].map((d) => (
          <option key={d} value={d}>
            Div {d}
          </option>
        ))}
      </select>
    </div>
  );
}
