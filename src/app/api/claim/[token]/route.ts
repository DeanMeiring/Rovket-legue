import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appButton, escapeHtml, sendEmail } from "@/lib/email";
import { claimSchema } from "@/lib/claimSchema";

const INVALID = "This link isn't valid any more. Ask an admin for a new one.";

function findPlayer(token: string) {
  return prisma.tryoutPlayer.findUnique({ where: { claimToken: token } });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const player = await findPlayer(params.token);
  if (!player || player.userId) return NextResponse.json({ error: INVALID }, { status: 404 });
  return NextResponse.json({ tag: player.tag, name: player.name });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const player = await findPlayer(params.token);
  if (!player || player.userId) return NextResponse.json({ error: INVALID }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }

  const username = player.tag.trim().toLowerCase();
  const email = parsed.data.email.toLowerCase();
  const displayName = parsed.data.displayName;

  const taken = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (taken) {
    return NextResponse.json(
      {
        error:
          taken.username === username
            ? "An account with this gamertag already exists. Ask an admin to sort it out."
            : "That email is already registered.",
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const claimed = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so the same link can't be used twice.
    const res = await tx.tryoutPlayer.updateMany({
      where: { id: player.id, claimToken: params.token, userId: null },
      data: { claimToken: null },
    });
    if (res.count === 0) return false;
    const user = await tx.user.create({
      data: {
        username,
        email,
        passwordHash,
        displayName,
        rank2v2: player.rank2v2,
        rank3v3: player.rank3v3,
        rlTrackerUrl: player.trackerUrl,
        role: "PLAYER",
        status: "PENDING",
      },
    });
    await tx.tryoutPlayer.update({ where: { id: player.id }, data: { userId: user.id } });
    return true;
  });
  if (!claimed) return NextResponse.json({ error: INVALID }, { status: 404 });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "APPROVED" },
    select: { email: true },
  });
  for (const admin of admins) {
    void sendEmail(
      admin.email,
      `${player.tag} requested access with their invite link`,
      `<p><strong>${escapeHtml(displayName)}</strong> (@${escapeHtml(username)}) requested access using their invite link
       and set up their account.</p>
       <p>Approve them in the admin panel.</p>
       ${appButton("/admin", "Review in admin panel")}`
    );
  }

  return NextResponse.json({ ok: true });
}
