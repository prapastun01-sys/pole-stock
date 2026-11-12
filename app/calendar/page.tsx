import Link from "next/link";
import { db } from "@/lib/supabase";
import { areaSiteIds, poleFreeInScope } from "@/lib/area";
import { todayBKK, unitOf } from "@/lib/items";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

type W = { id: string; job_name: string; team: string | null; responsible: string; move_date: string; items: any[]; poles: { site_id: string; pole_sizes: { name: string } | null }[] };

export default async function Calendar({ searchParams }: { searchParams: { m?: string; d?: string } }) {
  const today = todayBKK();
  const mm = /^\d{4}-\d{2}$/.test(searchParams.m || "") ? searchParams.m! : (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.d || "") ? searchParams.d!.slice(0, 7) : today.slice(0, 7));
  const [Y, M] = mm.split("-").map(Number);
  const first = ymd(Y, M, 1);
  const daysIn = new Date(Y, M, 0).getDate();
  const last = ymd(Y, M, daysIn);
  const startDow = new Date(Y, M - 1, 1).getDay();
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d || "") && searchParams.d!.startsWith(mm) ? searchParams.d! : (today.startsWith(mm) ? today : "");

  const q = (cols: string) => db().from("withdrawals").select(cols)
    .gte("move_date", first).lte("move_date", last).order("created_at", { ascending: true });
  const BASE = "id,job_name,team,responsible,move_date,items,poles(site_id,pole_sizes(name))";
  let { data, error } = await q(BASE + ",pole_free,area_id,approved_at");
  if (error && /pole_free|area_id|approved_at/.test(error.message)) ({ data, error } = await q(BASE)); // ยังไม่ได้รัน migration_012
  if (error) return <div className="card text-red-600">{error.message}<br />ต้องรัน <code>migration_010_move_date.sql</code> ใน Supabase ก่อน</div>;

  // กรองตามพื้นที่: นับเฉพาะเสาในกองของพื้นที่ที่เลือก
  const ids = await areaSiteIds();
  const set = ids ? new Set(ids) : null;
  const ws: W[] = ((data || []) as any[])
    .map((w) => ({ ...w, poles: set ? w.poles.filter((p: any) => set.has(p.site_id)) : w.poles }))
    .filter((w) => (w as any).approved_at !== null)
    .filter((w) => !set || w.poles.length > 0 || poleFreeInScope(w));

  const byDay = new Map<string, W[]>();
  for (const w of ws) { if (!byDay.has(w.move_date)) byDay.set(w.move_date, []); byDay.get(w.move_date)!.push(w); }

  const prev = M === 1 ? `${Y - 1}-12` : `${Y}-${pad(M - 1)}`;
  const next = M === 12 ? `${Y + 1}-01` : `${Y}-${pad(M + 1)}`;
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const dayWs = sel ? byDay.get(sel) || [] : [];

  // รวมยอด: เสาตามขนาด + อุปกรณ์ตามรหัส
  const agg = (list: W[]) => {
    const sizes = new Map<string, number>(); const items = new Map<string, { code: string; name: string; qty: number }>();
    for (const w of list) {
      for (const p of w.poles) { const n = p.pole_sizes?.name || "-"; sizes.set(n, (sizes.get(n) || 0) + 1); }
      for (const it of w.items || []) { const c = items.get(it.code) || { code: it.code, name: it.name, qty: 0 }; c.qty += Number(it.qty) || 0; items.set(it.code, c); }
    }
    return { sizes: Array.from(sizes.entries()), items: Array.from(items.values()).sort((a, b) => a.code.localeCompare(b.code)) };
  };
  const teams = new Map<string, W[]>();
  for (const w of dayWs) { const t = (w.team || "").trim() || "ไม่ระบุทีม"; if (!teams.has(t)) teams.set(t, []); teams.get(t)!.push(w); }
  const lnk = (o: { m?: string; d?: string }) => "/calendar?" + new URLSearchParams(o as Record<string, string>).toString();
  const selTH = sel ? new Date(sel + "T12:00:00+07:00").toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "full" }) : "";

  const Summary = ({ list }: { list: W[] }) => {
    const a = agg(list);
    return (
      <div className="space-y-2 text-sm">
        <ul className="space-y-0.5">
          {a.sizes.map(([n, c]) => <li key={n}>🪵 เสา {n} <b>{c}</b> ต้น</li>)}
        </ul>
        {a.items.length > 0 && (
          <ul className="space-y-0.5 border-t pt-2">
            {a.items.map((x) => <li key={x.code}><span className="font-mono text-xs text-slate-500">{x.code}</span> {x.name} <b>{x.qty}</b> {unitOf(x.name)}</li>)}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ปฏิทินขนเสา</h1>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <Link className="btn-ghost !py-1.5" href={lnk({ m: prev })}>←</Link>
          <div className="text-center">
            <div className="text-lg font-semibold">{MONTHS[M - 1]} {Y + 543}</div>
            {mm !== today.slice(0, 7) && <Link className="text-xs text-brand underline" href={lnk({ m: today.slice(0, 7), d: today })}>กลับเดือนนี้</Link>}
          </div>
          <Link className="btn-ghost !py-1.5" href={lnk({ m: next })}>→</Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">{DOW.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = ymd(Y, M, d); const list = byDay.get(k);
            const n = list ? list.reduce((a, w) => a + w.poles.length, 0) : 0;
            const isSel = k === sel, isToday = k === today;
            return (
              <Link key={i} href={lnk({ m: mm, d: k })}
                className={`flex min-h-14 flex-col items-center rounded-xl border p-1 text-sm md:min-h-20 ${isSel ? "border-brand bg-brand text-white" : list ? "border-brand/40 bg-brand-light" : "border-slate-200 hover:bg-slate-50"} ${isToday && !isSel ? "ring-2 ring-orange-400" : ""}`}>
                <span className="font-semibold">{d}</span>
                {list && <span className={`mt-0.5 rounded-full px-1.5 text-[10px] leading-4 ${isSel ? "bg-white/25" : "bg-brand text-white"}`}>🚚 {n}</span>}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">🚚 = วันที่มีการขนเสา (ตัวเลข = จำนวนเสา) · วงกรอบส้ม = วันนี้</p>
      </section>

      {sel && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">📅 {selTH}</h2>
          {dayWs.length === 0 ? <div className="card text-slate-500">วันนี้ไม่มีการขนเสา</div> : (
            <>
              <div className="card border-brand/40">
                <div className="mb-2 font-semibold">ยอดรวมทั้งวัน <span className="text-sm font-normal text-slate-500">({teams.size} ทีม · {dayWs.length} ใบเบิก)</span></div>
                <Summary list={dayWs} />
              </div>
              {Array.from(teams.entries()).map(([t, list]) => (
                <div key={t} className="card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">👷 ทีม {t}</h3>
                    <span className="text-xs text-slate-500">{list.length} ใบเบิก</span>
                  </div>
                  <Summary list={list} />
                  <div className="border-t pt-2 text-xs text-slate-500">
                    {list.map((w) => <div key={w.id}>• {w.job_name} · {w.responsible} · <Link className="text-brand underline" href={`/print/${w.id}`} target="_blank">ใบเบิก</Link></div>)}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
