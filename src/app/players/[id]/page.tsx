"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Link from "next/link";
import { RANKS, rankLabelForValue } from "@/lib/ranks";

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
  bio: string | null;
  role: string;
  skillRating: number | null;
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
    rank: "",
  });
  const [saving, setSaving] = useState(false);

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
        rank: rankLabelForValue(data.skillRating) || "",
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
      body: JSON.stringify(form),
    });
    await load();
    setSaving(false);
    setEditing(false);
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
            {player.discordTag && <p>💬 Discord: {player.discordTag}</p>}
            {rankLabelForValue(player.skillRating) && (
              <p>🏅 Rank: {rankLabelForValue(player.skillRating)}</p>
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
            <div>
              <label className="label">Current rank</label>
              <select
                className="input"
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
              >
                <option value="">Not sure / unranked</option>
                {RANKS.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        )}
      </div>

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
