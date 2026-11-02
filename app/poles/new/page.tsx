"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";
import SizePicker from "@/components/SizePicker";

/**
 * วิธีกรอก: เรียงตามที่เห็นในกอง
 *   เริ่มจากชั้นล่างสุด (ชั้น 1) พิมพ์เลขเสาจาก "ซ้าย → ขวา" แล้วขึ้นชั้นถัดไปทีละชั้น
 *   พิมพ์ช่วงเลขได้ เช่น 3133-3140 (ขยายเป็น 3133,3134,...,3140)
 */
function parseNums(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = tok.match(/^(\d+)[-–~](\d+)$/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (b >= a && b - a <= 500) {
        for (let n = a; n <= b; n++) out.push(String(n).padStart(m[1].length, "0"));
        continue;
      }
    }
    out.push(tok);
  }
  return out;
}

type TierBox = { tier: number; text: string };

export default function NewPoles() {
  const [sites, setSites] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [siteId, setSiteId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [existing, setExisting] = useState<Record<number, number>>({}); // ชั้น → จำนวนเสาเดิม
  const [boxes, setBoxes] = useState<TierBox[]>([{ tier: 1, text: "" }]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg("❌ " + e.message)); }, []);

  // โหลดชั้นที่มีอยู่แล้วของกองนี้ เพื่อเสนอชั้นถัดไปให้
  const loadExisting = async (id: string, resetBoxes = true) => {
    if (!id) { setExisting({}); return; }
    try {
      const j = await api(`/api/poles?site=${id}`);
      const ex: Record<number, number> = {};
      for (const p of j.poles) if (p.tier) ex[p.tier] = (ex[p.tier] || 0) + 1;
      setExisting(ex);
      if (resetBoxes) {
        const max = Math.max(0, ...Object.keys(ex).map(Number));
        setBoxes([{ tier: max + 1, text: "" }]);
      }
    } catch (e: any) { setMsg("❌ " + e.message); }
  };
  useEffect(() => { loadExisting(siteId); /* eslint-disable-next-line */ }, [siteId]);

  const parsed = useMemo(() => boxes.map((b) => ({ tier: b.tier, nos: parseNums(b.text) })), [boxes]);
  const all = parsed.flatMap((t) => t.nos);
  const dups = all.filter((n, i) => all.indexOf(n) !== i);
  const total = all.length;

  const site = sites.find((s) => s.id === siteId);
  const size = sizes.find((s) => s.id === sizeId);
  const setBox = (i: number, patch: Partial<TierBox>) => setBoxes((l) => l.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  async function save() {
    setMsg("");
    if (!siteId || !sizeId) return setMsg("❌ กรุณาเลือกจุดกองและขนาดเสา");
    if (total === 0) return setMsg("❌ ยังไม่มีเลขเสา");
    if (dups.length) return setMsg(`❌ มีเลขซ้ำในที่กรอก: ${Array.from(new Set(dups)).join(", ")}`);
    setBusy(true);
    try {
      let photo: { id: string; url: string } | null = null;
      if (photos[0]) {
        setMsg("กำลังอัปโหลดรูปไป Google Drive...");
        photo = await uploadPhoto(photos[0], ["เสา", site.label, size.name], `กอง_${stamp().full}.jpg`);
      }
      const r = await api("/api/poles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, size_id: sizeId, photo_url: photo?.url, photo_id: photo?.id, tiers: parsed }),
      });
      setMsg(`✅ บันทึกเสา ${r.count} ต้นเรียบร้อย`);
      setPhotos([]);
      await loadExisting(siteId);
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
          {site && <p className="mt-1 text-xs text-slate-500">พิกัด: {site.lat != null ? `${site.lat}, ${site.lng}` : "ยังไม่ได้ระบุ"} · <Link className="text-brand underline" href={`/piles/${site.id}`}>ดูผังกองนี้</Link></p>}
          {sites.length === 0 && <p className="mt-1 text-sm text-orange-600">ยังไม่มีจุดกอง <Link className="underline" href="/sites">เพิ่มที่นี่</Link></p>}
          {siteId && Object.keys(existing).length > 0 && (
            <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              กองนี้มีอยู่แล้ว: {Object.entries(existing).map(([t, n]) => `ชั้น ${t} (${n} ต้น)`).join(" · ")}
              <br />พิมพ์เลขชั้นเดิมเพื่อ "เพิ่มต่อทางขวา" ของชั้นนั้น หรือชั้นใหม่เพื่อวางทับขึ้นไป
            </p>
          )}
        </div>
        <div>
          <label className="label">2) ขนาดเสา *</label>
          <SizePicker sizes={sizes} value={sizeId} onChange={setSizeId} onAdded={(z) => setSizes((l) => [...l, z])} />
        </div>
        <PhotoPicker label="3) รูปกองเสา (บีบเหลือ ≤ 1MB อัตโนมัติ)" photos={photos} onChange={setPhotos} single />
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">4) กรอกเลขเสาตามชั้น</h2>
          <p className="text-sm text-slate-500">เริ่มจาก <b>ชั้นล่างสุด</b> พิมพ์เลขเสาเรียง <b>ซ้าย → ขวา</b> (คั่นด้วยเว้นวรรค , หรือขึ้นบรรทัดใหม่ · ช่วงเลขพิมพ์ 3133-3140 ได้) แล้วขึ้นชั้นถัดไป</p>
        </div>

        {boxes.map((b, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium">ชั้นที่</span>
              <input type="number" min={1} className="input !w-20 !py-1.5" value={b.tier} onChange={(e) => setBox(i, { tier: +e.target.value })} />
              {existing[b.tier] ? <span className="chip">มีแล้ว {existing[b.tier]} ต้น → ต่อทางขวา</span> : null}
              <span className="ml-auto text-sm text-slate-500">{parseNums(b.text).length} ต้น</span>
              {boxes.length > 1 && <button type="button" className="text-red-600" onClick={() => setBoxes((l) => l.filter((_, k) => k !== i))}>ลบ</button>}
            </div>
            <textarea className="input min-h-20" value={b.text} onChange={(e) => setBox(i, { text: e.target.value })}
              placeholder={i === 0 ? "เช่น 3135 3136 3134 3133 3139 3140 (ซ้าย → ขวา)" : "เลขเสาซ้าย → ขวา"} />
          </div>
        ))}
        <button type="button" className="btn-ghost w-full" onClick={() => setBoxes((l) => [...l, { tier: Math.max(...l.map((x) => x.tier)) + 1, text: "" }])}>+ เพิ่มชั้นถัดไป (ขึ้นไปด้านบน)</button>

        {/* ตัวอย่างผัง: ชั้นบนอยู่บน ชั้นล่างอยู่ล่าง เหมือนกองจริง */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-2 text-sm text-slate-500">ตัวอย่างผังกอง ({total} ต้น) — ชั้นบนอยู่ด้านบน, อ่านซ้าย → ขวา</div>
          <div className="space-y-1.5">
            {[...parsed].filter((t) => t.nos.length).sort((a, b) => b.tier - a.tier).map((t) => (
              <div key={t.tier} className="flex items-start gap-2">
                <span className="w-12 shrink-0 pt-1 text-xs text-slate-400">ชั้น {t.tier}</span>
                <div className="flex flex-wrap gap-1">
                  {t.nos.map((n, k) => <span key={k} className={`rounded border px-1.5 py-0.5 text-sm ${dups.includes(n) ? "border-red-400 bg-red-50 text-red-600" : "border-yellow-400 bg-yellow-100"}`}>{n}</span>)}
                </div>
              </div>
            ))}
            {total === 0 && <span className="text-sm text-slate-400">ยังไม่มี</span>}
          </div>
          {dups.length > 0 && <p className="mt-2 text-sm text-red-600">มีเลขซ้ำ: {Array.from(new Set(dups)).join(", ")}</p>}
        </div>
      </div>

      <button className="btn w-full py-3 text-lg" onClick={save} disabled={busy}>{busy ? "กำลังบันทึก..." : `บันทึกเสา ${total} ต้น`}</button>
      {msg && <p className="text-center text-sm">{msg}</p>}
    </div>
  );
}
