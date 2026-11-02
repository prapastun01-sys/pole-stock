import Link from "next/link";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Row = { site_id: string; site_name: string; size_id: string; size_name: string; sort_order: number; total: number; available: number; withdrawn: number };

export default async function Dashboard() {
  const [{ data, error }, { data: siteRows }] = await Promise.all([
    db().from("v_stock").select("*"),
    db().from("sites").select("id,name"),
  ]);
  if (error) return <div className="card text-red-600">โหลดข้อมูลไม่ได้: {error.message}<br />ตรวจสอบว่ารัน schema.sql แล้ว และตั้งค่า env ถูกต้อง</div>;

  const rows = (data || []) as Row[];
  const sizes = Array.from(new Map(rows.map((r) => [r.size_id, r])).values()).sort((a, b) => a.sort_order - b.sort_order || a.size_name.localeCompare(b.size_name));
  const sum = (f: (r: Row) => number, filter: (r: Row) => boolean = () => true) => rows.filter(filter).reduce((a, r) => a + Number(f(r)), 0);
  const total = sum((r) => r.total), avail = sum((r) => r.available), out = sum((r) => r.withdrawn);

  // สรุปรายจุดกองหมอน: รวมทุกกองในจุดเดียวกัน แล้วแยกตามขนาดเสา
  const nameOf = new Map((siteRows || []).map((s: any) => [s.id, s.name as string]));
  type G = { name: string; piles: number; sizes: Map<string, { name: string; sort: number; total: number; avail: number }> };
  const groups = new Map<string, G>();
  for (const s of siteRows || []) {
    if (!groups.has(s.name)) groups.set(s.name, { name: s.name, piles: 0, sizes: new Map() });
    groups.get(s.name)!.piles++;
  }
  for (const r of rows) {
    const g = groups.get(nameOf.get(r.site_id) || "");
    if (!g || Number(r.total) === 0) continue;
    const cur = g.sizes.get(r.size_id) || { name: r.size_name, sort: r.sort_order, total: 0, avail: 0 };
    cur.total += Number(r.total); cur.avail += Number(r.available);
    g.sizes.set(r.size_id, cur);
  }
  const list = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">สรุปภาพรวม</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="จุดกองหมอน" value={groups.size} />
        <Stat label="เสาทั้งหมด" value={total} />
        <Stat label="ใช้ได้ (คงเหลือ)" value={avail} color="text-emerald-600" />
        <Stat label="เบิกแล้ว" value={out} color="text-orange-600" />
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">ยอดตามขนาดเสา (ทุกกอง)</h2>
        <div className="space-y-3">
          {sizes.map((z) => {
            const t = sum((r) => r.total, (r) => r.size_id === z.size_id);
            const a = sum((r) => r.available, (r) => r.size_id === z.size_id);
            return (
              <div key={z.size_id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{z.size_name}</span>
                  <span><b className="text-emerald-600">{a}</b> / {t} ต้น</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: t ? `${(a / t) * 100}%` : "0%" }} />
                </div>
              </div>
            );
          })}
          {sizes.length === 0 && <p className="text-slate-500">ยังไม่มีข้อมูล</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">แยกตามจุดกองหมอน <span className="text-sm font-normal text-slate-500">(คงเหลือ / ทั้งหมด)</span></h2>
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g) => {
            const sz = Array.from(g.sizes.values()).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
            const a = sz.reduce((x, s) => x + s.avail, 0), t = sz.reduce((x, s) => x + s.total, 0);
            return (
              <Link key={g.name} href={`/piles/point?name=${encodeURIComponent(g.name)}`} className="card block hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">📍 {g.name}</div>
                    <div className="text-xs text-slate-500">{g.piles} กอง</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${a === 0 ? "text-red-500" : "text-emerald-600"}`}>{a}</div>
                    <div className="text-xs text-slate-400">/ {t} ต้น</div>
                  </div>
                </div>
                <ul className="mt-2 divide-y text-sm">
                  {sz.map((s) => (
                    <li key={s.name} className="flex justify-between py-1">
                      <span>{s.name}</span>
                      <span><b className={s.avail === 0 ? "text-red-500" : "text-emerald-600"}>{s.avail}</b><span className="text-slate-400"> / {s.total} ต้น</span></span>
                    </li>
                  ))}
                  {sz.length === 0 && <li className="py-1 text-slate-400">ยังไม่มีเสา</li>}
                </ul>
              </Link>
            );
          })}
          {list.length === 0 && <div className="card text-slate-500">ยังไม่มีจุดกองหมอน — เริ่มที่เมนู "จุดกอง"</div>}
        </div>
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
