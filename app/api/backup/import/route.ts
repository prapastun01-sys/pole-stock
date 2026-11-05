import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { BACKUP_TABLES, GENERATED } from "@/lib/backup";

export const maxDuration = 60;

// นำเข้าทีละก้อน: { table, rows }  — เพิ่มข้อมูลที่ไม่มี และอัปเดตแถวที่ id ตรงกัน (ไม่ลบข้อมูลใด ๆ)
export async function POST(req: Request) {
  const b = await req.json();
  const table = String(b.table || "");
  if (!(BACKUP_TABLES as readonly string[]).includes(table)) return NextResponse.json({ error: "ตารางไม่ถูกต้อง" }, { status: 400 });
  if (!Array.isArray(b.rows)) return NextResponse.json({ error: "rows ต้องเป็นรายการ" }, { status: 400 });
  if (b.rows.length === 0) return NextResponse.json({ ok: true, count: 0 });
  if (b.rows.length > 1000) return NextResponse.json({ error: "ส่งได้ครั้งละไม่เกิน 1000 แถว" }, { status: 400 });

  const drop = GENERATED[table] || [];
  const rows = b.rows.map((r: any) => {
    if (!r || typeof r !== "object" || !r.id) throw new Error("พบแถวที่ไม่มี id");
    const o = { ...r };
    for (const k of drop) delete o[k];
    return o;
  });
  const { error } = await db().from(table).upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}
