"use client";

import CrashReport from "@/components/CrashReport";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CrashReport error={error} reset={reset} />;
}
