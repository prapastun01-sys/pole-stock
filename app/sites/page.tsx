"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export default function Sites() {
  const [sites, setSites] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [f, setF] = useState({ name: "", pile: "", lat: "", lng: "", note: "" });
  const [size, setSize] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [d, setD] = useState({ name: "", pile: "", lat: "", lng: "", note: "" });

  const load = () => api("/api/master").then((j) => { setSites(j.sites); setSizes(j.sizes); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  function locate() {
    if (!navigator.geolocation) return alert("อุปกรณ์ไม่รองรับ GPS");
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })),
      () => alert("ดึงตำแหน่งไม่ได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // รองรับวางพิกัดแบบ "13.7563, 100.5018" จาก Google Maps
  function pasteCoord(v: string) {
    const m = v.match(/(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)/);
    if (m) setF((x) => ({ ...x, lat: m[1], lng: m[2] }));
  }

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      setF({ name: "", pile: "", lat: "", lng: "", note: "" });
      setMsg("✅ เพิ่มจุดกองหมอนแล้ว");
      load();
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  function startEdit(s: any) {
    setEditId(s.id);
    setD({ name: s.name || "", pile: s.pile || "", lat: s.lat ?? "", lng: s.lng ?? "", note: s.note || "" } as any);
    setMsg("");
  }
  async function saveEdit() {
    setBusy(true); setMsg("");
    try {
      await api(`/api/sites/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      setEditId(null); setMsg("✅ แก้ไขแล้ว"); load();
    } catch (e: any) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  async function addSize(e: React.FormEvent) {
    e.preventDefault();
    if (!size.trim()) return;
    try {
      await api("/api/sizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: size }) });
      setSize(""); load();
    } catch (e: any) { setMsg("❌ " + e.message); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">จุดกองหมอน</h1>

      <form onSubmit={addSite} className="card space-y-3">
        <h2 className="font-semibold">เพิ่มจุดกองหมอน</h2>
        <div><label className="label">ชื่อจุด *</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น ที่เช่า / อ.เมือง" /></div>
        <div><label className="label">กอง (ถ้าจุดเดียวมีหลายกอง)</label><input className="input" value={f.pile} onChange={(e) => setF({ ...f, pile: e.target.value })} placeholder="เช่น กอง 1, กอง 2 (เว้นว่างได้)" /></div>
        <div>
          <label className="label">พิกัด (วางจาก Google Maps ได้ เช่น 13.7563, 100.5018)</label>
          <input className="input" placeholder="วางพิกัดที่นี่" onChange={(e) => pasteCoord(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Latitude</label><input className="input" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></div>
          <div><label className="label">Longitude</label><input className="input" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></div>
        </div>
        <button type="button" className="btn-ghost" onClick={locate}>📍 ใช้ตำแหน่งปัจจุบัน (GPS)</button>
        <div><label className="label">หมายเหตุ</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <button className="btn w-full" disabled={busy}>บันทึกจุดกอง</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>

      <section className="card">
        <h2 className="mb-2 font-semibold">รายการจุดกอง ({sites.length})</h2>
        <ul className="divide-y">
          {sites.map((s) => (
            <li key={s.id} className="py-2">
              {editId === s.id ? (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <div><label className="label">ชื่อจุด *</label><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
                  <div><label className="label">กอง</label><input className="input" value={d.pile} onChange={(e) => setD({ ...d, pile: e.target.value })} placeholder="เว้นว่างได้" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Latitude</label><input className="input" inputMode="decimal" value={d.lat} onChange={(e) => setD({ ...d, lat: e.target.value })} /></div>
                    <div><label className="label">Longitude</label><input className="input" inputMode="decimal" value={d.lng} onChange={(e) => setD({ ...d, lng: e.target.value })} /></div>
                  </div>
                  <div><label className="label">หมายเหตุ</label><input className="input" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></div>
                  <div className="flex gap-2">
                    <button type="button" className="btn" disabled={busy} onClick={saveEdit}>บันทึก</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-slate-500">{s.lat != null ? `${s.lat}, ${s.lng}` : "ไม่มีพิกัด"}{s.note ? ` · ${s.note}` : ""}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {s.lat != null && <a className="btn-ghost !py-1.5 text-sm" target="_blank" href={`https://maps.google.com/?q=${s.lat},${s.lng}`}>🗺</a>}
                    <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => startEdit(s)}>✏️ แก้ไข</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {sites.length === 0 && <li className="py-3 text-slate-500">ยังไม่มีข้อมูล</li>}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">ขนาดเสา</h2>
        <div className="flex flex-wrap gap-2">{sizes.map((z) => <span key={z.id} className="chip">{z.name}</span>)}</div>
        <form onSubmit={addSize} className="flex gap-2">
          <input className="input" placeholder="เพิ่มขนาดใหม่ เช่น 10 เมตร" value={size} onChange={(e) => setSize(e.target.value)} />
          <button className="btn shrink-0">เพิ่ม</button>
        </form>
      </section>
    </div>
  );
}
