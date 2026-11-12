import { callGas, esc } from "@/lib/gas";

// ส่งแจ้งเตือน Telegram ของใบเบิกจากข้อมูลในฐานข้อมูล (เรียกตอนอนุมัติ) — คืน true ถ้าส่งสำเร็จ
export async function notifyWithdrawal(s: any, id: string): Promise<boolean> {
  try {
    const { data: w } = await s.from("withdrawals").select("*, poles(pole_no,tier,pos,sites(label,lat,lng),pole_sizes(name))").eq("id", id).single();
    if (!w) return false;
    const poles = [...(w.poles || [])].sort((a: any, b: any) => (a.tier ?? 999) - (b.tier ?? 999) || (a.pos ?? 999) - (b.pos ?? 999));
    const groups = new Map<string, { site: string; size: string; lat: any; lng: any; nos: string[] }>();
    for (const p of poles) {
      const k = `${p.sites?.label}|${p.pole_sizes?.name}`;
      if (!groups.has(k)) groups.set(k, { site: p.sites?.label, size: p.pole_sizes?.name, lat: p.sites?.lat, lng: p.sites?.lng, nos: [] });
      groups.get(k)!.nos.push(p.pole_no);
    }
    const lines = Array.from(groups.values()).map((g) => {
      const map = g.lat != null && g.lng != null ? `\n    🗺 https://maps.google.com/?q=${g.lat},${g.lng}` : "";
      return `📍 <b>${esc(g.site)}</b> · ${esc(g.size)} (${g.nos.length} ต้น)\n    เลขเสา: ${esc(g.nos.join(", "))}${map}`;
    });
    const items: any[] = Array.isArray(w.items) ? w.items : [];
    const app = process.env.NEXT_PUBLIC_APP_URL ? `\n🔗 ${process.env.NEXT_PUBLIC_APP_URL}/history` : "";
    const text =
      `📦 <b>เบิกเสา (อนุมัติแล้ว)</b>\n` +
      `งาน: ${esc(w.job_name)}\n` +
      `WBS/ใบสั่ง: ${esc(w.wbs)}\n` +
      `โครงข่าย: ${esc(w.network)}\n` +
      `ผู้รับผิดชอบ: ${esc(w.responsible)}\n` +
      `ทีมงาน: ${esc(w.team)}\n` +
      (w.move_date ? `วันขนเสา: ${esc(w.move_date)}\n` : "") +
      (poles.length ? `รวม: <b>${poles.length}</b> ต้น จาก ${groups.size} กอง\n\n` : `เบิกเฉพาะอุปกรณ์เสริม (ไม่มีเสา)\n\n`) +
      lines.join("\n") +
      (items.length ? `\n\n🔩 <b>อุปกรณ์เสริม</b>\n` + items.map((x) => `• ${esc(x.code)} ${esc(x.name)} × ${x.qty}${x.detail ? ` (${esc(x.detail)})` : ""}`).join("\n") : "") + app;
    const r = await callGas({ action: "notify", text });
    return !!r.ok;
  } catch {
    return false;
  }
}
