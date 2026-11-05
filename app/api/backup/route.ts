import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { BACKUP_TABLES } from "@/lib/backup";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function all(table: string, select = "*") {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select(select).order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return out;
}

const csvCell = (v: any) => {
  const t = v == null ? "" : String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const toCsv = (head: string[], rows: any[][]) => "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
const stamp = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(/[: ]/g, "-").slice(0, 16);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const format = u.searchParams.get("format") || "json";
  try {
    if (format === "csv") {
      const table = u.searchParams.get("table");
      let body = "";
      if (table === "poles") {
        const rows = await all("poles", "id,pole_no,tier,pos,kind,status,withdrawn_at,sites(label),pole_sizes(name),withdrawals(job_name,team,wbs)");
        body = toCsv(["เลขเสา", "จุดกอง/กอง", "ขนาด", "ชั้น", "ลำดับ", "ประเภท", "สถานะ", "วันที่เบิก", "ชื่องานที่เบิก", "ทีมงาน", "WBS"],
          rows.map((r) => [r.pole_no, r.sites?.label, r.pole_sizes?.name, r.tier, r.pos, r.kind, r.status === "available" ? "คงเหลือ" : "เบิกแล้ว", r.withdrawn_at, r.withdrawals?.job_name, r.withdrawals?.team, r.withdrawals?.wbs]));
      } else if (table === "withdrawals") {
        const rows = await all("withdrawals", "*, poles(pole_no,sites(label),pole_sizes(name))");
        body = toCsv(["เลขที่", "วันขนเสา", "สร้างเมื่อ", "ชื่องาน", "WBS", "โครงข่าย", "ทีมงาน", "ผู้รับผิดชอบ", "งานเสร็จ", "เลขใบตัดงาน", "จำนวนเสา", "เลขเสา", "อุปกรณ์เสริม"],
          rows.map((w) => [w.doc_seq ?? "", w.move_date, w.created_at, w.job_name, w.wbs, w.network, w.team, w.responsible, w.done_at ? "เสร็จ" : "", w.cut_no,
            (w.poles || []).length, (w.poles || []).map((p: any) => `${p.sites?.label}:${p.pole_no}`).join(" "),
            (Array.isArray(w.items) ? w.items : []).map((i: any) => `${i.code} ${i.name} x${i.qty}`).join(" | ")]));
      } else return NextResponse.json({ error: "table ต้องเป็น poles หรือ withdrawals" }, { status: 400 });
      return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pole-stock-${table}-${stamp()}.csv"` } });
    }

    const data: Record<string, any[]> = {};
    const skipped: string[] = [];
    for (const t of BACKUP_TABLES) {
      try { data[t] = await all(t); } catch (e: any) { if (t === "accessories") { skipped.push(t); data[t] = []; } else throw e; }
    }
    const meta = { app: "pole-stock", version: 1, exported_at: new Date().toISOString(), counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])), skipped };
    return new NextResponse(JSON.stringify({ meta, data }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="pole-stock-backup-${stamp()}.json"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
