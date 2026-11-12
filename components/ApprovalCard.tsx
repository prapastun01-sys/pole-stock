"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify, confirmDialog } from "@/lib/status";

type G = { site: string; size: string; nos: string[] };
type P = { id: string; job_name: string; wbs?: string; network?: string; team?: string; responsible: string; when: string; moveDate: string; groups: G[]; items: any[]; nBefore: number; nAfter: number; nAcc: number };

// ใบเบิกที่รออนุมัติ: ใส่รหัสอนุมัติเพื่ออนุมัติ → ไปหน้าประวัติ / หรือยกเลิกใบ (คืนเสา)
export default function ApprovalCard({ p }: { p: P }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = p.groups.reduce((a, g) => a + g.nos.length, 0);

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return notify("❌ กรุณาใส่รหัสอนุมัติ");
    setBusy(true); notify("กำลังอนุมัติใบเบิกและแจ้งเตือน...");
    try {
      const r = await api(`/api/withdrawals/${p.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code }) });
      setOpen(false); setCode("");
      notify(r.notified ? "✅ อนุมัติเรียบร้อย และแจ้งเตือน Telegram แล้ว" : "✅ อนุมัติเรียบร้อย (แต่แจ้งเตือน Telegram ไม่สำเร็จ)");
      router.push("/history");
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }

  async function cancel() {
    if (!(await confirmDialog(`ยกเลิกใบเบิก "${p.job_name}" ?\n\n${total ? `เสา ${total} ต้นจะกลับเป็น "คงเหลือ" ในกองเดิม` : "ใบนี้เบิกเฉพาะอุปกรณ์เสริม"}`, { ok: "ยกเลิกใบเบิก", danger: true }))) return;
    notify("กำลังยกเลิกใบเบิก...");
    try {
      await api(`/api/withdrawals/${p.id}`, { method: "DELETE" });
      notify("✅ ยกเลิกใบเบิกแล้ว"); router.refresh();
    } catch (e: any) { notify("❌ " + e.message); }
  }

  const row = (k: string, v?: string) => v ? <div><div className="text-xs text-slate-400">{k}</div><div>{v}</div></div> : null;

  return (
    <div className="card space-y-3 border-amber-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">{p.job_name}</div>
          <div className="text-xs text-slate-500">สร้างเมื่อ {p.when}</div>
        </div>
        <span className="chip !bg-amber-100 !text-amber-800">⏳ รออนุมัติ</span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        {row("WBS/ใบสั่ง", p.wbs)}{row("โครงข่าย", p.network)}{row("วันขนเสา", p.moveDate)}
        {row("ผู้รับผิดชอบ", p.responsible)}{row("ทีมงาน", p.team)}
      </div>

      {p.groups.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-sm font-medium">เสา {total} ต้น</div>
          {p.groups.map((g) => (
            <div key={g.site + g.size} className="rounded-lg bg-slate-50 p-2 text-sm">
              <div className="mb-1 font-medium">📍 {g.site} · {g.size} <span className="text-slate-400">({g.nos.length} ต้น)</span></div>
              <div className="flex flex-wrap gap-1">{g.nos.map((n) => <span key={n} className="chip">{n}</span>)}</div>
            </div>
          ))}
        </div>
      ) : <div className="text-sm text-slate-500">เบิกเฉพาะอุปกรณ์เสริม (ไม่มีเสา)</div>}

      {p.items.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-2 text-sm">
          <div className="mb-1 font-medium">🔩 อุปกรณ์เสริม</div>
          <ul className="space-y-0.5">{p.items.map((x) => <li key={x.code}><span className="font-mono text-xs text-slate-500">{x.code}</span> {x.name} <b>× {x.qty}</b>{x.detail ? ` (${x.detail})` : ""}</li>)}</ul>
        </div>
      )}
      <div className="text-xs text-slate-500">รูป: ก่อนขน {p.nBefore} · หลังขน {p.nAfter}{p.nAcc ? ` · หลังขนอุปกรณ์ ${p.nAcc}` : ""}</div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => setOpen(true)}>✅ อนุมัติ</button>
        <a className="btn-ghost" target="_blank" rel="noreferrer" href={`/print/${p.id}`}>📄 ดูใบเบิก</a>
        <button type="button" className="btn-ghost !text-red-600" onClick={cancel}>ยกเลิกใบเบิก</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-[2px]" role="dialog" aria-label="อนุมัติใบเบิก" onClick={() => !busy && setOpen(false)}>
          <form onSubmit={approve} className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-2xl">🔐</div>
            <h2 className="text-center text-lg font-bold">อนุมัติใบเบิก</h2>
            <p className="text-center text-sm text-slate-500">{p.job_name}{total ? ` · ${total} ต้น` : ""}</p>
            <div className="flex gap-2">
              <input className="input text-center" autoFocus type={show ? "text" : "password"} placeholder="รหัสอนุมัติ" value={code} onChange={(e) => setCode(e.target.value)}
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} />
              <button type="button" className="btn-ghost shrink-0" onClick={() => setShow(!show)}>{show ? "ซ่อน" : "แสดง"}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="btn" disabled={busy}>อนุมัติ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
