import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// แก้ไขจุดกองหมอน (ชื่อ / กอง / พิกัด / หมายเหตุ)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อจุด" }, { status: 400 });
  const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

  const { data, error } = await db()
    .from("sites")
    .update({ area_id: b.area_id || null, name, zone: String(b.zone || "").trim(), pile: String(b.pile || "").trim(), lat: num(b.lat), lng: num(b.lng), note: b.note || null })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีจุดนี้อยู่แล้ว (ชื่อจุด + Zone + กอง ต้องไม่ซ้ำกัน)" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ site: data });
}

// ลบกอง (กองที่ลงข้อมูลผิด) พร้อมเสาทั้งหมดในกอง — ต้องใส่รหัส (APPROVE_PASSCODE) และห้ามมีเสาที่เบิกแล้ว
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let b: any = {};
  try { b = await req.json(); } catch {}
  const need = (process.env.APPROVE_PASSCODE || "ad112233").trim();
  if (String(b.passcode || "").trim() !== need) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });

  const s = db();
  const { count: used } = await s.from("poles").select("id", { count: "exact", head: true }).eq("site_id", params.id).or("status.neq.available,withdrawal_id.not.is.null");
  if (used && used > 0) return NextResponse.json({ error: `กองนี้มีเสาที่เบิกแล้ว ${used} ต้น ลบกองไม่ได้ — ให้ลบใบเบิกที่เกี่ยวข้องก่อน (เสาจะกลับมาเป็นคงเหลือ) แล้วลบกองอีกครั้ง` }, { status: 409 });

  const { count: n } = await s.from("poles").select("id", { count: "exact", head: true }).eq("site_id", params.id);
  const { error: e1 } = await s.from("poles").delete().eq("site_id", params.id);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const { error: e2 } = await s.from("sites").delete().eq("id", params.id);
  if (e2) return NextResponse.json({ error: e2.code === "23503" ? "ลบกองไม่ได้ เพราะยังมีใบเบิกเก่าอ้างอิงกองนี้อยู่" : e2.message }, { status: e2.code === "23503" ? 409 : 500 });
  return NextResponse.json({ ok: true, poles: n || 0 });
}
