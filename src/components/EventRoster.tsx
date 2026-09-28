"use client";

import { useEffect, useMemo, useState } from "react";
import { RSVP_COLOR, RSVP_LABEL } from "@/lib/format";

type Named = { id: string; name: string };
type Game = {
  id: string;
  number: number;
  round: number;
  blue: Named[];
  orange: Named[];
  played: boolean;
  blueGoals: number | null;
  orangeGoals: number | null;
  gap?: number;
};
type Candidate = Named & { rsvp: string | null; rating: number; hasRank: boolean };
type Roster = {
  shared: boolean;
  teamSize?: number;
  gameCount?: number;
  games: Game[];
  sittingOut?: Record<string, Named[]>;
  plays?: Record<string, number>;
  pool?: string[];
  candidates?: Candidate[];
};

// Going first, then Maybe, no reply, can't make it, and players the event
// wasn't for (walk-ins).
const RSVP_ORDER: Record<string, number> = { GOING: 0, MAYBE: 1, PENDING: 2, DECLINED: 3 };
// A side-average gap above this is flagged (about half a Champion sub-rank).
const GAP_WARN = 50;

export default function EventRoster({
  eventId,
  eventTitle,
  isAdmin,
  myId,
}: {
  eventId: string;
  eventTitle: string;
  isAdmin: boolean;
  myId?: string;
}) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [pool, setPool] = useState<Set<string>>(new Set());
  const [gameCount, setGameCount] = useState(6);
  const [teamSize, setTeamSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPool, setShowPool] = useState(true);

  async function load(resetForm = false) {
    const res = await fetch(`/api/events/${eventId}/roster`);
    if (!res.ok) return;
    const data: Roster = await res.json();
    setRoster(data);
    if (resetForm && data.candidates) {
      setGameCount(data.gameCount ?? 6);
      setTeamSize(data.teamSize ?? 3);
      // A new roster starts from everyone who said Going or Maybe.
      setPool(
        new Set(
          data.games.length || data.pool?.length
            ? data.pool
            : data.candidates.filter((c) => c.rsvp === "GOING" || c.rsvp === "MAYBE").map((c) => c.id),
        ),
      );
      setShowPool(!data.games.length);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const candidates = useMemo(
    () =>
      [...(roster?.candidates ?? [])].sort(
        (a, b) => (RSVP_ORDER[a.rsvp ?? ""] ?? 4) - (RSVP_ORDER[b.rsvp ?? ""] ?? 4) || a.name.localeCompare(b.name),
      ),
    [roster],
  );

  async function put(body: object) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/events/${eventId}/roster`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMessage(data.error || "Something went wrong.");
    await load();
    return data;
  }

  async function build() {
    const data = await put({ action: "build", poolIds: [...pool], gameCount, teamSize });
    if (data.ok) {
      setMessage(
        data.kept
          ? `Kept ${data.kept} played game(s) and rebalanced the other ${data.built}.`
          : `Built ${data.built} balanced game(s).`,
      );
      setShowPool(false);
    }
  }

  function toggle(id: string) {
    setPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function shareText() {
    if (!roster) return "";
    const lines = [`${eventTitle}: game roster`];
    let round = 0;
    for (const g of roster.games) {
      if (g.round !== round) {
        round = g.round;
        const out = roster.sittingOut?.[String(round)] ?? [];
        lines.push("", `Round ${round}${out.length ? ` (sitting out: ${out.map((p) => p.name).join(", ")})` : ""}`);
      }
      lines.push(
        `Game ${g.number}: 🔵 ${g.blue.map((p) => p.name).join(", ")}  vs  🟠 ${g.orange.map((p) => p.name).join(", ")}`,
      );
    }
    return lines.join("\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText());
      setMessage("Copied. Paste it into Discord or WhatsApp.");
    } catch {
      setMessage("Couldn't copy. Your browser blocked it.");
    }
  }

  if (!roster) return null;
  if (!isAdmin && (!roster.shared || !roster.games.length)) return null;

  const rounds = [...new Set(roster.games.map((g) => g.round))];
  const hasPlayed = roster.games.some((g) => g.played);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-lg">Game roster</h2>
        {isAdmin && roster.games.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={copy} className="btn-secondary !py-1 !px-3 text-sm">
              Copy as text
            </button>
            <button
              onClick={() => put({ action: "share", shared: !roster.shared })}
              disabled={busy}
              className="btn-secondary !py-1 !px-3 text-sm"
            >
              {roster.shared ? "Hide from players" : "Show to players"}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mb-4 space-y-3">
          {roster.games.length > 0 && (
            <p className="text-sm text-slate-400">
              {roster.shared ? "Players can see this roster on the event page." : "Only admins can see this roster."}
            </p>
          )}
          <div className="flex gap-3 flex-wrap items-end">
            <label className="text-sm">
              <span className="block text-slate-400 mb-1">Format</span>
              <select className="input !w-auto" value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))}>
                <option value={3}>3v3</option>
                <option value={2}>2v2</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-400 mb-1">Games</span>
              <input
                type="number"
                min={1}
                max={40}
                className="input !w-24"
                value={gameCount}
                onChange={(e) => setGameCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              />
            </label>
            <button onClick={() => setShowPool((s) => !s)} className="btn-secondary !py-2 !px-3 text-sm">
              {showPool ? "Hide players" : `Players (${pool.size})`}
            </button>
            <button onClick={build} disabled={busy} className="btn-primary !py-2 !px-3 text-sm">
              {busy ? "Working..." : roster.games.length ? "Rebalance remaining games" : "Build roster"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Tick who&apos;s here, then rebalance. Games marked played stay as they are; the rest are rebuilt so sides
            stay even and whoever has played least goes next.
          </p>
          {showPool && (
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={pool.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="flex-1 min-w-0 truncate">{c.name}</span>
                    {!c.hasRank && <span className="text-xs text-slate-500">no rank</span>}
                    {roster.plays?.[c.id] ? (
                      <span className="text-xs text-slate-400">{roster.plays[c.id]} played</span>
                    ) : null}
                    <span
                      className={`badge whitespace-nowrap ${c.rsvp ? RSVP_COLOR[c.rsvp] : "bg-slate-700/40 text-slate-400"}`}
                    >
                      {c.rsvp ? RSVP_LABEL[c.rsvp] : "Not invited"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {message && <p className="text-sm text-slate-300">{message}</p>}
        </div>
      )}

      {rounds.map((round) => {
        const out = roster.sittingOut?.[String(round)] ?? [];
        return (
          <div key={round} className="mb-4">
            <p className="text-sm font-semibold text-slate-300 mb-2">
              Round {round}
              {out.length > 0 && (
                <span className="font-normal text-slate-400"> · sitting out: {out.map((p) => p.name).join(", ")}</span>
              )}
            </p>
            <div className="space-y-2">
              {roster.games
                .filter((g) => g.round === round)
                .map((g) => (
                  <GameRow key={g.id} game={g} isAdmin={isAdmin} myId={myId} onSave={(body) => put(body)} />
                ))}
            </div>
          </div>
        );
      })}
      {isAdmin && hasPlayed && (
        <p className="text-xs text-slate-500">Untick “Played” on a game to let a rebalance change it again.</p>
      )}
    </div>
  );
}

function GameRow({
  game,
  isAdmin,
  myId,
  onSave,
}: {
  game: Game;
  isAdmin: boolean;
  myId?: string;
  onSave: (body: object) => Promise<unknown>;
}) {
  const [blue, setBlue] = useState(game.blueGoals?.toString() ?? "");
  const [orange, setOrange] = useState(game.orangeGoals?.toString() ?? "");
  const goals = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.min(99, Number(v) || 0)));
  const names = (side: Named[]) =>
    side.map((p, i) => (
      <span key={p.id}>
        {i > 0 && ", "}
        <span className={p.id === myId ? "font-bold text-white" : undefined}>{p.name}</span>
      </span>
    ));

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${game.played ? "border-slate-800 opacity-70" : "border-slate-700"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <span className="font-semibold">Game {game.number}</span>
        <span className="flex items-center gap-3 text-xs text-slate-400">
          {isAdmin && game.gap !== undefined && (
            <span className={game.gap > GAP_WARN ? "text-yellow-300" : undefined}>gap {game.gap} MMR</span>
          )}
          {!isAdmin && game.played && <span>Played</span>}
          {(game.blueGoals != null || game.orangeGoals != null) && !isAdmin && (
            <span>
              {game.blueGoals ?? 0} – {game.orangeGoals ?? 0}
            </span>
          )}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-1">
        <p>
          <span className="text-sky-400">Blue:</span> {names(game.blue)}
        </p>
        <p>
          <span className="text-orange-400">Orange:</span> {names(game.orange)}
        </p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={game.played}
              onChange={(e) =>
                onSave({
                  action: "played",
                  gameId: game.id,
                  played: e.target.checked,
                  blueGoals: goals(blue),
                  orangeGoals: goals(orange),
                })
              }
            />
            Played
          </label>
          <input
            className="input !w-20 !py-1 text-xs"
            inputMode="numeric"
            placeholder="Blue"
            value={blue}
            onChange={(e) => setBlue(e.target.value)}
            onBlur={() =>
              goals(blue) !== game.blueGoals &&
              onSave({ action: "played", gameId: game.id, played: game.played, blueGoals: goals(blue) })
            }
          />
          <span className="text-slate-500">–</span>
          <input
            className="input !w-20 !py-1 text-xs"
            inputMode="numeric"
            placeholder="Orange"
            value={orange}
            onChange={(e) => setOrange(e.target.value)}
            onBlur={() =>
              goals(orange) !== game.orangeGoals &&
              onSave({ action: "played", gameId: game.id, played: game.played, orangeGoals: goals(orange) })
            }
          />
        </div>
      )}
    </div>
  );
}
