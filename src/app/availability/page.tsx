"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BLOCKS, DAYS, slotKey } from "@/lib/availability";

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSlots(new Set(data.slots));
          setNote(data.note ?? "");
          setUpdatedAt(data.updatedAt);
        }
        setLoading(false);
      });
  }, []);

  function toggle(key: string) {
    setMessage(null);
    setSlots((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Toggles a whole row: fills it unless every day in it is already ticked.
  function toggleBlock(block: string) {
    setMessage(null);
    setSlots((s) => {
      const keys = DAYS.map((d) => slotKey(d.key, block));
      const allOn = keys.every((k) => s.has(k));
      const next = new Set(s);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: Array.from(slots), note }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({
        ok: false,
        text: data.error || "Couldn't save your availability.",
      });
      return;
    }
    setUpdatedAt(data.updatedAt);
    setMessage({
      ok: true,
      text: "Saved. Admins can now see when you're free.",
    });
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">My availability</h1>
        <p className="text-slate-400 mt-1">
          Tick the times you can usually play in a normal week. Admins use this to plan practice.
        </p>
      </div>

      <div className="card overflow-x-auto !px-3 sm:!px-5">
        <table className="w-full table-fixed text-sm border-separate border-spacing-0.5 sm:border-spacing-1">
          <thead>
            <tr>
              <th className="w-20 sm:w-28" />
              {DAYS.map((d) => (
                <th key={d.key} className="font-medium text-slate-400 pb-1">
                  <span className="sm:hidden">{d.short}</span>
                  <span className="hidden sm:inline">{d.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BLOCKS.map((b) => (
              <tr key={b.key}>
                <th className="text-left pr-2 whitespace-nowrap">
                  <button
                    onClick={() => toggleBlock(b.key)}
                    className="text-left hover:underline"
                    title="Tick or clear the whole row"
                  >
                    <span className="block font-medium">{b.label}</span>
                    <span className="block text-[10px] sm:text-xs text-slate-500 font-normal">
                      <span className="sm:hidden">{b.hoursShort}</span>
                      <span className="hidden sm:inline">{b.hours}</span>
                    </span>
                  </button>
                </th>
                {DAYS.map((d) => {
                  const key = slotKey(d.key, b.key);
                  const on = slots.has(key);
                  return (
                    <td key={key}>
                      <button
                        onClick={() => toggle(key)}
                        aria-pressed={on}
                        aria-label={`${d.label} ${b.label}`}
                        className={`w-full h-11 rounded-lg border text-xs font-semibold transition-colors ${
                          on
                            ? "bg-accent text-black border-accent"
                            : "border-border text-slate-500 hover:border-slate-500"
                        }`}
                      >
                        {on ? (
                          <>
                            <span className="sm:hidden">✓</span>
                            <span className="hidden sm:inline">Free</span>
                          </>
                        ) : (
                          ""
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">Anything else? (optional)</label>
          <input
            className="input"
            maxLength={300}
            placeholder="e.g. Exams until 15 Nov, only free after 19:00 on Thursdays"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setMessage(null);
            }}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save availability"}
          </button>
          {message && (
            <span className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</span>
          )}
          {!message && updatedAt && (
            <span className="text-xs text-slate-500">Last saved {format(new Date(updatedAt), "d MMM, HH:mm")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
