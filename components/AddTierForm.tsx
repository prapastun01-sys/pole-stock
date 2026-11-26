"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify } from "@/lib/status";

// เพิ่มเสาเข้าชั้น / แทรกชั้นที่กรอกตกไป
export default function AddTierForm({ siteId, sizes, maxTier }: { siteId: string; sizes: { id: string; name: string }[]; maxTier: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState(String(maxTier + 1));
  const [mode, setMode] = useState<"insert" | "append">("append");
  const [sizeId, setSizeId] = useState(sizes[0]?.id || "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const nos = text.split(/[\s,;\t]+/).map((x) => x.trim()).filter(Boolean);

  async function save() {
    const t = Number(tier);
    if (!Number.isInteger(t) || t < 1) return notify("❌ ใส่เลขชั้นให้ถูกต้อง");
    if (nos.length === 0) return notify("❌ ใส่เลขเสาอย่างน้อย 1 ต้น");
    if (mode === "insert" && t <= maxTier && !window.confirm(`แทรกชั้นใหม่ที่ชั้น ${t} และเลื่อนชั้น ${t}–${maxTier} ขึ้นไปอีก 1 ชั้น ใช่ไหม?`)) return;
    setBusy(true); notify("กำลังบันทึก...");
    try {
      const r = await api("/api/piles/tier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, size_id: sizeId, tier: t, nos, insert: mode === "insert" }) });
      notify(`✅ เพิ่มเสา ${r.count} ต้น ที่ชั้น ${t} แล้ว`);
      setText(""); setOpen(false); router.refresh();
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }

  if (!open) return <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setOpen(true)}>➕ เพิ่มเสา / แทรกชั้นที่ตกไป</button>;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-semibold">เพิ่มเสาเข้ากองนี้ (กรอกชั้นตกหล่น)</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">ชั้นที่</label>
          <input className="input !w-24" inputMode="numeric" value={tier} onChange={(e) => setTier(e.target.value.replace(/\D/g, ""))} />
        </div>
        {sizes.length > 1 && (
          <div>
            <label className="label">ขนาด</label>
            <select className="input" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>{sizes.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          </div>
        )}
      </div>
      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2"><input type="radio" className="accent-teal-700" checked={mode === "append"} onChange={() => setMode("append")} /> ต่อท้ายชั้นนี้ (ชั้นใหม่ถ้ายังไม่มี เช่น ชั้นบนสุดที่ตกไป)</label>
        <label className="flex items-center gap-2"><input type="radio" className="accent-teal-700" checked={mode === "insert"} onChange={() => setMode("insert")} /> แทรกเป็นชั้นนี้ แล้วเลื่อนชั้นที่สูงกว่าขึ้น 1 ชั้น (ตกหล่นตรงกลาง)</label>
      </div>
      <div>
        <label className="label">เลขเสา (ซ้าย → ขวา คั่นด้วยเว้นวรรค / จุลภาค / ขึ้นบรรทัดใหม่) — {nos.length} ต้น</label>
        <textarea className="input min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="เช่น 601 602 603 604" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={busy} onClick={save}>บันทึก</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button>
      </div>
    </div>
  );
}
