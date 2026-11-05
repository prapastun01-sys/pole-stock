"use client";
import { useCallback, useEffect, useState } from "react";

const PAGE_H_MM = 297 - 16 - 2; // A4 สูง 297 − ขอบบนล่าง 8+8 − เผื่อ 2 มม.
const mmPx = (mm: number) => (mm * 96) / 25.4;

// แถบปุ่มบนหน้าใบเบิก (ไม่ถูกพิมพ์) — ย่อเนื้อหาให้พอดี A4 หน้าเดียวอัตโนมัติ
export default function PrintBar({ auto }: { auto?: boolean }) {
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);

  const apply = useCallback((on: boolean) => {
    const el = document.getElementById("doc") as HTMLElement | null;
    if (!el) return 1;
    el.style.zoom = "1";
    if (!on) { setZoom(1); return 1; }
    const avail = mmPx(PAGE_H_MM);
    let z = 1;
    for (let i = 0; i < 8; i++) {
      const h = el.getBoundingClientRect().height;
      if (h <= avail) break;
      z = Math.max(0.45, z * (avail / h) * 0.985);
      el.style.zoom = String(z);
    }
    setZoom(z);
    return z;
  }, []);

  useEffect(() => {
    apply(fit);
    const t1 = setTimeout(() => apply(fit), 600), t2 = setTimeout(() => apply(fit), 2000); // รอรูปโหลด
    const onBefore = () => apply(fit);
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("load", onBefore);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("beforeprint", onBefore); window.removeEventListener("load", onBefore); };
  }, [fit, apply]);

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => { apply(fit); window.print(); }, 1200); // รอฟอนต์/รูปโหลดก่อน
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="no-print mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center gap-2">
      <a href="/history" className="btn-ghost">← กลับประวัติ</a>
      <button type="button" className="btn" onClick={() => { apply(fit); window.print(); }}>🖨 พิมพ์ / บันทึกเป็น PDF</button>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={fit} onChange={(e) => setFit(e.target.checked)} />
        ย่อให้พอดี 1 หน้า A4{fit && zoom < 1 ? ` (${Math.round(zoom * 100)}%)` : ""}
      </label>
      <span className="basis-full text-xs text-slate-500">ในหน้าต่างพิมพ์ เลือกปลายทาง "บันทึกเป็น PDF" · ขนาดกระดาษ A4 · มาตราส่วน 100% (Default)</span>
    </div>
  );
}
