"use client";
import { useEffect, useState } from "react";
import { notify } from "@/lib/status";
import { DEFAULT_SIGNERS, Signers, Person } from "@/lib/inventory";

const KEY = "ps_inventory_signers";

// ดาวน์โหลดเอกสารตรวจนับพัสดุประจำเดือน (Excel) ของพื้นที่ที่เลือก — แก้รายชื่อกรรมการได้ก่อนส่งออก
export default function InventoryButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sg, setSg] = useState<Signers>(DEFAULT_SIGNERS);
  const [saved, setSaved] = useState<Signers>(DEFAULT_SIGNERS); // รายชื่อที่บันทึกไว้ (ค่าตั้งต้นของเครื่องนี้)

  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v) { const x = { ...DEFAULT_SIGNERS, ...JSON.parse(v) }; setSg(x); setSaved(x); } } catch { /* ignore */ }
  }, []);

  const setP = (get: (s: Signers) => Person, field: keyof Person, val: string) => {
    const next: Signers = JSON.parse(JSON.stringify(sg));
    get(next)[field] = val; setSg(next);
  };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(sg)); setSaved(JSON.parse(JSON.stringify(sg))); notify("✅ บันทึกรายชื่อใหม่แล้ว (ใช้เป็นค่าตั้งต้นครั้งต่อไป)"); }
    catch { notify("❌ บันทึกไม่ได้ (เบราว์เซอร์ปิดการเก็บข้อมูล)"); }
  }
  const changed = JSON.stringify(sg) !== JSON.stringify(saved);

  async function go() {
    setOpen(false); setBusy(true); notify("กำลังสร้างเอกสารตรวจนับ (อาจใช้เวลาสักครู่)...");
    try {
      const res = await fetch("/api/inventory", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signers: sg }) });
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

  const row = (label: string, get: (s: Signers) => Person) => (
    <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2">
      <span className="text-sm text-slate-600">{label}</span>
      <input className="input !py-1.5" placeholder="ชื่อ" value={get(sg).name} onChange={(e) => setP(get, "name", e.target.value)} />
      <input className="input !py-1.5" placeholder="ตำแหน่ง" value={get(sg).pos} onChange={(e) => setP(get, "pos", e.target.value)} />
    </div>
  );

  return (
    <>
      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => setOpen(true)}>📥 เอกสารตรวจนับ (Excel)</button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" role="dialog" aria-label="เอกสารตรวจนับ" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">📥 เอกสารตรวจนับพัสดุประจำเดือน</h2>
            <p className="text-sm text-slate-500">ตรวจ/แก้รายชื่อผู้ลงนามก่อนส่งออก — ถ้าเปลี่ยนคนถาวร กด "💾 บันทึกรายชื่อนี้" เพื่อใช้แทนคนเดิม</p>
            {row("ประธาน", (s) => s.chair)}
            {row("กรรมการ 1", (s) => s.members[0])}
            {row("กรรมการ 2", (s) => s.members[1])}
            {row("กรรมการ 3", (s) => s.members[2])}
            {row("ผู้ควบคุมพัสดุ", (s) => s.controller)}
            {row("หัวหน้าแผนก", (s) => s.head)}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn" onClick={go}>ดาวน์โหลด Excel</button>
              <button type="button" className={changed ? "btn-ghost !border-brand !text-brand" : "btn-ghost"} onClick={save} disabled={!changed}>💾 บันทึกรายชื่อนี้</button>
              <button type="button" className="btn-ghost" onClick={() => setSg(JSON.parse(JSON.stringify(saved)))} disabled={!changed}>ย้อนกลับ</button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
