"use client";

import { useEffect, useState } from "react";

type Review = { id: string; text: string; published: boolean; createdAt: string };

// Admin view of a player's AI review: write one, edit it, and publish it to
// the player's dashboard.
export default function ReviewModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<{ text: string; createdAt: string } | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  function show(r: Review | null) {
    setReview(r);
    setText(r?.text ?? "");
  }

  useEffect(() => {
    fetch(`/api/admin/reviews?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        show(d.review ?? null);
        setLoaded(true);
      });
    fetch("/api/admin/coaching-brief")
      .then((r) => r.json())
      .then((d) => setBrief(d.brief ?? null));
  }, [userId]);

  async function call(label: string, url: string, method: string, body: object) {
    setBusy(label);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return null;
    }
    return data;
  }

  async function write() {
    const data = await call("write", "/api/admin/reviews", "POST", { userId });
    if (data) show(data.review);
    if (!brief) fetch("/api/admin/coaching-brief").then((r) => r.json()).then((d) => setBrief(d.brief ?? null));
  }

  async function save(published?: boolean) {
    if (!review) return;
    const data = await call(published === undefined ? "save" : "publish", `/api/admin/reviews/${review.id}`, "PATCH", {
      text,
      ...(published === undefined ? {} : { published }),
    });
    if (data) show(data.review);
  }

  async function refreshResearch() {
    const data = await call("research", "/api/admin/coaching-brief", "POST", {});
    if (data) setBrief(data.brief);
  }

  const edited = review && text !== review.text;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label={`Review for ${name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-bold text-lg">Review: {name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            Close
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Written by Claude from all of this player&apos;s stats, judged against research on pro players and coaching.
          The player only sees it once you publish it.
        </p>

        {!loaded && <p className="text-sm text-slate-500">Loading...</p>}
        {loaded && review && (
          <>
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className={`badge ${review.published ? "bg-green-500/20 text-green-300" : "bg-slate-700/40 text-slate-300"}`}>
                {review.published ? "Published" : "Draft"}
              </span>
              <span className="text-slate-500">Written {new Date(review.createdAt).toLocaleString()}</span>
            </div>
            <textarea className="input min-h-[320px] text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          </>
        )}
        {loaded && !review && <p className="text-sm text-slate-400 mb-2">No review yet.</p>}

        <div className="flex gap-2 flex-wrap mt-3">
          <button onClick={write} disabled={busy !== null} className={review ? "btn-secondary text-sm" : "btn-primary text-sm"}>
            {busy === "write" ? "Writing, this can take a minute or two..." : review ? "Write a new one" : "Write review"}
          </button>
          {review && edited && (
            <button onClick={() => save()} disabled={busy !== null} className="btn-secondary text-sm">
              {busy === "save" ? "Saving..." : "Save edits"}
            </button>
          )}
          {review && (
            <button
              onClick={() => save(!review.published)}
              disabled={busy !== null}
              className={review.published ? "btn-secondary text-sm" : "btn-primary text-sm"}
            >
              {busy === "publish" ? "Saving..." : review.published ? "Hide from player" : "Publish to player"}
            </button>
          )}
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        <div className="border-t border-border mt-5 pt-3 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-slate-400">
              {brief
                ? `Coaching research from ${new Date(brief.createdAt).toLocaleDateString()}`
                : "The first review also researches pro players and coaching, and saves it for the rest."}
            </span>
            <span className="flex gap-3">
              {brief && (
                <button onClick={() => setShowBrief((s) => !s)} className="text-accent2 hover:underline">
                  {showBrief ? "Hide research" : "See research"}
                </button>
              )}
              <button onClick={refreshResearch} disabled={busy !== null} className="text-accent2 hover:underline">
                {busy === "research" ? "Researching..." : brief ? "Refresh research" : "Run research"}
              </button>
            </span>
          </div>
          {showBrief && brief && <p className="whitespace-pre-wrap text-slate-300 mt-3">{brief.text}</p>}
        </div>
      </div>
    </div>
  );
}
