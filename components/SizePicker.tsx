"use client";
import { useState } from "react";
import { api } from "@/lib/client";

// กดเลือกขนาดจากรายการ ถ้าไม่มีให้กด "+ ขนาดอื่น" เพื่อเพิ่มใหม่
export default function SizePicker({
  sizes, value, onChange, onAdded,
}: { sizes: any[]; value: string; onChange: (id: string) => void; onAdded: (s: any) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const n = name.trim();
    if (!n) return;
    const exist = sizes.find((s) => s.name.trim().toLowerCase() === n.toLowerCase());
    if (exist) { onChange(exist.id); setName(""); setAdding(false); return; } // มีอยู่แล้ว → เลือกให้เลย
    setBusy(true); setErr("");
    try {
      const j = await api("/api/sizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) });
      onAdded(j.size); onChange(j.size.id);
      setName(""); setAdding(false);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={`rounded-xl border px-4 py-2 text-base ${value === s.id ? "border-brand bg-brand font-semibold text-white" : "border-slate-300 bg-white hover:border-brand"}`}>
            {value === s.id ? "✓ " : ""}{s.name}
          </button>
        ))}
        <button type="button" onClick={() => setAdding(!adding)}
          className="rounded-xl border-2 border-dashed border-slate-300 px-4 py-2 text-slate-500 hover:border-brand hover:text-brand">
          + ขนาดอื่น
        </button>
      </div>
      {adding && (
        <div className="flex gap-2">
          <input className="input" autoFocus placeholder="ไม่มีในรายการ? พิมพ์ขนาดใหม่ เช่น 10 เมตร" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn shrink-0" disabled={busy} onClick={add}>เพิ่ม</button>
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
