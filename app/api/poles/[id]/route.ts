import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// แก้เลขเสา (ห้ามซ้ำกับเสาอื่นในกองเดียวกัน)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const pole_no = String(b.pole_no || "").trim();
  if (!pole_no) return NextResponse.json({ error: "กรุณากรอกเลขเสา" }, { status: 400 });
  const s = db();
  const { data: cur, error: e1 } = await s.from("poles").select("id,site_id,pole_no").eq("id", params.id).single();
  if (e1 || !cur) return NextResponse.json({ error: "ไม่พบเสาต้นนี้" }, { status: 404 });
  if (cur.pole_no === pole_no) return NextResponse.json({ ok: true });
  const { data: dup } = await s.from("poles").select("id").eq("site_id", cur.site_id).eq("pole_no", pole_no).limit(1);
  if (dup && dup.length) return NextResponse.json({ error: `เลข ${pole_no} มีอยู่แล้วในกองนี้` }, { status: 409 });
  const { error } = await s.from("poles").update({ pole_no }).eq("id", params.id);
  if (error) {
    const d = error.code === "23505";
    return NextResponse.json({ error: d ? `เลข ${pole_no} มีอยู่แล้ว (ถ้าซ้ำกับกองอื่น ให้รัน migration_011 ใน Supabase)` : error.message }, { status: d ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}

// ลบเสาที่ใส่ผิด (เฉพาะเสาที่ยังไม่เคยเบิก)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = db();
  const { data: cur } = await s.from("poles").select("id,status,withdrawal_id").eq("id", params.id).single();
  if (!cur) return NextResponse.json({ error: "ไม่พบเสาต้นนี้" }, { status: 404 });
  if (cur.status !== "available" || cur.withdrawal_id) return NextResponse.json({ error: "เสาที่เบิกแล้วลบไม่ได้ (ให้ลบใบเบิกก่อน)" }, { status: 409 });
  const { error } = await s.from("poles").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
