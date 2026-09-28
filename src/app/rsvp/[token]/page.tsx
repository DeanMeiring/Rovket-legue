"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, formatEventWhen, RSVP_LABEL } from "@/lib/format";

type State = {
  event: {
    id: string;
    title: string;
    type: string;
    startTime: string;
    endTime: string | null;
    location: string | null;
  };
  player: { name: string };
  current: string | null;
  open: boolean;
  closedReason: string | null;
};

const CHOICES = [
  { status: "GOING", label: "Going" },
  { status: "MAYBE", label: "Maybe" },
  { status: "DECLINED", label: "Can't make it" },
] as const;

// Opened from the RSVP buttons in an event email. Nothing is saved until the
// player presses a button here.
export default function EmailRsvpPage() {
  const { token } = useParams<{ token: string }>();
  const picked = useSearchParams().get("s");
  const [state, setState] = useState<State | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rsvp/${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This RSVP link isn't valid.");
        setState(data);
      })
      .catch((e) => setInvalid(e.message));
  }, [token]);

  async function answer(status: string) {
    setSaving(status);
    setError(null);
    const res = await fetch(`/api/rsvp/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) return setError(data.error || "Couldn't save your answer.");
    setState((s) => (s ? { ...s, current: status } : s));
  }

  if (invalid) {
    return (
      <div className="max-w-md mx-auto mt-12 card text-center">
        <h1 className="text-xl font-bold mb-2">Can&apos;t RSVP with this link</h1>
        <p className="text-slate-400 text-sm">{invalid}</p>
        <Link href="/events" className="btn-secondary mt-4 inline-block">
          Log in to see events
        </Link>
      </div>
    );
  }
  if (!state) return <p className="text-slate-500 text-center mt-12">Loading...</p>;

  const { event } = state;
  // The button they clicked in the email goes first and is the highlighted one.
  const choices = [...CHOICES].sort((a, b) => Number(b.status === picked) - Number(a.status === picked));

  return (
    <div className="max-w-md mx-auto mt-12 card space-y-4">
      <div>
        <span className={`badge ${EVENT_TYPE_COLOR[event.type] ?? ""}`}>
          {EVENT_TYPE_LABEL[event.type] ?? event.type}
        </span>
        <h1 className="text-2xl font-bold mt-2">{event.title}</h1>
        <p className="text-slate-400 text-sm">{formatEventWhen(event.startTime, event.endTime)}</p>
        {event.location && <p className="text-slate-500 text-sm">{event.location}</p>}
      </div>

      <p className="text-sm">
        Hi {state.player.name}.{" "}
        {state.current && state.current !== "PENDING" ? (
          <>
            Your answer: <strong>{RSVP_LABEL[state.current]}</strong>.
          </>
        ) : (
          "Are you coming?"
        )}
      </p>

      {state.open ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <button
              key={c.status}
              onClick={() => answer(c.status)}
              disabled={saving !== null}
              className={`${c.status === (picked ?? "GOING") ? "btn-primary" : "btn-secondary"} ${
                state.current === c.status ? "ring-2 ring-accent" : ""
              }`}
            >
              {saving === c.status ? "Saving..." : c.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-slate-400 text-sm">{state.closedReason}</p>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Link href={`/events/${event.id}`} className="text-sm text-accent2 hover:underline block">
        Open the event in the team hub
      </Link>
    </div>
  );
}
