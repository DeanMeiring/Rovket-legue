"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { preciseRankLabel } from "@/lib/ranks";

type Team = { id: string; name: string; colorHex: string | null; members: { id: string }[] };
type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  rlTrackerUrl: string | null;
  rank1v1: number | null;
  rank2v2: number | null;
  rank3v3: number | null;
  teamId: string | null;
  team: { id: string; name: string } | null;
};

const RANK_FIELDS = [
  { key: "rank1v1" as const, label: "1s" },
  { key: "rank2v2" as const, label: "2s" },
  { key: "rank3v3" as const, label: "3s" },
];

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");

  async function load() {
    setLoading(true);
    const [uRes, tRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/teams")]);
    if (uRes.ok) setUsers(await uRes.json());
    if (tRes.ok) setTeams(await tRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateUser(id: string, data: Record<string, unknown>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await load();
  }

  async function resetPassword(id: string, name: string) {
    const newPassword = prompt(`New password for ${name} (at least 8 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (res.ok) {
      alert(`Password updated for ${name}.`);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Couldn't reset password.");
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Remove this user permanently?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await load();
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    setNewTeamName("");
    await load();
  }

  async function removeTeam(id: string) {
    if (!confirm("Delete this team? Members will become unassigned.")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    await load();
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const approved = users.filter((u) => u.status === "APPROVED");
  const rejected = users.filter((u) => u.status === "REJECTED");

  return (
    <div className="space-y-10 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Admin panel</h1>
        <div className="flex gap-2">
          <Link href="/admin/balance-teams" className="btn-secondary">
            ⚖️ Balance tryout teams
          </Link>
          <Link href="/events/new" className="btn-primary">
            + New event
          </Link>
        </div>
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      <section className="card">
        <h2 className="font-bold text-lg mb-1">
          Pending approvals {pending.length > 0 && <span className="badge bg-accent/20 text-accent">{pending.length}</span>}
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Review tryout signups, then approve and assign them to a team.
        </p>
        {pending.length === 0 && <p className="text-slate-500 text-sm">Nothing pending.</p>}
        <ul className="space-y-3">
          {pending.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
              <div>
                <p className="font-medium">
                  {u.displayName || u.username} <span className="text-slate-500 font-normal">@{u.username}</span>
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
                {u.rlTrackerUrl && (
                  <a href={u.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-xs text-accent2 hover:underline">
                    RL Tracker profile
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="input !py-1 !w-auto text-sm"
                  defaultValue=""
                  onChange={(e) => e.target.value && updateUser(u.id, { teamId: e.target.value })}
                >
                  <option value="">No team yet</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="btn-primary !py-1 !px-3 text-sm" onClick={() => updateUser(u.id, { status: "APPROVED" })}>
                  Approve
                </button>
                <button className="btn-danger !py-1 !px-3 text-sm" onClick={() => updateUser(u.id, { status: "REJECTED" })}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="font-bold text-lg mb-4">Teams</h2>
        <form onSubmit={createTeam} className="flex gap-2 mb-4">
          <input
            className="input"
            placeholder="New team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button className="btn-secondary" type="submit">
            Add team
          </button>
        </form>
        <ul className="space-y-2">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span>
                {t.name} <span className="text-slate-500">({t.members.length} players)</span>
              </span>
              <button onClick={() => removeTeam(t.id)} className="text-red-400 hover:underline text-xs">
                Delete
              </button>
            </li>
          ))}
          {teams.length === 0 && <p className="text-slate-500 text-sm">No teams yet.</p>}
        </ul>
      </section>

      <section className="card">
        <h2 className="font-bold text-lg mb-4">Approved players ({approved.length})</h2>
        <div className="space-y-3">
          {approved.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
              <div>
                <p className="font-medium">
                  {u.displayName || u.username}{" "}
                  {u.role === "ADMIN" && <span className="badge bg-accent2/20 text-accent2 ml-1">Admin</span>}
                </p>
                <p className="text-xs text-slate-500">@{u.username} · {u.email}</p>
                {u.rlTrackerUrl && (
                  <a href={u.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-xs text-accent2 hover:underline">
                    RL Tracker profile
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {RANK_FIELDS.map((f) => (
                    <div
                      key={f.key}
                      className="flex flex-col items-center"
                      title={preciseRankLabel(u[f.key]) || "No rank set — used by the team balancer"}
                    >
                      <span className="text-[10px] text-slate-500">{f.label}</span>
                      <input
                        type="number"
                        min={0}
                        max={3000}
                        className="input !py-1 !px-1 !w-16 text-sm text-center"
                        defaultValue={u[f.key] ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          updateUser(u.id, { [f.key]: val === "" ? null : Number(val) });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <select
                  className="input !py-1 !w-auto text-sm"
                  value={u.teamId || ""}
                  onChange={(e) => updateUser(u.id, { teamId: e.target.value || null })}
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input !py-1 !w-auto text-sm"
                  value={u.role}
                  onChange={(e) => updateUser(u.id, { role: e.target.value })}
                >
                  <option value="PLAYER">Player</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  onClick={() => resetPassword(u.id, u.displayName || u.username)}
                  className="text-accent2 hover:underline text-xs"
                >
                  Reset password
                </button>
                <button onClick={() => removeUser(u.id)} className="text-red-400 hover:underline text-xs">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {rejected.length > 0 && (
        <section className="card">
          <h2 className="font-bold text-lg mb-4">Rejected ({rejected.length})</h2>
          <ul className="space-y-2">
            {rejected.map((u) => (
              <li key={u.id} className="flex items-center justify-between text-sm">
                <span>{u.displayName || u.username} (@{u.username})</span>
                <div className="flex gap-2">
                  <button className="text-accent2 hover:underline text-xs" onClick={() => updateUser(u.id, { status: "APPROVED" })}>
                    Approve instead
                  </button>
                  <button onClick={() => removeUser(u.id)} className="text-red-400 hover:underline text-xs">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
