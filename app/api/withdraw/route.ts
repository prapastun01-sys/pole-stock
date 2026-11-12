import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { cleanItems, isYmd, todayBKK } from "@/lib/items";
import { areaCookie, isAreaId } from "@/lib/area";

export const maxDuration = 30;

// ใบเบิก 1 ใบ เบิกเสาได้หลายกอง/หลายขนาด (ส่งแค่ pole_ids; กอง/ขนาดดูจากตัวเสาเอง)
export async function POST(req: Request) {
  const b = await req.json();
  for (const k of ["job_name", "responsible"])
    if (!String(b[k] || "").trim()) return NextResponse.json({ error: `กรุณากรอก ${k === "job_name" ? "ชื่องาน" : "ผู้รับผิดชอบ"}` }, { status: 400 });
  const ci = cleanItems(b.items);
  if (ci.error) return NextResponse.json({ error: ci.error }, { status: 400 });

  const poleIds: string[] = Array.isArray(b.pole_ids) ? b.pole_ids : [];
  if (poleIds.length === 0 && ci.items.length === 0)
    return NextResponse.json({ error: "กรุณาเลือกเสาหรืออุปกรณ์เสริมอย่างน้อย 1 รายการ" }, { status: 400 });

  const accPhotos = Array.isArray(b.acc_photos) ? b.acc_photos.map((x: any) => ({ id: String(x.id), url: String(x.url) })) : [];

  const s = db();
  let id: any, error: any;
  if (poleIds.length > 0) {
    ({ data: id, error } = await s.rpc("create_withdrawal", { p: b }));
  } else {
    // เบิกเฉพาะอุปกรณ์เสริม (ไม่มีเสา) — ต้องรัน migration_012
    const ac = areaCookie();
    const ins = await s.from("withdrawals").insert({
      job_name: String(b.job_name).trim(), wbs: b.wbs || null, network: b.network || null, responsible: String(b.responsible).trim(), team: b.team || null,
      before_photos: b.before_photos || [], after_photos: b.after_photos || [],
      pole_free: true, area_id: isAreaId(ac) ? ac : null,
    }).select("id").single();
    id = ins.data?.id; error = ins.error;
    if (error && /pole_free|area_id/.test(error.message)) error = { message: "ฐานข้อมูลยังไม่ได้อัปเดต: กรุณารัน migration_012_items_only.sql ใน Supabase" };
  }
  if (error) {
    const gone = error.message.includes("POLE_NOT_AVAILABLE");
    return NextResponse.json(
      { error: gone ? "มีเสาบางต้นถูกเบิกไปแล้ว กรุณารีเฟรชแล้วเลือกใหม่" : error.message },
      { status: gone ? 409 : 500 }
    );
  }

  let itemsSaved = true;
  {
    const upd: Record<string, any> = { move_date: isYmd(b.move_date) ? b.move_date : todayBKK() };
    if (ci.items.length || accPhotos.length) { upd.items = ci.items; upd.acc_photos = accPhotos; }
    const { error: ie } = await s.from("withdrawals").update(upd).eq("id", id);
    if (ie) itemsSaved = false; // ใบเบิกถูกสร้างแล้ว แต่บันทึกวันขนเสา/อุปกรณ์ไม่สำเร็จ (ยังไม่ได้รัน migration_008-010?)
  }

  // ใบเบิกใหม่อยู่สถานะ "รออนุมัติ" (approved_at = null) — แจ้ง Telegram ตอนอนุมัติ
  return NextResponse.json({ ok: true, id, itemsSaved });
}
