import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// Browser crashes are otherwise invisible to us: the error pages post them here
// so they show up in the server logs.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  console.error(
    "[client-error]",
    JSON.stringify({
      user: user.username,
      path: cut(body?.path, 200),
      message: cut(body?.message, 500),
      digest: cut(body?.digest, 100),
      stack: cut(body?.stack, 2000),
      agent: cut(req.headers.get("user-agent"), 200),
    }),
  );
  return NextResponse.json({ ok: true });
}
