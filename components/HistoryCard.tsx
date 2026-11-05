"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, stamp, uploadPhoto, Photo } from "@/lib/client";
import PhotoPicker from "@/components/PhotoPicker";
import { useStatus, notify } from "@/lib/status";
import ItemsPicker from "@/components/ItemsPicker";
import type { Item } from "@/lib/items";

type P = { id: string; url: string };

async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } finally { document.body.removeChild(t); }
  }
  notify(`✅ คัดลอก${what}แล้ว`);
}

export default function HistoryCard({ w, groups, when, accessories = [] }: { w: any; groups: { site: string; size: string; nos: string[] }[]; when: string; accessories?: any[] }) {
  const [items, setItems] = useState<Item[]>(Array.isArray(w.items) ? w.items : []);
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useStatus();
  const [doneOpen, setDoneOpen] = useState(false);
  const [cutNo, setCutNo] = useState(w.cut_no || "");

  async function patchDone(body: any) {
    setBusy(true); setMsg("กำลังบันทึกสถานะงาน...");
    try {
      await api(`/api/withdrawals/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setDoneOpen(false);
      router.refresh();
      setMsg("✅ บันทึกสถานะงานแล้ว");
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }
  const [f, setF] = useState({ job_name: w.job_name || "", wbs: w.wbs || "", network: w.network || "", responsible: w.responsible || "", team: w.team || "" });
  const [before, setBefore] = useState<P[]>(w.before_photos || []);
  const [after, setAfter] = useState<P[]>(w.after_photos || []);
  const [newBefore, setNewBefore] = useState<Photo[]>([]);
  const [newAfter, setNewAfter] = useState<Photo[]>([]);
  const mdOrig = w.move_date || new Date(w.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [moveDate, setMoveDate] = useState<string>(mdOrig);
  const [acc, setAcc] = useState<P[]>(w.acc_photos || []);
  const [newAcc, setNewAcc] = useState<Photo[]>([]);

  function cancel() {
    setEdit(false); setMsg("");
    setF({ job_name: w.job_name || "", wbs: w.wbs || "", network: w.network || "", responsible: w.responsible || "", team: w.team || "" });
    setBefore(w.before_photos || []); setAfter(w.after_photos || []); setNewBefore([]); setNewAfter([]); setAcc(w.acc_photos || []); setNewAcc([]); setMoveDate(mdOrig);
    setItems(Array.isArray(w.items) ? w.items : []);
  }

  async function save() {
    if (!f.job_name.trim() || !f.responsible.trim()) return setMsg("❌ กรุณากรอกชื่องานและผู้รับผิดชอบ");
    setBusy(true); setMsg("กำลังบันทึก...");
    try {
      // เก็บรูปใหม่ในโฟลเดอร์ของวันที่เบิก (ตามวันที่ของใบเบิก)
      const ymd = new Date(w.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
      const base = ["เบิกเสา", ymd.slice(0, 7), `${ymd.replace(/-/g, "")}_${f.job_name.trim()}`];
      const up = async (arr: Photo[], sub: string, label: string) => {
        const out: P[] = [];
        for (let i = 0; i < arr.length; i++) {
          setMsg(`กำลังอัปโหลดรูป${label} ${i + 1}/${arr.length} ...`);
          out.push(await uploadPhoto(arr[i], [...base, sub], `${sub}_เพิ่ม_${stamp().full}_${i + 1}.jpg`));
        }
        return out;
      };
      const addB = await up(newBefore, "ก่อนขนเสา", "ก่อนขน");
      const addA = await up(newAfter, "หลังขนเสา", "หลังขน");
      const addC = await up(newAcc, "หลังขนอุปกรณ์เสริม", "หลังขนอุปกรณ์เสริม");
      setMsg("กำลังบันทึก...");
      await api(`/api/withdrawals/${w.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, before_photos: [...before, ...addB], after_photos: [...after, ...addA], acc_photos: [...acc, ...addC], items, move_date: moveDate }),
      });
      setEdit(false); setNewBefore([]); setNewAfter([]); setNewAcc([]);
      router.refresh();
      setMsg("✅ บันทึกการแก้ไขแล้ว");
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  async function remove() {
    const n = groups.reduce((a, g) => a + g.nos.length, 0);
    if (!confirm(`ลบใบเบิก "${w.job_name}" ?\n\n${n ? `เสา ${n} ต้นในใบนี้จะกลับไปเป็น "คงเหลือ" ในกองเดิม` : "ใบนี้เบิกเฉพาะอุปกรณ์เสริม"}\n(รูปใน Google Drive จะไม่ถูกลบ) การลบย้อนกลับไม่ได้`)) return;
    setBusy(true); setMsg("กำลังลบใบเบิกและคืนเสาเข้ากอง...");
    try {
      await api(`/api/withdrawals/${w.id}`, { method: "DELETE" });
      router.refresh();
      setMsg(`✅ ลบใบเบิกแล้ว คืนเสา ${n} ต้นเข้ากอง`);
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  const total = groups.reduce((a, g) => a + g.nos.length, 0);

  return (
    <article className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{w.job_name}</h2>
          <div className="text-sm text-slate-500">{when}</div>
        </div>
        <div className="flex items-center gap-2">
          {w.done_at && <span className="chip !bg-emerald-100 !text-emerald-700">✅ งานเสร็จ</span>}
          <span className="chip">{total > 0 ? `${total} ต้น · ${groups.length} กอง` : "เฉพาะอุปกรณ์เสริม"}</span>
          {!edit && (
            <>
              <a className="btn-ghost !py-1 text-sm" href={`/print/${w.id}`} target="_blank" rel="noreferrer">📄 ใบเบิก PDF</a>
              <button className="btn-ghost !py-1 text-sm" onClick={() => setEdit(true)}>✏️ แก้ไข / เพิ่มรูป</button>
              <button className="btn-ghost !py-1 text-sm !text-red-600" disabled={busy} onClick={remove}>🗑 ลบ</button>
            </>
          )}
        </div>
      </div>

      {!edit ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
          <Item k="WBS/ใบสั่ง" v={w.wbs} /><Item k="โครงข่าย" v={w.network} />
          <Item k="วันขนเสา" v={new Date(mdOrig + "T00:00:00").toLocaleDateString("th-TH", { dateStyle: "medium" })} /><Item k="ผู้รับผิดชอบ" v={w.responsible} /><Item k="ทีมงาน" v={w.team} />
        </dl>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ชื่องาน *" v={f.job_name} on={(v) => setF({ ...f, job_name: v })} />
          <Field label="ผู้รับผิดชอบ *" v={f.responsible} on={(v) => setF({ ...f, responsible: v })} />
          <Field label="WBS / ใบสั่ง" v={f.wbs} on={(v) => setF({ ...f, wbs: v })} />
          <Field label="โครงข่าย" v={f.network} on={(v) => setF({ ...f, network: v })} />
          <Field label="ทีมงาน" v={f.team} on={(v) => setF({ ...f, team: v })} />
          <div><label className="label">วันขนเสา</label><input className="input" type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} /></div>
        </div>
      )}

      {/* สถานะงานเสร็จ + เลขใบตัดงาน */}
      <div className={`rounded-xl border p-3 text-sm ${w.done_at ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
        {w.done_at ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-emerald-700">✅ งานเสร็จ</span>
            <span className="text-slate-500">{new Date(w.done_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" })}</span>
            <span>· เลขใบตัดงาน: <b>{w.cut_no}</b></span>
            <button type="button" className="ml-auto text-brand underline" onClick={() => setDoneOpen(!doneOpen)}>แก้เลขใบตัดงาน</button>
            <button type="button" className="text-red-600 underline" disabled={busy} onClick={() => { if (confirm("ยกเลิกสถานะงานเสร็จ?")) patchDone({ done: false }); }}>ยกเลิกสถานะ</button>
          </div>
        ) : !doneOpen ? (
          <button type="button" className="btn !py-1.5" onClick={() => setDoneOpen(true)}>✅ งานเสร็จ</button>
        ) : null}
        {doneOpen && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="grow">
              <label className="label">เลขใบตัดงาน *</label>
              <input className="input" autoFocus value={cutNo} onChange={(e) => setCutNo(e.target.value)} placeholder="กรอกเลขใบตัดงาน" />
            </div>
            <button type="button" className="btn" disabled={busy || !cutNo.trim()} onClick={() => patchDone(w.done_at ? { cut_no: cutNo } : { done: true, cut_no: cutNo })}>{w.done_at ? "บันทึกเลข" : "ยืนยันงานเสร็จ"}</button>
            <button type="button" className="btn-ghost" onClick={() => setDoneOpen(false)}>ยกเลิก</button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {total > 0 && <div className="flex justify-end">
          <button type="button" className="btn-ghost !py-1 text-sm" onClick={() => copyText(groups.flatMap((g) => g.nos).join(", "), `เลขเสาทั้งหมด ${total} ต้น`)}>📋 คัดลอกเลขเสาทั้งหมด ({total})</button>
        </div>}
        {groups.map((g) => (
          <div key={g.site + g.size} className="rounded-lg bg-slate-50 p-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm font-medium">
              <span>📍 {g.site} · {g.size} <span className="text-slate-400">({g.nos.length} ต้น)</span></span>
              <button type="button" className="shrink-0 text-xs text-brand underline" onClick={() => copyText(g.nos.join(", "), "เลขเสากองนี้")}>📋 คัดลอก</button>
            </div>
            <div className="flex flex-wrap gap-1">{g.nos.map((n) => <span key={n} className="chip">{n}</span>)}</div>
          </div>
        ))}
      </div>

      {/* อุปกรณ์เสริม */}
      {!edit && items.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-2 text-sm">
          <div className="mb-1 font-medium">🔩 อุปกรณ์เสริม</div>
          <ul className="space-y-0.5">
            {items.map((x) => <li key={x.code}><span className="font-mono text-xs text-slate-500">{x.code}</span> {x.name} <b>× {x.qty}</b>{x.detail ? <span className="text-slate-500"> ({x.detail})</span> : null}</li>)}
          </ul>
        </div>
      )}
      {edit && (
        <div>
          <div className="label">🔩 อุปกรณ์เสริม</div>
          <ItemsPicker accessories={accessories} value={items} onChange={setItems} />
        </div>
      )}

      {/* รูปก่อนขน / หลังขน อยู่บรรทัดเดียวกัน */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <Photos title="ก่อนขน" list={before} onRemove={edit ? (id) => setBefore(before.filter((p) => p.id !== id)) : undefined} />
        <Photos title="หลังขน" list={after} onRemove={edit ? (id) => setAfter(after.filter((p) => p.id !== id)) : undefined} />
        <Photos title="หลังขนอุปกรณ์เสริม" list={acc} onRemove={edit ? (id) => setAcc(acc.filter((p) => p.id !== id)) : undefined} />
      </div>
      {edit && <div className="grid gap-3 md:grid-cols-2"><PhotoPicker label="เพิ่มรูปก่อนขน" photos={newBefore} onChange={setNewBefore} /><PhotoPicker label="เพิ่มรูปหลังขน" photos={newAfter} onChange={setNewAfter} /><PhotoPicker label="เพิ่มรูปหลังขนอุปกรณ์เสริม" photos={newAcc} onChange={setNewAcc} /></div>}

      {edit && (
        <div className="flex gap-2 pt-1">
          <button className="btn" disabled={busy} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button>
          <button className="btn-ghost" disabled={busy} onClick={cancel}>ยกเลิก</button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </article>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div><label className="label">{label}</label><input className="input" value={v} onChange={(e) => on(e.target.value)} /></div>;
}
function Item({ k, v }: { k: string; v?: string }) {
  return <div><dt className="text-slate-400">{k}</dt><dd className="font-medium">{v || "-"}</dd></div>;
}
function Photos({ title, list, onRemove }: { title: string; list: P[]; onRemove?: (id: string) => void }) {
  if (!list?.length) return null;
  return (
    <div>
      <div className="mb-1 text-sm text-slate-500">{title}{onRemove ? " (กด × เพื่อเอาออกจากใบเบิก — ไฟล์ใน Drive ยังอยู่)" : ""}</div>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <div key={p.id} className="relative">
            <a href={`https://drive.google.com/file/d/${p.id}/view`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={title} loading="lazy" className="h-20 w-20 rounded-lg border object-cover" />
            </a>
            {onRemove && <button type="button" onClick={() => onRemove(p.id)} className="absolute right-0 top-0 h-6 w-6 rounded-bl-lg rounded-tr-lg bg-red-600 text-sm leading-6 text-white">×</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
