"use client";

import { useEffect, useState } from "react";

type Name = { name: string; games: number; goals: number; saves: number; score: number };
type Player = { id: string; name: string; designated: boolean };

// Asks who each unmatched in-game name from a ballchasing import is. Picking a
// player moves that name's stats onto them; "Not one of ours" drops them.
export default function UnmatchedModal({
  eventId,
  onClose,
  onChanged,
}: {
  eventId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [names, setNames] = useState<Name[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/events/${eventId}/unmatched`);
    if (!res.ok) return;
    const data = await res.json();
    setNames(data.names);
    setPlayers(data.players);
    if (!data.names.length) onClose();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function assign(name: string, userId: string | null) {
    setBusy(name);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/unmatched`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userId, remember }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(data.error || "Couldn't save that.");
    onChanged();
    await load();
  }

  const undesignated = players.filter((p) => !p.designated);
  const others = players.filter((p) => p.designated);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-label="Who is this?"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-bold text-lg">Who is this?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            Close
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          These in-game names from the replays didn&apos;t match an account. Pick who each one is and their stats move
          onto that player.
        </p>
        {names === null && <p className="text-sm text-slate-500">Loading...</p>}
        <ul className="space-y-4">
          {names?.map((n) => (
            <li key={n.name} className="border border-border rounded-lg p-3">
              <p className="font-semibold">{n.name}</p>
              <p className="text-xs text-slate-400 mb-2">
                {n.games} game{n.games === 1 ? "" : "s"} · {n.goals} goals · {n.saves} saves · {n.score} pts
              </p>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="input !w-auto flex-1 min-w-0"
                  value={picked[n.name] ?? ""}
                  onChange={(e) => setPicked({ ...picked, [n.name]: e.target.value })}
                >
                  <option value="">Choose a player...</option>
                  {undesignated.length > 0 && (
                    <optgroup label="Undesignated players (no stats yet)">
                      {undesignated.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {others.length > 0 && (
                    <optgroup label="Players who already have stats">
                      {others.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={() => assign(n.name, picked[n.name])}
                  disabled={!picked[n.name] || busy !== null}
                  className="btn-primary !py-2 !px-3 text-sm"
                >
                  {busy === n.name ? "Saving..." : "Assign"}
                </button>
                <button
                  onClick={() => assign(n.name, null)}
                  disabled={busy !== null}
                  className="btn-secondary !py-2 !px-3 text-sm"
                >
                  Not one of ours
                </button>
              </div>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2 text-sm mt-4">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember these names for future imports
        </label>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}
