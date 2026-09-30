"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCaptainTeam } from "@/components/useCaptainTeam";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/availability", label: "Availability" },
  { href: "/players", label: "Roster" },
  { href: "/performance", label: "My Performance" },
];

// Top bar on desktop; on phones the links move into a slide-out menu.
export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The Captain's dashboard link only shows for a team's captain.
  const captainTeam = useCaptainTeam();

  // Close the menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  // Stop the page behind the open menu from scrolling.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const allLinks = [
    ...links,
    ...(captainTeam ? [{ href: "/captain", label: "Captain" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const linkClass = (href: string, extra = "") =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${extra} ${
      pathname?.startsWith(href)
        ? "bg-accent text-black"
        : href === "/admin"
          ? "text-accent2 hover:bg-panel2"
          : "text-slate-300 hover:bg-panel2"
    }`;

  // The menu sits outside <header>: its backdrop-blur would otherwise trap the fixed overlay inside the bar.
  return (
    <>
      <header className="border-b border-border bg-panel/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="font-bold text-lg text-accent tracking-tight whitespace-nowrap">
            🚀 RL Team Hub
          </Link>

          <nav className="hidden lg:flex flex-wrap gap-1 flex-1">
            {allLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3 text-sm">
            <span className="text-slate-400">
              {session.user.name} {isAdmin && <span className="badge bg-accent2/20 text-accent2 ml-1">Admin</span>}
            </span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary !py-1 !px-3 text-sm">
              Sign out
            </button>
          </div>

          <button
            className="lg:hidden ml-auto p-2 -mr-2 rounded-lg text-slate-200 hover:bg-panel2"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-panel border-l border-border p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400 truncate">
                {session.user.name} {isAdmin && <span className="badge bg-accent2/20 text-accent2 ml-1">Admin</span>}
              </span>
              <button
                className="p-2 -mr-2 rounded-lg text-slate-200 hover:bg-panel2"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {allLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href, "!py-3 !text-base")}>
                {l.label}
              </Link>
            ))}
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary mt-auto">
              Sign out
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
