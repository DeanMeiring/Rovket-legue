export function balanceIntoTeams<T extends { skillRating: number | null }>(
  players: T[],
  teamCount: number
): T[][] {
  const known = players.map((p) => p.skillRating).filter((r): r is number => r != null);
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1000;

  // Snake draft: highest-rated players fill teams first, alternating
  // direction each pass, so total skill ends up close to even per team.
  const sorted = [...players].sort((a, b) => (b.skillRating ?? avg) - (a.skillRating ?? avg));

  const groups: T[][] = Array.from({ length: teamCount }, () => []);
  let idx = 0;
  let dir = 1;
  for (const player of sorted) {
    groups[idx].push(player);
    idx += dir;
    if (idx === teamCount) {
      idx = teamCount - 1;
      dir = -1;
    } else if (idx === -1) {
      idx = 0;
      dir = 1;
    }
  }
  return groups;
}
