"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { BLOCKS, DAYS, slotFor, slotKey } from "@/lib/availability";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/format";

type Player = {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  team: { id: string; name: string } | null;
  availability: {
    slots: string[];
    note: string | null;
    updatedAt: string;
  } | null;
};
type EventItem = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string | null;
};

const nameOf = (p: Player) => p.displayName || p.username;

export default function AdminAvailabilityPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [teamFilter, setTeamFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7), [weekOffset]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/availability?from=${encodeURIComponent(weekStart.toISOString())}`)
      .then((r) => (r.ok ? r.json() : { players: [], events: [] }))
      .then((data) => {
        setPlayers(data.players);
        setEvents(data.events);
        setLoading(false);
      });
  }, [weekStart]);

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => p.team && map.set(p.team.id, p.team.name));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const shown = players.filter((p) => teamFilter === "all" || p.team?.id === teamFilter);
  const withAvailability = shown.filter((p) => p.availability);
  const missing = shown.filter((p) => !p.availability && p.role !== "ADMIN");

  function freeIn(key: string) {
    return withAvailability.filter((p) => p.availability!.slots.includes(key));
  }

  // Events land in the slot their start time falls in (multi-day events only on their first day).
  const eventsBySlot = new Map<string, EventItem[]>();
  events.forEach((ev) => {
    const key = slotFor(new Date(ev.startTime));
    if (key && new Date(ev.startTime) >= weekStart) eventsBySlot.set(key, [...(eventsBySlot.get(key) ?? []), ev]);
  });

  const max = Math.max(1, withAvailability.length);
  const selectedFree = selected ? freeIn(selected) : [];
  const [selDay, selBlock] = selected ? selected.split("-") : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-sm text-accent2 hover:underline">
            ← Admin panel
          </Link>
          <h1 className="text-3xl font-bold mt-1">Availability and calendar</h1>
          <p className="text-slate-400 text-sm mt-1">
            Each box shows how many players are usually free then. Click one to see who.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input !py-1 !w-auto text-sm"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="all">All players</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn-secondary !py-1 !px-3 text-sm" onClick={() => setWeekOffset((w) => w - 1)}>
            ←
          </button>
          <span className="text-sm text-slate-300 whitespace-nowrap">
            {format(weekStart, "d MMM")} to {format(addDays(weekStart, 6), "d MMM")}
          </span>
          <button className="btn-secondary !py-1 !px-3 text-sm" onClick={() => setWeekOffset((w) => w + 1)}>
            →
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full table-fixed text-sm border-separate border-spacing-1 min-w-[720px]">
              <thead>
                <tr>
                  <th className="w-28" />
                  {DAYS.map((d, i) => (
                    <th key={d.key} className="font-medium text-slate-400 pb-1">
                      {d.label}{" "}
                      <span className="text-slate-500 font-normal">{format(addDays(weekStart, i), "d MMM")}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BLOCKS.map((b) => (
                  <tr key={b.key}>
                    <th className="text-left pr-2 whitespace-nowrap align-top">
                      <span className="block font-medium">{b.label}</span>
                      <span className="block text-xs text-slate-500 font-normal">{b.hours}</span>
                    </th>
                    {DAYS.map((d) => {
                      const key = slotKey(d.key, b.key);
                      const count = freeIn(key).length;
                      const slotEvents = eventsBySlot.get(key) ?? [];
                      const strength = count / max;
                      return (
                        <td key={key} className="align-top">
                          <button
                            onClick={() => setSelected(selected === key ? null : key)}
                            className={`w-full min-h-[64px] rounded-lg border p-1.5 text-left transition-colors ${
                              selected === key ? "border-accent" : "border-border hover:border-slate-500"
                            }`}
                            style={{
                              backgroundColor: `rgba(255, 138, 0, ${0.08 + strength * 0.5})`,
                            }}
                          >
                            <span className="block text-lg font-bold leading-none">{count}</span>
                            <span className="block text-[10px] text-slate-300">free</span>
                            {slotEvents.map((ev) => (
                              <span
                                key={ev.id}
                                className={`mt-1 block truncate rounded px-1 py-0.5 text-[10px] font-semibold ${EVENT_TYPE_COLOR[ev.type]}`}
                                title={ev.title}
                              >
                                {format(new Date(ev.startTime), "HH:mm")} {ev.title}
                              </span>
                            ))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-2">
              {withAvailability.length} of {shown.length} players have set their availability.
            </p>
          </div>

          {selected && (
            <div className="card">
              <h2 className="font-bold text-lg mb-3">
                {DAYS.find((d) => d.key === selDay)?.label}{" "}
                {BLOCKS.find((b) => b.key === selBlock)?.label.toLowerCase()}: {selectedFree.length} free
              </h2>
              {selectedFree.length === 0 ? (
                <p className="text-slate-500 text-sm">Nobody has ticked this time.</p>
              ) : (
                <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {selectedFree.map((p) => (
                    <li key={p.id}>
                      {nameOf(p)} {p.team && <span className="text-slate-500">· {p.team.name}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-bold text-lg mb-3">This week&apos;s events</h2>
              {events.length === 0 && <p className="text-slate-500 text-sm">Nothing scheduled this week.</p>}
              <ul className="space-y-2 text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2">
                    <span className={`badge ${EVENT_TYPE_COLOR[ev.type]}`}>{EVENT_TYPE_LABEL[ev.type]}</span>
                    <Link href={`/events/${ev.id}`} className="hover:underline">
                      {ev.title}
                    </Link>
                    <span className="text-slate-500">{format(new Date(ev.startTime), "EEE d MMM, HH:mm")}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2 className="font-bold text-lg mb-3">Not set yet ({missing.length})</h2>
              {missing.length === 0 ? (
                <p className="text-slate-500 text-sm">Everyone has filled it in.</p>
              ) : (
                <p className="text-sm text-slate-300">{missing.map(nameOf).join(", ")}</p>
              )}
              {withAvailability.some((p) => p.availability!.note) && (
                <>
                  <h3 className="font-semibold mt-4 mb-2 text-sm">Notes from players</h3>
                  <ul className="space-y-1 text-sm">
                    {withAvailability
                      .filter((p) => p.availability!.note)
                      .map((p) => (
                        <li key={p.id}>
                          <span className="font-medium">{nameOf(p)}:</span>{" "}
                          <span className="text-slate-400">{p.availability!.note}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
