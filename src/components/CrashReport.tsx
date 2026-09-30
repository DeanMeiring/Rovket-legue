"use client";

import { useEffect } from "react";

// Shown when a page crashes in the browser. It reports the error to the server
// logs and gives the reader a way back.
export default function CrashReport({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname + window.location.search,
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="max-w-lg mx-auto mt-12 card space-y-3">
      <h1 className="text-xl font-bold">This page hit an error</h1>
      <p className="text-sm text-slate-400">
        It has been logged so it can be fixed. Try again, or go back to the dashboard.
      </p>
      <p className="text-xs text-slate-500 break-words font-mono">{error.message}</p>
      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/dashboard" className="btn-secondary">
          Dashboard
        </a>
      </div>
    </div>
  );
}
