"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_TYPE_LABEL } from "@/lib/format";

export type EventFormValues = {
  title: string;
  type: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
};

export default function EventForm({
  mode,
  eventId,
  initialValues,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: EventFormValues;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EventFormValues>(
    initialValues || {
      title: "",
      type: "SCRIM",
      description: "",
      location: "",
      startTime: "",
      endTime: "",
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof EventFormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.endTime && new Date(form.endTime) < new Date(form.startTime)) {
      setError("The end has to be after the start.");
      return;
    }
    setLoading(true);

    const url = mode === "edit" ? `/api/events/${eventId}` : "/api/events";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : "",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Could not ${mode === "edit" ? "update" : "create"} the event.`);
      return;
    }

    router.push(mode === "edit" ? `/events/${eventId}` : "/events");
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">
          {mode === "edit" ? "Edit event" : "Schedule a new event"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Scrim vs Aces Esports"
              required
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
            >
              {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Starts</label>
            <input
              className="input"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Ends (optional)</label>
            <input
              className="input"
              type="datetime-local"
              value={form.endTime}
              min={form.startTime || undefined}
              onChange={(e) => update("endTime", e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              For multi-day events like tournaments, set the last day here.
            </p>
          </div>
          <div>
            <label className="label">Location / lobby info</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Venue address, private match code, Discord channel, etc."
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px]"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Anything players should know beforehand."
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : mode === "edit"
                  ? "Save changes"
                  : "Create event"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
          {mode === "create" && (
            <p className="text-xs text-slate-500">
              All approved players will get an email notification when this is created.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
