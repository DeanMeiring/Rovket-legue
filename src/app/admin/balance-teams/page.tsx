"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { balanceIntoTeams } from "@/lib/teamBalance";

type PlayerRow = {
  id: string;
  username: string;
  displayName: string | null;
  status: string;
  skillRating: number | null;
  teamId: string | null;
};

export default function BalanceTeamsPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [teamCount, setTeamCount] = useState(2);
  const [namePrefix, setNamePrefix] = useState("Team");
  const [groups, setGroups] = useState<PlayerRow[][] | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((users: PlayerRow[]) => {
        const approved = users.filter((u) => u.status === "APPROVED");
        setPlayers(approved);
        const initialSelected: Record<string, boolean> = {};
        approved.forEach((u) => {
          initialSelected[u.id] = !u.teamId;
        });
        setSelected(initialSelected);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedPlayers = players.filter((p) => selected[p.id]);
  const missingRatingCount = selectedPlayers.filter((p) => p.skillRating == null).length;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
    setGroups(null);
  }

  function suggest() {
    setGroups(balanceIntoTeams(selectedPlayers, teamCount));
  }

  async function createTeams() {
    if (!groups) return;
    setSaving(true);
    const res = await fetch("/api/admin/balance-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: groups.map((g, i) => ({
          name: `${namePrefix} ${i + 1}`,
          playerIds: g.map((p) => p.id),
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/admin" className="text-sm text-accent2 hover:underline">
          ← Back to admin panel
        </Link>
        <h1 className="text-3xl font-bold mt-2">Balance tryout teams</h1>
        <p className="text-slate-400 mt-1">
          Pick who&apos;s in the pool and how many teams you need — this splits them as
          evenly as possible by skill rating (set each player&apos;s MMR from their RL
          Tracker page in the admin panel first). Players with no rating are treated as
          average.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Number of teams</label>
            <input
              type="number"
              min={2}
              max={20}
              className="input !w-24"
              value={teamCount}
              onChange={(e) => {
                setTeamCount(Number(e.target.value) || 2);
                setGroups(null);
              }}
            />
          </div>
          <div>
            <label className="label">Team name prefix</label>
            <input
              className="input !w-40"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            onClick={suggest}
            disabled={selectedPlayers.length < teamCount}
          >
            Suggest balanced teams
          </button>
        </div>
        {selectedPlayers.length < teamCount && (
          <p className="text-sm text-yellow-400">
            Select at least {teamCount} players to fill {teamCount} teams.
          </p>
        )}
        {missingRatingCount > 0 && selectedPlayers.length > 0 && (
          <p className="text-sm text-slate-500">
            {missingRatingCount} of {selectedPlayers.length} selected player(s) have no
            skill rating set — they&apos;ll be treated as average skill.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">Player pool ({selectedPlayers.length} selected)</h2>
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {players.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!selected[p.id]}
                  onChange={() => toggle(p.id)}
                />
                {p.displayName || p.username}
              </label>
              <span className="text-slate-500">
                {p.skillRating != null ? `${p.skillRating} MMR` : "no rating"}
                {p.teamId && " · already on a team"}
              </span>
            </li>
          ))}
          {players.length === 0 && (
            <p className="text-slate-500 text-sm">No approved players yet.</p>
          )}
        </ul>
      </div>

      {groups && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Suggested teams</h2>
            <button className="btn-primary" disabled={saving} onClick={createTeams}>
              {saving ? "Creating..." : "Create these teams"}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {groups.map((g, i) => {
              const known = g.map((p) => p.skillRating).filter((r): r is number => r != null);
              const avg = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
              return (
                <div key={i} className="border border-border rounded-lg p-3">
                  <p className="font-semibold mb-2">
                    {namePrefix} {i + 1}{" "}
                    <span className="text-slate-500 font-normal">
                      · avg {avg != null ? `${avg} MMR` : "no data"}
                    </span>
                  </p>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {g.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{p.displayName || p.username}</span>
                        <span className="text-slate-500">{p.skillRating ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Creating teams will (re)assign these players&apos; team. If a team named e.g.
            &quot;{namePrefix} 1&quot; already exists, players are added to it instead of
            creating a duplicate.
          </p>
        </div>
      )}
    </div>
  );
}
