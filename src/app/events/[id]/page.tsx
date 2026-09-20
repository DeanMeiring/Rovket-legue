"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Link from "next/link";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  RSVP_COLOR,
  RSVP_LABEL,
} from "@/lib/format";

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
              {format(new Date(event.startTime), "EEEE d MMM yyyy, HH:mm")}
              {event.location && ` · ${event.location}`}
            </p>
          </div>
          {isAdmin && (
            <button onClick={deleteEvent} className="btn-danger">
              Delete event
            </button>
          )}
        </div>
        {event.description && <p className="text-slate-300 mt-4">{event.description}</p>}
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">RSVPs</h2>
        <ul className="space-y-2">
          {event.rsvps.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span>{r.user.displayName || r.user.username}</span>
              <span className={`badge ${RSVP_COLOR[r.status]}`}>{RSVP_LABEL[r.status]}</span>
            </li>
          ))}
          {event.rsvps.length === 0 && (
            <p className="text-slate-500 text-sm">No players linked to this event yet.</p>
          )}
        </ul>
      </div>

      <div className="card">
        <h2 className="font-bold text-lg mb-4">Performance</h2>
        <ul className="space-y-2 mb-4">
          {event.performances.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm gap-2">
              <span>
                {p.user.displayName || p.user.username}
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
                  {r.user.displayName || r.user.username}
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
