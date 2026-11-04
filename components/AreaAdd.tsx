"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { notify } from "@/lib/status";

export default function AreaAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    notify("กำลังเพิ่มพื้นที่...");
    try {
      await api("/api/areas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setName(""); setOpen(false);
      router.refresh();
      notify("✅ เพิ่มพื้นที่แล้ว");
    } catch (e: any) { notify("❌ " + e.message); }
  }

  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>➕ เพิ่มพื้นที่</button>;
  return (
    <form onSubmit={add} className="flex gap-2">
      <input className="input" autoFocus placeholder="ชื่อพื้นที่ เช่น เรณูนคร" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn shrink-0">เพิ่ม</button>
      <button type="button" className="btn-ghost shrink-0" onClick={() => setOpen(false)}>ยกเลิก</button>
    </form>
  );
}
