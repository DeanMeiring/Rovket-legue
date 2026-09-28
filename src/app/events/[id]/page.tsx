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
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/events/${params.id}`);
    if (res.ok) setEvent(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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

      <div className="card">
        <h2 className="font-bold text-lg mb-4">Performance</h2>
        <ul className="space-y-2 mb-4">
          {event.performances.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm gap-2">
              <span>
                {nameWithTag(p.user)}
                {p.mvp && <span className="badge bg-accent/20 text-accent ml-2">MVP</span>}
                {p.win === true && <span className="badge bg-green-500/20 text-green-300 ml-2">Win</span>}
                {p.win === false && <span className="badge bg-red-500/20 text-red-300 ml-2">Loss</span>}
              </span>
              <span className="text-slate-400">
                {p.goals}G {p.assists}A {p.saves}S {p.shots} shots · {p.score} pts
              </span>
              {isAdmin && (
                <button
                  onClick={() => deletePerformance(p.id)}
                  className="text-red-400 hover:underline text-xs"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {event.performances.length === 0 && (
            <p className="text-slate-500 text-sm">No stats logged for this event yet.</p>
          )}
        </ul>

        {isAdmin && (
          <form onSubmit={importReplay} className="border-t border-border pt-4 space-y-2 mb-4">
            <p className="label mb-0">Import stats from a ballchasing.com replay</p>
            <div className="flex gap-2">
              <input
                className="input"
                value={replayUrl}
                onChange={(e) => setReplayUrl(e.target.value)}
                placeholder="https://ballchasing.com/replay/..."
              />
              <button type="submit" disabled={importing} className="btn-secondary whitespace-nowrap">
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            {importError && <p className="text-red-400 text-sm">{importError}</p>}
            {importResult && (
              <div className="text-sm">
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
            <p className="text-xs text-slate-500">
              Matches replay players to app accounts by name. Needs BALLCHASING_API_KEY
              set on the server.
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
    </div>
  );
}
