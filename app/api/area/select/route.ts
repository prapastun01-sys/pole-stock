import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// เลือกพื้นที่ (ตั้ง cookie) แล้วพาไปหน้าถัดไป   /api/area/select?id=<uuid|all|none>&to=/summary
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "all";
  let to = u.searchParams.get("to") || "/summary";
  if (!to.startsWith("/") || to.startsWith("//")) to = "/summary";

  let name = "ทุกพื้นที่";
  if (id === "none") name = "ยังไม่ระบุพื้นที่";
  else if (id !== "all") {
    const { data } = await db().from("areas").select("name").eq("id", id).single();
    if (!data) return NextResponse.redirect(new URL("/", req.url));
    name = data.name;
  }

  const res = NextResponse.redirect(new URL(to, req.url));
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  res.cookies.set("ps_area", id, { ...opts, httpOnly: true });
  res.cookies.set("ps_area_name", encodeURIComponent(name), { ...opts, httpOnly: false }); // ให้แถบเมนูอ่านชื่อพื้นที่ได้
  return res;
}
