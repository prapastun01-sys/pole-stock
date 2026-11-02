import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: Request) {
  const { passcode } = await req.json();
  const pass = process.env.APP_PASSCODE;
  if (pass && passcode !== pass) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const token = createHash("sha256").update((pass || "") + ":pole-stock").digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ps_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
