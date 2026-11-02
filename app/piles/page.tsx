import Link from "next/link";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Piles() {
  const [{ data: sites, error }, { data: stock }] = await Promise.all([
    db().from("sites").select("id,label,lat,lng,note").order("label"),
    db().from("v_stock").select("site_id,total,available,withdrawn"),
  ]);
  if (error) return <div className="card text-red-600">{error.message}</div>;

  const sum = (id: string, k: "total" | "available" | "withdrawn") =>
    (stock || []).filter((r: any) => r.site_id === id).reduce((a: number, r: any) => a + Number(r[k]), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ผังกองเสา</h1>
      <p className="text-sm text-slate-500">เลือกกองเพื่อดูผังเสาเรียงตามชั้นและลำดับ พร้อมประวัติการเพิ่ม/เบิก</p>
      <div className="grid gap-3 md:grid-cols-2">
        {(sites || []).map((s: any) => (
          <Link key={s.id} href={`/piles/${s.id}`} className="card block hover:border-brand">
            <div className="font-semibold">{s.label}</div>
            <div className="mt-1 text-sm text-slate-500">{s.lat != null ? `${s.lat}, ${s.lng}` : "ไม่มีพิกัด"}</div>
            <div className="mt-2 flex gap-2 text-sm">
              <span className="chip">ทั้งหมด {sum(s.id, "total")}</span>
              <span className="chip !bg-emerald-100 !text-emerald-700">คงเหลือ {sum(s.id, "available")}</span>
              <span className="chip !bg-orange-100 !text-orange-700">เบิกแล้ว {sum(s.id, "withdrawn")}</span>
            </div>
          </Link>
        ))}
        {(sites || []).length === 0 && <div className="card text-slate-500">ยังไม่มีจุดกอง</div>}
      </div>
    </div>
  );
}
