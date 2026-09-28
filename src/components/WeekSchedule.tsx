"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, eventIsOver, RSVP_COLOR, RSVP_LABEL } from "@/lib/format";

type WeekEvent = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string | null;
  rsvpOpen: boolean;
  rsvp: string | null;
};

// A Monday to Sunday calendar of one player's events, with their RSVP. On
// your own profile you can answer RSVPs right here.
export default function WeekSchedule({ playerId, isSelf }: { playerId: string; isSelf: boolean }) {
  const [offset, setOffset] = useState(0);
  const [events, setEvents] = useState<WeekEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), offset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekKey = weekStart.toISOString();

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setFailed(false);
    const from = new Date(weekKey);
    const params = new URLSearchParams({ from: from.toISOString(), to: addDays(from, 7).toISOString() });
    fetch(`/api/players/${playerId}/week?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => !cancelled && setEvents(data.events))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [playerId, weekKey]);

  const [saveError, setSaveError] = useState<string | null>(null);

  async function rsvp(eventId: string, status: string) {
    setSaveError(null);
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setSaveError((await res.json().catch(() => ({}))).error || "Couldn't save your RSVP.");
      return;
    }
    setEvents((list) => list?.map((e) => (e.id === eventId ? { ...e, rsvp: status } : e)) ?? list);
  }

  // A multi-day event shows on every day it covers.
  const eventsOn = (day: Date) =>
    (events ?? []).filter((e) => {
      const start = new Date(e.startTime);
      const end = e.endTime ? new Date(e.endTime) : start;
      const dayEnd = addDays(day, 1);
      return start < dayEnd && end >= day;
    });

  // Only on your own profile, while RSVPs are open and the event isn't over.
  const canAnswer = (e: WeekEvent) => isSelf && e.rsvpOpen && !eventIsOver(e.startTime, e.endTime);

  const today = new Date();
  const label = offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : "Week";

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg">{label}</h2>
          <p className="text-xs text-slate-500">
            {format(days[0], "d MMM")} to {format(days[6], "d MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="btn-secondary !py-1 !px-3 text-sm"
            aria-label="Previous week"
          >
            ←
          </button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="btn-secondary !py-1 !px-3 text-sm">
              Today
            </button>
          )}
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="btn-secondary !py-1 !px-3 text-sm"
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      {failed ? (
        <p className="text-slate-500 text-sm">Couldn&apos;t load the schedule.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((day) => {
            const dayEvents = eventsOn(day);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={`rounded-lg border p-2 sm:min-h-[96px] ${
                  isToday ? "border-accent/60 bg-accent/5" : "border-border bg-panel2/40"
                }`}
              >
                <p className={`text-xs font-semibold mb-1 ${isToday ? "text-accent" : "text-slate-400"}`}>
                  {format(day, "EEE d")}
                </p>
                {events === null ? (
                  <p className="text-xs text-slate-600">…</p>
                ) : dayEvents.length === 0 ? (
                  <p className="text-xs text-slate-600 sm:hidden">Nothing on</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayEvents.map((e) => (
                      <li key={e.id}>
                        <Link href={`/events/${e.id}`} className="block rounded-md hover:bg-panel2 p-1 -m-1">
                          <span className="block text-xs font-medium text-slate-200 truncate" title={e.title}>
                            {e.title}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {isSameDay(new Date(e.startTime), day) ? format(new Date(e.startTime), "HH:mm") : "All day"}
                          </span>
                          <span className="flex flex-wrap gap-1 mt-0.5">
                            <span className={`badge !text-[10px] ${EVENT_TYPE_COLOR[e.type] ?? ""}`}>
                              {EVENT_TYPE_LABEL[e.type] ?? e.type}
                            </span>
                            {e.rsvp && !canAnswer(e) && (
                              <span className={`badge !text-[10px] whitespace-nowrap ${RSVP_COLOR[e.rsvp] ?? ""}`}>
                                {e.rsvp === "PENDING" ? "No reply" : RSVP_LABEL[e.rsvp]}
                              </span>
                            )}
                          </span>
                        </Link>
                        {canAnswer(e) && (
                          <select
                            aria-label={`RSVP for ${e.title}`}
                            value={e.rsvp && e.rsvp !== "PENDING" ? e.rsvp : ""}
                            onChange={(ev) => ev.target.value && rsvp(e.id, ev.target.value)}
                            className={`mt-1 w-full rounded-md border border-border text-[11px] py-0.5 px-1 ${
                              RSVP_COLOR[e.rsvp ?? "PENDING"] ?? "bg-panel2"
                            }`}
                          >
                            <option value="" disabled>
                              RSVP…
                            </option>
                            <option value="GOING">Going</option>
                            <option value="MAYBE">Maybe</option>
                            <option value="DECLINED">Can&apos;t make it</option>
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      {saveError && <p className="text-red-400 text-sm mt-3">{saveError}</p>}
      {events !== null && events.length === 0 && !failed && (
        <p className="text-slate-500 text-sm mt-3">
          {isSelf ? "You have nothing scheduled this week." : "Nothing scheduled this week."}
        </p>
      )}
    </div>
  );
}
