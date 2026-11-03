import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { KIND_VALUES } from "@/lib/kinds";

// เปลี่ยนประเภทเสาทั้งกอง เช่น เสารับฝาก → เสาใหม่  body: { site_id, size_id?, from, to }  หรือ { pole_ids, to }
export async function POST(req: Request) {
  const b = await req.json();
  if (!KIND_VALUES.includes(b.to)) return NextResponse.json({ error: "ประเภทเสาไม่ถูกต้อง" }, { status: 400 });

  let q = db().from("poles").update({ kind: b.to }).select("id");
  if (Array.isArray(b.pole_ids) && b.pole_ids.length) q = q.in("id", b.pole_ids);
  else if (b.site_id) {
    q = q.eq("site_id", b.site_id);
    if (b.size_id) q = q.eq("size_id", b.size_id);
    if (b.from) q = q.eq("kind", b.from);
  } else return NextResponse.json({ error: "ระบุกองหรือเลขเสา" }, { status: 400 });

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: data?.length || 0 });
}
