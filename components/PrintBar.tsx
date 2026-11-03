"use client";
import { useEffect } from "react";

// แถบปุ่มบนหน้าใบเบิก (ไม่ถูกพิมพ์) — เปิดหน้าต่างพิมพ์ให้อัตโนมัติถ้า auto
export default function PrintBar({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 700); // รอฟอนต์โหลดก่อน
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="no-print mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center gap-2">
      <a href="/history" className="btn-ghost">← กลับประวัติ</a>
      <button type="button" className="btn" onClick={() => window.print()}>🖨 พิมพ์ / บันทึกเป็น PDF</button>
      <span className="text-xs text-slate-500">ในหน้าต่างพิมพ์ เลือกปลายทาง "บันทึกเป็น PDF" (Save as PDF)</span>
    </div>
  );
}
