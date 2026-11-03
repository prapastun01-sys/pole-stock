import { kindOf } from "@/lib/kinds";

// แสดงผังกองเสา: ชั้นบนอยู่ด้านบน ชั้น 1 อยู่ล่าง อ่านซ้าย → ขวา (ใช้ได้ทั้ง server/client)
export default function StackView({ poles, showSize }: { poles: any[]; showSize?: boolean }) {
  const byTier = new Map<number, any[]>();
  for (const p of poles) {
    const t = p.tier ?? 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(p);
  }
  const tiers = Array.from(byTier.keys()).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : b - a));

  return (
    <div className="space-y-2 overflow-x-auto">
      {tiers.map((t) => (
        <div key={t} className="flex items-start gap-2">
          <div className="w-14 shrink-0 pt-1.5 text-xs text-slate-400">{t === 0 ? "ไม่ระบุชั้น" : `ชั้น ${t}`}</div>
          <div className="flex flex-wrap gap-1.5">
            {byTier.get(t)!.map((p) => (
              <div key={p.id}
                title={`${p.pole_sizes?.name || ""} · ${p.status === "available" ? "คงเหลือ" : "เบิกแล้ว: " + (p.withdrawals?.job_name || "")}`}
                className={`min-w-[3.6rem] rounded-lg border px-2 py-1.5 text-center text-sm ${p.status === "available" ? "border-yellow-400 bg-yellow-100 font-semibold" : "border-slate-300 bg-slate-200 text-slate-400 line-through"}`}>
                {p.pole_no}
                {showSize && <div className="text-[10px] font-normal no-underline">{p.pole_sizes?.name}</div>}
                {p.kind && p.kind !== "new" && <div className={`mt-0.5 rounded px-1 text-[10px] font-normal no-underline ${kindOf(p.kind).cls}`}>{kindOf(p.kind).short}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
