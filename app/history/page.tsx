import { db } from "@/lib/supabase";
import { areaSiteIds } from "@/lib/area";
import HistoryCard from "@/components/HistoryCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function History() {
  const SEL = "*, poles(pole_no,tier,pos,sites(label),pole_sizes(name))";
  const ids = await areaSiteIds(); // null = ทุกพื้นที่
  let data: any[] | null = null, error: any = null;
  if (ids === null) {
    const r = await db().from("withdrawals").select(SEL).order("created_at", { ascending: false }).limit(50);
    data = r.data; error = r.error;
  } else {
    // ใบเบิกที่มีเสาอยู่ในกองของพื้นที่นี้
    const wset = new Set<string>();
    for (let i = 0; i < ids.length && !error; i += 50) {
      const r = await db().from("poles").select("withdrawal_id").in("site_id", ids.slice(i, i + 50)).not("withdrawal_id", "is", null).limit(5000);
      if (r.error) error = r.error; else (r.data || []).forEach((x: any) => wset.add(x.withdrawal_id));
    }
    const wl = Array.from(wset);
    const out: any[] = [];
    for (let i = 0; i < wl.length && !error; i += 60) {
      const r = await db().from("withdrawals").select(SEL).in("id", wl.slice(i, i + 60));
      if (r.error) error = r.error; else out.push(...(r.data || []));
    }
    data = out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 50);
  }

  if (error) return <div className="card text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ประวัติการเบิกเสา</h1>
      {(data || []).map((w: any) => (
        <HistoryCard key={w.id} w={w} groups={groupsOf(w)}
          when={new Date(w.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} />
      ))}
      {(data || []).length === 0 && <div className="card text-slate-500">ยังไม่มีประวัติการเบิก</div>}
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
