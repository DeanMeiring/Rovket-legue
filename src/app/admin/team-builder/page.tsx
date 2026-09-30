import Link from "next/link";
import TeamBoard from "@/components/TeamBoard";
import TeamChat from "@/components/TeamChat";
import { combos, loadScouting, personLabel, personStats, playstyle } from "@/lib/scouting";
import { loadDraft, tryoutPool } from "@/lib/teamBuilder";

export const dynamic = "force-dynamic";

// Admins build Team 1-4 and the subs from tryout data, and can ask Claude.
export default async function TeamBuilderPage() {
  const s = await loadScouting("tryout");
  const slots = await loadDraft(s);
  const people = tryoutPool(s).map((key) => {
    const p = s.people.get(key)!;
    const st = personStats(s, key);
    return {
      key,
      label: personLabel(p),
      rank3v3: p.rank3v3,
      rank2v2: p.rank2v2,
      style: playstyle(st.avg),
      games: st.record.games,
      wins: st.record.wins,
    };
  });
  const strip = (size: 2 | 3) => combos(s, size).map((c) => ({ keys: c.keys, games: c.games, wins: c.wins }));

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/admin" className="text-sm text-accent2 hover:underline">
        ← Back to admin
      </Link>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Team builder</h1>
        <Link href="/admin/chemistry" className="btn-secondary">
          🧩 Tryout chemistry
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Uses tryout data only: games from tryout events and the Tryout games page. Practice games are left out. Every admin
        sees and edits the same line-up, and changes save straight away.
      </p>
      <TeamBoard initialSlots={slots} people={people} pairs={strip(2)} trios={strip(3)} />
      <TeamChat />
    </div>
  );
}
