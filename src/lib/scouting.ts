// Everything the admin scouting pages need, gathered from both club games
// (imported ballchasing replays) and tryout games: who played, who was on
// whose team, results and stats. Players are keyed by their account id, or
// "tp:<tryout player id>" for tryout players without an account yet.

import { prisma } from "@/lib/prisma";
import { averageStats, type Averages } from "@/lib/replayStats";

export type Person = {
  key: string;
  userId: string | null;
  name: string;
  tag: string | null;
  rank2v2: number | null;
  rank3v3: number | null;
  team: string | null;
  tryoutTeam: number | null;
  avatarUpdatedAt: Date | null;
};

export type Appearance = {
  key: string;
  gameId: string;
  source: "club" | "tryout";
  label: string;
  date: Date;
  won: boolean;
  teamKeys: string[];
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  score: number;
  mvp: boolean;
  stats: unknown;
};

export type Confidence = "too few" | "early" | "solid";

// Shared-game counts behind each label. Below 3 a result is mostly luck.
export function confidence(games: number): Confidence {
  return games >= 6 ? "solid" : games >= 3 ? "early" : "too few";
}

export async function loadScouting() {
  const [users, tryoutPlayers, performances, tryoutStats] = await Promise.all([
    prisma.user.findMany({
      where: { status: "APPROVED", isPlayer: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        rank2v2: true,
        rank3v3: true,
        avatarUpdatedAt: true,
        team: { select: { name: true } },
        tryoutEntry: { select: { id: true, tag: true, currentTeam: true, rank2v2: true, rank3v3: true } },
      },
    }),
    prisma.tryoutPlayer.findMany({ where: { userId: null } }),
    prisma.performance.findMany({
      where: { replayId: { not: null }, win: { not: null } },
      include: { event: { select: { title: true, startTime: true } } },
    }),
    prisma.tryoutGameStat.findMany({ include: { game: { select: { number: true, updatedAt: true } } } }),
  ]);

  const people = new Map<string, Person>();
  const tryoutKey = new Map<string, string>();
  for (const u of users) {
    people.set(u.id, {
      key: u.id,
      userId: u.id,
      name: u.displayName || u.username,
      tag: u.tryoutEntry?.tag ?? u.username,
      rank2v2: u.rank2v2 ?? u.tryoutEntry?.rank2v2 ?? null,
      rank3v3: u.rank3v3 ?? u.tryoutEntry?.rank3v3 ?? null,
      team: u.team?.name ?? null,
      tryoutTeam: u.tryoutEntry?.currentTeam ?? null,
      avatarUpdatedAt: u.avatarUpdatedAt,
    });
    if (u.tryoutEntry) tryoutKey.set(u.tryoutEntry.id, u.id);
  }
  for (const t of tryoutPlayers) {
    const key = `tp:${t.id}`;
    people.set(key, {
      key,
      userId: null,
      name: t.name || t.tag,
      tag: t.tag,
      rank2v2: t.rank2v2,
      rank3v3: t.rank3v3,
      team: null,
      tryoutTeam: t.currentTeam,
      avatarUpdatedAt: null,
    });
    tryoutKey.set(t.id, key);
  }

  // Group rows into teams: same game and same side.
  const teams = new Map<string, Appearance[]>();
  const add = (teamId: string, a: Appearance) => {
    if (!people.has(a.key)) return;
    const list = teams.get(teamId) ?? [];
    list.push(a);
    teams.set(teamId, list);
  };
  for (const p of performances) {
    const date = p.event?.startTime ?? p.createdAt;
    add(`club:${p.replayId}:${p.win}`, {
      key: p.userId,
      gameId: `club:${p.replayId}`,
      source: "club",
      label: p.event?.title ?? "Club game",
      date,
      won: !!p.win,
      teamKeys: [],
      goals: p.goals,
      assists: p.assists,
      saves: p.saves,
      shots: p.shots,
      score: p.score,
      mvp: p.mvp,
      stats: p.stats,
    });
  }
  for (const s of tryoutStats) {
    const key = tryoutKey.get(s.playerId);
    if (!key) continue;
    add(`tryout:${s.gameId}:${s.side}`, {
      key,
      gameId: `tryout:${s.gameId}`,
      source: "tryout",
      label: "Tryouts",
      date: s.game.updatedAt,
      won: s.win,
      teamKeys: [],
      goals: s.goals,
      assists: s.assists,
      saves: s.saves,
      shots: s.shots,
      score: s.score,
      mvp: s.mvp,
      stats: s.raw,
    });
  }

  const appearances: Appearance[] = [];
  const teamList: { keys: string[]; won: boolean; gameId: string }[] = [];
  for (const members of teams.values()) {
    const keys = [...new Set(members.map((m) => m.key))].sort();
    for (const m of members) appearances.push({ ...m, teamKeys: keys.filter((k) => k !== m.key) });
    teamList.push({ keys, won: members[0].won, gameId: members[0].gameId });
  }
  return { people, appearances, teams: teamList };
}

export type Scouting = Awaited<ReturnType<typeof loadScouting>>;

export type WinLoss = { games: number; wins: number };

export function recordFor(appearances: Appearance[]): WinLoss {
  return { games: appearances.length, wins: appearances.filter((a) => a.won).length };
}

export type Style = "Stays back" | "All-rounder" | "Pushes up" | "Not enough games";

// A rough playstyle read from ballchasing positioning: how much more of the
// game a player spends as the last player back than as the furthest forward.
export function playstyle(avg: Averages): Style {
  const back = avg.values.mostBack;
  const forward = avg.values.mostForward;
  if (avg.games < 3 || back == null) return "Not enough games";
  // In 3v3 each player is last back a third of the time on average.
  const lean = forward == null ? (back - 100 / 3) * 2 : back - forward;
  return lean > 8 ? "Stays back" : lean < -8 ? "Pushes up" : "All-rounder";
}

export type Combo = {
  keys: string[];
  games: number;
  wins: number;
  confidence: Confidence;
  // Win rate together minus the average of each player's overall win rate.
  lift: number | null;
};

export function combos(s: Scouting, size: 2 | 3): Combo[] {
  const overall = new Map<string, WinLoss>();
  for (const a of s.appearances) {
    const r = overall.get(a.key) ?? { games: 0, wins: 0 };
    r.games++;
    if (a.won) r.wins++;
    overall.set(a.key, r);
  }
  const counts = new Map<string, { games: number; wins: number }>();
  for (const t of s.teams) {
    for (const group of subsets(t.keys, size)) {
      const id = group.join("|");
      const c = counts.get(id) ?? { games: 0, wins: 0 };
      c.games++;
      if (t.won) c.wins++;
      counts.set(id, c);
    }
  }
  return [...counts.entries()]
    .map(([id, c]) => {
      const keys = id.split("|");
      const base = keys.map((k) => overall.get(k)!).map((r) => r.wins / r.games);
      const expected = base.reduce((a, b) => a + b, 0) / base.length;
      return {
        keys,
        games: c.games,
        wins: c.wins,
        confidence: confidence(c.games),
        lift: c.games ? c.wins / c.games - expected : null,
      };
    })
    .sort((a, b) => b.games - a.games || b.wins / b.games - a.wins / a.games);
}

function subsets(keys: string[], size: number): string[][] {
  if (size === 2) {
    const out: string[][] = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) out.push([keys[i], keys[j]]);
    return out;
  }
  return keys.length === 3 ? [keys] : [];
}

export function personStats(s: Scouting, key: string) {
  const mine = s.appearances.filter((a) => a.key === key);
  return { appearances: mine, record: recordFor(mine), avg: averageStats(mine.map((a) => a.stats)) };
}

export function clubAverage(s: Scouting): Averages {
  return averageStats(s.appearances.map((a) => a.stats));
}

export function personLabel(p: Person): string {
  return p.tag && p.tag.toLowerCase() !== p.name.toLowerCase() ? `${p.name} (${p.tag})` : p.name;
}

export const CONFIDENCE_STYLE: { [K in Confidence]: string } = {
  "too few": "bg-slate-700/40 text-slate-400",
  early: "bg-yellow-500/15 text-yellow-300",
  solid: "bg-green-500/15 text-green-300",
};
