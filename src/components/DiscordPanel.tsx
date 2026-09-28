"use client";

import { useEffect, useState } from "react";

type Status = {
  enabled: boolean;
  missing: string[];
  interactionsUrl: string | null;
  linked: number;
  players: number;
  teams: { id: string; name: string; ready: boolean }[];
};

// Admin: the BC Discord bot's setup state and its two setup buttons.
export default function DiscordPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/discord");
    if (res.ok) setStatus(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function run(action: string) {
    setBusy(action);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) setMessage(data.message);
    else setError(data.error || "Discord didn't accept that.");
    await load();
  }

  if (!status) return null;

  return (
    <section className="card">
      <h2 className="font-bold text-lg mb-1">Discord bot</h2>
      {!status.enabled ? (
        <p className="text-slate-400 text-sm">Not connected yet. Add these in Railway: {status.missing.join(", ")}.</p>
      ) : (
        <>
          <p className="text-slate-500 text-sm mb-4">
            {status.linked} of {status.players} players have linked Discord with /link.
            {status.missing.length > 0 && ` Still missing: ${status.missing.join(", ")}.`}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => run("register-commands")} disabled={!!busy} className="btn-secondary text-sm">
              {busy === "register-commands" ? "Registering..." : "Register /link command"}
            </button>
            <button onClick={() => run("sync-teams")} disabled={!!busy} className="btn-secondary text-sm">
              {busy === "sync-teams" ? "Setting up..." : "Set up team roles and channels"}
            </button>
          </div>
          <ul className="text-sm space-y-1">
            {status.teams.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.name}</span>
                <span className={t.ready ? "text-green-400" : "text-slate-500"}>
                  {t.ready ? "Role, category, text and voice ready" : "Not set up"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {status.interactionsUrl && (
        <p className="text-xs text-slate-500 mt-4">
          Interactions Endpoint URL for the Discord developer portal:{" "}
          <code className="text-slate-300 break-all">{status.interactionsUrl}</code>
        </p>
      )}
      {message && <p className="text-green-400 text-sm mt-3">{message}</p>}
      {error && <p className="text-red-400 text-sm mt-3 break-words">{error}</p>}
    </section>
  );
}
