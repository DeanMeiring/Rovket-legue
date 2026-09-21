"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RankPicker from "@/components/RankPicker";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    rlTrackerUrl: "",
    platform: "",
    rank1v1: "",
    rank2v2: "",
    rank3v3: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-12 card text-center">
        <h1 className="text-2xl font-bold mb-2">Request sent 🎉</h1>
        <p className="text-slate-400">
          An admin needs to approve your account before you can log in. You'll be
          redirected to the sign-in page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">Request to join</h1>
        <p className="text-slate-400 text-sm mb-6">
          Fill this out for tryouts. An admin will review and approve your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="in-game tag"
                required
              />
            </div>
            <div>
              <label className="label">Platform</label>
              <input
                className="input"
                value={form.platform}
                onChange={(e) => update("platform", e.target.value)}
                placeholder="Steam / Epic / PS / Xbox"
              />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Rocket League Tracker URL</label>
            <input
              className="input"
              value={form.rlTrackerUrl}
              onChange={(e) => update("rlTrackerUrl", e.target.value)}
              placeholder="https://rocketleague.tracker.network/rocket-league/profile/..."
            />
          </div>
          <div>
            <label className="label">Current ranks</label>
            <RankPicker
              value={{ rank1v1: form.rank1v1, rank2v2: form.rank2v2, rank3v3: form.rank3v3 }}
              onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Helps admins balance tryout teams. Doesn&apos;t need to be exact — you&apos;ll
              get a chance to refine it once you&apos;re approved.
            </p>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Submitting..." : "Request account"}
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
