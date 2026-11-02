"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";

/**
 * การสร้างเลขเสา: เลขเสา = [ชั้น] + [ลำดับ เติม 0 ให้ครบหลัก]
 *   ชั้น 42 เริ่ม 1 จำนวน 5 หลัก 2  →  4201, 4202, 4203, 4204, 4205
 * หรือเลือกโหมด "กรอกเอง" เพื่อพิมพ์เลขเสาทีละรายการ
 * (ถ้าต้องการรูปแบบอื่น แก้ที่ฟังก์ชัน buildNumbers ด้านล่าง)
 */
function buildNumbers(layer: string, start: number, qty: number, digits: number) {
  return Array.from({ length: qty }, (_, i) => `${layer}${String(start + i).padStart(digits, "0")}`);
}

export default function NewPoles() {
  const [sites, setSites] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [siteId, setSiteId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [layer, setLayer] = useState("");
  const [start, setStart] = useState(1);
  const [qty, setQty] = useState(10);
  const [digits, setDigits] = useState(2);
  const [manual, setManual] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg("❌ " + e.message)); }, []);

  const numbers = useMemo(() => {
    if (mode === "manual") return Array.from(new Set(manual.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
    if (!layer.trim() || qty < 1) return [];
    return buildNumbers(layer.trim(), start, Math.min(qty, 2000), digits);
  }, [mode, manual, layer, start, qty, digits]);

  const site = sites.find((s) => s.id === siteId);
  const size = sizes.find((s) => s.id === sizeId);

  async function save() {
    setMsg("");
    if (!siteId || !sizeId) return setMsg("❌ กรุณาเลือกจุดกองและขนาดเสา");
    if (numbers.length === 0) return setMsg("❌ ยังไม่มีเลขเสา");
    setBusy(true);
    try {
      let photo: { id: string; url: string } | null = null;
      if (photos[0]) {
        setMsg("กำลังอัปโหลดรูปไป Google Drive...");
        photo = await uploadPhoto(photos[0], ["เสา", site.label, size.name], `${layer || "pole"}_${stamp().full}.jpg`);
      }
      const r = await api("/api/poles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, size_id: sizeId, layer: mode === "auto" ? layer : null, pole_nos: numbers, photo_url: photo?.url, photo_id: photo?.id }),
      });
      setMsg(`✅ บันทึกเสา ${r.count} ต้นเรียบร้อย`);
      setPhotos([]); setManual("");
      if (mode === "auto") setStart(start + qty);
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">เพิ่มเสาเข้ากองหมอน</h1>

      <div className="card space-y-3">
        <div>
          <label className="label">1) จุดกองหมอน *</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">— เลือกจุดกอง —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {site && <p className="mt-1 text-xs text-slate-500">พิกัด: {site.lat != null ? `${site.lat}, ${site.lng}` : "ยังไม่ได้ระบุ"} · <Link className="text-brand underline" href="/sites">จัดการจุดกอง</Link></p>}
          {sites.length === 0 && <p className="mt-1 text-sm text-orange-600">ยังไม่มีจุดกอง <Link className="underline" href="/sites">เพิ่มที่นี่</Link></p>}
        </div>
        <div>
          <label className="label">2) ขนาดเสา *</label>
          <select className="input" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            <option value="">— เลือกขนาด —</option>
            {sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <PhotoPicker label="3) รูปเสา (บีบเหลือ ≤ 1MB อัตโนมัติ)" photos={photos} onChange={setPhotos} single />
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">4) สร้างเลขเสา</h2>
          <div className="flex overflow-hidden rounded-lg border text-sm">
            <button className={`px-3 py-1 ${mode === "auto" ? "bg-brand text-white" : ""}`} onClick={() => setMode("auto")}>ตามชั้น</button>
            <button className={`px-3 py-1 ${mode === "manual" ? "bg-brand text-white" : ""}`} onClick={() => setMode("manual")}>กรอกเอง</button>
          </div>
        </div>

        {mode === "auto" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><label className="label">ชั้น</label><input className="input" value={layer} onChange={(e) => setLayer(e.target.value)} placeholder="เช่น 42" /></div>
            <div><label className="label">เริ่มลำดับที่</label><input type="number" min={0} className="input" value={start} onChange={(e) => setStart(+e.target.value)} /></div>
            <div><label className="label">จำนวน (ต้น)</label><input type="number" min={1} max={2000} className="input" value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
            <div><label className="label">จำนวนหลักลำดับ</label><input type="number" min={1} max={6} className="input" value={digits} onChange={(e) => setDigits(+e.target.value)} /></div>
          </div>
        ) : (
          <div>
            <label className="label">พิมพ์เลขเสา คั่นด้วย , หรือเว้นวรรค หรือขึ้นบรรทัดใหม่</label>
            <textarea className="input min-h-28" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={"4201, 4202, 4203\n4301 4302"} />
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-1 text-sm text-slate-500">ตัวอย่างเลขเสาที่จะสร้าง ({numbers.length} ต้น)</div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
            {numbers.slice(0, 200).map((n) => <span key={n} className="chip">{n}</span>)}
            {numbers.length > 200 && <span className="text-sm text-slate-500">… และอีก {numbers.length - 200} ต้น</span>}
            {numbers.length === 0 && <span className="text-sm text-slate-400">ยังไม่มี</span>}
          </div>
        </div>
      </div>

      <button className="btn w-full py-3 text-lg" onClick={save} disabled={busy}>{busy ? "กำลังบันทึก..." : `บันทึกเสา ${numbers.length} ต้น`}</button>
      {msg && <p className="text-center text-sm">{msg}</p>}
    </div>
  );
}
