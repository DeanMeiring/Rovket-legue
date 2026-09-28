"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";

type Player = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUpdatedAt: string | null;
  rlTrackerUrl: string | null;
  platform: string | null;
  role: string;
  team: { id: string; name: string; colorHex: string | null } | null;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then(setPlayers)
      .finally(() => setLoading(false));
  }, []);

  const grouped = players.reduce<Record<string, Player[]>>((acc, p) => {
    const key = p.team?.name || "Unassigned";
    acc[key] = acc[key] || [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Roster</h1>
      {loading && <p className="text-slate-500">Loading...</p>}

      {Object.entries(grouped).map(([teamName, members]) => (
        <section key={teamName}>
          <h2 className="text-lg font-semibold text-slate-300 mb-3">
            {teamName} <span className="text-slate-500 font-normal">({members.length})</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((p) => (
              <Link href={`/players/${p.id}`} key={p.id} className="card hover:border-accent transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar id={p.id} name={p.displayName || p.username} version={p.avatarUpdatedAt} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">{p.displayName || p.username}</span>
                      {p.role === "ADMIN" && <span className="badge bg-accent2/20 text-accent2">Admin</span>}
                    </div>
                    <p className="text-sm text-slate-500 truncate">@{p.username}</p>
                    {p.platform && <p className="text-xs text-slate-500 mt-1">{p.platform}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
