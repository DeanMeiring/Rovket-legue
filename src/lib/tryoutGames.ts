// Builds balanced games (3v3 by default, or 2v2) for tryouts and event rosters. Pure functions so
// the API route and any preview share the same logic.

export type RatedPlayer = {
  id: string;
  rank2v2: number | null;
  rank3v3: number | null;
};

export type GameSides = { blueIds: string[]; orangeIds: string[] };

export type GeneratedGame = GameSides & { number: number; round: number };

// Weighting of the two playlists: tryouts are 3v3, but 2v2 still says a lot
// about mechanics, and it catches players whose 3v3 rank lags behind.
export const WEIGHT_3V3 = 0.7;
export const WEIGHT_2V2 = 0.3;

// How much a repeated teammate pairing "costs", in MMR of side imbalance.
// Around a sub-rank, so the generator accepts a slightly less even game to
// avoid putting the same two players together again.
const REPEAT_PENALTY = 60;

export function ratingOf(p: RatedPlayer, fallback: number): number {
  if (p.rank3v3 != null && p.rank2v2 != null) return WEIGHT_3V3 * p.rank3v3 + WEIGHT_2V2 * p.rank2v2;
  return p.rank3v3 ?? p.rank2v2 ?? fallback;
}

export function ratingMap(players: RatedPlayer[]): Map<string, number> {
  const known = players
    .map((p) => ratingOf(p, NaN))
    .filter((r) => !Number.isNaN(r))
    .sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 1000;
  return new Map(players.map((p) => [p.id, ratingOf(p, fallback)]));
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every way to split 2×size players into two sides, with player 0 fixed on blue.
const SPLITS = new Map<number, [number[], number[]][]>();
function splitsFor(size: number) {
  let list = SPLITS.get(size);
  if (list) return list;
  list = [];
  const all = Array.from({ length: size * 2 }, (_, i) => i);
  const pick = (from: number, chosen: number[]) => {
    if (chosen.length === size) {
      list!.push([chosen, all.filter((x) => !chosen.includes(x))]);
      return;
    }
    for (let i = from; i < all.length; i++) pick(i + 1, [...chosen, i]);
  };
  pick(1, [0]);
  SPLITS.set(size, list);
  return list;
}

function bestSplit(
  group: string[],
  size: number,
  rating: Map<string, number>,
  pairs: Map<string, number>,
  repeatPenalty: number
) {
  let best: { cost: number; blue: string[]; orange: string[] } | null = null;
  for (const [b, o] of splitsFor(size)) {
    const blue = b.map((i) => group[i]);
    const orange = o.map((i) => group[i]);
    const sum = (ids: string[]) => ids.reduce((s, id) => s + (rating.get(id) ?? 0), 0);
    let cost = Math.abs(sum(blue) - sum(orange)) / size;
    for (const side of [blue, orange])
      for (let x = 0; x < size; x++)
        for (let y = x + 1; y < size; y++) cost += repeatPenalty * (pairs.get(pairKey(side[x], side[y])) ?? 0);
    if (!best || cost < best.cost) best = { cost, blue, orange };
  }
  return best!;
}

// Generates `count` games. Each round, the players with the fewest games so
// far play (so sit-outs rotate), and they are split into games whose sides
// are as even as possible while avoiding repeat teammates. `history` holds
// games already played, so a regenerate carries on from where things stand.
export function generateGames(
  players: RatedPlayer[],
  count: number,
  history: GameSides[] = [],
  start: { number: number; round: number } = { number: 1, round: 1 },
  seed = 20260928,
  teamSize = 3,
  repeatPenalty = REPEAT_PENALTY
): GeneratedGame[] {
  const perGame = teamSize * 2;
  if (players.length < perGame || count < 1) return [];
  const rnd = seeded(seed + players.length * 7919 + history.length);
  const rating = ratingMap(players);
  const ids = players.map((p) => p.id);
  const plays = new Map(ids.map((id) => [id, 0]));
  const pairs = new Map<string, number>();

  const record = (g: GameSides) => {
    for (const side of [g.blueIds, g.orangeIds]) {
      side.forEach((id) => plays.has(id) && plays.set(id, plays.get(id)! + 1));
      for (let x = 0; x < side.length; x++)
        for (let y = x + 1; y < side.length; y++) {
          const k = pairKey(side[x], side[y]);
          pairs.set(k, (pairs.get(k) ?? 0) + 1);
        }
    }
  };
  history.forEach(record);

  const perRound = Math.floor(ids.length / perGame);
  const games: GeneratedGame[] = [];
  let round = start.round;

  while (games.length < count) {
    const n = Math.min(perRound, count - games.length);
    const playing = [...ids]
      .map((id) => ({ id, r: rnd() }))
      .sort((a, b) => plays.get(a.id)! - plays.get(b.id)! || a.r - b.r)
      .slice(0, n * perGame)
      .map((x) => x.id);

    // Random-restart search over which six go in which game.
    let best: { cost: number; games: { blue: string[]; orange: string[] }[] } | null = null;
    const tries = n === 1 ? 1 : 400;
    for (let t = 0; t < tries; t++) {
      const shuffled = t === 0 ? playing : [...playing].sort(() => rnd() - 0.5);
      let cost = 0;
      const split = [];
      for (let g = 0; g < n; g++) {
        const res = bestSplit(shuffled.slice(g * perGame, g * perGame + perGame), teamSize, rating, pairs, repeatPenalty);
        cost += res.cost;
        split.push(res);
      }
      if (!best || cost < best.cost) best = { cost, games: split };
    }

    for (const g of best!.games) {
      const game = { blueIds: g.blue, orangeIds: g.orange, number: start.number + games.length, round };
      games.push(game);
      record(game);
    }
    round++;
  }
  return games;
}

// A side-average gap above this (in MMR, about half a Champion sub-rank) is
// flagged as unbalanced when a game is edited by hand.
export const BALANCE_WARN_MMR = 50;

export function sideAverage(ids: string[], rating: Map<string, number>): number {
  return ids.length ? ids.reduce((s, id) => s + (rating.get(id) ?? 0), 0) / ids.length : 0;
}

export function balanceGap(game: GameSides, rating: Map<string, number>): number {
  return Math.abs(sideAverage(game.blueIds, rating) - sideAverage(game.orangeIds, rating));
}
