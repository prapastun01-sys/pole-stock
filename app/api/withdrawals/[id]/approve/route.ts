import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { notifyWithdrawal } from "@/lib/notify";

export const maxDuration = 30;

// อนุมัติใบเบิก: ต้องใส่รหัสอนุมัติ (ตั้งใน Vercel ที่ APPROVE_PASSCODE; ถ้าไม่ตั้งใช้ค่าเริ่มต้น)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const need = (process.env.APPROVE_PASSCODE || "ad112233").trim();
  if (String(b.passcode || "").trim() !== need) return NextResponse.json({ error: "รหัสอนุมัติไม่ถูกต้อง" }, { status: 401 });

  const s = db();
  const { data: w, error: e0 } = await s.from("withdrawals").select("id,approved_at").eq("id", params.id).single();
  if (e0 || !w) return NextResponse.json({ error: e0 ? e0.message + " (ต้องรัน migration_013_approval.sql)" : "ไม่พบใบเบิกนี้" }, { status: e0 ? 500 : 404 });
  if (w.approved_at) return NextResponse.json({ ok: true, already: true, notified: true });

  const { error } = await s.from("withdrawals").update({ approved_at: new Date().toISOString() }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notified = await notifyWithdrawal(s, params.id);
  return NextResponse.json({ ok: true, notified });
}
