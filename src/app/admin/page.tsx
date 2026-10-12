"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { preciseRankLabel } from "@/lib/ranks";
import { audienceLabel, EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, formatEventWhen } from "@/lib/format";
import DiscordPanel from "@/components/DiscordPanel";
import TeamAnnouncements from "@/components/TeamAnnouncements";

type Team = {
  id: string;
  name: string;
  colorHex: string | null;
  captainId: string | null;
  members: { id: string; displayName: string | null; username: string }[];
};
type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  isPlayer: boolean;
  isMainAdmin: boolean;
  notifySignups: boolean;
  rlTrackerUrl: string | null;
  rank1v1: number | null;
  rank2v2: number | null;
  rank3v3: number | null;
  teamId: string | null;
  team: { id: string; name: string } | null;
  discordId: string | null;
};

type WeekEvent = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string | null;
  forEveryone: boolean;
  audienceTeams: { name: string }[];
  rsvps: { status: string }[];
};

const RANK_FIELDS = [
  { key: "rank1v1" as const, label: "1s" },
  { key: "rank2v2" as const, label: "2s" },
  { key: "rank3v3" as const, label: "3s" },
];

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [week, setWeek] = useState<WeekEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  // Bumped on every reload so the team announcement list sees team changes.
  const [announceKey, setAnnounceKey] = useState(0);
  const { data: session } = useSession();

  async function load() {
    setLoading(true);
    const [uRes, tRes, eRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/teams"), fetch("/api/events")]);
    if (uRes.ok) setUsers(await uRes.json());
    if (tRes.ok) setTeams(await tRes.json());
    if (eRes.ok) {
      // Anything still running or starting in the next 7 days.
      const now = Date.now();
      const soon = now + 7 * 24 * 60 * 60 * 1000;
      const events: WeekEvent[] = await eRes.json();
      setWeek(
        events.filter((ev) => {
          const start = new Date(ev.startTime).getTime();
          const end = new Date(ev.endTime ?? ev.startTime).getTime();
          return end >= now && start <= soon;
        }),
      );
    }
    setLoading(false);
    setAnnounceKey((k) => k + 1);
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

  // Like updateUser, but shows the server's refusal (e.g. not the main admin).
  async function updateAdmin(id: string, data: Record<string, unknown>) {
    setAdminError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) setAdminError((await res.json().catch(() => ({}))).error || "Couldn't save that.");
    await load();
  }

  async function renameUser(id: string, username: string) {
    const next = prompt(`New username for @${username} (this is what they log in with):`, username)?.trim();
    if (!next || next.toLowerCase() === username) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: next }),
    });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Couldn't change the username.");
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

  async function setCaptain(teamId: string, captainId: string) {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captainId: captainId || null }),
    });
    if (!res.ok) alert((await res.json().catch(() => null))?.error || "Couldn't set the captain.");
    await load();
  }

  async function removeTeam(id: string) {
    if (!confirm("Delete this team? Members will become unassigned.")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    await load();
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const approved = users.filter((u) => u.status === "APPROVED" && u.isPlayer);
  const unlinked = approved.filter((u) => !u.discordId);
  const staff = users.filter((u) => u.status === "APPROVED" && !u.isPlayer);
  const admins = users.filter((u) => u.status === "APPROVED" && u.role === "ADMIN");
  const iAmMain = users.some((u) => u.id === session?.user.id && u.isMainAdmin);
  const rejected = users.filter((u) => u.status === "REJECTED");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Admin panel</h1>
        <Link href="/events/new" className="btn-primary">
          + New event
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/teams" className="btn-secondary">
          🧢 Team dashboards
        </Link>
        <Link href="/admin/players" className="btn-secondary">
          🗂️ Player portfolios
        </Link>
        <Link href="/admin/chemistry" className="btn-secondary">
          🧩 Chemistry
        </Link>
        <Link href="/admin/availability" className="btn-secondary">
          🗓️ Availability
        </Link>
        <Link href="/admin/coaching-reference" className="btn-secondary">
          📚 Coaching reference
        </Link>
        <Link href="/admin/tryouts" className="btn-secondary text-slate-400">
          🗄️ Tryouts archive
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-lg">This week</h2>
          <Link href="/events" className="text-sm text-accent2 hover:underline">
            All events
          </Link>
        </div>
        {week.length === 0 ? (
          <p className="text-slate-500 text-sm">Nothing scheduled in the next 7 days.</p>
        ) : (
          <ul className="space-y-2">
            {week.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                <span>
                  <span className={`badge ${EVENT_TYPE_COLOR[ev.type]} mr-2`}>{EVENT_TYPE_LABEL[ev.type]}</span>
                  <Link href={`/events/${ev.id}`} className="font-medium hover:underline">
                    {ev.title}
                  </Link>
                  <span className="text-slate-500"> · {audienceLabel(ev)}</span>
                </span>
                <span className="text-slate-400">
                  {formatEventWhen(ev.startTime, ev.endTime)} · {ev.rsvps.filter((r) => r.status === "GOING").length} going
                </span>
              </li>
            ))}
          </ul>
        )}
        {unlinked.length > 0 && (
          <p className="text-xs text-slate-500 mt-3">
            {unlinked.length} player{unlinked.length === 1 ? " hasn't" : "s haven't"} linked Discord yet, so they miss
            the event pings. See &quot;Not linked to Discord&quot; below.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="font-bold text-lg mb-1">
          Pending approvals {pending.length > 0 && <span className="badge bg-accent/20 text-accent">{pending.length}</span>}
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Review signups, then approve and assign them to a team.
        </p>
        {pending.length === 0 && <p className="text-slate-500 text-sm">Nothing pending.</p>}
        <ul className="space-y-3">
          {pending.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
              <div>
                <p className="font-medium">
                  {u.displayName || u.username} <span className="text-slate-500 font-normal">@{u.username}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {u.email}
                  {iAmMain && (
                  <button className="text-accent2 hover:underline ml-2" onClick={() => renameUser(u.id, u.username)}>
                    Change username
                  </button>
                )}
                </p>
                <TrackerField user={u} onSaved={load} />
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
        <h2 className="font-bold text-lg mb-1">Teams</h2>
        <p className="text-sm text-slate-400 mb-4">
          A captain can schedule their team&apos;s practices, scrims, matches and tournaments (one a day), run the
          game roster on those, and can edit their team&apos;s page under Teams.
        </p>
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
            <li key={t.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span>
                {t.name} <span className="text-slate-500">({t.members.length} players)</span>
              </span>
              <span className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  Captain
                  <select
                    className="input !py-1 !w-auto text-sm"
                    value={t.captainId ?? ""}
                    onChange={(e) => setCaptain(t.id, e.target.value)}
                  >
                    <option value="">No captain</option>
                    {t.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName || m.username}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={() => removeTeam(t.id)} className="text-red-400 hover:underline text-xs">
                  Delete
                </button>
              </span>
            </li>
          ))}
          {teams.length === 0 && <p className="text-slate-500 text-sm">No teams yet.</p>}
        </ul>
      </section>

      <TeamAnnouncements refresh={announceKey} />

      <Fold title="Discord setup">
        <DiscordPanel />
      </Fold>

      <Fold title="Not linked to Discord" count={unlinked.length}>
      <section className="card">
        <p className="text-sm text-slate-400 mb-3">
          Approved players who haven&apos;t run /link in Discord yet. They don&apos;t get their team role, event buttons or
          reminders there until they do.
        </p>
        {unlinked.length === 0 ? (
          <p className="text-sm text-slate-500">Every approved player is linked.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {unlinked.map((u) => (
              <li key={u.id} className="flex justify-between gap-3 border-b border-border/50 py-1">
                <Link href={`/players/${u.id}`} className="hover:text-white truncate">
                  {u.displayName ? `${u.displayName} (${u.username})` : u.username}
                </Link>
                <span className="text-slate-500 shrink-0">{u.team?.name ?? "No team"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Fold>

      <Fold title="Approved players" count={approved.length}>
      <section className="card">
        <div className="space-y-3">
          {approved.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
              <div>
                <p className="font-medium">
                  {u.displayName || u.username}{" "}
                  {u.role === "ADMIN" && <span className="badge bg-accent2/20 text-accent2 ml-1">Admin</span>}
                </p>
                <p className="text-xs text-slate-500">
                  @{u.username} · {u.email}
                  {iAmMain && (
                  <button className="text-accent2 hover:underline ml-2" onClick={() => renameUser(u.id, u.username)}>
                    Change username
                  </button>
                )}
                </p>
                <TrackerField user={u} onSaved={load} />
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
                {u.role === "ADMIN" && (
                  <button
                    onClick={() => updateUser(u.id, { isPlayer: false })}
                    className="text-slate-400 hover:underline text-xs"
                    title="Keep admin access but take them off the roster, availability and RSVP lists"
                  >
                    Not a player
                  </button>
                )}
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
      </Fold>

      <Fold title="Admin accounts" count={admins.length}>
      <section className="card">
        <p className="text-slate-500 text-sm mb-4">
          {iAmMain
            ? "Choose which admins get an email when someone signs up or uses their invite link."
            : "Only the main admin can change who gets sign-up emails."}
        </p>
        <ul className="space-y-2">
          {admins.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span>
                {u.displayName || u.username} <span className="text-slate-500">@{u.username}</span>
                {u.isMainAdmin && <span className="badge bg-accent/20 text-accent ml-2">Main admin</span>}
                {!u.isPlayer && <span className="badge bg-panel2 text-slate-400 ml-2">Staff</span>}
              </span>
              <div className="flex items-center gap-4">
                <label className={`flex items-center gap-2 text-xs ${iAmMain ? "" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={u.notifySignups}
                    disabled={!iAmMain}
                    onChange={(e) => updateAdmin(u.id, { notifySignups: e.target.checked })}
                  />
                  Sign-up emails
                </label>
                {iAmMain && u.id !== session?.user.id && (
                  <button
                    className="text-xs text-accent2 hover:underline"
                    onClick={() => updateAdmin(u.id, { isMainAdmin: !u.isMainAdmin })}
                  >
                    {u.isMainAdmin ? "Remove main admin" : "Make main admin"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {adminError && <p className="text-red-400 text-sm mt-3">{adminError}</p>}
      </section>
      </Fold>

      <Fold title="Staff admins and Add admin" count={staff.length}>
      <section className="card">
        <p className="text-slate-500 text-sm mb-4">
          Admins who run the site but don&apos;t play. They don&apos;t appear on the roster, in availability, RSVP lists
          or team balancing.
        </p>
        <ul className="space-y-2 mb-5">
          {staff.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span>
                {u.displayName || u.username}{" "}
                <span className="text-slate-500">
                  @{u.username} · {u.email}
                </span>
                {u.role !== "ADMIN" && <span className="badge bg-red-500/20 text-red-300 ml-2">Not an admin</span>}
              </span>
              <div className="flex gap-3">
                <button className="text-accent2 hover:underline text-xs" onClick={() => updateUser(u.id, { isPlayer: true })}>
                  Make a player too
                </button>
                {iAmMain && (
                  <button className="text-accent2 hover:underline text-xs" onClick={() => renameUser(u.id, u.username)}>
                    Change username
                  </button>
                )}
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
            </li>
          ))}
          {staff.length === 0 && <p className="text-slate-500 text-sm">No staff admins yet.</p>}
        </ul>
        <AddAdminForm onAdded={load} />
      </section>
      </Fold>

      {rejected.length > 0 && (
        <Fold title="Rejected" count={rejected.length}>
        <section className="card">
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
        </Fold>
      )}
    </div>
  );
}

// A closed-by-default section, so the panel opens on what needs doing this week.
function Fold({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="card cursor-pointer list-none flex items-center justify-between gap-3 group-open:mb-3">
        <span className="font-bold text-lg">
          {title} {count !== undefined && <span className="text-slate-500 font-normal">({count})</span>}
        </span>
        <span className="text-sm text-accent2 group-open:hidden">Show</span>
        <span className="text-sm text-accent2 hidden group-open:inline">Hide</span>
      </summary>
      {children}
    </details>
  );
}

// Shows the player's RL Tracker link with an inline field so admins can add or fix it.
function TrackerField({ user, onSaved }: { user: UserRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user.rlTrackerUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rlTrackerUrl: value.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save that link.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <p className="text-xs">
        {user.rlTrackerUrl ? (
          <a href={user.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-accent2 hover:underline">
            RL Tracker profile
          </a>
        ) : (
          <span className="text-slate-500">No tracker link</span>
        )}
        <button
          className="text-slate-400 hover:underline ml-2"
          onClick={() => {
            setValue(user.rlTrackerUrl ?? "");
            setEditing(true);
          }}
        >
          {user.rlTrackerUrl ? "Edit" : "Add"}
        </button>
      </p>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-2 items-center">
        <input
          className="input !py-1 text-xs w-72"
          type="url"
          autoFocus
          placeholder="https://rocketleague.tracker.network/rocket-league/profile/..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button className="btn-primary !py-1 !px-2 text-xs" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button className="text-slate-400 hover:underline text-xs" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

// Creates an approved admin account. By default they're staff only, not a player.
function AddAdminForm({ onAdded }: { onAdded: () => void }) {
  const empty = { displayName: "", username: "", email: "", password: "", isPlayer: false };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDone(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't add that admin.");
      return;
    }
    setDone(`${form.displayName} can now log in as ${form.username.trim().toLowerCase()}. They've been emailed.`);
    setForm(empty);
    onAdded();
  }

  return (
    <form onSubmit={submit} className="border-t border-border/60 pt-4 space-y-3">
      <h3 className="font-semibold">Add admin</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Name"
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
        <input
          className="input"
          placeholder="Username"
          required
          autoCapitalize="none"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="input"
          type="password"
          placeholder="Starting password (8+ characters)"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={form.isPlayer} onChange={(e) => setForm({ ...form, isPlayer: e.target.checked })} />
        They also play (show them on the roster and RSVP lists)
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Adding..." : "Add admin"}
        </button>
        {error && <span className="text-red-400 text-sm">{error}</span>}
        {done && <span className="text-green-400 text-sm">{done}</span>}
      </div>
      <p className="text-xs text-slate-500">Give them the password yourself. The email only tells them their username.</p>
    </form>
  );
}
