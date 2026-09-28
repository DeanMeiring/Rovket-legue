"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  formatEventWhen,
  RSVP_COLOR,
  RSVP_LABEL,
  audienceLabel,
  nameWithTag,
} from "@/lib/format";
import EventRoster from "@/components/EventRoster";
import UnmatchedModal from "@/components/UnmatchedModal";
import ReviewModal from "@/components/ReviewModal";
import { PlayerStatTiles, ReplayStatsCard } from "@/components/ReplayStats";
import { averageStats } from "@/lib/replayStats";

type PlayerRef = { id: string; displayName: string | null; username: string };
type Rsvp = { id: string; status: string; user: PlayerRef };
type Performance = {
  id: string;
  user: PlayerRef;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  score: number;
  mvp: boolean;
  win: boolean | null;
  stats: unknown;
};
type EventDetail = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string | null;
  rsvpOpen: boolean;
  forEveryone: boolean;
  audienceTeams: { id: string; name: string }[];
  rsvps: Rsvp[];
  performances: Performance[];
};

const emptyForm = {
  userId: "",
  goals: 0,
  assists: 0,
  saves: 0,
  shots: 0,
  score: 0,
  mvp: false,
  win: null as boolean | null,
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [replayUrl, setReplayUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: string[];
    unmatched: string[];
    games: number;
    skipped: number;
    failed: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [reviewing, setReviewing] = useState<PlayerRef | null>(null);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number; failed: string[]; running: boolean } | null>(null);

  // Writes a fresh draft review for every player in this event, one at a time.
  async function reviewEveryone(players: PlayerRef[]) {
    if (!confirm(`Write a new draft review for all ${players.length} players? Each one is a Claude call.`)) return;
    const failed: string[] = [];
    setBulk({ done: 0, total: players.length, failed, running: true });
    for (const [i, p] of players.entries()) {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id }),
      }).catch(() => null);
      if (!res?.ok) failed.push(nameWithTag(p));
      setBulk({ done: i + 1, total: players.length, failed: [...failed], running: i + 1 < players.length });
    }
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/events/${params.id}`);
    if (res.ok) setEvent(await res.json());
    setLoading(false);
    if (isAdmin) await loadUnmatched();
  }

  async function loadUnmatched() {
    const res = await fetch(`/api/events/${params.id}/unmatched`);
    if (res.ok) setUnmatchedCount((await res.json()).names.length);
  }

  async function clearImported() {
    if (!confirm("Remove every stat imported from ballchasing for this event? Stats logged by hand stay.")) return;
    const res = await fetch(`/api/events/${params.id}/import-replay`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setImportResult(null);
    setImportError(res.ok ? null : data.error || "Couldn't clear the imported stats.");
    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (isAdmin) loadUnmatched();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, params.id]);

  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState(true);
  const [resendDiscord, setResendDiscord] = useState(true);
  const [resendOnlyNoReply, setResendOnlyNoReply] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);

  async function resend() {
    if (!event) return;
    const where = [resendEmail && "email", resendDiscord && "Discord"].filter(Boolean).join(" and ");
    const who = resendOnlyNoReply ? "players who haven't replied" : "everyone this event is for";
    if (!confirm(`Send this event again by ${where} to ${who}?`)) return;
    setResending(true);
    setResendResult(null);
    const res = await fetch(`/api/events/${event.id}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail, discord: resendDiscord, onlyNoReply: resendOnlyNoReply }),
    });
    const data = await res.json().catch(() => ({}));
    setResendResult(data.message || data.error || "Something went wrong.");
    setResending(false);
    // A resend can add RSVP rows for players who joined a team since.
    if (res.ok) await load();
  }

  async function toggleRsvps() {
    if (!event) return;
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvpOpen: !event.rsvpOpen }),
    });
    await load();
  }

  async function submitPerformance(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId) return;
    setSaving(true);
    await fetch("/api/performances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, eventId: event?.id }),
    });
    setForm(emptyForm);
    await load();
    setSaving(false);
  }

  async function importReplay(e: React.FormEvent) {
    e.preventDefault();
    if (!replayUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    const res = await fetch(`/api/events/${params.id}/import-replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replayUrl }),
    });
    const data = await res.json().catch(() => ({}));

    setImporting(false);

    if (!res.ok) {
      setImportError(data.error || "Couldn't import that replay.");
      return;
    }

    setImportResult(data);
    setReplayUrl("");
    await load();
    if (data.unmatched?.length) setShowUnmatched(true);
  }

  async function deletePerformance(id: string) {
    await fetch(`/api/performances/${id}`, { method: "DELETE" });
    await load();
  }

  async function deleteEvent() {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/events/${event?.id}`, { method: "DELETE" });
    router.push("/events");
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!event) return <p className="text-slate-500">Event not found.</p>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Link href="/events" className="text-sm text-accent2 hover:underline">
          ← Back to events
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div>
            <span className={`badge ${EVENT_TYPE_COLOR[event.type]}`}>
              {EVENT_TYPE_LABEL[event.type]}
            </span>
            <h1 className="text-3xl font-bold mt-2">{event.title}</h1>
            <p className="text-slate-400 mt-1">
              {formatEventWhen(event.startTime, event.endTime)}
              {event.location && ` · ${event.location}`}
            </p>
            <p className="text-sm text-slate-500 mt-1">For: {audienceLabel(event)}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setResendOpen((o) => !o)} className="btn-secondary">
                Resend
              </button>
              <Link href={`/events/${event.id}/edit`} className="btn-secondary">
                Edit event
              </Link>
              <button onClick={deleteEvent} className="btn-danger">
                Delete event
              </button>
            </div>
          )}
        </div>
        {event.description && <p className="text-slate-300 mt-4">{event.description}</p>}
        {isAdmin && resendOpen && (
          <div className="mt-4 rounded-lg border border-slate-700 p-4 space-y-3">
            <p className="font-semibold">Send this event again</p>
            <div className="flex gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={resendEmail} onChange={(e) => setResendEmail(e.target.checked)} />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={resendDiscord} onChange={(e) => setResendDiscord(e.target.checked)} />
                Discord
              </label>
            </div>
            <div className="flex gap-4 flex-wrap text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!resendOnlyNoReply} onChange={() => setResendOnlyNoReply(false)} />
                Everyone it&apos;s for
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={resendOnlyNoReply}
                  disabled={!event.rsvpOpen}
                  onChange={() => setResendOnlyNoReply(true)}
                />
                Only players who haven&apos;t replied
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Discord replaces the old post with a new one, so the RSVP buttons stay in one place.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={resend}
                disabled={resending || (!resendEmail && !resendDiscord)}
                className="btn-primary !py-1 !px-3 text-sm"
              >
                {resending ? "Sending..." : "Send"}
              </button>
              {resendResult && <p className="text-sm text-slate-300">{resendResult}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-bold text-lg">RSVPs</h2>
          {isAdmin && (
            <button onClick={toggleRsvps} className="btn-secondary !py-1 !px-3 text-sm">
              {event.rsvpOpen ? "Close RSVPs" : "Open RSVPs"}
            </button>
          )}
        </div>
        {!event.rsvpOpen && <p className="text-sm text-slate-400 mb-3">RSVPs open once the teams are confirmed.</p>}
        <ul className="space-y-2">
          {event.rsvps.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span>{nameWithTag(r.user)}</span>
              <span className={`badge ${RSVP_COLOR[r.status]}`}>{RSVP_LABEL[r.status]}</span>
            </li>
          ))}
          {event.rsvps.length === 0 && (
            <p className="text-slate-500 text-sm">No players linked to this event yet.</p>
          )}
        </ul>
      </div>

      <EventRoster eventId={event.id} eventTitle={event.title} isAdmin={isAdmin} myId={session?.user.id} />

      <ReplayStatsCard
        players={groupByPlayer(event.performances).map((g) => ({
          id: g.user.id,
          name: nameWithTag(g.user),
          stats: g.rows.map((r) => r.stats),
        }))}
      />

      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-bold text-lg">Performance</h2>
          {isAdmin && event.performances.length > 0 && (
            <button
              onClick={() => reviewEveryone(groupByPlayer(event.performances).map((g) => g.user))}
              disabled={bulk?.running}
              className="btn-secondary !py-1 !px-3 text-sm"
            >
              {bulk?.running ? `Writing reviews... ${bulk.done} of ${bulk.total}` : "Write reviews for everyone"}
            </button>
          )}
        </div>
        {isAdmin && bulk && !bulk.running && (
          <p className="text-sm text-slate-400 mb-4">
            Wrote {bulk.done - bulk.failed.length} draft review{bulk.done - bulk.failed.length === 1 ? "" : "s"}. Open each
            player&apos;s Review to check it and publish it.
            {bulk.failed.length > 0 && <span className="text-red-400"> Failed: {bulk.failed.join(", ")}.</span>}
          </p>
        )}
        {isAdmin && unmatchedCount > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 mb-4 text-sm">
            <span className="text-yellow-200">
              {unmatchedCount} in-game name{unmatchedCount === 1 ? "" : "s"} from the replays still need a player.
            </span>
            <button onClick={() => setShowUnmatched(true)} className="btn-secondary !py-1 !px-3 text-sm">
              Who is this?
            </button>
          </div>
        )}
        <ul className="space-y-2 mb-4">
          {groupByPlayer(event.performances).map((g) => (
            <li key={g.user.id} className="text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => setOpenPlayer(openPlayer === g.user.id ? null : g.user.id)}
                  className="text-left hover:text-white"
                >
                  {openPlayer === g.user.id ? "▾" : "▸"} {nameWithTag(g.user)}
                  {g.mvps > 0 && <span className="badge bg-accent/20 text-accent ml-2">{g.mvps > 1 ? `${g.mvps}× MVP` : "MVP"}</span>}
                </button>
                <span className="flex items-center gap-3">
                  <span className="text-slate-400">
                    {g.rows.length} game{g.rows.length === 1 ? "" : "s"}
                    {g.wins + g.losses > 0 && ` · ${g.wins}W ${g.losses}L`} · {g.goals}G {g.assists}A {g.saves}S · avg{" "}
                    {Math.round(g.score / g.rows.length)} pts
                  </span>
                  {isAdmin && (
                    <button onClick={() => setReviewing(g.user)} className="btn-secondary !py-1 !px-2 text-xs">
                      Review
                    </button>
                  )}
                </span>
              </div>
              {openPlayer === g.user.id && (
                <div className="mt-3 ml-4">
                  <PlayerStatTiles
                    stats={g.rows.map((r) => r.stats)}
                    eventAvg={averageStats(event.performances.map((r) => r.stats))}
                  />
                </div>
              )}
              {openPlayer === g.user.id && (
                <ul className="mt-3 ml-4 space-y-1">
                  {g.rows.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        Game {i + 1}
                        {p.mvp && <span className="badge bg-accent/20 text-accent ml-2">MVP</span>}
                        {p.win === true && <span className="badge bg-green-500/20 text-green-300 ml-2">Win</span>}
                        {p.win === false && <span className="badge bg-red-500/20 text-red-300 ml-2">Loss</span>}
                      </span>
                      <span>
                        {p.goals}G {p.assists}A {p.saves}S {p.shots} shots · {p.score} pts
                      </span>
                      {isAdmin && (
                        <button onClick={() => deletePerformance(p.id)} className="text-red-400 hover:underline">
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {event.performances.length === 0 && (
            <p className="text-slate-500 text-sm">No stats logged for this event yet.</p>
          )}
        </ul>

        {isAdmin && (
          <form onSubmit={importReplay} className="border-t border-border pt-4 space-y-2 mb-4">
            <p className="label mb-0">Import stats from ballchasing.com</p>
            <div className="flex gap-2">
              <input
                className="input"
                value={replayUrl}
                onChange={(e) => setReplayUrl(e.target.value)}
                placeholder="Replay or group link, e.g. https://ballchasing.com/group/..."
              />
              <button type="submit" disabled={importing} className="btn-secondary whitespace-nowrap">
                {importing ? "Importing, this can take a minute..." : "Import"}
              </button>
            </div>
            {importError && <p className="text-red-400 text-sm">{importError}</p>}
            {importResult && (
              <div className="text-sm">
                <p className="text-slate-300">
                  Imported {importResult.games} game{importResult.games === 1 ? "" : "s"}
                  {importResult.skipped > 0 && `, skipped ${importResult.skipped} already imported`}.
                </p>
                {importResult.failed.length > 0 && (
                  <p className="text-yellow-400">
                    Couldn&apos;t read {importResult.failed.length} replay(s), ballchasing may still be processing them.
                    Import the group again in a minute: {importResult.failed.join(", ")}
                  </p>
                )}
                {importResult.imported.length > 0 && (
                  <p className="text-green-400">
                    Imported: {importResult.imported.join(", ")}
                  </p>
                )}
                {importResult.unmatched.length > 0 && (
                  <p className="text-yellow-400">
                    Couldn&apos;t match to an app account (log them manually below): {importResult.unmatched.join(", ")}
                  </p>
                )}
              </div>
            )}
            <button type="button" onClick={clearImported} className="text-xs text-red-400 hover:underline">
              Clear imported stats and start fresh
            </button>
            <p className="text-xs text-slate-500">
              Paste one replay, or the whole group after the event to pull every game in it. Players are
              matched by in-game name to their username, display name or tryout board tag. Importing a group
              again only adds the new replays.
            </p>
          </form>
        )}

        {isAdmin && (
          <form onSubmit={submitPerformance} className="border-t border-border pt-4 space-y-3">
            <p className="label mb-0">Log stats for a player</p>
            <select
              className="input"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              required
            >
              <option value="">Select player...</option>
              {event.rsvps.map((r) => (
                <option key={r.user.id} value={r.user.id}>
                  {nameWithTag(r.user)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(["goals", "assists", "saves", "shots", "score"] as const).map((field) => (
                <div key={field}>
                  <label className="label capitalize">{field}</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: Number(e.target.value) })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.mvp}
                  onChange={(e) => setForm({ ...form, mvp: e.target.checked })}
                />
                MVP
              </label>
              <select
                className="input !w-auto"
                value={form.win === null ? "" : form.win ? "win" : "loss"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    win: e.target.value === "" ? null : e.target.value === "win",
                  })
                }
              >
                <option value="">Result unknown</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
              </select>
              <button type="submit" disabled={saving} className="btn-primary ml-auto">
                {saving ? "Saving..." : "Add stats"}
              </button>
            </div>
          </form>
        )}
      </div>
      {showUnmatched && (
        <UnmatchedModal eventId={event.id} onClose={() => setShowUnmatched(false)} onChanged={load} />
      )}
      {reviewing && (
        <ReviewModal userId={reviewing.id} name={nameWithTag(reviewing)} onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}

// One entry per player with their totals, games in the order they were logged.
function groupByPlayer(performances: Performance[]) {
  const groups = new Map<string, { user: PlayerRef; rows: Performance[] }>();
  for (const p of performances) {
    const g = groups.get(p.user.id) ?? { user: p.user, rows: [] };
    g.rows.push(p);
    groups.set(p.user.id, g);
  }
  return [...groups.values()]
    .map((g) => {
      const sum = (k: "goals" | "assists" | "saves" | "score") => g.rows.reduce((s, r) => s + r[k], 0);
      return {
        ...g,
        goals: sum("goals"),
        assists: sum("assists"),
        saves: sum("saves"),
        score: sum("score"),
        mvps: g.rows.filter((r) => r.mvp).length,
        wins: g.rows.filter((r) => r.win === true).length,
        losses: g.rows.filter((r) => r.win === false).length,
      };
    })
    .sort((a, b) => b.score / b.rows.length - a.score / a.rows.length);
}
