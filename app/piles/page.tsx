import Link from "next/link";
import { db } from "@/lib/supabase";
import { scopedSites } from "@/lib/area";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// ระดับ 1: รายการ "จุดกองหมอน" (กองที่เสาหมดแล้วจะไม่แสดง)
export default async function Piles({ searchParams }: { searchParams: { all?: string } }) {
  const showAll = searchParams.all === "1";
  const [{ data: sites, error }, { data: stock }] = await Promise.all([
    scopedSites("id,name"),
    db().from("v_stock").select("site_id,size_name,sort_order,total,available"),
  ]);
  if (error) return <div className="card text-red-600">{error.message}</div>;

  const nameOf = new Map<string, string>((sites || []).map((s: any) => [s.id as string, s.name as string]));
  type G = { name: string; piles: Set<string>; active: Set<string>; sizes: Map<string, { sort: number; avail: number; total: number }> };
  const groups = new Map<string, G>();
  for (const s of sites || []) if (!groups.has(s.name)) groups.set(s.name, { name: s.name, piles: new Set(), active: new Set(), sizes: new Map() });
  for (const s of sites || []) groups.get(s.name)!.piles.add(s.id);
  for (const r of (stock || []) as any[]) {
    const g = groups.get(nameOf.get(r.site_id) || "");
    if (!g || Number(r.total) === 0) continue;
    if (Number(r.available) > 0) g.active.add(r.site_id);
    const c = g.sizes.get(r.size_name) || { sort: r.sort_order, avail: 0, total: 0 };
    c.avail += Number(r.available); c.total += Number(r.total);
    g.sizes.set(r.size_name, c);
  }

  const all = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  const hasStock = (g: G) => Array.from(g.sizes.values()).some((s) => s.avail > 0);
  const list = showAll ? all : all.filter(hasStock);
  const hidden = all.length - all.filter(hasStock).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ผังกองเสา</h1>
          <p className="text-sm text-slate-500">เลือกจุดกองหมอน → เลือกขนาดเสา → ดูผังกองเสาของขนาดนั้น</p>
        </div>
        {hidden > 0 && (showAll
          ? <Link href="/piles" className="text-sm text-brand underline">ซ่อนจุดที่เสาหมดแล้ว ({hidden})</Link>
          : <Link href="/piles?all=1" className="text-sm text-slate-500 underline">แสดงจุดที่เสาหมดแล้ว ({hidden})</Link>)}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((g) => {
          const sz = Array.from(g.sizes.entries()).filter(([, v]) => showAll || v.avail > 0).sort((a, b) => a[1].sort - b[1].sort);
          const avail = sz.reduce((x, [, v]) => x + v.avail, 0);
          return (
            <Link key={g.name} href={`/piles/point?name=${encodeURIComponent(g.name)}${showAll ? "&all=1" : ""}`} className="card block hover:border-brand">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">📍 {g.name}</div>
                  <div className="text-xs text-slate-500">{g.active.size} กองที่ยังมีเสา · ทั้งหมด {g.piles.size} กอง</div>
                </div>
                <div className="text-right"><div className="text-2xl font-bold text-emerald-600">{avail}</div><div className="text-xs text-slate-400">ต้นคงเหลือ</div></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sz.map(([n, v]) => <span key={n} className="chip">{n}: {v.avail}</span>)}
              </div>
            </Link>
          );
        })}
        {list.length === 0 && <div className="card text-slate-500">{all.length === 0 ? "ยังไม่มีจุดกองหมอน" : "เสาในทุกจุดหมดแล้ว"}</div>}
      </div>
    </div>
  );
}
