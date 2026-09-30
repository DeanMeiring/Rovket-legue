import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ClaudeError, askClaude } from "@/lib/claude";
import { coachingReference } from "@/lib/coachingReference";
import { teamBuilderContext } from "@/lib/teamBuilder";

const HISTORY = 30;

const SYSTEM = `You help the admins of a university Rocket League club pick their 3v3 teams (Team 1 to Team 4 plus 2 to 4 subs) from their tryouts. You are talking to admins, not players.

Rules:
- Use only the tryout data below. Practice games are deliberately left out, so never guess at how someone plays in practice.
- Say how many games a claim rests on. Under 3 shared games a pair or trio result is mostly luck; say so plainly instead of reading meaning into it.
- Judge fundamentals for 3v3: rotation (time last back, time furthest forward, distance to teammates, time behind the ball), boost management, speed, and results. Rank (MMR) matters but is not everything.
- When you suggest a change, write it as a concrete move, e.g. "Swap A (Team 2) with B (Team 3)", and give the reason in one line. You can't change the line-up yourself; the admins do that.
- Talk about every team in the same way. Never call a team locked, protected, guaranteed or fixed.
- Plain text, short paragraphs or "-" bullets, no markdown headings or tables. Keep answers under 250 words unless asked for more.
- The coaching reference is your only source for benchmarks; don't invent pro or rank numbers.`;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messages = await prisma.teamChatMessage.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!text) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const history = (await prisma.teamChatMessage.findMany({ orderBy: { createdAt: "desc" }, take: HISTORY })).reverse();
  const context = await teamBuilderContext();
  const system = `${SYSTEM}\n\nCoaching reference:\n${coachingReference()}\n\n---\nTRYOUT DATA (current as of this message)\n${context}`;

  try {
    const { text: answer } = await askClaude(system, [
      ...history.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.text })),
      { role: "user", content: text },
    ]);
    const [question, reply] = await prisma.$transaction([
      prisma.teamChatMessage.create({ data: { role: "user", text, authorId: admin.id } }),
      prisma.teamChatMessage.create({ data: { role: "assistant", text: answer } }),
    ]);
    return NextResponse.json({ messages: [question, reply] });
  } catch (err) {
    if (err instanceof ClaudeError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}

export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.teamChatMessage.deleteMany();
  return NextResponse.json({ ok: true });
}
