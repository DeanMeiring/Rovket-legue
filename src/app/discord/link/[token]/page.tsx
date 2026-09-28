"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

// Opened from the bot's /link reply in Discord.
export default function DiscordLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { data: session } = useSession();
  const [discordName, setDiscordName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/discord/link/${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This link isn't valid.");
        setDiscordName(data.username);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  async function confirm() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/discord/link/${token}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "Couldn't link your account.");
    setDone(true);
  }

  return (
    <div className="max-w-md mx-auto mt-12 card space-y-4 text-center">
      <div className="text-4xl">🔗</div>
      {done ? (
        <>
          <h1 className="text-xl font-bold">Discord linked</h1>
          <p className="text-slate-400 text-sm">
            {discordName} is now linked to your account. You can RSVP from Discord and you&apos;ll get your team role
            there.
          </p>
          <Link href="/dashboard" className="btn-primary inline-block">
            Back to dashboard
          </Link>
        </>
      ) : error && !discordName ? (
        <>
          <h1 className="text-xl font-bold">Can&apos;t use this link</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </>
      ) : discordName ? (
        <>
          <h1 className="text-xl font-bold">Link your Discord?</h1>
          <p className="text-slate-400 text-sm">
            Link Discord account <strong className="text-slate-200">{discordName}</strong> to{" "}
            <strong className="text-slate-200">{session?.user.username ?? "your account"}</strong>.
          </p>
          <button onClick={confirm} disabled={saving} className="btn-primary">
            {saving ? "Linking..." : "Link account"}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </>
      ) : (
        <p className="text-slate-500">Loading...</p>
      )}
    </div>
  );
}
