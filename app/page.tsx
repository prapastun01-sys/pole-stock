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
  const stock = (stockQ.data || []) as any[];
  const sum = (siteIds: Set<string>, k: "total" | "available") => stock.filter((r) => siteIds.has(r.site_id)).reduce((a, r) => a + Number(r[k]), 0);

  const card = (key: string, id: string, title: string, siteList: any[], emoji = "📍") => {
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
