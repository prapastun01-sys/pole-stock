"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
          <input type="password" className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn w-full" disabled={busy}>เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
