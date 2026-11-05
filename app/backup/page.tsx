"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { useStatus, notify } from "@/lib/status";
import { BACKUP_TABLES } from "@/lib/backup";

const NAME: Record<string, string> = { areas: "พื้นที่", pole_sizes: "ขนาดเสา", accessories: "อุปกรณ์เสริม", sites: "จุดกอง/กอง", withdrawals: "ใบเบิก (ประวัติ)", poles: "เสา" };
type Parsed = { meta: any; data: Record<string, any[]> };

export default function Backup() {
  const [, setMsg] = useStatus();
  const [file, setFile] = useState<string>("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    setParsed(null); setOk(false); setFile("");
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.meta?.app !== "pole-stock" || !j.data) throw new Error("ไม่ใช่ไฟล์สำรองของระบบนี้");
      setParsed(j); setFile(f.name);
    } catch (e: any) { setMsg("❌ อ่านไฟล์ไม่ได้: " + e.message); if (ref.current) ref.current.value = ""; }
  }

  async function restore() {
    if (!parsed) return;
    setBusy(true);
    try {
      for (const t of BACKUP_TABLES) {
        const rows = parsed.data[t] || [];
        for (let i = 0; i < rows.length; i += 500) {
          setMsg(`กำลังนำเข้า${NAME[t]} ${Math.min(i + 500, rows.length)}/${rows.length} ...`);
          await api("/api/backup/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: t, rows: rows.slice(i, i + 500) }) });
        }
      }
      setMsg("✅ นำเข้าข้อมูลเรียบร้อย");
      setParsed(null); setOk(false); setFile(""); if (ref.current) ref.current.value = "";
    } catch (e: any) { setMsg("❌ นำเข้าไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }

  const dl = (href: string) => { notify("📦 กำลังเตรียมไฟล์ดาวน์โหลด..."); window.location.href = href; };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">สำรอง / นำเข้าข้อมูล</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">⬇️ สำรองข้อมูล (Backup)</h2>
        <p className="text-sm text-slate-600">ดาวน์โหลดข้อมูลทั้งหมด: พื้นที่ · จุดกอง/กอง · ขนาดเสา · เสาทุกต้น · ประวัติใบเบิก · อุปกรณ์เสริม เป็นไฟล์เดียว (.json) เก็บไว้ในเครื่อง/Google Drive ได้ — รูปภาพอยู่ใน Google Drive อยู่แล้ว ไฟล์สำรองเก็บลิงก์รูปไว้ให้</p>
        <button type="button" className="btn w-full sm:w-auto" onClick={() => dl("/api/backup")}>⬇️ ดาวน์โหลดไฟล์สำรองทั้งหมด (.json)</button>
        <div className="border-t pt-3">
          <p className="mb-2 text-sm text-slate-600">ไฟล์ตารางสำหรับเปิดใน Excel (ดูอย่างเดียว นำเข้ากลับไม่ได้):</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => dl("/api/backup?format=csv&table=poles")}>📄 รายการเสา (.csv)</button>
            <button type="button" className="btn-ghost" onClick={() => dl("/api/backup?format=csv&table=withdrawals")}>📄 ประวัติการเบิก (.csv)</button>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">⬆️ นำเข้าข้อมูล (Restore)</h2>
        <p className="text-sm text-slate-600">เลือกไฟล์สำรอง (.json) ที่ดาวน์โหลดจากระบบนี้ ระบบจะ <b>เพิ่มข้อมูลที่ยังไม่มี และอัปเดตรายการที่ตรงกัน</b> โดยไม่ลบข้อมูลที่มีอยู่ ใช้กู้ข้อมูลเมื่อเผลอลบ หรือย้ายไปฐานข้อมูลใหม่ (ต้องรัน schema/migration ในฐานข้อมูลใหม่ก่อน)</p>
        <input ref={ref} type="file" accept=".json,application/json" className="input" onChange={(e) => pick(e.target.files?.[0])} />
        {parsed && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm">
            <div>ไฟล์: <b>{file}</b> · สำรองเมื่อ {new Date(parsed.meta.exported_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
              {BACKUP_TABLES.map((t) => <li key={t}>{NAME[t]}: <b>{(parsed.data[t] || []).length.toLocaleString()}</b></li>)}
            </ul>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={ok} onChange={(e) => setOk(e.target.checked)} />
              <span>ยืนยันนำเข้าข้อมูลจากไฟล์นี้ (แนะนำให้ดาวน์โหลดสำรองข้อมูลปัจจุบันก่อน)</span>
            </label>
            <button type="button" className="btn" disabled={!ok || busy} onClick={restore}>⬆️ เริ่มนำเข้า</button>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">คำแนะนำ: ควรสำรองข้อมูลเป็นประจำ เช่น สัปดาห์ละครั้ง และก่อนลบ/แก้ข้อมูลจำนวนมาก · Supabase เองก็มีระบบสำรองรายวันในแผนที่มีให้ (ดูที่ Supabase → Database → Backups)</p>
    </div>
  );
}
