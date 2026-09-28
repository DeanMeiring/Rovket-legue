"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { preciseRankLabel } from "@/lib/ranks";
import { BALANCE_WARN_MMR, ratingMap, WEIGHT_2V2, WEIGHT_3V3 } from "@/lib/tryoutGames";
import { summarize, StatRow } from "@/lib/tryoutStats";

type Player = { id: string; tag: string; name: string | null; rank2v2: number | null; rank3v3: number | null };
type Game = {
  id: string;
  number: number;
  round: number;
  blueIds: string[];
  orangeIds: string[];
  blueGoals: number | null;
  orangeGoals: number | null;
  ballchasingId: string | null;
  replayStatus: string | null;
  stats: (StatRow & { side: string })[];
};
type Evaluation = { id: string; text: string; model: string; createdAt: string };
type Data = {
  players: Player[];
  games: Game[];
  evaluations: Evaluation[];
  ballchasingEnabled: boolean;
  aiEnabled: boolean;
};

const fmt = (n: number | null, digits = 0) => (n == null ? "—" : n.toFixed(digits));

export default function TryoutGamesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/admin/tryout-games");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const players = useMemo(() => new Map((data?.players ?? []).map((p) => [p.id, p])), [data]);
  const ratings = useMemo(() => ratingMap(data?.players ?? []), [data]);
  const summaries = useMemo(() => summarize((data?.games ?? []).flatMap((g) => g.stats)), [data]);
  const played = (data?.games ?? []).filter((g) => g.replayStatus === "ok").length;
  const unplayed = (data?.games ?? []).filter((g) => !g.ballchasingId).length;

  const rounds = useMemo(() => {
    const m = new Map<number, Game[]>();
    (data?.games ?? []).forEach((g) => m.set(g.round, [...(m.get(g.round) ?? []), g]));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  function tagOf(id: string) {
    return players.get(id)?.tag ?? "Removed player";
  }

  function avg(ids: string[]) {
    return ids.reduce((s, id) => s + (ratings.get(id) ?? 0), 0) / ids.length;
  }

  async function generate() {
    if (unplayed > 0 && !confirm(`Replace the ${unplayed} games that have no replay yet? Games with replays are kept.`)) return;
    setBusy("generate");
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/tryout-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || "Couldn't generate games.");
    setNotice(`Generated ${body.created} balanced games.`);
    await load();
  }

  function reportImport(game: Game, body: { status?: string; matched?: string[]; unmatched?: string[] }) {
    if (body.status === "pending") {
      setNotice(`Game ${game.number}: ballchasing is still processing the replay. Press "Check again" in a minute.`);
    } else if (body.status === "failed") {
      setError(`Game ${game.number}: ballchasing couldn't read that replay file.`);
    } else {
      const extra = body.unmatched?.length
        ? ` Not on the board by gamertag: ${body.unmatched.join(", ")}. Fix their gamertag on the tryout board, then press "Check again".`
        : "";
      setNotice(`Game ${game.number}: imported stats for ${body.matched?.length ?? 0} players.${extra}`);
    }
  }

  async function uploadReplay(game: Game, file: File | null) {
    const link = links[game.id]?.trim();
    if (!file && !link) return;
    setBusy(game.id);
    setError(null);
    setNotice(null);
    const form = new FormData();
    if (file) form.append("file", file);
    else form.append("link", link!);
    const res = await fetch(`/api/admin/tryout-games/${game.id}/replay`, { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || "Replay import failed.");
    reportImport(game, body);
    setLinks((l) => ({ ...l, [game.id]: "" }));
    await load();
  }

  async function refresh(game: Game) {
    setBusy(game.id);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/tryout-games/${game.id}/refresh`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || "Couldn't check the replay.");
    reportImport(game, body);
    await load();
  }

  async function saveGame(game: Game, blueIds: string[], orangeIds: string[]): Promise<string | null> {
    const res = await fetch(`/api/admin/tryout-games/${game.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueIds, orangeIds }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error || "Couldn't save that game.";
    await load();
    return null;
  }

  async function evaluate() {
    setBusy("evaluate");
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/tryout-games/evaluate", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || "Evaluation failed.");
    await load();
  }

  if (!data) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <Link href="/admin/tryout-board" className="text-sm text-slate-500 hover:underline">
          ← Tryout board
        </Link>
        <h1 className="text-3xl font-bold">Tryout games</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every game is a 3v3 with both sides balanced on a combined rating ({WEIGHT_3V3 * 100}% 3v3 rank,{" "}
          {WEIGHT_2V2 * 100}% 2v2 rank). Players rotate so they team up with as many different people as possible,
          and sit-outs are spread evenly.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {notice && <p className="text-accent2 text-sm">{notice}</p>}

      <section className="card flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Number of games</label>
          <input
            type="number"
            min={1}
            max={60}
            className="input !w-28"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy === "generate" || data.players.length < 6}>
          {busy === "generate" ? "Generating..." : data.games.length ? "Regenerate unplayed games" : "Generate games"}
        </button>
        <a href="/api/admin/tryout-games/export" className="btn-secondary" aria-disabled={data.games.length === 0}>
          Export to Excel
        </a>
        <p className="text-xs text-slate-500 basis-full">
          {data.players.length} players on the board, so {Math.floor(data.players.length / 6)} game
          {Math.floor(data.players.length / 6) === 1 ? "" : "s"} can run at once. Regenerating keeps every game that
          already has a replay, and replaces hand edits on games without one. Add or remove players on the tryout
          board first.
        </p>
      </section>

      {!data.ballchasingEnabled && (
        <p className="text-yellow-300 text-sm">
          Replay upload is off until BALLCHASING_API_KEY is set in Railway.
        </p>
      )}

      {rounds.map(([round, games]) => {
        const playing = new Set(games.flatMap((g) => [...g.blueIds, ...g.orangeIds]));
        const sitting = data.players.filter((p) => !playing.has(p.id));
        return (
          <section key={round} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-lg">Round {round}</h2>
              <p className="text-xs text-slate-500">
                {sitting.length ? `Sitting out: ${sitting.map((p) => p.tag).join(", ")}` : "Nobody sits out"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {games.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  tagOf={tagOf}
                  avg={avg}
                  busy={busy === g.id}
                  canUpload={data.ballchasingEnabled}
                  link={links[g.id] ?? ""}
                  onLink={(v) => setLinks((l) => ({ ...l, [g.id]: v }))}
                  onUpload={(file) => uploadReplay(g, file)}
                  onRefresh={() => refresh(g)}
                  players={data.players}
                  otherIdsThisRound={
                    new Set(games.filter((o) => o.id !== g.id).flatMap((o) => [...o.blueIds, ...o.orangeIds]))
                  }
                  onSave={(blue, orange) => saveGame(g, blue, orange)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {summaries.length > 0 && (
        <section className="card">
          <h2 className="font-bold text-lg mb-1">Player stats ({played} {played === 1 ? "game" : "games"} with replays)</h2>
          <p className="text-slate-500 text-xs mb-4">
            From ballchasing. Behind ball and most back are % of game time. Low distance to mates can mean double
            commits; last-def is goals conceded while they were the last defender.
          </p>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-border">
                  {["Player", "GP", "W", "Avg score", "G", "A", "Sv", "Sh", "MVP", "Boost/min", "Behind ball", "Most back", "Dist mates", "Last-def"].map(
                    (h) => (
                      <th key={h} className="py-2 pr-3 whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const p = players.get(s.playerId);
                  return (
                    <tr key={s.playerId} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{p?.tag ?? "Removed player"}</p>
                        <p className="text-xs text-slate-500">{preciseRankLabel(p?.rank3v3) ?? ""}</p>
                      </td>
                      <td className="py-2 pr-3">{s.games}</td>
                      <td className="py-2 pr-3">{s.wins}</td>
                      <td className="py-2 pr-3">{fmt(s.avgScore)}</td>
                      <td className="py-2 pr-3">{s.goals}</td>
                      <td className="py-2 pr-3">{s.assists}</td>
                      <td className="py-2 pr-3">{s.saves}</td>
                      <td className="py-2 pr-3">{s.shots}</td>
                      <td className="py-2 pr-3">{s.mvps}</td>
                      <td className="py-2 pr-3">{fmt(s.avgBoostPerMinute)}</td>
                      <td className="py-2 pr-3">{fmt(s.percentBehindBall)}%</td>
                      <td className="py-2 pr-3">{fmt(s.percentMostBack)}%</td>
                      <td className="py-2 pr-3">{fmt(s.avgDistanceToMates)}</td>
                      <td className="py-2 pr-3">{s.goalsConcededAsLastDefender}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-lg">AI evaluation</h2>
          <button
            className="btn-secondary"
            onClick={evaluate}
            disabled={!data.aiEnabled || played === 0 || busy === "evaluate"}
          >
            {busy === "evaluate" ? "Evaluating... (up to a minute)" : "Evaluate with AI"}
          </button>
        </div>
        <p className="text-slate-500 text-xs">
          {data.aiEnabled
            ? "Sends the stats table above (gamertags, ranks and replay stats, no emails) to Claude and saves the write-up here."
            : "Off until ANTHROPIC_API_KEY is set in Railway. The stats table works without it."}
        </p>
        {data.evaluations.map((e) => (
          <div key={e.id} className="border-t border-border/60 pt-3">
            <p className="text-xs text-slate-500 mb-2">{new Date(e.createdAt).toLocaleString()}</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{e.text}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function GameCard({
  game,
  tagOf,
  avg,
  busy,
  canUpload,
  link,
  onLink,
  onUpload,
  onRefresh,
  players,
  otherIdsThisRound,
  onSave,
}: {
  game: Game;
  tagOf: (id: string) => string;
  avg: (ids: string[]) => number;
  busy: boolean;
  canUpload: boolean;
  link: string;
  onLink: (v: string) => void;
  onUpload: (file: File | null) => void;
  onRefresh: () => void;
  players: Player[];
  otherIdsThisRound: Set<string>;
  onSave: (blueIds: string[], orangeIds: string[]) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ blue: game.blueIds, orange: game.orangeIds });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sides = editing ? draft : { blue: game.blueIds, orange: game.orangeIds };
  const blue = avg(sides.blue);
  const orange = avg(sides.orange);
  const gap = Math.abs(blue - orange);
  const unbalanced = gap > BALANCE_WARN_MMR;
  const done = game.replayStatus === "ok";

  const all = [...draft.blue, ...draft.orange];
  const duplicates = new Set(all.filter((id, i) => all.indexOf(id) !== i));
  const clashes = all.filter((id) => otherIdsThisRound.has(id));
  const sortedPlayers = [...players].sort((a, b) => a.tag.localeCompare(b.tag));

  function setSlot(side: "blue" | "orange", i: number, id: string) {
    setDraft((d) => ({ ...d, [side]: d[side].map((x, j) => (j === i ? id : x)) }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    const err = await onSave(draft.blue, draft.orange);
    setSaving(false);
    if (err) setSaveError(err);
    else setEditing(false);
  }

  return (
    <div className={`card !p-4 space-y-3 ${unbalanced && !done ? "!border-yellow-500/60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Game {game.number}</h3>
        {done ? (
          <span className="badge bg-accent2/15 text-accent2">
            {game.blueGoals} – {game.orangeGoals}
          </span>
        ) : (
          <span className={`text-xs ${unbalanced ? "text-yellow-300 font-semibold" : "text-slate-500"}`}>
            {unbalanced ? "Unbalanced · " : ""}rating gap {Math.round(gap)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {([
          { key: "blue", label: "Blue", avg: blue, color: "text-accent2" },
          { key: "orange", label: "Orange", avg: orange, color: "text-accent" },
        ] as const).map((s) => (
          <div key={s.label}>
            <p className={`text-xs font-semibold ${s.color}`}>
              {s.label} <span className="text-slate-500 font-normal">· {preciseRankLabel(Math.round(s.avg))}</span>
            </p>
            {editing ? (
              <div className="space-y-1 mt-1">
                {draft[s.key].map((id, i) => (
                  <select
                    key={i}
                    className={`input !py-1 !px-2 text-xs ${duplicates.has(id) ? "!border-red-500" : ""}`}
                    value={id}
                    onChange={(e) => setSlot(s.key, i, e.target.value)}
                  >
                    {!players.some((p) => p.id === id) && <option value={id}>Removed player</option>}
                    {sortedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.tag}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            ) : (
              <ul>
                {sides[s.key].map((id) => (
                  <li key={id}>{tagOf(id)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="space-y-2 text-xs">
          {unbalanced && (
            <p className="text-yellow-300">
              Sides are {Math.round(gap)} MMR apart on average. Generated games stay under {BALANCE_WARN_MMR}.
            </p>
          )}
          {duplicates.size > 0 && <p className="text-red-400">A player is picked twice in this game.</p>}
          {clashes.length > 0 && (
            <p className="text-yellow-300">
              Also playing another game this round: {[...new Set(clashes)].map(tagOf).join(", ")}.
            </p>
          )}
          {saveError && <p className="text-red-400">{saveError}</p>}
          <div className="flex gap-2">
            <button className="btn-primary !py-1 !px-3 text-xs" onClick={save} disabled={saving || duplicates.size > 0}>
              {saving ? "Saving..." : "Save game"}
            </button>
            <button
              className="btn-secondary !py-1 !px-3 text-xs"
              onClick={() => {
                setEditing(false);
                setSaveError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && !game.ballchasingId && (
        <button
          className="text-xs text-accent2 hover:underline"
          onClick={() => {
            setDraft({ blue: game.blueIds, orange: game.orangeIds });
            setEditing(true);
          }}
        >
          Edit players
        </button>
      )}

      {done && game.ballchasingId && (
        <div className="flex gap-3 text-xs">
          <a
            href={`https://ballchasing.com/replay/${game.ballchasingId}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent2 hover:underline"
          >
            Open on ballchasing
          </a>
          <button className="text-slate-400 hover:underline" onClick={onRefresh} disabled={busy}>
            Re-import stats
          </button>
        </div>
      )}

      {!done && game.ballchasingId && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-yellow-300">
            {game.replayStatus === "failed" ? "Ballchasing couldn't read the replay." : "Ballchasing is processing the replay."}
          </span>
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={onRefresh} disabled={busy}>
            {busy ? "Checking..." : "Check again"}
          </button>
        </div>
      )}

      {!done && canUpload && !editing && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <label className="block text-xs text-slate-400">
            Upload the .replay file
            <input
              type="file"
              accept=".replay"
              disabled={busy}
              className="block mt-1 text-xs"
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex gap-2">
            <input
              className="input !py-1 text-xs"
              placeholder="or paste a ballchasing.com link"
              value={link}
              onChange={(e) => onLink(e.target.value)}
            />
            <button className="btn-secondary !py-1 !px-3 text-xs" disabled={busy || !link.trim()} onClick={() => onUpload(null)}>
              {busy ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
