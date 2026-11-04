import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { callGas, esc } from "@/lib/gas";
import { cleanItems } from "@/lib/items";

// แก้ไขใบเบิก: ข้อมูลงาน + รูปก่อน/หลังขน (เพิ่ม/เอาออก)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const patch: Record<string, any> = {};

  for (const k of ["job_name", "responsible"]) {
    if (k in b) {
      if (!String(b[k] || "").trim()) return NextResponse.json({ error: k === "job_name" ? "ชื่องานต้องไม่ว่าง" : "ผู้รับผิดชอบต้องไม่ว่าง" }, { status: 400 });
      patch[k] = String(b[k]).trim();
    }
  }
  for (const k of ["wbs", "network", "team"]) if (k in b) patch[k] = String(b[k] || "").trim() || null;
  for (const k of ["before_photos", "after_photos", "acc_photos"]) {
    if (k in b) {
      if (!Array.isArray(b[k])) return NextResponse.json({ error: `${k} ต้องเป็นรายการ` }, { status: 400 });
      patch[k] = b[k].map((x: any) => ({ id: String(x.id), url: String(x.url) }));
    }
  }
  if ("items" in b) {
    const ci = cleanItems(b.items);
    if (ci.error) return NextResponse.json({ error: ci.error }, { status: 400 });
    patch.items = ci.items;
  }
  // งานเสร็จ: ต้องมีเลขใบตัดงาน
  if ("done" in b) {
    if (b.done) {
      const cut = String(b.cut_no || "").trim();
      if (!cut) return NextResponse.json({ error: "กรุณากรอกเลขใบตัดงาน" }, { status: 400 });
      patch.done_at = new Date().toISOString();
      patch.cut_no = cut;
    } else {
      patch.done_at = null;
    }
  } else if ("cut_no" in b) {
    const cut = String(b.cut_no || "").trim();
    if (!cut) return NextResponse.json({ error: "เลขใบตัดงานต้องไม่ว่าง" }, { status: 400 });
    patch.cut_no = cut;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });

  const { error } = await db().from("withdrawals").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ลบใบเบิก: เสาทุกต้นในใบกลับเป็น "คงเหลือ" ในกองเดิม แล้วจึงลบใบเบิก
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = db();
  const { data: w } = await s.from("withdrawals").select("job_name,poles(pole_no)").eq("id", params.id).single();
  if (!w) return NextResponse.json({ error: "ไม่พบใบเบิกนี้" }, { status: 404 });

  const { error: e1 } = await s.from("poles")
    .update({ status: "available", withdrawal_id: null, withdrawn_at: null })
    .eq("withdrawal_id", params.id);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const { error: e2 } = await s.from("withdrawals").delete().eq("id", params.id);
  if (e2) return NextResponse.json({ error: "คืนเสาแล้วแต่ลบใบเบิกไม่สำเร็จ: " + e2.message }, { status: 500 });

  // แจ้ง Telegram ว่ายกเลิกใบเบิก (ไม่ทำให้การลบล้มเหลวถ้าส่งไม่ได้)
  try {
    const nos = ((w as any).poles || []).map((p: any) => p.pole_no).join(", ");
    await callGas({ action: "notify", text: `🗑 <b>ยกเลิกใบเบิกเสา</b>\nงาน: ${esc((w as any).job_name)}\nคืนเสา ${(w as any).poles?.length || 0} ต้นเข้ากอง\nเลขเสา: ${esc(nos)}` });
  } catch {}
  return NextResponse.json({ ok: true });
}
