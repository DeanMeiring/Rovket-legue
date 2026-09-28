import { prisma } from "@/lib/prisma";

// A player's 2v2 and 3v3 ranks live both on their account and on their tryout
// board entry, and tryout games are balanced from the board's copy. These keep
// the two in step once an entry is linked to an account. A blank rank never
// wipes a number on the other side.

type Ranks = { rank2v2: number | null; rank3v3: number | null };

function filled(r: Ranks) {
  return {
    ...(r.rank2v2 != null && { rank2v2: r.rank2v2 }),
    ...(r.rank3v3 != null && { rank3v3: r.rank3v3 }),
  };
}

// After an account's ranks change (by the player or an admin).
export async function copyAccountRanksToBoard(userId: string, ranks: Ranks) {
  const data = filled(ranks);
  if (!Object.keys(data).length) return;
  await prisma.tryoutPlayer.updateMany({ where: { userId }, data });
}

// After a board entry's ranks change.
export async function copyBoardRanksToAccount(userId: string | null, ranks: Ranks) {
  if (!userId) return;
  const data = filled(ranks);
  if (!Object.keys(data).length) return;
  await prisma.user.update({ where: { id: userId }, data });
}
