"use client";
import { Fragment, useEffect, useState } from "react";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";

const REQUIRE_PHOTOS = true; // เปลี่ยนเป็น false ถ้าไม่บังคับแนบรูปก่อน/หลัง

export default function Withdraw() {
  const [sites, setSites] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [siteId, setSiteId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [poles, setPoles] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [f, setF] = useState({ job_name: "", wbs: "", network: "", responsible: "", team: "" });
  const [before, setBefore] = useState<Photo[]>([]);
  const [after, setAfter] = useState<Photo[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg("❌ " + e.message)); }, []);

  const loadPoles = (site = siteId, size = sizeId, keep?: string) => {
    if (!site || !size) { setPoles([]); return; }
    api(`/api/poles?site=${site}&size=${size}&status=available`).then((j) => {
      setPoles(j.poles);
      setSel((old) => new Set([...old].filter((id) => j.poles.some((p: any) => p.id === id)).concat(keep ? [keep] : [])));
    }).catch((e) => setMsg("❌ " + e.message));
  };
  useEffect(() => { setSel(new Set()); loadPoles(); /* eslint-disable-next-line */ }, [siteId, sizeId]);

  // ค้นหาเลขเสา (debounce)
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => api(`/api/poles?q=${encodeURIComponent(q.trim())}`).then((j) => setResults(j.poles)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  function pickFromSearch(p: any) {
    if (p.site_id === siteId && p.size_id === sizeId) {
      setSel((s) => new Set(s).add(p.id));
    } else {
      setSiteId(p.site_id); setSizeId(p.size_id);
      // รอให้ effect โหลดรายการใหม่ แล้วค่อยติ๊กเสาต้นนี้
      setTimeout(() => loadPoles(p.site_id, p.size_id, p.id), 50);
    }
    setQ(""); setResults(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = poles.length > 0 && sel.size === poles.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (sel.size === 0) return setMsg("❌ กรุณาเลือกเลขเสาอย่างน้อย 1 ต้น");
    if (REQUIRE_PHOTOS && (before.length === 0 || after.length === 0)) return setMsg("❌ กรุณาแนบรูปก่อนขนและหลังขนอย่างน้อยอย่างละ 1 รูป");
    setBusy(true);
    try {
      const site = sites.find((s) => s.id === siteId);
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
        body: JSON.stringify({ site_id: siteId, size_id: sizeId, pole_ids: [...sel], ...f, before_photos, after_photos }),
      });
      setDone(`เบิกเสา ${sel.size} ต้น จาก ${site?.label} สำเร็จ${r.notified ? " และแจ้งเตือน Telegram แล้ว" : " (แต่แจ้งเตือน Telegram ไม่สำเร็จ)"}`);
      setSel(new Set()); setBefore([]); setAfter([]); setF({ job_name: "", wbs: "", network: "", responsible: "", team: "" });
      loadPoles();
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  if (done) return (
    <div className="card mt-8 space-y-4 text-center">
      <div className="text-5xl">✅</div>
      <p className="font-semibold">{done}</p>
      <div className="flex justify-center gap-2">
        <button className="btn" onClick={() => setDone(null)}>เบิกเพิ่ม</button>
        <a className="btn-ghost" href="/history">ดูประวัติ</a>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold">เบิกเสา</h1>

      <section className="card">
        <label className="label">🔎 ค้นหาเลขเสา (รู้ว่าอยู่กองไหน)</label>
        <input className="input" inputMode="numeric" placeholder="พิมพ์เลขเสา เช่น 4201" value={q} onChange={(e) => setQ(e.target.value)} />
        {results && (
          <ul className="mt-2 divide-y rounded-xl border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 p-2.5">
                <div>
                  <b>{p.pole_no}</b> <span className="chip ml-1">{p.status === "available" ? "พร้อมใช้" : "เบิกแล้ว"}</span>
                  <div className="text-sm text-slate-500">📍 {p.sites?.label} · {p.pole_sizes?.name}{p.tier ? ` · ชั้น ${p.tier} ลำดับ ${p.pos ?? "-"}` : ""}</div>
                </div>
                {p.status === "available"
                  ? <button type="button" className="btn !py-1.5 text-sm" onClick={() => pickFromSearch(p)}>เบิกเสานี้</button>
                  : <span className="text-sm text-slate-400">—</span>}
              </li>
            ))}
            {results.length === 0 && <li className="p-3 text-slate-500">ไม่พบเลขเสานี้</li>}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <label className="label">1) จุดกองหมอน *</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            <option value="">— เลือกจุดกอง —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">2) ขนาดเสา *</label>
          <select className="input" value={sizeId} onChange={(e) => setSizeId(e.target.value)} required>
            <option value="">— เลือกขนาด —</option>
            {sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label !mb-0">3) เลือกเลขเสา * <span className="text-slate-400">(เลือกแล้ว {sel.size} / คงเหลือ {poles.length})</span></span>
            {poles.length > 0 && <button type="button" className="text-sm text-brand underline" onClick={() => setSel(allSelected ? new Set() : new Set(poles.map((p) => p.id)))}>{allSelected ? "ล้าง" : "เลือกทั้งหมด"}</button>}
          </div>
          {!siteId || !sizeId ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">เลือกจุดกองและขนาดเสาก่อน</p>
            : poles.length === 0 ? <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-700">ไม่มีเสาคงเหลือในกองนี้</p>
            : (
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-auto rounded-xl border p-2 sm:grid-cols-4 md:grid-cols-6">
                {poles.map((p, i) => (
                  <Fragment key={p.id}>
                  {(i === 0 || poles[i - 1].tier !== p.tier) && <div className="col-span-full text-xs font-semibold text-slate-500">{p.tier ? `ชั้น ${p.tier}` : "ไม่ระบุชั้น"}</div>}
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm ${sel.has(p.id) ? "border-brand bg-brand-light font-semibold" : "border-slate-200"}`}>
                    <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                    {p.pole_no}
                  </label>
                  </Fragment>
                ))}
              </div>
            )}
        </div>
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

      <button className="btn w-full py-3 text-lg" disabled={busy}>{busy ? "กำลังดำเนินการ..." : `ยืนยันเบิกเสา ${sel.size} ต้น`}</button>
      {msg && <p className="text-center text-sm">{msg}</p>}
    </form>
  );
}
