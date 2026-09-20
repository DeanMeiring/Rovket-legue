"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

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

export default function MyPerformancePage() {
  const { data: session } = useSession();
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;
    fetch(`/api/performances?userId=${session.user.id}`)
      .then((r) => r.json())
      .then(setPerformances)
      .finally(() => setLoading(false));
  }, [session?.user.id]);

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
