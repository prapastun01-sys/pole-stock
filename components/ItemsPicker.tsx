"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { notify } from "@/lib/status";
import type { Item } from "@/lib/items";

type Acc = { id?: string; code: string; name: string };

// เลือกอุปกรณ์เสริมได้หลายรายการ ใส่จำนวนและรายละเอียดต่อรายการ + เพิ่มรายการใหม่ได้
export default function ItemsPicker({ accessories, value, onChange }: { accessories: Acc[]; value: Item[]; onChange: (v: Item[]) => void }) {
  const [extra, setExtra] = useState<Acc[]>([]);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState(""); const [nn, setNn] = useState("");

  const base = [...accessories, ...extra];
  // รายการที่อยู่ในใบเบิกแต่ไม่อยู่ในรายการหลัก (เช่นถูกปิดใช้) ก็ยังแสดง
  const list: Acc[] = [...base, ...value.filter((v) => !base.some((b) => b.code === v.code)).map((v) => ({ code: v.code, name: v.name }))];
  const get = (code: string) => value.find((v) => v.code === code);

  const toggle = (a: Acc) => onChange(get(a.code) ? value.filter((v) => v.code !== a.code) : [...value, { code: a.code, name: a.name, qty: 1 }]);
  const patch = (code: string, p: Partial<Item>) => onChange(value.map((v) => (v.code === code ? { ...v, ...p } : v)));

  async function add() {
    if (!nc.trim() || !nn.trim()) return notify("❌ กรุณากรอกรหัสและชื่ออุปกรณ์");
    notify("กำลังเพิ่มรายการอุปกรณ์...");
    try {
      const j = await api("/api/accessories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: nc, name: nn }) });
      setExtra((x) => [...x, j.accessory]);
      onChange([...value, { code: j.accessory.code, name: j.accessory.name, qty: 1 }]);
      setNc(""); setNn(""); setAdding(false);
      notify("✅ เพิ่มรายการอุปกรณ์แล้ว");
    } catch (e: any) { notify("❌ " + e.message); }
  }

  return (
    <div className="space-y-2">
      <div className="max-h-96 space-y-1.5 overflow-auto">
        {list.map((a) => {
          const it = get(a.code);
          return (
            <div key={a.code} className={`rounded-xl border p-2 ${it ? "border-brand bg-brand-light" : "border-slate-200"}`}>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-teal-700" checked={!!it} onChange={() => toggle(a)} />
                <span className="text-sm"><span className="block font-mono text-xs text-slate-500">{a.code}</span><span className={it ? "font-semibold" : ""}>{a.name}</span></span>
              </label>
              {it && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  <label className="flex items-center gap-1.5 text-sm">จำนวน
                    <input className="input !w-20 !py-1.5" inputMode="numeric" value={it.qty || ""} onChange={(e) => patch(a.code, { qty: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                  </label>
                  <input className="input !py-1.5 min-w-40 flex-1" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" value={it.detail || ""} onChange={(e) => patch(a.code, { detail: e.target.value })} />
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีรายการอุปกรณ์ (รัน migration_008 หรือเพิ่มรายการใหม่)</p>}
      </div>
      {!adding ? (
        <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => setAdding(true)}>➕ เพิ่มรายการอุปกรณ์ใหม่</button>
      ) : (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <input className="input" placeholder="รหัส เช่น 1-00-011-0010" value={nc} onChange={(e) => setNc(e.target.value)} />
          <input className="input" placeholder="ชื่อ/รายละเอียด เช่น CROSSARM 100X100X3,000 MM." value={nn} onChange={(e) => setNn(e.target.value)} />
          <div className="flex gap-2"><button type="button" className="btn" onClick={add}>เพิ่ม</button><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>ยกเลิก</button></div>
        </div>
      )}
    </div>
  );
}
