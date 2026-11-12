import Link from "next/link";
import { db } from "@/lib/supabase";
import { areaSiteIds, poleFreeInScope } from "@/lib/area";
import HistoryCard from "@/components/HistoryCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const SEL = "*, poles(pole_no,tier,pos,sites(label),pole_sizes(name))";
type SP = { q?: string; n?: string; p?: string; show?: string };

export default async function History({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q || "").trim();
  const n = [10, 50, 100].includes(Number(searchParams.n)) ? Number(searchParams.n) : 10;
  const showDone = searchParams.show === "1";
  const s = db();

  // 1) รายการใบเบิกแบบเบา ๆ (ใช้กรอง/ค้นหา/แบ่งหน้า)
  const lean: any[] = [];
  for (let from = 0; ; from += 1000) {
    const COLS = "id,created_at,done_at,job_name,wbs,network,team,responsible,cut_no";
    const run = (c: string) => s.from("withdrawals").select(c).order("created_at", { ascending: false }).range(from, from + 999);
    let { data, error } = await run(COLS + ",pole_free,area_id,approved_at");
    if (error && /pole_free|area_id|approved_at/.test(error.message)) ({ data, error } = await run(COLS)); // ยังไม่ได้รัน migration 012/013
    if (error) return <div className="card text-red-600">{error.message}</div>;
    lean.push(...((data || []) as any[]));
    if ((data || []).length < 1000) break;
  }

  // 2) กรองตามพื้นที่ (ใบเบิกที่มีเสาในกองของพื้นที่นี้)
  let rows = lean;
  const ids = await areaSiteIds();
  if (ids !== null) {
    const wset = new Set<string>();
    for (let i = 0; i < ids.length; i += 50) {
      const { data } = await s.from("poles").select("withdrawal_id").in("site_id", ids.slice(i, i + 50)).not("withdrawal_id", "is", null).limit(10000);
      (data || []).forEach((x: any) => wset.add(x.withdrawal_id));
    }
    rows = rows.filter((w) => wset.has(w.id) || poleFreeInScope(w));
  }

  // 3) ค้นหา: WBS / โครงข่าย / ทีมงาน / ผู้รับผิดชอบ / ชื่องาน / เลขใบตัดงาน / เลขเสา
  if (q) {
    const ql = q.toLowerCase();
    const safe = q.replace(/[%,()*\\]/g, " ").trim();
    const hit = new Set<string>();
    if (safe) {
      const { data } = await s.from("poles").select("withdrawal_id").ilike("pole_no", `%${safe}%`).not("withdrawal_id", "is", null).limit(5000);
      (data || []).forEach((x: any) => hit.add(x.withdrawal_id));
    }
    rows = rows.filter((w) => hit.has(w.id) || [w.wbs, w.network, w.team, w.responsible, w.job_name, w.cut_no].some((v) => String(v || "").toLowerCase().includes(ql)));
  }

  const pendingCount = rows.filter((w) => w.approved_at === null).length;
  rows = rows.filter((w) => w.approved_at !== null); // ใบที่รออนุมัติอยู่หน้า "รออนุมัติ"
  const doneCount = rows.filter((w) => w.done_at).length;
  if (!showDone) rows = rows.filter((w) => !w.done_at);

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / n));
  const p = Math.min(Math.max(1, parseInt(searchParams.p || "1", 10) || 1), pages);
  const pageIds = rows.slice((p - 1) * n, p * n).map((w) => w.id);

  // 4) ดึงข้อมูลเต็มเฉพาะหน้านี้
  const full: any[] = [];
  for (let i = 0; i < pageIds.length; i += 50) {
    const { data, error } = await s.from("withdrawals").select(SEL).in("id", pageIds.slice(i, i + 50));
    if (error) return <div className="card text-red-600">{error.message}</div>;
    full.push(...(data || []));
  }
  full.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const { data: acc } = await s.from("accessories").select("id,code,name").eq("active", true).order("sort_order").order("code");

  const href = (o: Partial<SP>) => {
    const m: Record<string, string> = { q, n: String(n), ...(showDone ? { show: "1" } : {}), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v != null) as [string, string][]) };
    if (o.show === "") delete m.show;
    if (!m.q) delete m.q;
    return "/history?" + new URLSearchParams(m).toString();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ประวัติการเบิกเสา</h1>

      {pendingCount > 0 && (
        <Link href="/approvals" className="card flex items-center justify-between border-amber-300 bg-amber-50 text-amber-800">
          <span>⏳ มีใบเบิกรออนุมัติ <b>{pendingCount}</b> ใบ</span><span className="underline">ไปหน้ารออนุมัติ →</span>
        </Link>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div className="min-w-56 grow">
          <label className="label">🔎 ค้นหา (WBS · โครงข่าย · ทีมงาน · ผู้รับผิดชอบ · ชื่องาน · เลขเสา)</label>
          <input className="input" name="q" defaultValue={q} placeholder="พิมพ์คำค้น แล้วกด Enter" />
        </div>
        <div>
          <label className="label">แสดงต่อหน้า</label>
          <select className="input" name="n" defaultValue={String(n)}>
            {[10, 50, 100].map((x) => <option key={x} value={x}>{x} รายการ</option>)}
          </select>
        </div>
        {showDone && <input type="hidden" name="show" value="1" />}
        <button className="btn">ค้นหา</button>
        {q && <Link className="btn-ghost" href={href({ q: "", p: "1" })}>ล้างคำค้น</Link>}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>พบ <b>{total}</b> ใบ{!showDone && doneCount > 0 ? ` (ซ่อนงานเสร็จแล้ว ${doneCount} ใบ)` : ""}</span>
        {doneCount > 0 && (showDone
          ? <Link className="text-brand underline" href={href({ show: "", p: "1" })}>ซ่อนงานที่เสร็จแล้ว</Link>
          : <Link className="text-brand underline" href={href({ show: "1", p: "1" })}>แสดงงานที่เสร็จแล้ว ({doneCount})</Link>)}
      </div>

      {full.map((w: any) => (
        <HistoryCard key={w.id} w={w} groups={groupsOf(w)} accessories={acc || []}
          when={new Date(w.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} />
      ))}
      {full.length === 0 && <div className="card text-slate-500">{q ? "ไม่พบใบเบิกที่ตรงกับคำค้น" : "ไม่มีใบเบิกที่ต้องแสดง"}</div>}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pb-2 text-sm">
          {p > 1 ? <Link className="btn-ghost" href={href({ p: String(p - 1) })}>← ก่อนหน้า</Link> : <span className="btn-ghost opacity-40">← ก่อนหน้า</span>}
          <span>หน้า {p} / {pages}</span>
          {p < pages ? <Link className="btn-ghost" href={href({ p: String(p + 1) })}>ถัดไป →</Link> : <span className="btn-ghost opacity-40">ถัดไป →</span>}
        </div>
      )}
    </div>
  );
}

// จัดกลุ่มเสาในใบเบิกตามกอง+ขนาด (เรียงตามชั้น/ลำดับ)
function groupsOf(w: any) {
  const poles = [...(w.poles || [])].sort((a: any, b: any) => (a.tier ?? 999) - (b.tier ?? 999) || (a.pos ?? 999) - (b.pos ?? 999));
  const m = new Map<string, { site: string; size: string; nos: string[] }>();
  for (const p of poles) {
    const k = `${p.sites?.label}|${p.pole_sizes?.name}`;
    if (!m.has(k)) m.set(k, { site: p.sites?.label, size: p.pole_sizes?.name, nos: [] });
    m.get(k)!.nos.push(p.pole_no);
  }
  return Array.from(m.values());
}
