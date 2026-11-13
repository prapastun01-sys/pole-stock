"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify } from "@/lib/status";

// ลบกองที่ลงข้อมูลผิด (พร้อมเสาทั้งหมดในกอง) — ต้องใส่รหัส
export default function DeletePileButton({ siteId, label, total, redirectTo }: { siteId: string; label: string; total: number; redirectTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return notify("❌ กรุณาใส่รหัส");
    setBusy(true); notify("กำลังลบกอง...");
    try {
      const r = await api(`/api/sites/${siteId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code }) });
      setOpen(false); setCode("");
      notify(`✅ ลบกอง "${label}" แล้ว (เสา ${r.poles} ต้น)`);
      if (redirectTo) router.push(redirectTo); else router.refresh();
    } catch (e: any) { notify("❌ " + e.message); }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn-ghost !py-1.5 text-sm !text-red-600" onClick={() => setOpen(true)}>🗑 ลบกองนี้</button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-[2px]" role="dialog" aria-label="ลบกอง" onClick={() => !busy && setOpen(false)}>
          <form onSubmit={del} className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">🗑</div>
            <h2 className="text-center text-lg font-bold">ลบกอง</h2>
            <p className="text-center text-sm text-slate-600">ลบกอง <b>{label}</b> พร้อมเสา{total >= 0 ? <> <b>{total}</b> ต้น</> : "ทุกขนาด"}ในกองนี้ทิ้งทั้งหมด<br /><span className="text-red-600">ย้อนกลับไม่ได้</span> (ถ้ามีเสาที่เบิกแล้ว จะลบไม่ได้)</p>
            <div className="flex gap-2">
              <input className="input text-center" autoFocus type={show ? "text" : "password"} placeholder="รหัส" value={code} onChange={(e) => setCode(e.target.value)}
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} />
              <button type="button" className="btn-ghost shrink-0" onClick={() => setShow(!show)}>{show ? "ซ่อน" : "แสดง"}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="btn !bg-red-600 hover:!bg-red-700" disabled={busy}>ลบกอง</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
