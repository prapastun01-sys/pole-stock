"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type MapPoint = { name: string; areaId: string | null; areaName: string; lat: number; lng: number; avail: number; piles: number; sizes: { name: string; n: number }[] };

declare global { interface Window { L?: any } }

// โหลด Leaflet (แผนที่ OpenStreetMap) จาก CDN
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id = "leaflet-css"; l.rel = "stylesheet"; l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => resolve(window.L); s.onerror = () => reject(new Error("โหลดแผนที่ไม่สำเร็จ"));
    document.body.appendChild(s);
  });
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export default function MapView({ points, areas }: { points: MapPoint[]; areas: { id: string; name: string }[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [area, setArea] = useState<string>("all");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  const shown = useMemo(() => points.filter((p) => area === "all" || (area === "none" ? !p.areaId : p.areaId === area)), [points, area]);

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current || mapRef.current) return;
      const m = L.map(el.current, { scrollWheelZoom: true }).setView([17.4, 104.7], 9);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      mapRef.current = m; layerRef.current = L.layerGroup().addTo(m);
      setReady(true);
    }).catch((e) => setErr(e?.message || "โหลดแผนที่ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)"));
    return () => { dead = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    const L = window.L, m = mapRef.current, g = layerRef.current;
    if (!ready || !L || !m || !g) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    for (const p of shown) {
      const ok = p.avail > 0;
      const icon = L.divIcon({
        className: "",
        iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -40],
        html: `<div style="width:44px;height:44px;display:flex;flex-direction:column;align-items:center"><div style="min-width:38px;padding:2px 6px;border-radius:12px;background:${ok ? "#0f766e" : "#94a3b8"};color:#fff;font:700 14px/20px sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.avail}</div><div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${ok ? "#0f766e" : "#94a3b8"}"></div></div>`,
      });
      const sizes = p.sizes.length ? p.sizes.map((s) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${esc(s.name)}</span><b>${s.n} ต้น</b></div>`).join("") : `<div style="color:#94a3b8">ไม่มีเสาคงเหลือ</div>`;
      const open = `/api/area/select?id=${p.areaId || "none"}&to=${encodeURIComponent("/piles/point?name=" + encodeURIComponent(p.name))}`;
      const html = `<div style="min-width:190px;font:14px/1.5 sans-serif"><div style="font-weight:700;font-size:15px">📍 ${esc(p.name)}</div><div style="color:#64748b;font-size:12px;margin-bottom:6px">${esc(p.areaName)} · ${p.piles} กอง</div>${sizes}<div style="margin-top:8px;display:flex;gap:10px"><a href="${open}" style="color:#0f766e;font-weight:600">ดูผังกอง</a><a target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" style="color:#0f766e;font-weight:600">นำทาง</a></div></div>`;
      L.marker([p.lat, p.lng], { icon, title: p.name }).bindPopup(html).addTo(g);
      pts.push([p.lat, p.lng]);
    }
    if (pts.length === 1) m.setView(pts[0], 15);
    else if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  }, [shown, ready]);

  const chip = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => setArea(id)} className={`rounded-full border px-3 py-1 text-sm ${area === id ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-600"}`}>{label}</button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chip("all", `ทุกพื้นที่ (${points.length})`)}
        {areas.map((a) => chip(a.id, `${a.name} (${points.filter((p) => p.areaId === a.id).length})`))}
        {points.some((p) => !p.areaId) && chip("none", `ยังไม่ระบุพื้นที่ (${points.filter((p) => !p.areaId).length})`)}
      </div>
      {err && <div className="card text-red-600">{err}</div>}
      <div ref={el} className="h-[68vh] min-h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" />
      <p className="text-xs text-slate-500">ตัวเลขบนหมุด = จำนวนเสาคงเหลือของจุดนั้น (สีเทา = ไม่เหลือแล้ว) · กดหมุดเพื่อดูรายละเอียด ผังกอง และนำทาง</p>
    </div>
  );
}
