"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify, confirmDialog } from "@/lib/status";

// ปุ่มเปลี่ยนเสารับฝากทั้งกอง → เสาใหม่
export default function KindButton({ siteId, sizeId, count }: { siteId: string; sizeId: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (count <= 0) return null;

  async function go() {
    if (!(await confirmDialog(`เปลี่ยนเสารับฝาก ${count} ต้น ในกองนี้ เป็น "เสาใหม่" ใช่หรือไม่?`, { ok: "เปลี่ยนเป็นเสาใหม่" }))) return;
    setBusy(true); notify("กำลังเปลี่ยนเป็นเสาใหม่...");
    try {
      await api("/api/poles/kind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, size_id: sizeId, from: "deposit", to: "new" }) });
      router.refresh(); notify(`✅ เปลี่ยนเสารับฝาก ${count} ต้น เป็นเสาใหม่แล้ว`);
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }
  return (
    <button type="button" disabled={busy} onClick={go} className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
      🔄 เสารับฝาก {count} ต้น → เปลี่ยนเป็นเสาใหม่
    </button>
  );
}
