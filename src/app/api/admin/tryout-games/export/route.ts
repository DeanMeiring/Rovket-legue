import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { preciseRankLabel } from "@/lib/ranks";
import { BALANCE_WARN_MMR, balanceGap, ratingMap, sideAverage } from "@/lib/tryoutGames";

// Downloads the tryout games as an .xlsx: one row per game with both sides,
// their ratings, the gap, and an empty Notes column for tryout day.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const [players, games] = await Promise.all([
    prisma.tryoutPlayer.findMany({ orderBy: { tag: "asc" } }),
    prisma.tryoutGame.findMany({ orderBy: { number: "asc" } }),
  ]);
  const rating = ratingMap(players);
  const tag = new Map(players.map((p) => [p.id, p.tag]));
  const names = (ids: string[]) => ids.map((id) => tag.get(id) ?? "Removed player").join(", ");

  const wb = new ExcelJS.Workbook();
  wb.creator = "RL Team Hub";

  const sheet = wb.addWorksheet("Games", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Round", key: "round", width: 8 },
    { header: "Game", key: "game", width: 8 },
    { header: "Blue", key: "blue", width: 44 },
    { header: "Blue rating", key: "blueRating", width: 12 },
    { header: "Orange", key: "orange", width: 44 },
    { header: "Orange rating", key: "orangeRating", width: 14 },
    { header: "Gap", key: "gap", width: 8 },
    { header: "Balanced", key: "balanced", width: 10 },
    { header: "Score (blue-orange)", key: "score", width: 18 },
    { header: "Sitting out", key: "sitting", width: 40 },
    { header: "Notes", key: "notes", width: 50 },
  ];

  const byRound = new Map<number, string[]>();
  games.forEach((g) => byRound.set(g.round, [...(byRound.get(g.round) ?? []), ...g.blueIds, ...g.orangeIds]));

  for (const g of games) {
    const gap = balanceGap(g, rating);
    const playing = new Set(byRound.get(g.round));
    const row = sheet.addRow({
      round: g.round,
      game: g.number,
      blue: names(g.blueIds),
      blueRating: Math.round(sideAverage(g.blueIds, rating)),
      orange: names(g.orangeIds),
      orangeRating: Math.round(sideAverage(g.orangeIds, rating)),
      gap: Math.round(gap),
      balanced: gap > BALANCE_WARN_MMR ? "No" : "Yes",
      score: g.blueGoals != null && g.orangeGoals != null ? `${g.blueGoals}-${g.orangeGoals}` : "",
      sitting: players.filter((p) => !playing.has(p.id)).map((p) => p.tag).join(", "),
      notes: "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    if (gap > BALANCE_WARN_MMR) {
      row.getCell("balanced").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE2C4" } };
    }
  }

  const ps = wb.addWorksheet("Players", { views: [{ state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "Gamertag", key: "tag", width: 22 },
    { header: "Name", key: "name", width: 16 },
    { header: "3v3 rank", key: "r3", width: 22 },
    { header: "2v2 rank", key: "r2", width: 22 },
    { header: "Rating (70% 3v3, 30% 2v2)", key: "rating", width: 24 },
    { header: "Games scheduled", key: "games", width: 16 },
    { header: "Notes", key: "notes", width: 50 },
  ];
  for (const p of players) {
    ps.addRow({
      tag: p.tag,
      name: p.name ?? "",
      r3: preciseRankLabel(p.rank3v3) ?? "",
      r2: preciseRankLabel(p.rank2v2) ?? "",
      rating: Math.round(rating.get(p.id) ?? 0),
      games: games.filter((g) => g.blueIds.includes(p.id) || g.orangeIds.includes(p.id)).length,
      notes: "",
    });
  }

  for (const ws of [sheet, ps]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECF3" } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tryout-games-${date}.xlsx"`,
    },
  });
}
