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
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });

  const { error } = await db().from("withdrawals").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
