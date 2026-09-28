"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Link from "next/link";
import { PLAYLISTS, preciseRankLabel } from "@/lib/ranks";
import PreciseRankPicker from "@/components/PreciseRankPicker";
import WeekSchedule from "@/components/WeekSchedule";

type Performance = {
  id: string;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  score: number;
  mvp: boolean;
  win: boolean | null;
  createdAt: string;
  event: { id: string; title: string; startTime: string; type: string } | null;
};

type Player = {
  id: string;
  username: string;
  displayName: string | null;
  rlTrackerUrl: string | null;
  platform: string | null;
  discordTag: string | null;
  discordUsername: string | null;
  bio: string | null;
  role: string;
  rank1v1: number | null;
  rank2v2: number | null;
  rank3v3: number | null;
  team: { id: string; name: string } | null;
  performances: Performance[];
};

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    rlTrackerUrl: "",
    platform: "",
    discordTag: "",
    bio: "",
  });
  const [ranks, setRanks] = useState<{
    rank1v1: number | null;
    rank2v2: number | null;
    rank3v3: number | null;
  }>({ rank1v1: null, rank2v2: null, rank3v3: null });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const isSelf = session?.user.id === params.id;

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/players/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setPlayer(data);
      setForm({
        displayName: data.displayName || "",
        rlTrackerUrl: data.rlTrackerUrl || "",
        platform: data.platform || "",
        discordTag: data.discordTag || "",
        bio: data.bio || "",
      });
      setRanks({
        rank1v1: data.rank1v1 ?? null,
        rank2v2: data.rank2v2 ?? null,
        rank3v3: data.rank3v3 ?? null,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rank1v1Value: ranks.rank1v1,
        rank2v2Value: ranks.rank2v2,
        rank3v3Value: ranks.rank3v3,
      }),
    });
    await load();
    setSaving(false);
    setEditing(false);
  }

  async function unlinkDiscord() {
    if (!confirm("Unlink your Discord? You'll lose your team role there.")) return;
    await fetch("/api/profile/discord", { method: "DELETE" });
    await load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }

    setPwSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPwSaving(false);

    if (!res.ok) {
      setPwError(data.error || "Couldn't change your password.");
      return;
    }

    setPwSuccess(true);
    setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!player) return <p className="text-slate-500">Player not found.</p>;

  const totals = player.performances.reduce(
    (acc, p) => {
      acc.goals += p.goals;
      acc.assists += p.assists;
      acc.saves += p.saves;
      acc.shots += p.shots;
      acc.score += p.score;
      acc.mvps += p.mvp ? 1 : 0;
      acc.games += 1;
      return acc;
    },
    { goals: 0, assists: 0, saves: 0, shots: 0, score: 0, mvps: 0, games: 0 }
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <Link href="/players" className="text-sm text-accent2 hover:underline">
        ← Back to roster
      </Link>

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{player.displayName || player.username}</h1>
            <p className="text-slate-400">
              @{player.username} {player.team && `· ${player.team.name}`}
            </p>
          </div>
          {isSelf && (
            <button onClick={() => setEditing((e) => !e)} className="btn-secondary">
              {editing ? "Cancel" : "Edit profile"}
            </button>
          )}
        </div>

        {!editing ? (
          <div className="mt-4 space-y-2 text-sm">
            {player.rlTrackerUrl && (
              <p>
                🏆 RL Tracker:{" "}
                <a href={player.rlTrackerUrl} target="_blank" rel="noreferrer" className="text-accent2 hover:underline">
                  {player.rlTrackerUrl}
                </a>
              </p>
            )}
            {player.platform && <p>🎮 Platform: {player.platform}</p>}
            {player.discordUsername ? (
              <p>
                💬 Discord: {player.discordUsername} <span className="badge bg-green-500/20 text-green-300 ml-1">Linked</span>
                {isSelf && (
                  <button onClick={unlinkDiscord} className="text-xs text-slate-500 hover:underline ml-2">
                    Unlink
                  </button>
                )}
              </p>
            ) : (
              <>
                {player.discordTag && <p>💬 Discord: {player.discordTag}</p>}
                {isSelf && (
                  <p className="text-slate-500">
                    🔗 Type <code className="text-slate-300">/link</code> in the BC Discord to RSVP from there and get
                    your team role.
                  </p>
                )}
              </>
            )}
            {(player.rank1v1 || player.rank2v2 || player.rank3v3) && (
              <p>
                🏅 Ranks:{" "}
                {PLAYLISTS.filter((p) => player[p.key] != null)
                  .map((p) => `${p.label.split(" ")[0]} ${preciseRankLabel(player[p.key])}`)
                  .join(" · ")}
              </p>
            )}
            {player.bio && <p className="text-slate-300 mt-3">{player.bio}</p>}
          </div>
        ) : (
          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <div>
              <label className="label">Display name</label>
              <input
                className="input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">RL Tracker URL</label>
              <input
                className="input"
                value={form.rlTrackerUrl}
                onChange={(e) => setForm({ ...form, rlTrackerUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Platform</label>
                <input
                  className="input"
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Discord tag</label>
                <input
                  className="input"
                  value={form.discordTag}
                  onChange={(e) => setForm({ ...form, discordTag: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea
                className="input"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="label mb-0">Current ranks</label>
              {PLAYLISTS.map((p) => (
                <div key={p.key}>
                  <p className="text-xs text-slate-500 mb-1">{p.label}</p>
                  <PreciseRankPicker
                    value={ranks[p.key]}
                    onChange={(v) => setRanks((r) => ({ ...r, [p.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        )}
      </div>

      <WeekSchedule playerId={player.id} isSelf={isSelf} />

      {isSelf && (
        <div className="card">
          <h2 className="font-bold text-lg mb-1">Change password</h2>
          <p className="text-slate-500 text-sm mb-4">
            Needs your current password to confirm it&apos;s you.
          </p>
          <form onSubmit={changePassword} className="space-y-3 max-w-sm">
            <div>
              <label className="label">Current password</label>
              <input
                type="password"
                className="input"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                minLength={8}
                className="input"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                minLength={8}
                className="input"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                required
              />
            </div>
            {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
            {pwSuccess && <p className="text-green-400 text-sm">Password changed.</p>}
            <button type="submit" disabled={pwSaving} className="btn-primary">
              {pwSaving ? "Saving..." : "Change password"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold text-lg mb-4">Career totals ({totals.games} sessions)</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
          {[
            ["Goals", totals.goals],
            ["Assists", totals.assists],
            ["Saves", totals.saves],
            ["Shots", totals.shots],
            ["Score", totals.score],
            ["MVPs", totals.mvps],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-2xl font-bold text-accent">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">Performance history</h2>
        <ul className="space-y-2">
          {player.performances.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm border-b border-border/60 pb-2">
              <div>
                <span className="font-medium">{p.event?.title || "Freestanding session"}</span>
                {p.mvp && <span className="badge bg-accent/20 text-accent ml-2">MVP</span>}
                <p className="text-xs text-slate-500">
                  {format(new Date(p.event?.startTime || p.createdAt), "d MMM yyyy")}
                </p>
              </div>
              <span className="text-slate-400">
                {p.goals}G {p.assists}A {p.saves}S · {p.score} pts
              </span>
            </li>
          ))}
          {player.performances.length === 0 && (
            <p className="text-slate-500 text-sm">No performance data yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
