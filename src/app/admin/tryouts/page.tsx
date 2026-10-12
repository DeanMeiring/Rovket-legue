import Link from "next/link";

// The tools used to run tryouts and pick the teams. Kept for next season's
// tryouts; nothing here is needed week to week.
const TOOLS = [
  { href: "/admin/tryout-board", icon: "📋", label: "Tryout board", text: "Roster, invite links, tracker links and the tryout games." },
  { href: "/admin/tryout-games", icon: "🎮", label: "Tryout games", text: "Balanced games, results from tryout events and the AI evaluation." },
  { href: "/admin/balance-teams", icon: "⚖️", label: "Balance tryout teams", text: "Split the players at a tryout into even teams by rank." },
  { href: "/admin/team-builder", icon: "🏗️", label: "Team builder", text: "Lay out Teams 1 to 4 and the subs, with Claude suggesting swaps." },
];

export default function TryoutsArchivePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin" className="text-sm text-accent2 hover:underline">
        ← Admin panel
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Tryouts archive</h1>
        <p className="text-slate-400 mt-1">
          The tools used to run tryouts and pick the teams. Everything is kept as it was, ready for the next round of
          tryouts.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="card hover:border-accent transition-colors">
            <p className="font-bold">
              {t.icon} {t.label}
            </p>
            <p className="text-sm text-slate-400 mt-1">{t.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
