"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/client";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [len, setLen] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: ref.current?.value ?? passcode }) });
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
            <input ref={ref} name="passcode" id="passcode" type={show ? "text" : "password"} className="input" defaultValue="" onInput={(e) => { setPasscode(e.currentTarget.value); setLen(e.currentTarget.value.length); }}
              autoFocus autoCapitalize="none" autoCorrect="off" autoComplete="current-password" spellCheck={false} />
            <button type="button" className="btn-ghost shrink-0" onClick={() => setShow(!show)}>{show ? "ซ่อน" : "แสดง"}</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">พิมพ์แล้ว <b>{len}</b> ตัวอักษร (รหัสที่ถูกต้องมี 8 ตัว) · ตัวพิมพ์เล็ก/ใหญ่มีผล</p>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn w-full" disabled={busy}>เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
