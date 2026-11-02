import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { callGas, esc } from "@/lib/gas";

export const maxDuration = 30;

export async function POST(req: Request) {
  const b = await req.json();
  const need = ["site_id", "size_id", "job_name", "responsible"];
  for (const k of need) if (!String(b[k] || "").trim()) return NextResponse.json({ error: `กรุณากรอก ${k}` }, { status: 400 });
  if (!Array.isArray(b.pole_ids) || b.pole_ids.length === 0)
    return NextResponse.json({ error: "กรุณาเลือกเลขเสาอย่างน้อย 1 ต้น" }, { status: 400 });

  const s = db();
  const { data: id, error } = await s.rpc("create_withdrawal", { p: b });
  if (error) {
    const gone = error.message.includes("POLE_NOT_AVAILABLE");
    return NextResponse.json(
      { error: gone ? "มีเสาบางต้นถูกเบิกไปแล้ว กรุณารีเฟรชแล้วเลือกใหม่" : error.message },
      { status: gone ? 409 : 500 }
    );
  }

  // แจ้งเตือน Telegram (ถ้าล้มเหลว ไม่ทำให้การเบิกล้มเหลว)
  let notified = true;
  try {
    const [{ data: poles }, { data: site }, { data: size }] = await Promise.all([
      s.from("poles").select("pole_no").in("id", b.pole_ids).order("pole_no"),
      s.from("sites").select("label,lat,lng").eq("id", b.site_id).single(),
      s.from("pole_sizes").select("name").eq("id", b.size_id).single(),
    ]);
    const nos = (poles || []).map((p) => p.pole_no).join(", ");
    const map = site?.lat != null && site?.lng != null ? `\n🗺 https://maps.google.com/?q=${site.lat},${site.lng}` : "";
    const app = process.env.NEXT_PUBLIC_APP_URL ? `\n🔗 ${process.env.NEXT_PUBLIC_APP_URL}/history` : "";
    const text =
      `📦 <b>เบิกเสา</b>\n` +
      `งาน: ${esc(b.job_name)}\n` +
      `WBS/ใบสั่ง: ${esc(b.wbs)}\n` +
      `โครงข่าย: ${esc(b.network)}\n` +
      `ผู้รับผิดชอบ: ${esc(b.responsible)}\n` +
      `ทีมงาน: ${esc(b.team)}\n` +
      `จุดกองหมอน: ${esc(site?.label)}\n` +
      `ขนาดเสา: ${esc(size?.name)}\n` +
      `จำนวน: <b>${b.pole_ids.length}</b> ต้น\n` +
      `เลขเสา: ${esc(nos)}` + map + app;
    const r = await callGas({ action: "notify", text });
    notified = !!r.ok;
  } catch {
    notified = false;
  }

  return NextResponse.json({ ok: true, id, notified });
}
