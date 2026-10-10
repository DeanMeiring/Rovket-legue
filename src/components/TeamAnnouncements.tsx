"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  team: string;
  sub: boolean;
  captain: string | null;
  discord: boolean;
  status: "new" | "moved" | "told";
  message: string;
};

const STATUS: Record<Row["status"], string> = {
  new: "Not told yet",
  moved: "Moved team",
  told: "Told",
};

// Admin panel card: tells players which team they made (and their captain),
// by email and Discord DM. Nothing is sent until Send is pressed.
export default function TeamAnnouncements({ refresh }: { refresh: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/team-announcements");
    if (!res.ok) return;
    const data: { players: Row[] } = await res.json();
    setRows(data.players);
    setPicked(new Set(data.players.filter((r) => r.status !== "told").map((r) => r.id)));
  }

  useEffect(() => {
    load();
  }, [refresh]);

  async function send() {
    const ids = [...picked];
    if (!ids.length) return;
    if (!confirm(`Email and Discord-message ${ids.length} player${ids.length === 1 ? "" : "s"} their team now?`)) return;
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/team-announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setResult(data.error || "Sending failed.");
    setResult(
      `Told ${data.sent} player${data.sent === 1 ? "" : "s"}.` +
        (data.noDm?.length ? ` Email only, no Discord message, for: ${data.noDm.join(", ")}.` : ""),
    );
    await load();
  }

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="card">
      <h2 className="font-bold text-lg mb-1">Announce teams</h2>
      <p className="text-sm text-slate-400 mb-4">
        Tells each player the team they made and who their captain is, by email and a Discord DM. Subs get their own
        message. Players still in Tryouts or BC USSA aren&apos;t listed. Ticked by default: everyone not told about
        their current team yet.
      </p>
      {!rows && <p className="text-slate-500 text-sm">Loading...</p>}
      {rows?.length === 0 && <p className="text-slate-500 text-sm">Nobody is on a team yet.</p>}
      {!!rows?.length && (
        <>
          <ul className="divide-y divide-border/60 text-sm mb-4">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-slate-400">
                    {r.team}
                    {!r.sub && ` · captain ${r.captain ?? "not picked"}`}
                  </span>
                  <span
                    className={`badge ${r.status === "told" ? "bg-green-500/15 text-green-300" : "bg-yellow-500/15 text-yellow-300"}`}
                  >
                    {STATUS[r.status]}
                  </span>
                  {!r.discord && <span className="text-xs text-slate-500">email only (no Discord linked)</span>}
                  <button
                    className="text-xs text-accent2 hover:underline ml-auto"
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    {open === r.id ? "Hide message" : "See message"}
                  </button>
                </div>
                {open === r.id && <p className="mt-2 ml-7 text-slate-300 bg-panel2 rounded-lg px-3 py-2">{r.message}</p>}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn-primary" onClick={send} disabled={busy || picked.size === 0}>
              {busy ? "Sending..." : `Send to ${picked.size} player${picked.size === 1 ? "" : "s"}`}
            </button>
            {result && <p className="text-sm text-slate-300">{result}</p>}
          </div>
        </>
      )}
    </section>
  );
}
