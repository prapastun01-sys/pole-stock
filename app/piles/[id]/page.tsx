import Link from "next/link";
import { db } from "@/lib/supabase";
import { pilePhotos } from "@/lib/pile";
import { withdrawalColors } from "@/lib/wcolor";
import PilePhotosView from "@/components/PilePhotosView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const fmt = (d: string) => new Date(d).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
const day = (d: string) => new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });

async function allPoles(siteId: string) {
  const s = db();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s
      .from("poles")
      .select("id,pole_no,tier,pos,status,photo_url,created_at,withdrawn_at,size_id,withdrawal_id,pole_sizes(name),withdrawals(job_name,responsible,team,created_at)")
      .eq("site_id", siteId)
      .order("tier", { ascending: true, nullsFirst: false })
      .order("pos", { ascending: true, nullsFirst: false })
      .order("pole_no")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default async function Pile({ params }: { params: { id: string } }) {
  const s = db();
  const { data: site } = await s.from("sites").select("id,label,lat,lng,note").eq("id", params.id).single();
  if (!site) return <div className="card">ไม่พบจุดกองนี้ <Link className="text-brand underline" href="/piles">กลับ</Link></div>;

  let poles: any[] = [];
  try { poles = await allPoles(params.id); } catch (e: any) { return <div className="card text-red-600">{e.message}</div>; }

  // ใบเบิกที่แตะกองนี้ (ใบเดียวอาจเบิกหลายกอง) — แสดงเฉพาะเสาของกองนี้
  const wIds = Array.from(new Set(poles.map((p) => p.withdrawal_id).filter(Boolean))) as string[];
  const wds: any[] = [];
  for (let i = 0; i < wIds.length; i += 60) {
    const { data } = await s
      .from("withdrawals")
      .select("id,created_at,job_name,responsible,team,poles(pole_no,site_id,pole_sizes(name))")
      .in("id", wIds.slice(i, i + 60));
    wds.push(...(data || []));
  }

  // จัดกลุ่มตามชั้น: ชั้นบนอยู่บน ชั้น 1 อยู่ล่าง; ไม่ระบุชั้นไว้ล่างสุด
  const byTier = new Map<number, any[]>();
  for (const p of poles) {
    const t = p.tier ?? 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(p);
  }
  const tiers = Array.from(byTier.keys()).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : b - a));

  const wcol = withdrawalColors(poles);
  const sizeNames = Array.from(new Set(poles.map((p) => p.pole_sizes?.name).filter(Boolean)));
  const avail = poles.filter((p) => p.status === "available").length;
  const phs = await pilePhotos([params.id]);

  // ประวัติ: เพิ่มเสา (จัดกลุ่มตามวัน+ขนาด) + เบิกเสา
  const adds = new Map<string, { ts: string; size: string; n: number }>();
  for (const p of poles) {
    const k = `${day(p.created_at)}|${p.pole_sizes?.name}`;
    const cur = adds.get(k);
    if (cur) cur.n++; else adds.set(k, { ts: p.created_at, size: p.pole_sizes?.name, n: 1 });
  }
  const events = [
    ...Array.from(adds.values()).map((a) => ({ ts: a.ts, kind: "add", text: `เพิ่มเสา ${a.n} ต้น (${a.size})` })),
    ...wds.map((w: any) => {
      const mine = w.poles.filter((p: any) => p.site_id === params.id);
      return {
        ts: w.created_at, kind: "out",
        text: `เบิก ${mine.length} ต้น — ${w.job_name} · ${w.responsible}${w.team ? " · ทีม " + w.team : ""} · เลข ${mine.map((p: any) => p.pole_no).join(", ")}`,
      };
    }),
  ].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/piles" className="text-sm text-brand underline">← ผังกองเสาทั้งหมด</Link>
        <h1 className="text-2xl font-bold">{site.label}</h1>
        <div className="mt-1 flex flex-wrap gap-2 text-sm">
          <span className="chip">ทั้งหมด {poles.length}</span>
          <span className="chip !bg-emerald-100 !text-emerald-700">คงเหลือ {avail}</span>
          <span className="chip !bg-orange-100 !text-orange-700">เบิกแล้ว {poles.length - avail}</span>
          {sizeNames.map((n) => <span key={n as string} className="chip">{n as string}</span>)}
          {site.lat != null && <a className="chip" target="_blank" href={`https://maps.google.com/?q=${site.lat},${site.lng}`}>🗺 แผนที่</a>}
        </div>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">รูปกอง</h2>
        <PilePhotosView ph={phs[params.id]} />
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">ผังกอง <span className="text-sm font-normal text-slate-500">(ชั้นบนอยู่ด้านบน · อ่านซ้าย → ขวา)</span></h2>
          <div className="flex gap-3 text-xs">
            <span><i className="mr-1 inline-block h-3 w-3 rounded border border-yellow-400 bg-yellow-100" />คงเหลือ</span>
            <span><i className="mr-1 inline-block h-3 w-3 rounded border border-slate-300 bg-slate-200" />เบิกแล้ว</span>
          </div>
        </div>
        {wcol.size > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {Array.from(wcol.values()).map((c) => <span key={c.n}><i className="mr-1 inline-block h-3 w-3 rounded border align-[-2px]" style={{ background: c.bg, borderColor: c.bd }} />{c.label}</span>)}
          </div>
        )}
        <div className="space-y-2 overflow-x-auto">
          {tiers.map((t) => (
            <div key={t} className="flex items-start gap-2">
              <div className="w-14 shrink-0 pt-1.5 text-xs text-slate-400">{t === 0 ? "ไม่ระบุชั้น" : `ชั้น ${t}`}</div>
              <div className="flex flex-wrap gap-1.5">
                {byTier.get(t)!.map((p) => (
                  <div key={p.id}
                    title={`${p.pole_sizes?.name || ""} · ${p.status === "available" ? "คงเหลือ" : "เบิกแล้ว: " + (p.withdrawals?.job_name || "") + (p.withdrawals?.team ? " · ทีม " + p.withdrawals.team : "")}`}
                    style={p.status !== "available" && wcol.get(p.withdrawal_id) ? { background: wcol.get(p.withdrawal_id)!.bg, borderColor: wcol.get(p.withdrawal_id)!.bd } : undefined}
                    className={`relative min-w-[3.6rem] rounded-lg border px-2 py-1.5 text-center text-sm ${p.status !== "available" && p.withdrawals?.team ? "pb-3.5" : ""} ${p.status === "available" ? "border-yellow-400 bg-yellow-100 font-semibold" : "border-slate-300 bg-slate-200 text-slate-600 line-through"}`}>
                    {p.pole_no}
                    {p.status !== "available" && p.withdrawals?.team ? <span className="absolute bottom-0 right-1 max-w-[95%] overflow-hidden whitespace-nowrap text-[9px] font-semibold leading-tight text-teal-700 no-underline">{p.withdrawals.team}</span> : null}
                    {sizeNames.length > 1 && <div className="text-[10px] font-normal no-underline">{p.pole_sizes?.name}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {poles.length === 0 && <p className="text-slate-500">ยังไม่มีเสาในกองนี้ — <Link href="/poles/new" className="text-brand underline">เพิ่มเสา</Link></p>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">ประวัติของกองนี้</h2>
        <ul className="divide-y">
          {events.map((e, i) => (
            <li key={i} className="flex gap-3 py-2 text-sm">
              <span className={`mt-0.5 h-5 shrink-0 rounded px-1.5 text-xs leading-5 ${e.kind === "add" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{e.kind === "add" ? "เพิ่ม" : "เบิก"}</span>
              <div><div>{e.text}</div><div className="text-xs text-slate-400">{fmt(e.ts)}</div></div>
            </li>
          ))}
          {events.length === 0 && <li className="py-3 text-slate-500">ยังไม่มีประวัติ</li>}
        </ul>
      </section>
    </div>
  );
}
