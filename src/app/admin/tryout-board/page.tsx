"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PreciseRankPicker from "@/components/PreciseRankPicker";
import { preciseRankLabel } from "@/lib/ranks";
import {
  BoardPlayer,
  Flag,
  GAP_FLAG_MMR,
  OPEN_SPOTS,
  avg3v3,
  buildLayouts,
  byRank,
  firstTeamFloor,
  flagsFor,
  gapOf,
  medianGap,
  STARTER_ROSTER,
} from "@/lib/tryoutBoard";

const TEAM_OPTIONS = [
  { value: 0, label: "New" },
  { value: 1, label: "Team 1" },
  { value: 2, label: "Team 2" },
  { value: 3, label: "Team 3" },
  { value: 4, label: "Team 4" },
];

const FLAG_STYLE: Record<Flag, { label: string; className: string }> = {
  understated: { label: "3v3 may understate", className: "bg-yellow-500/15 text-yellow-300" },
  specialist: { label: "3v3 specialist", className: "bg-accent2/15 text-accent2" },
  challenger: { label: "Standout rank", className: "bg-accent/15 text-accent" },
};

type Draft = {
  tag: string;
  name: string;
  currentTeam: number;
  rank3v3: number | null;
  rank2v2: number | null;
  notes: string;
};

const EMPTY_DRAFT: Draft = { tag: "", name: "", currentTeam: 0, rank3v3: null, rank2v2: null, notes: "" };

function rankText(v: number | null) {
  return preciseRankLabel(v) ?? "—";
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${Math.round(n)}`;
}

export default function TryoutBoardPage() {
  const [players, setPlayers] = useState<BoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"tiered" | "balanced">("tiered");

  async function load() {
    const res = await fetch("/api/admin/tryout-players");
    if (res.ok) setPlayers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const medGap = useMemo(() => medianGap(players), [players]);
  const t1Floor = useMemo(() => firstTeamFloor(players), [players]);
  const layouts = useMemo(() => buildLayouts(players), [players]);
  const sorted = useMemo(() => [...players].sort(byRank), [players]);

  const challengers = players.filter((p) => flagsFor(p, medGap, t1Floor).includes("challenger"));
  const understated = players.filter((p) => flagsFor(p, medGap, t1Floor).includes("understated"));
  const poolSize = players.filter((p) => p.currentTeam !== 1).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.tag.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      tag: draft.tag.trim(),
      name: draft.name.trim() || null,
      currentTeam: draft.currentTeam,
      rank3v3: draft.rank3v3,
      rank2v2: draft.rank2v2,
      notes: draft.notes.trim() || null,
    };
    const res = await fetch(editingId ? `/api/admin/tryout-players/${editingId}` : "/api/admin/tryout-players", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save that player.");
      return;
    }
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    await load();
  }

  function startEdit(p: BoardPlayer) {
    setEditingId(p.id);
    setDraft({
      tag: p.tag,
      name: p.name ?? "",
      currentTeam: p.currentTeam,
      rank3v3: p.rank3v3,
      rank2v2: p.rank2v2,
      notes: p.notes ?? "",
    });
    document.getElementById("player-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function setTeam(p: BoardPlayer, currentTeam: number) {
    setPlayers((ps) => ps.map((x) => (x.id === p.id ? { ...x, currentTeam } : x)));
    await fetch(`/api/admin/tryout-players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentTeam }),
    });
  }

  async function remove(p: BoardPlayer) {
    if (!confirm(`Remove ${p.tag} from the tryout board?`)) return;
    await fetch(`/api/admin/tryout-players/${p.id}`, { method: "DELETE" });
    if (editingId === p.id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
    await load();
  }

  async function runImport(source: "starter" | "signups") {
    setNotice(null);
    setError(null);
    const res = await fetch("/api/admin/tryout-players/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Import failed.");
      return;
    }
    if (source === "starter") {
      setNotice(`Loaded ${data.added} players.`);
    } else {
      setNotice(
        data.added || data.linked
          ? `Added ${data.added} new sign-ups and linked ${data.linked} existing players to their accounts.`
          : "Every sign-up is already on the board."
      );
    }
    await load();
  }

  const openTeams = mode === "tiered" ? layouts.tiered : layouts.balanced;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">
            ← Admin panel
          </Link>
          <h1 className="text-3xl font-bold">Tryout board</h1>
          <p className="text-slate-500 text-sm mt-1">
            3v3 tryout roster and provisional teams. Ranks are a starting point, tryout play decides.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/tryout-games" className="btn-primary">
            Tryout games
          </Link>
          <button className="btn-secondary" onClick={() => runImport("signups")}>
            Import app sign-ups
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {notice && <p className="text-accent2 text-sm">{notice}</p>}
      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && players.length === 0 && (
        <section className="card space-y-3">
          <h2 className="font-bold text-lg">The board is empty</h2>
          <p className="text-slate-500 text-sm">
            Load the {STARTER_ROSTER.length}-player roster from the original tryout plan, pull in everyone who signed up
            through the app, or add players by hand below.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" onClick={() => runImport("starter")}>
              Load starting roster
            </button>
            <button className="btn-secondary" onClick={() => runImport("signups")}>
              Import app sign-ups
            </button>
          </div>
        </section>
      )}

      {players.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card !p-4 border-l-4 !border-l-accent2">
            <p className="font-semibold">
              {poolSize} players for {OPEN_SPOTS} team spots
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {poolSize > OPEN_SPOTS
                ? `${poolSize - OPEN_SPOTS} currently land as subs. `
                : `${OPEN_SPOTS - poolSize} spots still open. `}
              You want 2 to 4 subs, so {Math.max(0, OPEN_SPOTS + 4 - poolSize)} more can join before anyone is cut.
            </p>
          </div>
          {challengers.length > 0 && (
            <div className="card !p-4 border-l-4 !border-l-accent">
              <p className="font-semibold">Standout ranks</p>
              <p className="text-sm text-slate-400 mt-1">
                {challengers.map((p) => p.tag).join(", ")} {challengers.length > 1 ? "have" : "has"} a 3v3 rank at Team
                1&apos;s level. Worth a close look in tryouts.
              </p>
            </div>
          )}
          {understated.length > 0 && (
            <div className="card !p-4 border-l-4 !border-l-yellow-500">
              <p className="font-semibold">Rank gaps worth a look</p>
              <p className="text-sm text-slate-400 mt-1">
                {understated
                  .map((p) => `${p.tag} is ${rankText(p.rank2v2)} in 2v2 but ${rankText(p.rank3v3)} in 3v3`)
                  .join("; ")}
                . Judge them on tryout play, not 3v3 rank.
              </p>
            </div>
          )}
        </section>
      )}

      {players.length > 0 && (
        <section className="card">
          <h2 className="font-bold text-lg mb-1">Roster ({players.length})</h2>
          <p className="text-slate-500 text-xs mb-4">
            Gap is 2v2 minus 3v3 MMR. Flags fire when a player&apos;s gap is {GAP_FLAG_MMR}+ MMR from this roster&apos;s
            median{medGap != null ? ` (${signed(medGap)})` : ""}, or when their 3v3 is at or above the lowest Team 1
            3v3.
          </p>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-border">
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Current</th>
                  <th className="py-2 pr-3">3v3</th>
                  <th className="py-2 pr-3">2v2</th>
                  <th className="py-2 pr-3 text-right">Gap</th>
                  <th className="py-2 pr-3">Flags</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const gap = gapOf(p);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border/60 align-top ${p.currentTeam === 1 ? "bg-panel2/60" : ""}`}
                    >
                      <td className="py-2 pr-3">
                        <p className="font-medium">
                          {p.tag}
                          {p.userId && (
                            <span className="badge bg-accent2/15 text-accent2 ml-2" title="Linked to an app account">
                              account
                            </span>
                          )}
                        </p>
                        {p.name && <p className="text-xs text-slate-500">{p.name}</p>}
                        {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          className="input !py-1 !w-auto text-sm"
                          value={p.currentTeam}
                          onChange={(e) => setTeam(p, Number(e.target.value))}
                        >
                          {TEAM_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{rankText(p.rank3v3)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{rankText(p.rank2v2)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{gap == null ? "—" : signed(gap)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {flagsFor(p, medGap, t1Floor).map((f) => (
                            <span key={f} className={`badge ${FLAG_STYLE[f].className}`}>
                              {FLAG_STYLE[f].label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 whitespace-nowrap text-right">
                        <button className="text-accent2 hover:underline text-xs mr-3" onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button className="text-red-400 hover:underline text-xs" onClick={() => remove(p)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" id="player-form">
        <h2 className="font-bold text-lg mb-4">{editingId ? "Edit player" : "Add a player"}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Gamertag</label>
              <input
                className="input"
                required
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Current team</label>
              <select
                className="input"
                value={draft.currentTeam}
                onChange={(e) => setDraft({ ...draft, currentTeam: Number(e.target.value) })}
              >
                {TEAM_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">3v3 rank</label>
              <PreciseRankPicker value={draft.rank3v3} onChange={(v) => setDraft({ ...draft, rank3v3: v })} />
            </div>
            <div>
              <label className="label">2v2 rank</label>
              <PreciseRankPicker value={draft.rank2v2} onChange={(v) => setDraft({ ...draft, rank2v2: v })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              placeholder="Optional, e.g. no sign-up form yet"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add player"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setDraft(EMPTY_DRAFT);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {players.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-lg">Provisional teams</h2>
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
              {(["tiered", "balanced"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 ${mode === m ? "bg-accent text-black font-semibold" : "bg-panel2 text-slate-300"}`}
                >
                  {m === "tiered" ? "Tiered" : "Balanced"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-slate-500 text-sm">
            {mode === "tiered"
              ? "Strongest remaining trio is Team 2, and so on. Best fit if teams enter different divisions."
              : "Teams 2 to 4 kept within a narrow rank band. Best fit if they all enter the same division."}{" "}
            Nothing here changes anyone&apos;s real team.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TeamCard title="Team 1" players={layouts.firstTeam} highlight />
            {openTeams.map((t, i) => (
              <TeamCard key={i} title={`Team ${i + 2}`} players={t} />
            ))}
            <TeamCard title={`Subs (${layouts.subs.length})`} players={layouts.subs} dashed />
          </div>
        </section>
      )}
    </div>
  );
}

function TeamCard({
  title,
  players,
  highlight,
  dashed,
}: {
  title: string;
  players: BoardPlayer[];
  highlight?: boolean;
  dashed?: boolean;
}) {
  const avg = avg3v3(players);
  return (
    <div className={`card !p-4 ${highlight ? "border-t-4 !border-t-accent" : ""} ${dashed ? "!border-dashed" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-slate-500">{avg != null ? `avg ${rankText(Math.round(avg))}` : ""}</span>
      </div>
      {players.length === 0 ? (
        <p className="text-slate-500 text-sm">Nobody yet</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                {p.tag}
                {p.name && <span className="text-slate-500"> · {p.name}</span>}
              </span>
              <span className="text-slate-500 whitespace-nowrap">{rankText(p.rank3v3)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
