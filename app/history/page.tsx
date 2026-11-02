import { db } from "@/lib/supabase";
import HistoryCard from "@/components/HistoryCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function History() {
  const { data, error } = await db()
    .from("withdrawals")
    .select("*, poles(pole_no,tier,pos,sites(label),pole_sizes(name))")
    .order("created_at", { ascending: false })
    .limit(50);

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
