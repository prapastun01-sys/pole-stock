import Link from "next/link";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Row = { site_id: string; site_name: string; size_id: string; size_name: string; sort_order: number; total: number; available: number; withdrawn: number };

export default async function Dashboard() {
  const { data, error } = await db().from("v_stock").select("*");
  if (error) return <div className="card text-red-600">โหลดข้อมูลไม่ได้: {error.message}<br />ตรวจสอบว่ารัน schema.sql แล้ว และตั้งค่า env ถูกต้อง</div>;

  const rows = (data || []) as Row[];
  const sizes = Array.from(new Map(rows.map((r) => [r.size_id, r])).values()).sort((a, b) => a.sort_order - b.sort_order || a.size_name.localeCompare(b.size_name));
  const sites = Array.from(new Map(rows.map((r) => [r.site_id, r.site_name])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const cell = (site: string, size: string) => rows.find((r) => r.site_id === site && r.size_id === size);

  const sum = (f: (r: Row) => number, filter: (r: Row) => boolean = () => true) => rows.filter(filter).reduce((a, r) => a + Number(f(r)), 0);
  const total = sum((r) => r.total), avail = sum((r) => r.available), out = sum((r) => r.withdrawn);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">สรุปภาพรวม</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="จุดกองหมอน" value={sites.length} />
        <Stat label="เสาทั้งหมด" value={total} />
        <Stat label="ใช้ได้ (คงเหลือ)" value={avail} color="text-emerald-600" />
        <Stat label="เบิกแล้ว" value={out} color="text-orange-600" />
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">ยอดตามขนาดเสา</h2>
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

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">ยอดใช้ได้ แยกตามจุดกองหมอน <span className="text-sm font-normal text-slate-500">(คงเหลือ / ทั้งหมด)</span></h2>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-3">จุดกองหมอน</th>
              {sizes.map((z) => <th key={z.size_id} className="px-2 text-center">{z.size_name}</th>)}
              <th className="px-2 text-center">รวม</th>
            </tr>
          </thead>
          <tbody>
            {sites.map(([sid, sname]) => (
              <tr key={sid} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium"><Link className="text-brand underline" href={`/piles/${sid}`}>{sname}</Link></td>
                {sizes.map((z) => {
                  const c = cell(sid, z.size_id);
                  return (
                    <td key={z.size_id} className="px-2 text-center">
                      {c && c.total > 0 ? <><b className={c.available === 0 ? "text-red-500" : "text-emerald-600"}>{c.available}</b><span className="text-slate-400"> / {c.total}</span></> : <span className="text-slate-300">-</span>}
                    </td>
                  );
                })}
                <td className="px-2 text-center font-bold">{sum((r) => r.available, (r) => r.site_id === sid)}</td>
              </tr>
            ))}
            {sites.length === 0 && <tr><td className="py-4 text-slate-500" colSpan={sizes.length + 2}>ยังไม่มีจุดกองหมอน — เริ่มที่เมนู "จุดกอง"</td></tr>}
          </tbody>
        </table>
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
