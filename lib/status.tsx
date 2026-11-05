"use client";
import { useCallback, useEffect, useState } from "react";

// ระบบแจ้งสถานะกลาง: ข้อความขึ้นต้น "กำลัง" = หน้าจอหมุนรอ, "❌" = ผิดพลาด, "⚠️" = เตือน, อื่นๆ = สำเร็จ
type S = { kind: "idle" | "busy" | "ok" | "err" | "warn" | "info"; text: string };
let state: S = { kind: "idle", text: "" };
let timer: any;
const subs = new Set<() => void>();

function set(s: S) {
  state = s;
  clearTimeout(timer);
  subs.forEach((f) => f());
  if (s.kind === "ok" || s.kind === "warn" || s.kind === "info") timer = setTimeout(() => set({ kind: "idle", text: "" }), s.kind === "ok" ? 2200 : s.kind === "info" ? 3500 : 10000);
}

export function notify(text: string) {
  const t = (text || "").trim();
  if (!t) return set({ kind: "idle", text: "" });
  if (t.startsWith("กำลัง")) return set({ kind: "busy", text: t });
  if (t.startsWith("❌")) return set({ kind: "err", text: t.replace(/^❌\s*/, "") });
  if (t.startsWith("⚠️")) return set({ kind: "warn", text: t.replace(/^⚠️\s*/, "") });
  if (t.startsWith("✅")) return set({ kind: "ok", text: t.replace(/^✅\s*/, "") });
  set({ kind: "info", text: t });
}

// ใช้แทน useState("") สำหรับข้อความสถานะ: ตั้งค่าแล้วแสดง toast/หน้าจอรอให้อัตโนมัติ
export function useStatus(): [string, (m: string) => void] {
  const [msg, setMsgState] = useState("");
  const setMsg = useCallback((m: string) => { setMsgState(m); notify(m); }, []);
  useEffect(() => () => { if (state.kind === "busy") set({ kind: "idle", text: "" }); }, []);
  return [msg, setMsg];
}

export function Toaster() {
  const [s, setS] = useState<S>(state);
  useEffect(() => {
    const f = () => setS({ ...state });
    subs.add(f);
    f();
    return () => { subs.delete(f); };
  }, []);

  if (s.kind === "idle") return null;
  const close = () => set({ kind: "idle", text: "" });

  // ข้อความทั่วไป (ไม่ใช่ผลการบันทึก) = แถบเล็กด้านบน
  if (s.kind === "info")
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3" role="status">
        <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-slate-800 px-4 py-3 text-white shadow-lg">
          <span className="grow">{s.text}</span>
          <button type="button" aria-label="ปิด" className="px-1 text-lg leading-none opacity-80 hover:opacity-100" onClick={close}>×</button>
        </div>
      </div>
    );

  // ป๊อปอัปกลางจอ: กำลังดำเนินการ / สำเร็จ / ผิดพลาด / เตือน
  const cfg = {
    busy: { title: "กำลังดำเนินการ", sub: "กรุณารอสักครู่ และอย่าปิดหน้านี้", ring: "bg-brand-light text-brand" },
    ok: { title: "สำเร็จ", sub: "", ring: "bg-emerald-100 text-emerald-600" },
    err: { title: "เกิดข้อผิดพลาด", sub: "", ring: "bg-red-100 text-red-600" },
    warn: { title: "โปรดตรวจสอบ", sub: "", ring: "bg-amber-100 text-amber-600" },
  }[s.kind as "busy" | "ok" | "err" | "warn"];
  const icon =
    s.kind === "busy" ? <span className="h-9 w-9 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
    : s.kind === "ok" ? <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    : s.kind === "err" ? <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    : <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v9M12 18.5v.5" /></svg>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-[2px]" role="alertdialog" aria-live="assertive" aria-label={cfg.title}
      onClick={s.kind === "busy" ? undefined : close}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${cfg.ring}`}>{icon}</div>
        <h2 className="mt-4 text-lg font-bold text-slate-800">{cfg.title}</h2>
        <p className="mt-1.5 whitespace-pre-line break-words text-slate-600">{s.text}</p>
        {cfg.sub && <p className="mt-2 text-xs text-slate-400">{cfg.sub}</p>}
        {s.kind !== "busy" && (
          <button type="button" autoFocus className={`mt-5 w-full rounded-xl px-4 py-2.5 font-semibold text-white ${s.kind === "ok" ? "bg-emerald-600 hover:bg-emerald-700" : s.kind === "warn" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"}`} onClick={close}>
            {s.kind === "ok" ? "ตกลง" : "ปิด"}
          </button>
        )}
      </div>
    </div>
  );
}
