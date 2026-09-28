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
  }

  async function save(published?: boolean) {
    if (!review) return;
    const data = await call(published === undefined ? "save" : "publish", `/api/admin/reviews/${review.id}`, "PATCH", {
      text,
      ...(published === undefined ? {} : { published }),
    });
    if (data) show(data.review);
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
          Written by Claude from all of this player&apos;s stats, judged against the club's coaching reference.
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
            {busy === "write" ? "Writing..." : review ? "Write a new one" : "Write review"}
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

        <p className="border-t border-border mt-5 pt-3 text-sm text-slate-400">
          Benchmarks come from the{" "}
          <a href="/admin/coaching-reference" target="_blank" className="text-accent2 hover:underline">
            coaching reference
          </a>
          .
        </p>
      </div>
    </div>
  );
}
