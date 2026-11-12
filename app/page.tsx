import { db } from "@/lib/supabase";
import AreaAdd from "@/components/AreaAdd";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// หน้าแรก: เลือกพื้นที่ (นครพนม / ธาตุพนม / นาแก / บ้านแพง ...) แล้วเข้าไปใช้เมนูของพื้นที่นั้น
export default async function Home() {
  const s = db();
  const [areasQ, sitesQ, stockQ] = await Promise.all([
    s.from("areas").select("id,name").order("sort_order").order("name"),
    s.from("sites").select("id,name,area_id"),
    s.from("v_stock").select("site_id,total,available"),
  ]);
  const err = areasQ.error || sitesQ.error;
  if (err) return <div className="card text-red-600">โหลดข้อมูลไม่ได้: {err.message}<br />ถ้าเพิ่งอัปเดตระบบ ให้รัน <code>migration_007_areas.sql</code> ใน Supabase</div>;

  const sites = (sitesQ.data || []) as any[];

  // งานที่ยังไม่ใส่เลขใบตัดงาน (ยังไม่กด "งานเสร็จ") — นับเฉพาะใบที่อนุมัติแล้ว
  let wq: any = await s.from("withdrawals").select("id,pole_free,area_id,approved_at").is("done_at", null);
  if (wq.error) wq = await s.from("withdrawals").select("id").is("done_at", null); // ยังไม่ได้รัน migration 012/013
  const openW = ((wq.data || []) as any[]).filter((w) => w.approved_at !== null);
  const wSites = new Map<string, Set<string>>();
  for (let i = 0; i < openW.length; i += 60) {
    const { data } = await s.from("poles").select("withdrawal_id,site_id").in("withdrawal_id", openW.slice(i, i + 60).map((w) => w.id)).limit(5000);
    for (const r of (data || []) as any[]) { if (!wSites.has(r.withdrawal_id)) wSites.set(r.withdrawal_id, new Set()); wSites.get(r.withdrawal_id)!.add(r.site_id); }
  }
  const openCount = (siteList: any[], areaKey: string) => {
    if (areaKey === "all") return openW.length;
    const ids = new Set(siteList.map((x) => x.id));
    return openW.filter((w) => {
      const ss = wSites.get(w.id);
      if (ss && Array.from(ss).some((x) => ids.has(x))) return true;
      return !!w.pole_free && (areaKey === "none" ? !w.area_id : w.area_id === areaKey);
    }).length;
  };
  const stock = (stockQ.data || []) as any[];
  const sum = (siteIds: Set<string>, k: "total" | "available") => stock.filter((r) => siteIds.has(r.site_id)).reduce((a, r) => a + Number(r[k]), 0);

  const card = (key: string, id: string, title: string, siteList: any[], emoji = "📍") => {
    const open = openCount(siteList, id);
    const ids = new Set(siteList.map((x) => x.id));
    const points = new Set(siteList.map((x) => x.name)).size;
    const avail = sum(ids, "available"), total = sum(ids, "total");
    return (
      // ใช้ <a> ธรรมดา (ไม่ใช้ Link) เพราะลิงก์นี้ตั้ง cookie แล้ว redirect
      <a key={key} href={`/api/area/select?id=${id}&to=/summary`} className="card block transition hover:border-brand hover:shadow-md">
        <div className="text-lg font-bold text-brand">{emoji} {title}</div>
        <div className="mt-1 text-sm text-slate-500">{points} จุดกองหมอน · {siteList.length} กอง</div>
        <div className="mt-3 flex items-end gap-1">
          <span className={`text-3xl font-bold ${avail === 0 ? "text-slate-400" : "text-emerald-600"}`}>{avail.toLocaleString()}</span>
          <span className="pb-1 text-sm text-slate-500">/ {total.toLocaleString()} ต้น (ใช้ได้)</span>
        </div>
        {open > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            ⚠️ {open} งานยังไม่ใส่เลขใบตัดงาน
          </div>
        )}
      </a>
    );
  };

  const noArea = sites.filter((x) => !x.area_id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ระบบเบิกเสา</h1>
        <p className="text-sm text-slate-500">เลือกพื้นที่เพื่อเข้าใช้งาน</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(areasQ.data || []).map((a: any) => card(a.id, a.id, a.name, sites.filter((x) => x.area_id === a.id)))}
        {noArea.length > 0 && card("none", "none", "ยังไม่ระบุพื้นที่", noArea, "❔")}
        {card("all", "all", "ดูทุกพื้นที่", sites, "🗂")}
      </div>

      {noArea.length > 0 && <p className="text-xs text-slate-500">มีจุดกอง {noArea.length} กองที่ยังไม่ระบุพื้นที่ — เข้าการ์ด "ยังไม่ระบุพื้นที่" แล้วไปที่เมนู จุดกอง → ✏️ แก้ไข เพื่อกำหนดพื้นที่</p>}

      <AreaAdd />
      <div className="pt-2 text-sm"><a className="text-slate-500 underline" href="/backup">⚙️ สำรอง / นำเข้าข้อมูล</a></div>
    </div>
  );
}
