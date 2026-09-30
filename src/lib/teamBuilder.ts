// The Team builder: the admins' shared line-up drawn from tryout data only.

import { prisma } from "@/lib/prisma";
import { METRICS, formatMetric } from "@/lib/replayStats";
import {
  clubAverage,
  combos,
  loadScouting,
  personLabel,
  personStats,
  playstyle,
  type Scouting,
} from "@/lib/scouting";

export const SLOTS = ["team1", "team2", "team3", "team4", "subs"] as const;
export type Slot = (typeof SLOTS)[number];
export type Slots = { [K in Slot]: string[] };
export const SLOT_LABEL: { [K in Slot]: string } = {
  team1: "Team 1",
  team2: "Team 2",
  team3: "Team 3",
  team4: "Team 4",
  subs: "Subs",
};

const DRAFT_ID = "main";

// Everyone who is on the tryout board or played in tryouts.
export function tryoutPool(s: Scouting): string[] {
  const played = new Set(s.appearances.map((a) => a.key));
  return [...s.people.values()].filter((p) => p.tryoutTeam != null || played.has(p.key)).map((p) => p.key);
}

// Starts from the tryout board's current teams.
export function defaultSlots(s: Scouting): Slots {
  const slots: Slots = { team1: [], team2: [], team3: [], team4: [], subs: [] };
  for (const key of tryoutPool(s)) {
    const team = s.people.get(key)!.tryoutTeam;
    if (team && team >= 1 && team <= 4) slots[`team${team}` as Slot].push(key);
  }
  return slots;
}

// Keeps only known players, each in one slot at most.
export function cleanSlots(raw: unknown, allowed: Set<string>): Slots {
  const slots: Slots = { team1: [], team2: [], team3: [], team4: [], subs: [] };
  const seen = new Set<string>();
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const slot of SLOTS) {
    const list = Array.isArray(obj[slot]) ? (obj[slot] as unknown[]) : [];
    for (const key of list) {
      if (typeof key !== "string" || !allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      slots[slot].push(key);
    }
  }
  return slots;
}

export async function loadDraft(s: Scouting): Promise<Slots> {
  const row = await prisma.teamDraft.findUnique({ where: { id: DRAFT_ID } });
  return row ? cleanSlots(row.slots, new Set(tryoutPool(s))) : defaultSlots(s);
}

export async function saveDraft(slots: Slots) {
  await prisma.teamDraft.upsert({
    where: { id: DRAFT_ID },
    create: { id: DRAFT_ID, slots },
    update: { slots },
  });
}

const CONTEXT_METRICS = ["bpm", "avgBoost", "zeroBoost", "speed", "behindBall", "mostBack", "mostForward", "toMates", "demos"];

// Everything Claude sees on the Team builder: tryout data only.
export async function teamBuilderContext(): Promise<string> {
  const s = await loadScouting("tryout");
  const slots = await loadDraft(s);
  const avg = clubAverage(s);
  const placed = new Set(SLOTS.flatMap((slot) => slots[slot]));
  const unplaced = tryoutPool(s).filter((k) => !placed.has(k));

  const describe = (key: string) => {
    const p = s.people.get(key)!;
    const st = personStats(s, key);
    const n = st.record.games;
    const per = (f: (a: (typeof st.appearances)[number]) => number) =>
      n ? (st.appearances.reduce((t, a) => t + f(a), 0) / n).toFixed(2) : "-";
    const metrics = CONTEXT_METRICS.map((k) => {
      const m = METRICS.find((x) => x.key === k)!;
      return `${m.label} ${formatMetric(m, st.avg.values[k])} (tryout avg ${formatMetric(m, avg.values[k])})`;
    }).join("; ");
    return [
      `- ${personLabel(p)}: 3v3 ${p.rank3v3 ?? "?"} MMR, 2v2 ${p.rank2v2 ?? "?"} MMR`,
      `  tryout games ${n}, W-L ${st.record.wins}-${n - st.record.wins}, playstyle ${playstyle(st.avg)}`,
      n ? `  per game: goals ${per((a) => a.goals)}, assists ${per((a) => a.assists)}, saves ${per((a) => a.saves)}, shots ${per((a) => a.shots)}, score ${per((a) => a.score)}` : "",
      st.avg.games ? `  replay stats over ${st.avg.games} games: ${metrics}` : "  no replay stats",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const lines: string[] = [];
  for (const slot of SLOTS) {
    lines.push(`${SLOT_LABEL[slot]} (${slots[slot].length} players):`);
    lines.push(slots[slot].length ? slots[slot].map(describe).join("\n") : "- (empty)");
  }
  lines.push(`Not placed yet (${unplaced.length}):`);
  lines.push(unplaced.length ? unplaced.map(describe).join("\n") : "- (none)");

  const combo = (size: 2 | 3) =>
    combos(s, size)
      .map(
        (c) =>
          `- ${c.keys.map((k) => personLabel(s.people.get(k)!)).join(" + ")}: ${c.games} games, ${c.wins} wins, ${
            c.lift == null ? "" : `win rate ${c.lift >= 0 ? "+" : ""}${Math.round(c.lift * 100)} points vs their own average, `
          }${c.confidence}`,
      )
      .join("\n") || "- none yet";

  return `Tryout games in the data: ${new Set(s.appearances.map((a) => a.gameId)).size}.

CURRENT LINE-UP
${lines.join("\n")}

TRIOS THAT SHARED A TEAM AT TRYOUTS
${combo(3)}

PAIRS THAT SHARED A TEAM AT TRYOUTS
${combo(2)}`;
}
