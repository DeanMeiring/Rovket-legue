"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkTrackerModal({ initialOpen }: { initialOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rlTrackerUrl: url, ...(platform && { platform }) }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save that link — double check the URL.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h2 className="text-xl font-bold mb-1">Link your Rocket League Tracker</h2>
        <p className="text-slate-400 text-sm mb-4">
          Add your Tracker profile so admins can pull up your rank and stats. You can
          also do this later from your player profile.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Rocket League Tracker URL</label>
            <input
              className="input"
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://rocketleague.tracker.network/rocket-league/profile/..."
            />
          </div>
          <div>
            <label className="label">Platform (optional)</label>
            <input
              className="input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Steam / Epic / PS / Xbox"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Maybe later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
