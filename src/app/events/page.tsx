"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { format, isPast } from "date-fns";
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABEL,
  RSVP_COLOR,
  RSVP_LABEL,
} from "@/lib/format";

type Rsvp = { userId: string; status: string };
type EventItem = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  location: string | null;
  startTime: string;
  rsvps: Rsvp[];
  createdBy: { displayName: string | null; username: string };
};

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const isAdmin = session?.user.role === "ADMIN";

  async function load() {
    setLoading(true);
    const res = await fetch("/api/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function rsvp(eventId: string, status: string) {
    setUpdating(eventId);
    await fetch(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setUpdating(null);
  }

  async function removeEvent(eventId: string) {
    if (!confirm("Delete this event? This can't be undone.")) return;
    await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    await load();
  }

  const upcoming = events.filter((e) => !isPast(new Date(e.startTime)));
  const past = events.filter((e) => isPast(new Date(e.startTime)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Events</h1>
        {isAdmin && (
          <Link href="/events/new" className="btn-primary">
            + New event
          </Link>
        )}
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-300">Upcoming</h2>
        {!loading && upcoming.length === 0 && (
          <p className="text-slate-500 text-sm">Nothing scheduled yet.</p>
        )}
        {upcoming.map((ev) => {
          const myRsvp = ev.rsvps.find((r) => r.userId === session?.user.id)?.status || "PENDING";
          const counts = { GOING: 0, MAYBE: 0, DECLINED: 0 };
          ev.rsvps.forEach((r) => {
            if (r.status in counts) counts[r.status as keyof typeof counts]++;
          });

          return (
            <div key={ev.id} className="card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${EVENT_TYPE_COLOR[ev.type]}`}>
                      {EVENT_TYPE_LABEL[ev.type]}
                    </span>
                    <Link href={`/events/${ev.id}`} className="font-bold text-lg hover:underline">
                      {ev.title}
                    </Link>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {format(new Date(ev.startTime), "EEEE d MMM yyyy, HH:mm")}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                  {ev.description && (
                    <p className="text-sm text-slate-500 mt-2 max-w-2xl">{ev.description}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    ✅ {counts.GOING} going · 🤔 {counts.MAYBE} maybe · ❌ {counts.DECLINED} declined
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={`badge ${RSVP_COLOR[myRsvp]}`}>{RSVP_LABEL[myRsvp]}</span>
                  <div className="flex gap-1">
                    {["GOING", "MAYBE", "DECLINED"].map((s) => (
                      <button
                        key={s}
                        disabled={updating === ev.id}
                        onClick={() => rsvp(ev.id, s)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          myRsvp === s
                            ? "border-accent text-accent"
                            : "border-border text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        {RSVP_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-1">
                      <Link href={`/events/${ev.id}`} className="text-xs text-accent2 hover:underline">
                        Manage
                      </Link>
                      <Link href={`/events/${ev.id}/edit`} className="text-xs text-accent2 hover:underline">
                        Edit
                      </Link>
                      <button
                        onClick={() => removeEvent(ev.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-300">Past</h2>
          {past.map((ev) => (
            <Link
              href={`/events/${ev.id}`}
              key={ev.id}
              className="card flex items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity"
            >
              <div>
                <span className={`badge ${EVENT_TYPE_COLOR[ev.type]} mr-2`}>
                  {EVENT_TYPE_LABEL[ev.type]}
                </span>
                <span className="font-medium">{ev.title}</span>
              </div>
              <span className="text-sm text-slate-500">
                {format(new Date(ev.startTime), "d MMM yyyy")}
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
