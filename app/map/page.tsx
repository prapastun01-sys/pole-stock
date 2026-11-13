import Link from "next/link";
import { db } from "@/lib/supabase";
import MapView, { MapPoint } from "@/components/MapView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// แผนที่จุดกองหมอนทั้งหมดที่ลงพิกัดไว้
export default async function MapPage() {
  const s = db();
  const [sitesQ, areasQ, stockQ] = await Promise.all([
    s.from("sites").select("id,name,zone,pile,lat,lng,area_id"),
    s.from("areas").select("id,name").order("sort_order").order("name"),
    s.from("v_stock").select("site_id,size_name,sort_order,available"),
  ]);
  if (sitesQ.error) return <div className="card text-red-600">{sitesQ.error.message}</div>;

  const areas = (areasQ.data || []) as { id: string; name: string }[];
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const sites = (sitesQ.data || []) as any[];
  const stock = (stockQ.data || []) as any[];

  const hasXY = (x: any) => x.lat != null && x.lng != null && isFinite(Number(x.lat)) && isFinite(Number(x.lng));
  // รวมกองที่อยู่จุดเดียวกัน (ชื่อเดียวกัน) เป็นหมุดเดียว
  const groups = new Map<string, any[]>();
  for (const x of sites) { if (!groups.has(x.name)) groups.set(x.name, []); groups.get(x.name)!.push(x); }

  const points: MapPoint[] = [];
  const noXY: string[] = [];
  groups.forEach((list, name) => {
    const withXY = list.filter(hasXY);
    if (withXY.length === 0) { noXY.push(name); return; }
    const ids = new Set(list.map((x) => x.id));
    const by = new Map<string, { sort: number; n: number }>();
    for (const r of stock) {
      if (!ids.has(r.site_id) || Number(r.available) <= 0) continue;
      const c = by.get(r.size_name) || { sort: Number(r.sort_order) || 0, n: 0 };
      c.n += Number(r.available); by.set(r.size_name, c);
    }
    const sizes = Array.from(by.entries()).sort((a, b) => a[1].sort - b[1].sort).map(([n, v]) => ({ name: n, n: v.n }));
    const lat = withXY.reduce((a, x) => a + Number(x.lat), 0) / withXY.length;
    const lng = withXY.reduce((a, x) => a + Number(x.lng), 0) / withXY.length;
    const aid = list.find((x) => x.area_id)?.area_id || null;
    points.push({ name, areaId: aid, areaName: aid ? areaName.get(aid) || "-" : "ยังไม่ระบุพื้นที่", lat, lng, avail: sizes.reduce((a, z) => a + z.n, 0), piles: list.length, sizes });
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">🗺 แผนที่จุดกองหมอน</h1>
        <p className="text-sm text-slate-500">แสดงเฉพาะจุดที่ลงพิกัดไว้ ({points.length} จุด)</p>
      </div>
      <MapView points={points} areas={areas} />
      {noXY.length > 0 && (
        <div className="card text-sm">
          <div className="mb-1 font-medium">ยังไม่มีพิกัด ({noXY.length} จุด)</div>
          <div className="mb-2 flex flex-wrap gap-1.5">{noXY.sort().map((n) => <span key={n} className="chip">{n}</span>)}</div>
          <Link href="/sites" className="text-brand underline">ไปเพิ่มพิกัดที่หน้าจุดกอง (✏️ แก้ไข)</Link>
        </div>
      )}
    </div>
  );
}
