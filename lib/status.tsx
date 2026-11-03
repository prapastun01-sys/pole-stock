"use client";
import { useCallback, useEffect, useState } from "react";

// ระบบแจ้งสถานะกลาง: ข้อความขึ้นต้น "กำลัง" = หน้าจอหมุนรอ, "❌" = ผิดพลาด, "⚠️" = เตือน, อื่นๆ = สำเร็จ
type S = { kind: "idle" | "busy" | "ok" | "err" | "warn"; text: string };
let state: S = { kind: "idle", text: "" };
let timer: any;
const subs = new Set<() => void>();

function set(s: S) {
  state = s;
  clearTimeout(timer);
  subs.forEach((f) => f());
  if (s.kind === "ok" || s.kind === "warn") timer = setTimeout(() => set({ kind: "idle", text: "" }), s.kind === "ok" ? 3500 : 8000);
}

export function notify(text: string) {
  const t = (text || "").trim();
  if (!t) return set({ kind: "idle", text: "" });
  if (t.startsWith("กำลัง")) return set({ kind: "busy", text: t });
  if (t.startsWith("❌")) return set({ kind: "err", text: t.replace(/^❌\s*/, "") });
  if (t.startsWith("⚠️")) return set({ kind: "warn", text: t.replace(/^⚠️\s*/, "") });
  set({ kind: "ok", text: t.replace(/^✅\s*/, "") });
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
  if (s.kind === "busy")
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" role="status" aria-live="polite">
        <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
          <span className="font-medium text-slate-700">{s.text}</span>
        </div>
      </div>
    );
  const style = s.kind === "ok" ? "bg-emerald-600" : s.kind === "warn" ? "bg-amber-500" : "bg-red-600";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3" role="alert">
      <div className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-white shadow-lg ${style}`}>
        <span>{s.kind === "ok" ? "✅" : s.kind === "warn" ? "⚠️" : "❌"}</span>
        <span className="grow">{s.text}</span>
        <button type="button" aria-label="ปิด" className="px-1 text-lg leading-none opacity-80 hover:opacity-100" onClick={() => set({ kind: "idle", text: "" })}>×</button>
      </div>
    </div>
  );
}
