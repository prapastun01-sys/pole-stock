import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// เปลี่ยนรูปกองเต็มของกอง  body: { site_id, photo_id, photo_url }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.site_id || !b.photo_url) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  const { error, count } = await db().from("poles")
    .update({ photo_id: b.photo_id || null, photo_url: b.photo_url }, { count: "exact" })
    .eq("site_id", b.site_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, poles: count ?? 0 });
}
