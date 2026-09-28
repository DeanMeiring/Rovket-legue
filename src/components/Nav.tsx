"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/availability", label: "Availability" },
  { href: "/players", label: "Roster" },
  { href: "/performance", label: "My Performance" },
];

export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";

  return (
    <header className="border-b border-border bg-panel/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
        <Link href="/dashboard" className="font-bold text-lg text-accent tracking-tight">
          🚀 RL Team Hub
        </Link>
        <nav className="flex flex-wrap gap-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname?.startsWith(l.href)
                  ? "bg-accent text-black"
                  : "text-slate-300 hover:bg-panel2"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname?.startsWith("/admin")
                  ? "bg-accent text-black"
                  : "text-accent2 hover:bg-panel2"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">
            {session.user.name} {isAdmin && <span className="badge bg-accent2/20 text-accent2 ml-1">Admin</span>}
          </span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary !py-1 !px-3 text-sm">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
