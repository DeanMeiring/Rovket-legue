"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { PLAYLISTS, preciseRankLabel } from "@/lib/ranks";
import PreciseRankPicker from "@/components/PreciseRankPicker";
import { PlayerBenchmarkCard } from "@/components/ReplayStats";
import type { Averages } from "@/lib/replayStats";

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

type RankValues = { rank1v1: number | null; rank2v2: number | null; rank3v3: number | null };

export default function MyPerformancePage() {
  const { data: session } = useSession();
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState<RankValues>({ rank1v1: null, rank2v2: null, rank3v3: null });
  const [editingRanks, setEditingRanks] = useState(false);
  const [savingRanks, setSavingRanks] = useState(false);
  const [replay, setReplay] = useState<{ stats: unknown[]; clubAvg: Averages } | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    fetch(`/api/performances?userId=${session.user.id}`)
      .then((r) => r.json())
      .then(setPerformances)
      .finally(() => setLoading(false));
    fetch(`/api/players/${session.user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setRanks({
          rank1v1: data.rank1v1 ?? null,
          rank2v2: data.rank2v2 ?? null,
          rank3v3: data.rank3v3 ?? null,
        });
        if (data.clubAvg) {
          setReplay({ stats: (data.performances ?? []).map((p: { stats: unknown }) => p.stats), clubAvg: data.clubAvg });
        }
      });
  }, [session?.user.id]);

  async function saveRanks(e: React.FormEvent) {
    e.preventDefault();
    setSavingRanks(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rank1v1Value: ranks.rank1v1,
        rank2v2Value: ranks.rank2v2,
        rank3v3Value: ranks.rank3v3,
      }),
    });
    setSavingRanks(false);
    setEditingRanks(false);
  }

  const totals = performances.reduce(
    (acc, p) => {
      acc.goals += p.goals;
      acc.assists += p.assists;
      acc.saves += p.saves;
      acc.shots += p.shots;
      acc.score += p.score;
      acc.mvps += p.mvp ? 1 : 0;
      acc.wins += p.win ? 1 : 0;
      return acc;
    },
    { goals: 0, assists: 0, saves: 0, shots: 0, score: 0, mvps: 0, wins: 0 }
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-3xl font-bold">My Performance</h1>

      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg">Your ranks</h2>
          <button className="btn-secondary !py-1 !px-3 text-sm" onClick={() => setEditingRanks((v) => !v)}>
            {editingRanks ? "Cancel" : "Edit"}
          </button>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          Used by admins to balance tryout teams — keep these current.
        </p>

        {!editingRanks ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLAYLISTS.map((p) => (
              <div key={p.key}>
                <p className="text-xs text-slate-500">{p.label}</p>
                <p className="font-semibold">{preciseRankLabel(ranks[p.key]) || "Not set"}</p>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={saveRanks} className="space-y-4">
            {PLAYLISTS.map((p) => (
              <div key={p.key}>
                <p className="text-xs text-slate-500 mb-1">{p.label}</p>
                <PreciseRankPicker
                  value={ranks[p.key]}
                  onChange={(v) => setRanks((r) => ({ ...r, [p.key]: v }))}
                />
              </div>
            ))}
            <button type="submit" disabled={savingRanks} className="btn-primary">
              {savingRanks ? "Saving..." : "Save ranks"}
            </button>
          </form>
        )}
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && performances.length === 0 && (
        <div className="card">
          <p className="text-slate-400">
            No stats logged yet. Your admins will add these after scrims and matches.
          </p>
        </div>
      )}

      {performances.length > 0 && (
        <>
          <div className="card">
            <h2 className="font-bold text-lg mb-4">
              Totals across {performances.length} session{performances.length !== 1 && "s"}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-4 text-center">
              {[
                ["Goals", totals.goals],
                ["Assists", totals.assists],
                ["Saves", totals.saves],
                ["Shots", totals.shots],
                ["Score", totals.score],
                ["MVPs", totals.mvps],
                ["Wins", totals.wins],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="text-2xl font-bold text-accent">{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {replay && <PlayerBenchmarkCard stats={replay.stats} clubAvg={replay.clubAvg} />}

          <div className="card">
            <h2 className="font-bold text-lg mb-4">History</h2>
            <ul className="space-y-2">
              {performances.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm border-b border-border/60 pb-2"
                >
                  <div>
                    <span className="font-medium">{p.event?.title || "Freestanding session"}</span>
                    {p.mvp && <span className="badge bg-accent/20 text-accent ml-2">MVP</span>}
                    {p.win === true && <span className="badge bg-green-500/20 text-green-300 ml-2">Win</span>}
                    {p.win === false && <span className="badge bg-red-500/20 text-red-300 ml-2">Loss</span>}
                    <p className="text-xs text-slate-500">
                      {format(new Date(p.event?.startTime || p.createdAt), "EEEE d MMM yyyy")}
                    </p>
                  </div>
                  <span className="text-slate-400">
                    {p.goals}G {p.assists}A {p.saves}S {p.shots} shots · {p.score} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
