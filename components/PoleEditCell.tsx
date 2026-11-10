"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify, confirmDialog } from "@/lib/status";

// ช่องเลขเสาในผังกอง: กดเพื่อแก้เลข / ลบเสาที่ใส่ผิด
export default function PoleEditCell({ id, poleNo, withdrawn, size, className, style, title, children }: {
  id: string; poleNo: string; withdrawn: boolean; size?: string; className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(poleNo);
  const [busy, setBusy] = useState(false);

  async function save() {
    const no = v.trim();
    if (!no) return notify("❌ กรุณากรอกเลขเสา");
    if (no === poleNo) return setOpen(false);
    if (withdrawn && !(await confirmDialog(`เสาต้นนี้เบิกไปแล้ว\nแก้เลข ${poleNo} → ${no} จะเปลี่ยนในประวัติและใบเบิกด้วย`, { ok: "แก้เลข" }))) return;
    setBusy(true); notify("กำลังบันทึกเลขเสา...");
    try {
      await api(`/api/poles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pole_no: no }) });
      setOpen(false); router.refresh(); notify(`✅ แก้เลขเสา ${poleNo} → ${no} แล้ว`);
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }

  async function del() {
    if (!(await confirmDialog(`ลบเสาเลข ${poleNo} ออกจากกองนี้?\n(ใช้เมื่อใส่เลขเกินหรือผิดต้น)`, { ok: "ลบเสา", danger: true }))) return;
    setBusy(true); notify("กำลังลบเสา...");
    try {
      await api(`/api/poles/${id}`, { method: "DELETE" });
      setOpen(false); router.refresh(); notify(`✅ ลบเสา ${poleNo} แล้ว`);
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }

  return (
    <>
      <button type="button" title={(title || "") + " (กดเพื่อแก้เลข)"} style={style} className={`${className || ""} cursor-pointer hover:ring-2 hover:ring-brand/40`} onClick={() => { setV(poleNo); setOpen(true); }}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-[2px]" role="dialog" aria-label="แก้เลขเสา" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center text-lg font-bold">แก้เลขเสา</h2>
            <p className="text-center text-sm text-slate-500">{size ? `${size} · ` : ""}เลขเดิม <b>{poleNo}</b>{withdrawn ? " (เบิกแล้ว)" : ""}</p>
            <input className="input text-center text-xl font-semibold" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} inputMode="text" />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button>
              <button type="button" className="btn" disabled={busy} onClick={save}>บันทึก</button>
            </div>
            {!withdrawn && <button type="button" className="w-full text-sm text-red-600 underline" disabled={busy} onClick={del}>🗑 ลบเสาต้นนี้ (ใส่ผิด/เกิน)</button>}
          </div>
        </div>
      )}
    </>
  );
}
