import Link from "next/link";
import { db } from "@/lib/supabase";
import { areaSiteIds, scopedSites } from "@/lib/area";
import { KINDS, kindOf } from "@/lib/kinds";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Row = { site_id: string; size_id: string; kind: string; total: number; available: number; withdrawn: number };

// สรุปยอด "แยกตามประเภทเสา" — ไม่นำประเภทมารวมกัน
export default async function Summary({ searchParams }: { searchParams: { kind?: string } }) {
  const ids = await areaSiteIds();
  let kq: any = db().from("v_stock_kind").select("*");
  if (ids) kq = kq.in("site_id", ids);
  const [{ data, error }, sitesQ, sizesQ] = await Promise.all([
    kq,
    scopedSites("id,name"),
    db().from("pole_sizes").select("id,name,sort_order").order("sort_order").order("name"),
  ]);
  if (error) return <div className="card text-red-600">โหลดข้อมูลไม่ได้: {error.message}<br />ถ้าเพิ่งอัปเดตระบบ ให้รัน <code>migration_007_areas.sql</code> ใน Supabase</div>;

  const rows = (data || []) as Row[];
  const nameOf = new Map<string, string>((sitesQ.data || []).map((s: any) => [s.id, s.name]));
  const sizeName = new Map<string, { name: string; sort: number }>((sizesQ.data || []).map((z: any) => [z.id, { name: z.name, sort: z.sort_order }]));
  const sum = (rs: Row[], k: "total" | "available" | "withdrawn") => rs.reduce((a, r) => a + Number(r[k]), 0);

  const kindSel = KINDS.find((k) => k.v === searchParams.kind)?.v || "new";
  const mine = rows.filter((r) => r.kind === kindSel);
  const k = kindOf(kindSel);

  // ยอดตามขนาด (เฉพาะประเภทที่เลือก)
  const bySize = Array.from(new Set(mine.map((r) => r.size_id)))
    .map((id) => { const rs = mine.filter((r) => r.size_id === id); return { id, name: sizeName.get(id)?.name || "-", sort: sizeName.get(id)?.sort ?? 0, total: sum(rs, "total"), avail: sum(rs, "available") }; })
    .sort((a, b) => a.sort - b.sort);

  // ยอดตามจุดกองหมอน (รวมกองย่อยของจุดเดียวกัน) แยกขนาด
  type G = { name: string; piles: Set<string>; sizes: Map<string, { name: string; sort: number; total: number; avail: number }> };
  const groups = new Map<string, G>();
  for (const r of mine) {
    const n = nameOf.get(r.site_id); if (!n) continue;
    if (!groups.has(n)) groups.set(n, { name: n, piles: new Set(), sizes: new Map() });
    const g = groups.get(n)!; g.piles.add(r.site_id);
    const c = g.sizes.get(r.size_id) || { name: sizeName.get(r.size_id)?.name || "-", sort: sizeName.get(r.size_id)?.sort ?? 0, total: 0, avail: 0 };
    c.total += Number(r.total); c.avail += Number(r.available);
    g.sizes.set(r.size_id, c);
  }
  const list = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">สรุปภาพรวม <span className="text-base font-normal text-slate-500">(แยกตามประเภทเสา)</span></h1>

      {/* เลือกประเภท: แต่ละประเภทแสดงยอดของตัวเอง ไม่รวมกัน */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {KINDS.map((x) => {
          const rs = rows.filter((r) => r.kind === x.v);
          const on = x.v === kindSel;
          return (
            <Link key={x.v} href={`/summary?kind=${x.v}`} className={`rounded-2xl border p-3 ${on ? "border-brand bg-brand text-white shadow" : "border-slate-200 bg-white hover:border-brand"}`}>
              <div className={`text-sm ${on ? "text-white/90" : "text-slate-500"}`}>{x.label}</div>
              <div className="text-2xl font-bold">{sum(rs, "available").toLocaleString()}</div>
              <div className={`text-xs ${on ? "text-white/80" : "text-slate-400"}`}>ใช้ได้ / ทั้งหมด {sum(rs, "total").toLocaleString()}</div>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold"><span className={`rounded-lg px-2 py-0.5 ${k.cls}`}>{k.label}</span></h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="ทั้งหมด" value={sum(mine, "total")} />
          <Stat label="ใช้ได้ (คงเหลือ)" value={sum(mine, "available")} color="text-emerald-600" />
          <Stat label="เบิกแล้ว" value={sum(mine, "withdrawn")} color="text-orange-600" />
        </div>

        {mine.length === 0 ? (
          <div className="card text-slate-500">ยังไม่มี{k.label}ในพื้นที่นี้</div>
        ) : (
          <>
            <div className="card">
              <h3 className="mb-3 font-semibold">ยอดตามขนาดเสา</h3>
              <div className="space-y-3">
                {bySize.map((z) => (
                  <div key={z.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{z.name}</span>
                      <span><b className="text-emerald-600">{z.avail}</b> / {z.total} ต้น</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: z.total ? `${(z.avail / z.total) * 100}%` : "0%" }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <h3 className="font-semibold">แยกตามจุดกองหมอน <span className="text-sm font-normal text-slate-500">(ใช้ได้ / ทั้งหมด)</span></h3>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((g) => {
                const sz = Array.from(g.sizes.values()).sort((a, b) => a.sort - b.sort);
                const a = sz.reduce((x, s) => x + s.avail, 0), t = sz.reduce((x, s) => x + s.total, 0);
                return (
                  <Link key={g.name} href={`/piles/point?name=${encodeURIComponent(g.name)}`} className="card block hover:border-brand">
                    <div className="flex items-start justify-between gap-2">
                      <div><div className="font-semibold">📍 {g.name}</div><div className="text-xs text-slate-500">{g.piles.size} กอง</div></div>
                      <div className="text-right"><div className={`text-2xl font-bold ${a === 0 ? "text-red-500" : "text-emerald-600"}`}>{a}</div><div className="text-xs text-slate-400">/ {t} ต้น</div></div>
                    </div>
                    <ul className="mt-2 divide-y text-sm">
                      {sz.map((s) => (
                        <li key={s.name} className="flex justify-between py-1">
                          <span>{s.name}</span>
                          <span><b className={s.avail === 0 ? "text-red-500" : "text-emerald-600"}>{s.avail}</b><span className="text-slate-400"> / {s.total} ต้น</span></span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, color = "text-slate-800" }: { label: string; value: number; color?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
