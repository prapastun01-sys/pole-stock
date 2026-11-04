"use client";
import SitePicker from "@/components/SitePicker";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";
import SizePicker from "@/components/SizePicker";
import { KINDS } from "@/lib/kinds";
import { useStatus } from "@/lib/status";

/**
 * วิธีกรอก (2 โหมด)
 *  - วางทั้งกอง: 1 บรรทัด = 1 ชั้น เรียงตามภาพกอง (ชั้นบนสุดบรรทัดแรก → ชั้นล่างสุดบรรทัดสุดท้าย) แต่ละบรรทัดซ้าย → ขวา
 *  - กรอกทีละชั้น: เริ่มชั้น 1 (ล่างสุด) ซ้าย → ขวา แล้วขึ้นชั้นถัดไป
 *  พิมพ์ช่วงเลขได้ เช่น 3133-3140
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
  const [kind, setKind] = useState("new");
  const [existing, setExisting] = useState<Record<number, number>>({}); // ชั้น → จำนวนเสาเดิม
  const [mode, setMode] = useState<"paste" | "tier">("paste");
  const [pasteText, setPasteText] = useState("");
  const [startTier, setStartTier] = useState(1);
  const [boxes, setBoxes] = useState<TierBox[]>([{ tier: 1, text: "" }]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useStatus();

  useEffect(() => { api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg("❌ " + e.message)); }, []);

  // โหลดชั้นที่มีอยู่แล้วของกองนี้ เพื่อเสนอชั้นถัดไปให้
  const loadExisting = async (id: string) => {
    if (!id) { setExisting({}); return; }
    try {
      const j = await api(`/api/poles?site=${id}`);
      const ex: Record<number, number> = {};
      for (const p of j.poles) if (p.tier) ex[p.tier] = (ex[p.tier] || 0) + 1;
      setExisting(ex);
      const max = Math.max(0, ...Object.keys(ex).map(Number));
      setBoxes([{ tier: max + 1, text: "" }]);
      setStartTier(max + 1);
    } catch (e: any) { setMsg("❌ " + e.message); }
  };
  useEffect(() => { loadExisting(siteId); /* eslint-disable-next-line */ }, [siteId]);

  const parsed = useMemo(() => {
    if (mode === "tier") return boxes.map((b) => ({ tier: b.tier, nos: parseNums(b.text) }));
    // บรรทัดล่างสุด = ชั้นล่างสุด (startTier) ขึ้นไปเรื่อยๆ
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).reverse();
    return lines.map((l, i) => ({ tier: startTier + i, nos: parseNums(l) }));
  }, [mode, boxes, pasteText, startTier]);

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
      setMsg("กำลังบันทึกเสา...");
      const r = await api("/api/poles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, size_id: sizeId, kind, photo_url: photo?.url, photo_id: photo?.id, tiers: parsed }),
      });
      setMsg(`✅ บันทึกเสา ${r.count} ต้นเรียบร้อย`);
      setPhotos([]); setPasteText("");
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
          <SitePicker sites={sites} value={siteId} onChange={setSiteId} />
          {site && <p className="mt-1 text-xs text-slate-500">พิกัด: {site.lat != null ? `${site.lat}, ${site.lng}` : "ยังไม่ได้ระบุ"} · <Link className="text-brand underline" href={`/piles/${site.id}`}>ดูประวัติกองนี้</Link></p>}
          {sites.length === 0 && <p className="mt-1 text-sm text-orange-600">ยังไม่มีจุดกอง <Link className="underline" href="/sites">เพิ่มที่นี่</Link></p>}
          {siteId && Object.keys(existing).length > 0 && (
            <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              กองนี้มีอยู่แล้ว: {Object.entries(existing).map(([t, n]) => `ชั้น ${t} (${n} ต้น)`).join(" · ")}
              <br />ถ้าชั้นล่างสุดที่ใส่ตรงกับชั้นเดิม ระบบจะเพิ่มต่อทางขวาของชั้นนั้น
            </p>
          )}
        </div>
        <div>
          <label className="label">2) ขนาดเสา *</label>
          <SizePicker sizes={sizes} value={sizeId} onChange={setSizeId} onAdded={(z) => setSizes((l) => [...l, z])} />
        </div>
        <PhotoPicker label="3) รูปกองเสา (บีบเหลือ ≤ 1MB อัตโนมัติ)" photos={photos} onChange={setPhotos} single />
        <div>
          <label className="label">ประเภทเสา (หัวรายการ)</label>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k.v} type="button" onClick={() => setKind(k.v)}
                className={`rounded-xl border px-3 py-2 text-sm ${kind === k.v ? "border-brand bg-brand font-semibold text-white" : "border-slate-300 bg-white hover:border-brand"}`}>
                {kind === k.v ? "✓ " : ""}{k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">4) กรอกเลขเสาตามชั้น</h2>
          <div className="flex overflow-hidden rounded-lg border text-sm">
            <button type="button" className={`px-3 py-1 ${mode === "paste" ? "bg-brand text-white" : ""}`} onClick={() => setMode("paste")}>วางทั้งกอง</button>
            <button type="button" className={`px-3 py-1 ${mode === "tier" ? "bg-brand text-white" : ""}`} onClick={() => setMode("tier")}>กรอกทีละชั้น</button>
          </div>
        </div>

        {mode === "paste" ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              พิมพ์/วางเลขเสาตามที่เห็นในภาพกอง <b>1 บรรทัด = 1 ชั้น</b> เรียงจาก <b>ชั้นบนสุดอยู่บรรทัดแรก</b> ลงไปถึง <b>ชั้นล่างสุดอยู่บรรทัดสุดท้าย</b> แต่ละบรรทัดเรียงซ้ายไปขวา
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">บรรทัดล่างสุดคือชั้นที่</span>
              <input type="number" min={1} className="input !w-20 !py-1.5" value={startTier} onChange={(e) => setStartTier(Math.max(1, +e.target.value || 1))} />
              <span className="ml-auto text-sm text-slate-500">{parsed.length} ชั้น · {total} ต้น</span>
            </div>
            <textarea className="input min-h-40 font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder={"1788 1787 1797 1796 727 744   (ชั้นบนสุด)\n710 712 713 714 709 711\n684 683 682 694 746 745   (ชั้นล่างสุด = ชั้น 1)"} />
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">เริ่มจาก <b>ชั้นล่างสุด</b> พิมพ์เลขเสาเรียงซ้ายไปขวา (คั่นด้วยเว้นวรรค , หรือขึ้นบรรทัดใหม่ · ช่วงเลขพิมพ์ 3133-3140 ได้) แล้วขึ้นชั้นถัดไป</p>
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
          </>
        )}

        {/* ตัวอย่างผัง: ชั้นบนอยู่บน ชั้นล่างอยู่ล่าง เหมือนกองจริง */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-2 text-sm text-slate-500">ตัวอย่างผังกอง ({total} ต้น) — ชั้นบนอยู่ด้านบน, อ่านซ้ายไปขวา</div>
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
