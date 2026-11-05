import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { callGas, esc } from "@/lib/gas";
import { cleanItems, isYmd, todayBKK } from "@/lib/items";

export const maxDuration = 30;

// ใบเบิก 1 ใบ เบิกเสาได้หลายกอง/หลายขนาด (ส่งแค่ pole_ids; กอง/ขนาดดูจากตัวเสาเอง)
export async function POST(req: Request) {
  const b = await req.json();
  for (const k of ["job_name", "responsible"])
    if (!String(b[k] || "").trim()) return NextResponse.json({ error: `กรุณากรอก ${k === "job_name" ? "ชื่องาน" : "ผู้รับผิดชอบ"}` }, { status: 400 });
  if (!Array.isArray(b.pole_ids) || b.pole_ids.length === 0)
    return NextResponse.json({ error: "กรุณาเลือกเลขเสาอย่างน้อย 1 ต้น" }, { status: 400 });

  const ci = cleanItems(b.items);
  if (ci.error) return NextResponse.json({ error: ci.error }, { status: 400 });

  const accPhotos = Array.isArray(b.acc_photos) ? b.acc_photos.map((x: any) => ({ id: String(x.id), url: String(x.url) })) : [];

  const s = db();
  const { data: id, error } = await s.rpc("create_withdrawal", { p: b });
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

  // แจ้งเตือน Telegram จัดกลุ่มตามกอง+ขนาด (ถ้าล้มเหลว ไม่ทำให้การเบิกล้มเหลว)
  let notified = true;
  try {
    const { data: poles } = await s
      .from("poles")
      .select("pole_no,tier,pos,sites(label,lat,lng),pole_sizes(name)")
      .eq("withdrawal_id", id)
      .order("tier", { ascending: true })
      .order("pos", { ascending: true });

    const groups = new Map<string, { site: string; size: string; lat: any; lng: any; nos: string[] }>();
    for (const p of (poles || []) as any[]) {
      const k = `${p.sites?.label}|${p.pole_sizes?.name}`;
      if (!groups.has(k)) groups.set(k, { site: p.sites?.label, size: p.pole_sizes?.name, lat: p.sites?.lat, lng: p.sites?.lng, nos: [] });
      groups.get(k)!.nos.push(p.pole_no);
    }
    const lines = Array.from(groups.values()).map((g) => {
      const map = g.lat != null && g.lng != null ? `\n    🗺 https://maps.google.com/?q=${g.lat},${g.lng}` : "";
      return `📍 <b>${esc(g.site)}</b> · ${esc(g.size)} (${g.nos.length} ต้น)\n    เลขเสา: ${esc(g.nos.join(", "))}${map}`;
    });
    const app = process.env.NEXT_PUBLIC_APP_URL ? `\n🔗 ${process.env.NEXT_PUBLIC_APP_URL}/history` : "";
    const text =
      `📦 <b>เบิกเสา</b>\n` +
      `งาน: ${esc(b.job_name)}\n` +
      `WBS/ใบสั่ง: ${esc(b.wbs)}\n` +
      `โครงข่าย: ${esc(b.network)}\n` +
      `ผู้รับผิดชอบ: ${esc(b.responsible)}\n` +
      `ทีมงาน: ${esc(b.team)}\n` +
      `รวม: <b>${b.pole_ids.length}</b> ต้น จาก ${groups.size} กอง\n\n` +
      lines.join("\n") +
      (ci.items.length ? `\n\n🔩 <b>อุปกรณ์เสริม</b>\n` + ci.items.map((x) => `• ${esc(x.code)} ${esc(x.name)} × ${x.qty}${x.detail ? ` (${esc(x.detail)})` : ""}`).join("\n") : "") + app;
    const r = await callGas({ action: "notify", text });
    notified = !!r.ok;
  } catch {
    notified = false;
  }

  return NextResponse.json({ ok: true, id, notified, itemsSaved });
}
