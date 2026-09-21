"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PreciseRankPicker from "@/components/PreciseRankPicker";
import { PLAYLISTS } from "@/lib/ranks";

type RankValues = { rank1v1: number | null; rank2v2: number | null; rank3v3: number | null };

export default function CompleteProfileModal({
  initialOpen,
  needsTracker,
  initialRanks,
}: {
  initialOpen: boolean;
  needsTracker: boolean;
  initialRanks: RankValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [trackerUrl, setTrackerUrl] = useState("");
  const [ranks, setRanks] = useState<RankValues>(initialRanks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function save(markComplete: boolean, includeTracker: boolean) {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(includeTracker && trackerUrl ? { rlTrackerUrl: trackerUrl } : {}),
        rank1v1Value: ranks.rank1v1,
        rank2v2Value: ranks.rank2v2,
        rank3v3Value: ranks.rank3v3,
        profileCompleted: markComplete,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save — try again.");
      return false;
    }

    setOpen(false);
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save(true, needsTracker);
  }

  async function skip() {
    await save(true, false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">Complete your profile</h2>
        <p className="text-slate-400 text-sm mb-4">
          You&apos;re approved! Pin down your exact rank — tier, sub-rank, and division —
          so tryout teams end up properly balanced. &quot;Champion III Div 1&quot; and
          &quot;Champion III Div 4&quot; play very differently even though it&apos;s the
          same tier.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {needsTracker && (
            <div>
              <label className="label">Rocket League Tracker URL</label>
              <input
                className="input"
                type="url"
                value={trackerUrl}
                onChange={(e) => setTrackerUrl(e.target.value)}
                placeholder="https://rocketleague.tracker.network/rocket-league/profile/..."
              />
            </div>
          )}
          {PLAYLISTS.map((p) => (
            <div key={p.key}>
              <label className="label">{p.label}</label>
              <PreciseRankPicker
                value={ranks[p.key]}
                onChange={(v) => setRanks((r) => ({ ...r, [p.key]: v }))}
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn-secondary" onClick={skip} disabled={saving}>
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
