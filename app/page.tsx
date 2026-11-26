import { db } from "@/lib/supabase";
import AreaAdd from "@/components/AreaAdd";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// หน้าแรก: เลือกพื้นที่ (นครพนม / ธาตุพนม / นาแก / บ้านแพง ...) แล้วเข้าไปใช้เมนูของพื้นที่นั้น
export default async function Home() {
  const s = db();
  const [areasQ, sitesQ, stockQ, kindQ, sizesQ] = await Promise.all([
    s.from("areas").select("id,name").order("sort_order").order("name"),
    s.from("sites").select("id,name,area_id,lat,lng"),
    s.from("v_stock").select("site_id,size_name,sort_order,total,available"),
    s.from("v_stock_kind").select("site_id,size_id,kind,available"),
    s.from("pole_sizes").select("id,name,sort_order"),
  ]);
  const sizeInfo = new Map<string, { name: string; sort: number }>(((sizesQ.data || []) as any[]).map((z) => [z.id as string, { name: z.name as string, sort: Number(z.sort_order) || 0 }]));
  const kindRows = (kindQ.data || []) as any[];
  const err = areasQ.error || sitesQ.error;
  if (err) return <div className="card text-red-600">โหลดข้อมูลไม่ได้: {err.message}<br />ถ้าเพิ่งอัปเดตระบบ ให้รัน <code>migration_007_areas.sql</code> ใน Supabase</div>;

  const sites = (sitesQ.data || []) as any[];

  // งานที่ยังไม่ใส่เลขใบตัดงาน (ยังไม่กด "งานเสร็จ") — นับเฉพาะใบที่อนุมัติแล้ว
  let wq: any = await s.from("withdrawals").select("id,pole_free,area_id,approved_at").is("done_at", null);
  if (wq.error) wq = await s.from("withdrawals").select("id").is("done_at", null); // ยังไม่ได้รัน migration 012/013
  const openW = ((wq.data || []) as any[]).filter((w) => w.approved_at !== null);
  // ใบเบิกที่รออนุมัติ (ยังไม่กดอนุมัติ)
  const pq: any = await s.from("withdrawals").select("id,pole_free,area_id").is("approved_at", null);
  const pendW = (pq.error ? [] : (pq.data || [])) as any[];
  const wSites = new Map<string, Set<string>>();
  const allW = [...openW, ...pendW];
  for (let i = 0; i < allW.length; i += 60) {
    const { data } = await s.from("poles").select("withdrawal_id,site_id").in("withdrawal_id", allW.slice(i, i + 60).map((w) => w.id)).limit(5000);
    for (const r of (data || []) as any[]) { if (!wSites.has(r.withdrawal_id)) wSites.set(r.withdrawal_id, new Set()); wSites.get(r.withdrawal_id)!.add(r.site_id); }
  }
  const openCount = (siteList: any[], areaKey: string, src: any[] = openW) => {
    if (areaKey === "all") return src.length;
    const ids = new Set(siteList.map((x) => x.id));
    return src.filter((w) => {
      const ss = wSites.get(w.id);
      if (ss && Array.from(ss).some((x) => ids.has(x))) return true;
      return !!w.pole_free && (areaKey === "none" ? !w.area_id : w.area_id === areaKey);
    }).length;
  };
  const stock = (stockQ.data || []) as any[];
  const sum = (siteIds: Set<string>, k: "total" | "available") => stock.filter((r) => siteIds.has(r.site_id)).reduce((a, r) => a + Number(r[k]), 0);

  const noArea = sites.filter((x) => !x.area_id);
  const card = (key: string, id: string, title: string, siteList: any[], emoji = "📍") => {
    const open = openCount(siteList, id);
    const pend = openCount(siteList, id, pendW);
    const ids = new Set(siteList.map((x) => x.id));
    const liveIds = new Set<string>();
    for (const r of stock) if (ids.has(r.site_id) && Number(r.available) > 0) liveIds.add(r.site_id);
    const points = new Set(siteList.filter((x) => liveIds.has(x.id)).map((x) => x.name)).size;
    // เสาคงเหลือแยกตามขนาด และแยกเสาใหม่ / เสารื้อถอน / อื่นๆ
    const bySize = new Map<string, { sort: number; nw: number; dis: number; other: number }>();
    for (const r of kindRows) {
      const n = Number(r.available);
      if (!ids.has(r.site_id) || n <= 0) continue;
      const info = sizeInfo.get(r.size_id); if (!info) continue;
      const c = bySize.get(info.name) || { sort: info.sort, nw: 0, dis: 0, other: 0 };
      if (r.kind === "new") c.nw += n; else if (r.kind === "dismantled") c.dis += n; else c.other += n;
      bySize.set(info.name, c);
    }
    const sizes = Array.from(bySize.entries()).sort((a, b) => a[1].sort - b[1].sort);
    const hasOther = sizes.some(([, v]) => v.other > 0);
    return (
      // ใช้ <a> ธรรมดา (ไม่ใช้ Link) เพราะลิงก์นี้ตั้ง cookie แล้ว redirect
      <a key={key} href={`/api/area/select?id=${id}&to=/summary`} className="card block transition hover:border-brand hover:shadow-md">
        <div className="text-lg font-bold text-brand">{emoji} {title}</div>
        <div className="mt-1 text-sm text-slate-500">{points} จุดกองหมอน · {liveIds.size} กอง</div>
        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-400">เสาคงเหลือ</div>
          {sizes.length === 0 ? <div className="text-slate-400">ไม่มีเสาคงเหลือ</div> : (
            <ul className="space-y-0.5">
              <li className="flex items-baseline gap-3 text-xs text-slate-500">
                <span className="flex-1" />
                <span className="w-20 whitespace-nowrap text-right">เสาใหม่</span>
                <span className="w-20 whitespace-nowrap text-right">เสารื้อถอน</span>
                {hasOther && <span className="w-14 text-right">อื่นๆ</span>}
              </li>
              {sizes.map(([n, v]) => (
                <li key={n} className="flex items-baseline gap-3">
                  <span className="flex-1 font-medium">{n}</span>
                  <span className="w-20 whitespace-nowrap text-right"><b className="text-xl text-emerald-600">{v.nw.toLocaleString()}</b> <span className="text-xs text-slate-500">ต้น</span></span>
                  <span className="w-20 whitespace-nowrap text-right"><b className={`text-xl ${v.dis ? "text-orange-600" : "text-slate-300"}`}>{v.dis.toLocaleString()}</b> <span className="text-xs text-slate-500">ต้น</span></span>
                  {hasOther && <span className="w-14 text-right"><b className="text-lg text-slate-600">{v.other.toLocaleString()}</b></span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {pend > 0 && (
          <div className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">
            ⏳ {pend} ใบเบิกรออนุมัติ
          </div>
        )}
        {open > 0 && (
          <div className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            ⚠️ {open} งานยังไม่ใส่เลขใบตัดงาน
          </div>
        )}
      </a>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ระบบเบิกเสา</h1>
        <p className="text-sm text-slate-500">เลือกพื้นที่เพื่อเข้าใช้งาน</p>
      </div>

      {pendW.length > 0 && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="text-lg font-bold text-red-700">⏳ มี {pendW.length} ใบเบิกรออนุมัติ</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...(areasQ.data || []).map((a: any) => ({ id: a.id as string, name: a.name as string, list: sites.filter((x) => x.area_id === a.id) })),
              ...(noArea.length > 0 ? [{ id: "none", name: "ยังไม่ระบุพื้นที่", list: noArea }] : [])]
              .map((a) => ({ ...a, n: openCount(a.list, a.id, pendW) }))
              .filter((a) => a.n > 0)
              .map((a) => (
                <a key={a.id} href={`/api/area/select?id=${a.id}&to=/approvals`} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700">
                  {a.name} · {a.n} ใบ →
                </a>
              ))}
            <a href="/api/area/select?id=all&to=/approvals" className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">ดูทุกพื้นที่</a>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(areasQ.data || []).map((a: any) => card(a.id, a.id, a.name, sites.filter((x) => x.area_id === a.id)))}
        {noArea.length > 0 && card("none", "none", "ยังไม่ระบุพื้นที่", noArea, "❔")}
        {card("all", "all", "ดูทุกพื้นที่", sites, "🗂")}
        <a href="/map" className="card block transition hover:border-brand hover:shadow-md">
          <div className="text-lg font-bold text-brand">🗺 แผนที่</div>
          <div className="mt-1 text-sm text-slate-500">ดูจุดกองหมอนทั้งหมดที่ลงพิกัดไว้บนแผนที่</div>
          <div className="mt-3 text-3xl font-bold text-emerald-600">{new Set(sites.filter((x) => x.lat != null && x.lng != null).map((x) => x.name)).size}<span className="ml-1 text-sm font-normal text-slate-500">จุดที่มีพิกัด</span></div>
        </a>
      </div>

      {noArea.length > 0 && <p className="text-xs text-slate-500">มีจุดกอง {noArea.length} กองที่ยังไม่ระบุพื้นที่ — เข้าการ์ด "ยังไม่ระบุพื้นที่" แล้วไปที่เมนู จุดกอง → ✏️ แก้ไข เพื่อกำหนดพื้นที่</p>}

      <AreaAdd />
      <div className="pt-2 text-sm"><a className="text-slate-500 underline" href="/backup">⚙️ สำรอง / นำเข้าข้อมูล</a></div>
    </div>
  );
}
