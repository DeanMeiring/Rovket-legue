"use client";

import { RANKS, PLAYLISTS } from "@/lib/ranks";

export type RankValues = { rank1v1: string; rank2v2: string; rank3v3: string };

export default function RankPicker({
  value,
  onChange,
  required = false,
}: {
  value: RankValues;
  onChange: (next: RankValues) => void;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PLAYLISTS.map((p) => (
        <div key={p.key}>
          <label className="label text-xs">{p.label}</label>
          <select
            className="input !py-1.5 text-sm"
            value={value[p.key]}
            required={required}
            onChange={(e) => onChange({ ...value, [p.key]: e.target.value })}
          >
            <option value="">{required ? "Select rank..." : "—"}</option>
            {RANKS.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
