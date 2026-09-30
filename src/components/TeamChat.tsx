"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: string; role: string; text: string; createdAt: string };

// Admins ask Claude about the line-up. Claude sees the current teams and tryout
// data each time, and suggests changes without making them.
export default function TeamChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/team-builder/chat")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  }, []);

  // Braces matter: newer browsers return a promise from scrollIntoView, and
  // React would try to call a returned value as the effect's cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/team-builder/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong.");
    setMessages((m) => [...m, ...data.messages]);
    setText("");
  }

  async function clear() {
    if (!confirm("Clear the whole conversation for every admin?")) return;
    await fetch("/api/admin/team-builder/chat", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="font-bold text-lg">Ask Claude</h2>
        {messages.length > 0 && (
          <button onClick={clear} className="text-xs text-slate-400 hover:text-red-400">
            Clear chat
          </button>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-3">
        Claude sees the line-up above as saved, every player&apos;s tryout stats and results together, and the coaching
        reference. It suggests swaps; you make them. Shared by all admins.
      </p>
      <div className="max-h-[480px] overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-slate-500">
            Try: &quot;Which team looks weakest and why?&quot; or &quot;Who fits Team 3 better, A or B?&quot;
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "assistant" ? "bg-panel2 text-slate-200" : "bg-accent2/10 text-slate-100 ml-8"
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && <p className="text-sm text-slate-500">Claude is thinking...</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2">
        <textarea
          className="input min-h-[44px] flex-1 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
          placeholder="Ask about the teams..."
          disabled={busy}
        />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary text-sm">
          Send
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
