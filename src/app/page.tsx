import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 px-4">
      <div className="text-6xl">🚀</div>
      <h1 className="text-4xl font-extrabold tracking-tight">
        Rocket League Team Hub
      </h1>
      <p className="max-w-xl text-slate-400 text-lg">
        Tryout signups, team rosters, scrim &amp; match scheduling, and performance
        tracking — all in one place.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="btn-primary">
          Sign in
        </Link>
        <Link href="/signup" className="btn-secondary">
          Request to join
        </Link>
      </div>
    </div>
  );
}
