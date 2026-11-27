"use client";
import { useState } from "react";
import { notify } from "@/lib/status";

// ดาวน์โหลดเอกสารตรวจนับพัสดุประจำเดือน (Excel) ของพื้นที่ที่เลือก
export default function InventoryButton() {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); notify("กำลังสร้างเอกสารตรวจนับ (อาจใช้เวลาสักครู่)...");
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `ผิดพลาด (${res.status})`); }
      const blob = await res.blob();
      const m = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("Content-Disposition") || "");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = m ? decodeURIComponent(m[1]) : "inventory.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      notify("✅ ดาวน์โหลดเอกสารตรวจนับแล้ว");
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }
  return <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={go}>📥 เอกสารตรวจนับ (Excel)</button>;
}
