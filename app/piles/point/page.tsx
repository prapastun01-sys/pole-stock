import Link from "next/link";
import { db } from "@/lib/supabase";
import { fetchPoles } from "@/lib/pile";
import StackView from "@/components/StackView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// ระดับ 2: จุดกองหมอนหนึ่งจุด → เลือกขนาดเสา → ผังของแต่ละกองที่ยังมีเสาขนาดนั้น
export default async function Point({ searchParams }: { searchParams: { name?: string; size?: string; all?: string } }) {
  const name = searchParams.name || "";
  const showAll = searchParams.all === "1";
  const s = db();

  const { data: sites } = await s.from("sites").select("id,name,pile,label,lat,lng,note").eq("name", name).order("pile");
  if (!sites || sites.length === 0)
    return <div className="card">ไม่พบจุดกองหมอนนี้ <Link className="text-brand underline" href="/piles">กลับ</Link></div>;

  const ids = sites.map((x: any) => x.id);
  const { data: stock } = await s.from("v_stock").select("site_id,size_id,size_name,sort_order,total,available").in("site_id", ids);
  const rows = (stock || []) as any[];

  // ขนาดที่มีในจุดนี้ (รวมทุกกอง) — ซ่อนขนาดที่หมดแล้ว
  const sizeMap = new Map<string, { id: string; name: string; sort: number; total: number; avail: number }>();
  for (const r of rows) {
    if (Number(r.total) === 0) continue;
    const c = sizeMap.get(r.size_id) || { id: r.size_id, name: r.size_name, sort: r.sort_order, total: 0, avail: 0 };
    c.total += Number(r.total); c.avail += Number(r.available);
    sizeMap.set(r.size_id, c);
  }
  const allSizes = Array.from(sizeMap.values()).sort((a, b) => a.sort - b.sort);
  const sizes = showAll ? allSizes : allSizes.filter((z) => z.avail > 0);
  const hiddenSizes = allSizes.length - allSizes.filter((z) => z.avail > 0).length;

  const sel = sizes.find((z) => z.id === searchParams.size) || sizes[0];

  // กองที่มีเสาขนาดที่เลือก (ซ่อนกองที่หมดแล้ว)
  const piles = sel
    ? sites
        .map((site: any) => {
          const r = rows.find((x) => x.site_id === site.id && x.size_id === sel.id);
          return { site, total: Number(r?.total || 0), avail: Number(r?.available || 0) };
        })
        .filter((p) => p.total > 0 && (showAll || p.avail > 0))
    : [];
  const stacks = await Promise.all(piles.map((p) => fetchPoles(p.site.id, sel!.id)));

  const qs = (size?: string) => `/piles/point?name=${encodeURIComponent(name)}${size ? `&size=${size}` : ""}${showAll ? "&all=1" : ""}`;
  const totalAvail = allSizes.reduce((a, z) => a + z.avail, 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href={showAll ? "/piles?all=1" : "/piles"} className="text-sm text-brand underline">← จุดกองหมอนทั้งหมด</Link>
        <h1 className="text-2xl font-bold">📍 {name}</h1>
        <div className="mt-1 flex flex-wrap gap-2 text-sm">
          <span className="chip !bg-emerald-100 !text-emerald-700">คงเหลือ {totalAvail} ต้น</span>
          <span className="chip">{sites.length} กอง</span>
          {sites[0].lat != null && <a className="chip" target="_blank" href={`https://maps.google.com/?q=${sites[0].lat},${sites[0].lng}`}>🗺 แผนที่</a>}
        </div>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">เลือกขนาดเสา</h2>
        <div className="flex flex-wrap gap-2">
          {sizes.map((z) => (
            <Link key={z.id} href={qs(z.id)}
              className={`rounded-xl border px-4 py-2 ${sel?.id === z.id ? "border-brand bg-brand font-semibold text-white" : "border-slate-300 bg-white hover:border-brand"}`}>
              {z.name} <span className={sel?.id === z.id ? "text-white/80" : "text-slate-400"}>· {z.avail}{showAll ? `/${z.total}` : ""} ต้น</span>
            </Link>
          ))}
          {sizes.length === 0 && <p className="text-slate-500">เสาในจุดนี้หมดแล้ว</p>}
        </div>
        {hiddenSizes > 0 && !showAll && <p className="mt-2 text-xs text-slate-400">ซ่อนขนาดที่หมดแล้ว {hiddenSizes} ขนาด · <Link className="underline" href={`${qs(sel?.id)}&all=1`}>แสดงทั้งหมด</Link></p>}
        {showAll && <p className="mt-2 text-xs text-slate-400"><Link className="underline" href={`/piles/point?name=${encodeURIComponent(name)}${sel ? `&size=${sel.id}` : ""}`}>ซ่อนที่หมดแล้ว</Link></p>}
      </section>

      {sel && (
        <div className="space-y-3">
          <h2 className="font-semibold">กองเสาขนาด {sel.name} <span className="text-sm font-normal text-slate-500">({piles.length} กอง · ชั้นบนอยู่บน, อ่านซ้าย → ขวา)</span></h2>
          {piles.map((p, i) => (
            <section key={p.site.id} className="card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.site.pile ? p.site.pile : "กอง (ไม่ระบุชื่อ)"}</div>
                  <div className="text-xs text-slate-500">คงเหลือ <b className="text-emerald-600">{p.avail}</b> / {p.total} ต้น</div>
                </div>
                <Link href={`/piles/${p.site.id}`} className="btn-ghost !py-1.5 text-sm">ดูประวัติกองนี้</Link>
              </div>
              <StackView poles={stacks[i]} />
            </section>
          ))}
          {piles.length === 0 && <div className="card text-slate-500">ไม่มีกองที่มีเสาขนาดนี้เหลือ</div>}
        </div>
      )}
      <div className="flex gap-1 text-xs text-slate-500">
        <span><i className="mr-1 inline-block h-3 w-3 rounded border border-yellow-400 bg-yellow-100" />คงเหลือ</span>
        <span className="ml-3"><i className="mr-1 inline-block h-3 w-3 rounded border border-slate-300 bg-slate-200" />เบิกแล้ว</span>
      </div>
    </div>
  );
}
