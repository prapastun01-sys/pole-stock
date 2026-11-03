"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";
import { kindOf } from "@/lib/kinds";
import { useStatus } from "@/lib/status";

const REQUIRE_PHOTOS = false; // รูปก่อน/หลังขน ไม่บังคับ (ตั้งเป็น true ถ้าต้องการบังคับแนบ)

type Picked = { id: string; pole_no: string; tier: number | null; site_id: string; size_id: string; site_label: string; size_name: string };
type PilePhotos = { full: { id: string; url: string; at: string } | null; after: { photos: { id: string; url: string }[]; at: string; job: string } | null };

const emptyForm = { job_name: "", wbs: "", network: "", responsible: "", team: "" };
const dthai = (d: string) => new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });

export default function Withdraw() {
  const [sites, setSites] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [siteIds, setSiteIds] = useState<string[]>([]);  // กองที่ติ๊ก (หลายกองได้)
  const [sizeIds, setSizeIds] = useState<string[]>([]);  // ขนาดที่ติ๊ก (ไม่ติ๊ก = ทุกขนาด)
  const [poles, setPoles] = useState<any[]>([]);
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [photoMap, setPhotoMap] = useState<Record<string, PilePhotos>>({});
  const [f, setF] = useState(emptyForm);
  const [qty, setQty] = useState("");
  const [autoPending, setAutoPending] = useState(false);
  const [pasteRow, setPasteRow] = useState("");
  const [before, setBefore] = useState<Photo[]>([]);
  const [after, setAfter] = useState<Photo[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useStatus();
  const [done, setDone] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => { api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg("❌ " + e.message)); }, []);

  const loadPoles = () => {
    if (siteIds.length === 0) { setPoles([]); return; }
    const sz = sizeIds.length ? `&size=${sizeIds.join(",")}` : "";
    api(`/api/poles?site=${siteIds.join(",")}${sz}&status=available`).then((j) => setPoles(j.poles)).catch((e) => setMsg("❌ " + e.message));
  };
  useEffect(() => { loadPoles(); /* eslint-disable-next-line */ }, [siteIds, sizeIds]);

  // รูปกองเต็ม + รูปหลังขนล่าสุด ของกองที่ติ๊ก
  useEffect(() => {
    if (siteIds.length === 0) { setPhotoMap({}); return; }
    api(`/api/piles/photos?site=${siteIds.join(",")}`).then((j) => setPhotoMap(j.piles || {})).catch(() => {});
  }, [siteIds]);

  // ค้นหาเลขเสา (debounce)
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => api(`/api/poles?q=${encodeURIComponent(q.trim())}`).then((j) => setResults(j.poles)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  const toPicked = (p: any): Picked => ({
    id: p.id, pole_no: p.pole_no, tier: p.tier ?? null, site_id: p.site_id, size_id: p.size_id,
    site_label: p.sites?.label || sites.find((s) => s.id === p.site_id)?.label || "",
    size_name: p.pole_sizes?.name || sizes.find((s) => s.id === p.size_id)?.name || "",
  });

  const toggle = (p: any) => setPicked((old) => {
    const n = { ...old };
    if (n[p.id]) delete n[p.id]; else n[p.id] = toPicked(p);
    return n;
  });
  const remove = (id: string) => setPicked((old) => { const n = { ...old }; delete n[id]; return n; });
  const tick = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  function pickFromSearch(p: any) {
    setPicked((old) => ({ ...old, [p.id]: toPicked(p) }));
    setQ(""); setResults(null);
    if (!siteIds.includes(p.site_id)) setSiteIds((l) => [...l, p.site_id]);
    if (sizeIds.length && !sizeIds.includes(p.size_id)) setSizeIds((l) => [...l, p.size_id]);
  }

  // เลือกอัตโนมัติ: จากชั้นบนสุด ซ้าย → ขวา ไล่ตามลำดับกองที่ติ๊ก
  function autoPick(nStr = qty) {
    const n = parseInt(nStr, 10);
    if (!n || n < 1) return setMsg("❌ กรุณากรอกจำนวนเสาที่ต้องการเบิก");
    if (siteIds.length === 0) return setMsg("❌ ติ๊กเลือกกองก่อน แล้วกด \"เลือกอัตโนมัติ\"");
    const order = (p: any) => siteIds.indexOf(p.site_id);
    const sorted = [...poles].sort((a, b) =>
      order(a) - order(b) || (b.tier ?? -1) - (a.tier ?? -1) || (a.pos ?? 1e9) - (b.pos ?? 1e9) || String(a.pole_no).localeCompare(String(b.pole_no)));
    const take = sorted.slice(0, n);
    const next: Record<string, Picked> = {};
    take.forEach((p) => { next[p.id] = toPicked(p); });
    setPicked(next);
    setMsg(take.length < n ? `⚠️ กองที่เลือกมีเสาคงเหลือเพียง ${take.length} ต้น (ขอ ${n}) เลือกให้ทั้งหมดแล้ว` : `✅ เลือกเสาอัตโนมัติ ${take.length} ต้น (จากชั้นบนสุด ซ้าย → ขวา)`);
  }

  // วางข้อมูลจาก Excel/Sheets: WBS ⇥ โครงข่าย ⇥ ชื่องาน ⇥ ทีมงาน ⇥ ผู้รับผิดชอบ [⇥ จำนวนเสา]
  function applyPaste(text: string) {
    setPasteRow(text);
    if (!text.includes("\t")) return;
    const c = text.replace(/[\r\n]+$/, "").split("\t").map((x) => x.trim());
    if (c.length < 3) return;
    let job = c[2] || "";
    let n = c[5] && /^\d+$/.test(c[5]) ? c[5] : "";
    if (!n) { // จำนวนเสาต่อท้ายชื่องาน เช่น "... PO 6"
      const m = job.match(/\s+(\d{1,4})(?:\s*ต้น)?$/);
      if (m) { n = m[1]; job = job.slice(0, m.index).trim(); }
    }
    setF({ wbs: c[0] || "", network: c[1] || "", job_name: job, team: c[3] || "", responsible: c[4] || "" });
    if (n) {
      setQty(n);
      setAutoPending(true);
      setMsg(`📋 วางข้อมูลแล้ว · จำนวนเสา ${n} ต้น`);
    } else setMsg("📋 วางข้อมูลแล้ว");
  }

  // ถ้าวางข้อมูลที่มีจำนวนเสา และเลือกกองไว้แล้ว → เลือกเสาให้เลย
  useEffect(() => {
    if (!autoPending) return;
    if (siteIds.length === 0) { setAutoPending(false); setMsg("📋 วางข้อมูลแล้ว · ติ๊กเลือกกองแล้วกด \"เลือกอัตโนมัติ\""); return; }
    if (poles.length > 0) { autoPick(qty); setAutoPending(false); }
    // eslint-disable-next-line
  }, [autoPending, poles]);

  // กลุ่มแสดงผล: กอง → ขนาด → ชั้น (ชั้นบนอยู่บน)
  const groupsView = useMemo(() => {
    const m = new Map<string, { key: string; site_id: string; site: string; size: string; items: any[] }>();
    for (const p of poles) {
      const k = `${p.site_id}|${p.size_id}`;
      if (!m.has(k)) m.set(k, { key: k, site_id: p.site_id, site: p.sites?.label, size: p.pole_sizes?.name, items: [] });
      m.get(k)!.items.push(p);
    }
    const arr = Array.from(m.values()).sort((a, b) => siteIds.indexOf(a.site_id) - siteIds.indexOf(b.site_id) || a.size.localeCompare(b.size));
    arr.forEach((g) => g.items.sort((a, b) => (b.tier ?? -1) - (a.tier ?? -1) || (a.pos ?? 1e9) - (b.pos ?? 1e9)));
    return arr;
  }, [poles, siteIds]);

  const toggleGroup = (items: any[]) => setPicked((old) => {
    const n = { ...old };
    const all = items.every((p) => n[p.id]);
    items.forEach((p) => { if (all) delete n[p.id]; else n[p.id] = toPicked(p); });
    return n;
  });

  const list = Object.values(picked);
  const cart = useMemo(() => {
    const m = new Map<string, { site_label: string; size_name: string; items: Picked[] }>();
    for (const p of list) {
      const k = `${p.site_id}|${p.size_id}`;
      if (!m.has(k)) m.set(k, { site_label: p.site_label, size_name: p.size_name, items: [] });
      m.get(k)!.items.push(p);
    }
    return Array.from(m.values());
  }, [picked]); // eslint-disable-line

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (list.length === 0) return setMsg("❌ กรุณาเลือกเลขเสาอย่างน้อย 1 ต้น");
    if (REQUIRE_PHOTOS && (before.length === 0 || after.length === 0)) return setMsg("❌ กรุณาแนบรูปก่อนขนและหลังขนอย่างน้อยอย่างละ 1 รูป");
    setBusy(true);
    try {
      const st = stamp();
      const base = ["เบิกเสา", st.month, `${st.full}_${f.job_name}`];
      const up = async (arr: Photo[], sub: string, label: string) => {
        const out = [];
        for (let i = 0; i < arr.length; i++) {
          setMsg(`กำลังอัปโหลดรูป${label} ${i + 1}/${arr.length} ...`);
          out.push(await uploadPhoto(arr[i], [...base, sub], `${sub}_${i + 1}.jpg`));
        }
        return out;
      };
      const before_photos = await up(before, "ก่อนขนเสา", "ก่อนขน");
      const after_photos = await up(after, "หลังขนเสา", "หลังขน");

      setMsg("กำลังบันทึกใบเบิก...");
      const r = await api("/api/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pole_ids: list.map((p) => p.id), ...f, before_photos, after_photos }),
      });
      setDoneId(r.id);
      setMsg("✅ บันทึกใบเบิกเรียบร้อย");
      setDone(`เบิกเสา ${list.length} ต้น จาก ${cart.length} กลุ่ม สำเร็จ${r.notified ? " และแจ้งเตือน Telegram แล้ว" : " (แต่แจ้งเตือน Telegram ไม่สำเร็จ)"}`);
      setPicked({}); setBefore([]); setAfter([]); setF(emptyForm); setQty(""); setPasteRow("");
      loadPoles();
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  if (done) return (
    <div className="card mt-8 space-y-4 text-center">
      <div className="text-5xl">✅</div>
      <p className="font-semibold">{done}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {doneId && <a className="btn" target="_blank" rel="noreferrer" href={`/print/${doneId}?auto=1`}>📄 เปิดใบเบิก / บันทึกเป็น PDF</a>}
        <button className="btn-ghost" onClick={() => { setDone(null); setDoneId(null); setMsg(""); }}>เบิกเพิ่ม</button>
        <a className="btn-ghost" href="/history">ดูประวัติ</a>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold">เบิกเสา</h1>

      <section className="card space-y-2">
        <label className="label">📋 วางข้อมูลงานจาก Excel / Google Sheets (กรอกให้อัตโนมัติ)</label>
        <textarea className="input min-h-16 font-mono text-sm" value={pasteRow} onChange={(e) => applyPaste(e.target.value)}
          placeholder="คัดลอก 1 แถวจากตารางมาวาง: WBS ⇥ โครงข่าย ⇥ ชื่องาน ⇥ ทีมงาน ⇥ ผู้รับผิดชอบ ⇥ (จำนวนเสา)" />
        <p className="text-xs text-slate-500">ลำดับคอลัมน์: <b>WBS · โครงข่าย · ชื่องาน · ทีมงาน · ผู้รับผิดชอบ</b> และถ้ามี <b>จำนวนเสา</b> (คอลัมน์ที่ 6 หรือเลขต่อท้ายชื่องาน) ระบบจะเลือกเลขเสาให้อัตโนมัติจากชั้นบนสุด ซ้ายไปขวา</p>
      </section>

      <section className="card">
        <label className="label">🔎 ค้นหาเลขเสา (รู้ว่าอยู่กองไหน)</label>
        <input className="input" inputMode="numeric" placeholder="พิมพ์เลขเสา เช่น 3135" value={q} onChange={(e) => setQ(e.target.value)} />
        {results && (
          <ul className="mt-2 divide-y rounded-xl border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 p-2.5">
                <div>
                  <b>{p.pole_no}</b> <span className="chip ml-1">{p.status === "available" ? "พร้อมใช้" : "เบิกแล้ว"}</span>
                  <div className="text-sm text-slate-500">📍 {p.sites?.label} · {p.pole_sizes?.name}{p.tier ? ` · ชั้น ${p.tier} ลำดับ ${p.pos ?? "-"}` : ""}</div>
                </div>
                {p.status === "available"
                  ? picked[p.id]
                    ? <span className="text-sm text-emerald-600">✓ เลือกแล้ว</span>
                    : <button type="button" className="btn !py-1.5 text-sm" onClick={() => pickFromSearch(p)}>เบิกเสานี้</button>
                  : <span className="text-sm text-slate-400">—</span>}
              </li>
            ))}
            {results.length === 0 && <li className="p-3 text-slate-500">ไม่พบเลขเสานี้</li>}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <label className="label">1) ติ๊กเลือกกอง <span className="text-slate-400">(ติ๊กตั้งแต่ 2 กองขึ้นไปได้)</span></label>
          <div className="grid gap-2 sm:grid-cols-2">
            {sites.map((s) => (
              <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 ${siteIds.includes(s.id) ? "border-brand bg-brand-light font-semibold" : "border-slate-200"}`}>
                <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={siteIds.includes(s.id)} onChange={() => tick(siteIds, setSiteIds, s.id)} />
                {s.label}
              </label>
            ))}
            {sites.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีจุดกอง</p>}
          </div>
        </div>
        <div>
          <label className="label">2) ขนาดเสา <span className="text-slate-400">(ไม่ติ๊ก = ทุกขนาด)</span></label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((z) => (
              <label key={z.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${sizeIds.includes(z.id) ? "border-brand bg-brand-light font-semibold" : "border-slate-200"}`}>
                <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={sizeIds.includes(z.id)} onChange={() => tick(sizeIds, setSizeIds, z.id)} />
                {z.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
          <div>
            <label className="label">จำนวนเสาที่เบิก (ต้น)</label>
            <input className="input !w-32" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="เช่น 6" />
          </div>
          <button type="button" className="btn" onClick={() => autoPick()}>⚡ เลือกอัตโนมัติ</button>
          <p className="basis-full text-xs text-slate-500">เลือกจากชั้นบนสุด เรียงซ้าย → ขวา ไล่ตามลำดับกองที่ติ๊ก (จะแทนที่รายการที่เลือกไว้)</p>
        </div>
      </section>

      {siteIds.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">รูปกองที่เลือก</h2>
          {siteIds.map((id) => {
            const s = sites.find((x) => x.id === id);
            const ph = photoMap[id];
            return (
              <div key={id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-medium">📍 {s?.label}</div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">รูปกองเต็ม {ph?.full ? `(${dthai(ph.full.at)})` : ""}</div>
                    {ph?.full
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <a href={`https://drive.google.com/file/d/${ph.full.id}/view`} target="_blank" rel="noreferrer"><img src={ph.full.url} alt="รูปกองเต็ม" className="h-24 w-32 rounded-lg border object-cover" /></a>
                      : <div className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">ไม่มีรูป</div>}
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-slate-500">รูปหลังขนล่าสุด {ph?.after ? `(${dthai(ph.after.at)} · ${ph.after.job})` : ""}</div>
                    <div className="flex gap-1.5">
                      {ph?.after
                        // eslint-disable-next-line @next/next/no-img-element
                        ? ph.after.photos.slice(0, 3).map((x) => <a key={x.id} href={`https://drive.google.com/file/d/${x.id}/view`} target="_blank" rel="noreferrer"><img src={x.url} alt="หลังขน" className="h-24 w-32 rounded-lg border object-cover" /></a>)
                        : <div className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">ยังไม่เคยเบิก</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card space-y-3">
        <span className="label !mb-0">3) ติ๊กเลขเสา <span className="text-slate-400">(ชั้นบนอยู่บน · ซ้าย → ขวา)</span></span>
        {siteIds.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">ติ๊กเลือกกองก่อน</p>
          : groupsView.length === 0 ? <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-700">ไม่มีเสาคงเหลือในกอง/ขนาดที่เลือก</p>
          : groupsView.map((g) => (
            <div key={g.key} className="rounded-xl border border-slate-200 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">📍 {g.site} · {g.size} <span className="text-slate-400">(เลือก {g.items.filter((p) => picked[p.id]).length}/{g.items.length})</span></span>
                <button type="button" className="text-sm text-brand underline" onClick={() => toggleGroup(g.items)}>{g.items.every((p) => picked[p.id]) ? "ล้างกลุ่มนี้" : "เลือกทั้งกลุ่ม"}</button>
              </div>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-auto sm:grid-cols-4 md:grid-cols-6">
                {g.items.map((p, i) => (
                  <Fragment key={p.id}>
                    {(i === 0 || g.items[i - 1].tier !== p.tier) && <div className="col-span-full text-xs font-semibold text-slate-500">{p.tier ? `ชั้น ${p.tier}` : "ไม่ระบุชั้น"}</div>}
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm ${picked[p.id] ? "border-brand bg-brand-light font-semibold" : "border-slate-200"}`}>
                      <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={!!picked[p.id]} onChange={() => toggle(p)} />
                      <span>{p.pole_no}{p.kind && p.kind !== "new" && <span className={`ml-1 rounded px-1 text-[10px] font-normal ${kindOf(p.kind).cls}`}>{kindOf(p.kind).short}</span>}</span>
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">รายการที่จะเบิกทั้งหมด <span className="text-brand">{list.length} ต้น</span> · {cart.length} กลุ่ม</h2>
          {list.length > 0 && <button type="button" className="text-sm text-red-600" onClick={() => setPicked({})}>ล้างทั้งหมด</button>}
        </div>
        {cart.map((g) => (
          <div key={g.site_label + g.size_name} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-sm font-medium">📍 {g.site_label} · {g.size_name} <span className="text-slate-400">({g.items.length} ต้น)</span></div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => (
                <span key={p.id} className="chip gap-1.5">{p.pole_no}
                  <button type="button" aria-label="เอาออก" className="text-brand-dark/60 hover:text-red-600" onClick={() => remove(p.id)}>×</button>
                </span>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">ยังไม่ได้เลือกเสา</p>}
      </section>

      <section className="card space-y-3">
        <div><label className="label">4) ชื่องาน *</label><input className="input" required value={f.job_name} onChange={(e) => setF({ ...f, job_name: e.target.value })} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label">5) WBS / ใบสั่ง</label><input className="input" value={f.wbs} onChange={(e) => setF({ ...f, wbs: e.target.value })} /></div>
          <div><label className="label">6) โครงข่าย</label><input className="input" value={f.network} onChange={(e) => setF({ ...f, network: e.target.value })} /></div>
          <div><label className="label">7) ผู้รับผิดชอบ *</label><input className="input" required value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })} /></div>
          <div><label className="label">8) ทีมงาน</label><input className="input" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} /></div>
        </div>
      </section>

      <section className="card space-y-4">
        <PhotoPicker label="9) รูปก่อนขนเสา (หลายรูปได้ / บีบ ≤ 1MB อัตโนมัติ)" photos={before} onChange={setBefore} />
        <PhotoPicker label="10) รูปหลังขนเสา (หลายรูปได้ / บีบ ≤ 1MB อัตโนมัติ)" photos={after} onChange={setAfter} />
      </section>

      <button className="btn w-full py-3 text-lg" disabled={busy}>{busy ? "กำลังดำเนินการ..." : `ยืนยันเบิกเสา ${list.length} ต้น`}</button>
      {msg && <p className="text-center text-sm">{msg}</p>}
    </form>
  );
}
