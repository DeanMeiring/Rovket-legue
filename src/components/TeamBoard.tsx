"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SLOTS = ["team1", "team2", "team3", "team4", "subs"] as const;
type Slot = (typeof SLOTS)[number];
type Slots = { [K in Slot]: string[] };
const LABEL: { [K in Slot | "pool"]: string } = {
  team1: "Team 1",
  team2: "Team 2",
  team3: "Team 3",
  team4: "Team 4",
  subs: "Subs",
  pool: "Not placed",
};

type Person = {
  key: string;
  label: string;
  rank3v3: number | null;
  rank2v2: number | null;
  style: string;
  games: number;
  wins: number;
};
type Combo = { keys: string[]; games: number; wins: number };

// Click a player to pick them up, then click another player to swap or a
// column to move them there. Dragging works too on a computer.
export default function TeamBoard({
  initialSlots,
  people,
  pairs,
  trios,
}: {
  initialSlots: Slots;
  people: Person[];
  pairs: Combo[];
  trios: Combo[];
}) {
  const [slots, setSlots] = useState<Slots>(initialSlots);
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const byKey = useMemo(() => new Map(people.map((p) => [p.key, p])), [people]);
  const pairMap = useMemo(() => new Map(pairs.map((c) => [c.keys.join("|"), c])), [pairs]);
  const trioMap = useMemo(() => new Map(trios.map((c) => [c.keys.join("|"), c])), [trios]);
  const first = useRef(true);

  const placed = new Set(SLOTS.flatMap((s) => slots[s]));
  const pool = people.map((p) => p.key).filter((k) => !placed.has(k));

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      const res = await fetch("/api/admin/team-builder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      }).catch(() => null);
      setStatus(res?.ok ? "saved" : "error");
    }, 400);
    return () => clearTimeout(t);
  }, [slots]);

  function where(key: string): Slot | "pool" {
    return SLOTS.find((s) => slots[s].includes(key)) ?? "pool";
  }

  function move(key: string, to: Slot | "pool") {
    const next = Object.fromEntries(SLOTS.map((s) => [s, slots[s].filter((k) => k !== key)])) as Slots;
    if (to !== "pool") next[to].push(key);
    setSlots(next);
    setPicked(null);
  }

  function swap(a: string, b: string) {
    const sa = where(a);
    const sb = where(b);
    if (sa === sb) return setPicked(null);
    const next = Object.fromEntries(SLOTS.map((s) => [s, [...slots[s]]])) as Slots;
    if (sa !== "pool") next[sa] = next[sa].map((k) => (k === a ? b : k));
    if (sb !== "pool") next[sb] = next[sb].map((k) => (k === b ? a : k));
    if (sa === "pool") next[sb as Slot] = next[sb as Slot].filter((k) => k !== b).concat(a);
    if (sb === "pool") next[sa as Slot] = next[sa as Slot].filter((k) => k !== a).concat(b);
    setSlots(next);
    setPicked(null);
  }

  function clickPlayer(key: string) {
    if (!picked) setPicked(key);
    else if (picked === key) setPicked(null);
    else swap(picked, key);
  }

  async function reset() {
    if (!confirm("Start again from the tryout board's current teams? This replaces the line-up for every admin.")) return;
    const res = await fetch("/api/admin/team-builder", { method: "DELETE" });
    if (res.ok) {
      first.current = true;
      setSlots((await res.json()).slots);
    }
  }

  function summary(keys: string[]) {
    const ranks = keys.map((k) => byKey.get(k)!.rank3v3).filter((r): r is number => r != null);
    const avg = ranks.length ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length) : null;
    const styles = keys.map((k) => byKey.get(k)!.style).filter((st) => st !== "Not enough games");
    const sorted = [...keys].sort();
    const trio = keys.length === 3 ? trioMap.get(sorted.join("|")) : undefined;
    const pairList: Combo[] = [];
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const c = pairMap.get(`${sorted[i]}|${sorted[j]}`);
        if (c) pairList.push(c);
      }
    const pairGames = pairList.reduce((t, c) => t + c.games, 0);
    const pairWins = pairList.reduce((t, c) => t + c.wins, 0);
    return { avg, styles, trio, pairList, pairGames, pairWins };
  }

  function column(slot: Slot | "pool", keys: string[]) {
    const isTeam = slot !== "pool" && slot !== "subs";
    const sum = summary(keys);
    const pushers = sum.styles.filter((st) => st === "Pushes up").length;
    return (
      <div
        key={slot}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const key = e.dataTransfer.getData("text/plain");
          if (key) move(key, slot);
        }}
        className={`rounded-xl border p-3 flex flex-col gap-2 ${
          picked && where(picked) !== slot ? "border-accent2/60 bg-accent2/5" : "border-border bg-panel"
        }`}
      >
        <div>
          <h2 className="font-bold whitespace-nowrap">{LABEL[slot]}</h2>
          <span className={`block text-xs ${isTeam && keys.length !== 3 ? "text-yellow-300" : "text-slate-500"}`}>
            {keys.length} player{keys.length === 1 ? "" : "s"}
            {isTeam && keys.length !== 3 && " (3v3 needs 3)"}
          </span>
        </div>
        {picked && where(picked) !== slot && (
          <button onClick={() => move(picked, slot)} className="text-xs text-accent2 hover:underline text-left">
            Move {byKey.get(picked)!.label} here
          </button>
        )}
        <ul className="space-y-1.5">
          {keys.map((k) => {
            const p = byKey.get(k)!;
            return (
              <li key={k}>
                <button
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", k)}
                  onClick={() => clickPlayer(k)}
                  className={`w-full text-left rounded-lg border px-2 py-1.5 text-sm ${
                    picked === k ? "border-accent bg-accent/15" : "border-border hover:border-accent2"
                  }`}
                >
                  <span className="font-medium block truncate">{p.label}</span>
                  <span className="text-[11px] text-slate-400">
                    3v3 {p.rank3v3 ?? "?"} · {p.games ? `${p.wins}-${p.games - p.wins}` : "no games"} · {p.style}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {isTeam && keys.length > 0 && (
          <div className="text-[11px] text-slate-400 border-t border-border pt-2 space-y-0.5">
            <p>Avg 3v3: {sum.avg ?? "?"} MMR</p>
            <p className={pushers >= 2 ? "text-yellow-300" : ""}>
              Styles: {sum.styles.length ? sum.styles.join(", ") : "not enough games"}
              {pushers >= 2 && " (two push up)"}
            </p>
            <p>
              Together at tryouts:{" "}
              {sum.trio
                ? `this trio ${sum.trio.wins}-${sum.trio.games - sum.trio.wins}${sum.trio.games < 3 ? " (too few)" : ""}`
                : sum.pairList.length
                  ? `${sum.pairList.length} pair${sum.pairList.length === 1 ? "" : "s"}, ${sum.pairWins}-${sum.pairGames - sum.pairWins}${sum.pairGames < 3 ? " (too few)" : ""}`
                  : "never on a team together"}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <p className="text-slate-400">
          {picked
            ? `Picked ${byKey.get(picked)!.label}. Click another player to swap, or a column to move them.`
            : "Click a player to pick them up, then click another player to swap or a column to move them."}
        </p>
        <span className="flex items-center gap-3">
          <span className={status === "error" ? "text-red-400" : "text-slate-500"}>
            {status === "saving" ? "Saving..." : status === "error" ? "Couldn't save" : "Saved"}
          </span>
          <button onClick={reset} className="btn-secondary !py-1 !px-3 text-sm">
            Reset from tryout board
          </button>
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {SLOTS.map((s) => column(s, slots[s]))}
        {column("pool", pool)}
      </div>
    </div>
  );
}
