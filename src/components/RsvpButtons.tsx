"use client";

import { useState } from "react";
import { RSVP_LABEL } from "@/lib/format";

const CHOICES = ["GOING", "MAYBE", "DECLINED"] as const;

// Going / Maybe / Can't for one event, saved straight away.
export default function RsvpButtons({
  eventId,
  initial,
  open,
  large = false,
}: {
  eventId: string;
  initial: string;
  open: boolean;
  large?: boolean;
}) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <span className="text-xs text-slate-400">RSVPs open once teams are confirmed</span>;

  async function choose(next: string) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    if (res.ok) setStatus(next);
    else setError((await res.json().catch(() => ({}))).error || "Couldn't save that.");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        {CHOICES.map((s) => (
          <button
            key={s}
            disabled={saving}
            onClick={() => choose(s)}
            className={`rounded-md border ${large ? "text-sm px-3 py-1.5" : "text-xs px-2 py-1"} ${
              status === s ? "border-accent text-accent bg-accent/10" : "border-border text-slate-400 hover:border-slate-500"
            }`}
          >
            {s === "DECLINED" ? "Can't" : RSVP_LABEL[s]}
          </button>
        ))}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
