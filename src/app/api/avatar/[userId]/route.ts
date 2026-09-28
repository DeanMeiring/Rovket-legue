import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 300 * 1024;

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const user = await requireApprovedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const avatar = await prisma.avatar.findUnique({ where: { userId: params.userId } });
  if (!avatar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // URLs carry ?v=<avatarUpdatedAt>, so a new picture gets a new URL.
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: { "Content-Type": avatar.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

// Players set their own picture. The browser sends a small square as a data URL.
export async function PUT(req: Request, { params }: { params: { userId: string } }) {
  const user = await requireApprovedUser();
  if (!user || user.id !== params.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const match = typeof body?.dataUrl === "string" ? body.dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/) : null;
  if (!match || !TYPES.includes(match[1])) {
    return NextResponse.json({ error: "Send a JPEG, PNG or WebP image." }, { status: 400 });
  }
  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_BYTES) return NextResponse.json({ error: "That image is too large." }, { status: 413 });

  const now = new Date();
  await prisma.$transaction([
    prisma.avatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, data, mime: match[1] },
      update: { data, mime: match[1] },
    }),
    prisma.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: now } }),
  ]);
  return NextResponse.json({ avatarUpdatedAt: now });
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const user = await requireApprovedUser();
  if (!user || user.id !== params.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.$transaction([
    prisma.avatar.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: null } }),
  ]);
  return NextResponse.json({ ok: true });
}
