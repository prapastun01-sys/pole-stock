"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
      window.location.href = "/";
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-xl font-bold text-brand">ระบบเบิกเสา</h1>
        <div>
          <label className="label">รหัสผ่านเข้าใช้งาน</label>
          <div className="flex gap-2">
            <input type={show ? "text" : "password"} className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)}
              autoFocus autoCapitalize="none" autoCorrect="off" autoComplete="current-password" spellCheck={false} />
            <button type="button" className="btn-ghost shrink-0" onClick={() => setShow(!show)}>{show ? "ซ่อน" : "แสดง"}</button>
          </div>
          <p className="mt-1 text-xs text-slate-400">ตัวพิมพ์เล็ก/ใหญ่มีผล (เช่น P ตัวใหญ่) — กด "แสดง" เพื่อตรวจสิ่งที่พิมพ์</p>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn w-full" disabled={busy}>เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
