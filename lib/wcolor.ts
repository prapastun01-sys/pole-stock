// สีพื้นหลังของเสาที่เบิก แยกตาม "การเบิกแต่ละครั้ง" (ใบเบิก) ภายในกองเดียวกัน
const PAL: [string, string][] = [
  ["#dbeafe", "#60a5fa"], // ฟ้า
  ["#fce7f3", "#f472b6"], // ชมพู
  ["#dcfce7", "#4ade80"], // เขียว
  ["#ede9fe", "#a78bfa"], // ม่วง
  ["#ffedd5", "#fb923c"], // ส้ม
  ["#cffafe", "#22d3ee"], // ฟ้าอมเขียว
  ["#fae8ff", "#e879f9"], // ม่วงชมพู
  ["#ecfccb", "#a3e635"], // เขียวมะนาว
];
export type WC = { n: number; bg: string; bd: string; label: string };

// poles ต้องมี withdrawal_id และ withdrawals{team,created_at}; เรียงครั้งที่ตามเวลาสร้างใบเบิก
export function withdrawalColors(poles: any[]): Map<string, WC> {
  const seen = new Map<string, any>();
  for (const p of poles) if (p.withdrawal_id && !seen.has(p.withdrawal_id)) seen.set(p.withdrawal_id, p.withdrawals || {});
  const ids = Array.from(seen.keys()).sort((a, b) => String(seen.get(a)?.created_at || "").localeCompare(String(seen.get(b)?.created_at || "")));
  const m = new Map<string, WC>();
  ids.forEach((id, i) => {
    const w = seen.get(id) || {};
    const c = PAL[i % PAL.length];
    const d = w.created_at ? new Date(w.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }) : "";
    m.set(id, { n: i + 1, bg: c[0], bd: c[1], label: [`ครั้งที่ ${i + 1}`, w.team, d].filter(Boolean).join(" · ") });
  });
  return m;
}
