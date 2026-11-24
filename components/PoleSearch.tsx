"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

type R = { id: string; pole_no: string; tier: number | null; pos: number | null; status: string; site_id: string; sites?: { label?: string }; pole_sizes?: { name?: string } };

// ค้นหาเลขเสาในจุดกองหมอนนี้ → บอกว่าอยู่กอง/ชั้นไหน
export default function PoleSearch({ siteIds }: { siteIds: string[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<R[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = q.trim();
    if (!t) { setRows(null); return; }
    setBusy(true);
    const h = setTimeout(() => {
      api(`/api/poles?q=${encodeURIComponent(t)}&site=${siteIds.join(",")}`)
        .then((j) => setRows(j.poles || [])).catch(() => setRows([])).finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(h);
  }, [q, siteIds.join(",")]);

  return (
    <div className="card space-y-2">
      <div className="flex gap-2">
        <input className="input" inputMode="search" placeholder="🔍 ค้นหาเลขเสาในจุดนี้ (รู้ว่าอยู่กองไหน)" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" className="btn-ghost shrink-0" onClick={() => setQ("")}>ล้าง</button>}
      </div>
      {rows && (
        rows.length === 0 ? <p className="text-sm text-slate-500">{busy ? "กำลังค้นหา..." : "ไม่พบเลขเสานี้ในจุดนี้"}</p> : (
          <ul className="divide-y text-sm">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/piles/${r.site_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:bg-slate-50">
                  <span><b className="text-base">{r.pole_no}</b> <span className="text-slate-500">· {r.pole_sizes?.name}</span></span>
                  <span className="text-slate-600">{r.sites?.label}{r.tier ? ` · ชั้น ${r.tier}` : ""}{r.pos ? ` · ลำดับ ${r.pos}` : ""}</span>
                  <span className={`chip ${r.status === "available" ? "!bg-emerald-100 !text-emerald-700" : "!bg-orange-100 !text-orange-700"}`}>{r.status === "available" ? "คงเหลือ" : "เบิกแล้ว"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
