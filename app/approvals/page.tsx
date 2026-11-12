import { db } from "@/lib/supabase";
import { areaSiteIds, poleFreeInScope } from "@/lib/area";
import ApprovalCard from "@/components/ApprovalCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Approvals() {
  const { data, error } = await db().from("withdrawals")
    .select("*, poles(pole_no,tier,pos,site_id,sites(label),pole_sizes(name))")
    .is("approved_at", null).order("created_at", { ascending: true });
  if (error) return <div className="card text-red-600">{error.message}<br />ต้องรัน <code>migration_013_approval.sql</code> ใน Supabase ก่อน</div>;

  const ids = await areaSiteIds();
  const set = ids ? new Set(ids) : null;
  const list = (data || []).filter((w: any) => !set || (w.poles || []).some((p: any) => set.has(p.site_id)) || poleFreeInScope(w));

  const cards = list.map((w: any) => {
    const poles = [...(w.poles || [])].sort((a: any, b: any) => (a.tier ?? 999) - (b.tier ?? 999) || (a.pos ?? 999) - (b.pos ?? 999));
    const m = new Map<string, { site: string; size: string; nos: string[] }>();
    for (const p of poles) {
      const k = `${p.sites?.label}|${p.pole_sizes?.name}`;
      if (!m.has(k)) m.set(k, { site: p.sites?.label, size: p.pole_sizes?.name, nos: [] });
      m.get(k)!.nos.push(p.pole_no);
    }
    const md = w.move_date || new Date(w.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    return {
      id: w.id, job_name: w.job_name, wbs: w.wbs || "", network: w.network || "", team: w.team || "", responsible: w.responsible,
      when: new Date(w.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      moveDate: new Date(md + "T12:00:00+07:00").toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" }),
      groups: Array.from(m.values()), items: Array.isArray(w.items) ? w.items : [],
      nBefore: (w.before_photos || []).length, nAfter: (w.after_photos || []).length, nAcc: (w.acc_photos || []).length,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">รออนุมัติ</h1>
        <p className="text-sm text-slate-500">ตรวจรายการเบิก แล้วใส่รหัสอนุมัติ — เมื่ออนุมัติจะแจ้งเตือน Telegram และย้ายไปหน้าประวัติ (เสาถูกจองไว้แล้วตั้งแต่ตอนบันทึก)</p>
      </div>
      {cards.map((c) => <ApprovalCard key={c.id} p={c} />)}
      {cards.length === 0 && <div className="card text-slate-500">ไม่มีใบเบิกที่รออนุมัติ</div>}
    </div>
  );
}
