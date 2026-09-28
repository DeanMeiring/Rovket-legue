"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [tag, setTag] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/claim/${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This link isn't valid.");
        setTag(data.tag);
        setForm((f) => ({ ...f, displayName: data.name ?? "" }));
      })
      .catch((e) => setInvalid(e.message));
  }, [token]);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("The passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/claim/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: form.displayName, email: form.email, password: form.password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (invalid) {
    return (
      <div className="max-w-sm mx-auto mt-12 card text-center">
        <h1 className="text-2xl font-bold mb-2">Link not valid</h1>
        <p className="text-slate-400">{invalid}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-12 card text-center">
        <h1 className="text-2xl font-bold mb-2">You're all set 🎉</h1>
        <p className="text-slate-400">
          An admin will approve your account, then you can log in as <strong>{tag}</strong> with your
          password. Taking you to the sign-in page.
        </p>
      </div>
    );
  }

  if (!tag) return <p className="text-slate-500 text-center mt-12">Loading...</p>;

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">Set up your account</h1>
        <p className="text-slate-400 text-sm mb-6">
          You're already on the tryout list. Add your email and a password, then an admin will approve you.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input opacity-70" value={tag} readOnly disabled />
            <p className="text-xs text-slate-500 mt-1">This is your login name. It can't be changed here.</p>
          </div>
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              required
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={(e) => update("confirm", e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Setting up..." : "Create my account"}
          </button>
        </form>
      </div>
    </div>
  );
}
