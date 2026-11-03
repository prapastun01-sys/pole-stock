import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

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
  for (const k of ["before_photos", "after_photos"]) {
    if (k in b) {
      if (!Array.isArray(b[k])) return NextResponse.json({ error: `${k} ต้องเป็นรายการ` }, { status: 400 });
      patch[k] = b[k].map((x: any) => ({ id: String(x.id), url: String(x.url) }));
    }
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
