export type Item = { code: string; name: string; qty: number; detail?: string };

// ตรวจ/ทำความสะอาดรายการอุปกรณ์จาก client (ใช้ใน API)
export function cleanItems(v: any): { items: Item[]; error?: string } {
  if (v == null) return { items: [] };
  if (!Array.isArray(v)) return { items: [], error: "รายการอุปกรณ์ไม่ถูกต้อง" };
  const items: Item[] = [];
  for (const x of v) {
    const qty = Math.floor(Number(x?.qty));
    if (!(qty > 0)) return { items: [], error: `กรุณาใส่จำนวนของอุปกรณ์ ${x?.code || ""}` };
    items.push({ code: String(x.code || "").trim(), name: String(x.name || "").trim(), qty, detail: String(x.detail || "").trim() || undefined });
  }
  return { items };
}

// หน่วยนับของอุปกรณ์ (แผ่นคอนกรีต = แผ่น, อื่น ๆ = อัน)
export const unitOf = (name: string) => (/ANCHOR/i.test(name) ? "แผ่น" : "อัน");
export const todayBKK = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
export const isYmd = (v: any): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
