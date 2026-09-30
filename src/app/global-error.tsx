"use client";

import CrashReport from "@/components/CrashReport";
import "./globals.css";

// Catches crashes in the root layout itself (the top menu).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <CrashReport error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
