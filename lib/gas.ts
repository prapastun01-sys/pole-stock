// เรียก Google Apps Script Web App (อัปโหลดรูปไป Drive / ส่ง Telegram)
export async function callGas(payload: Record<string, any>) {
  const url = process.env.GAS_URL;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า GAS_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, secret: process.env.GAS_SECRET }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Apps Script ตอบกลับผิดรูปแบบ: " + text.slice(0, 200));
  }
}

export function esc(s: any) {
  return String(s ?? "-").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function safeSegment(s: any) {
  return String(s ?? "").replace(/[\\/:*?"<>|\n\r]/g, "").trim().slice(0, 60) || "_";
}
