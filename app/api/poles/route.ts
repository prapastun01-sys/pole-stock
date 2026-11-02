import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ค้นหา/ดึงรายการเสา  ?q=เลขเสา&site=&size=&status=available
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  const site = u.searchParams.get("site");
  const size = u.searchParams.get("size");
  const status = u.searchParams.get("status");

  let query = db()
    .from("poles")
    .select("id,pole_no,layer,status,site_id,size_id,sites(name,lat,lng),pole_sizes(name)")
    .order("pole_no")
    .limit(1000);

  if (q) query = query.ilike("pole_no", `%${q.replace(/[%_]/g, "")}%`).limit(50);
  if (site) query = query.eq("site_id", site);
  if (size) query = query.eq("size_id", size);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ poles: data });
}

// เพิ่มเสาหลายต้นพร้อมกัน
export async function POST(req: Request) {
  const b = await req.json();
  const nos: string[] = Array.from(new Set((b.pole_nos || []).map((s: any) => String(s).trim()).filter(Boolean)));

  if (!b.site_id || !b.size_id) return NextResponse.json({ error: "กรุณาเลือกจุดกองและขนาดเสา" }, { status: 400 });
  if (nos.length === 0) return NextResponse.json({ error: "ไม่มีเลขเสา" }, { status: 400 });
  if (nos.length > 2000) return NextResponse.json({ error: "เพิ่มได้ครั้งละไม่เกิน 2000 ต้น" }, { status: 400 });

  const rows = nos.map((pole_no) => ({
    pole_no,
    layer: b.layer || null,
    site_id: b.site_id,
    size_id: b.size_id,
    photo_url: b.photo_url || null,
    photo_id: b.photo_id || null,
  }));

  const { error } = await db().from("poles").insert(rows);
  if (error) {
    if (error.code === "23505") {
      // หาเลขที่ซ้ำเพื่อแจ้งผู้ใช้
      const { data } = await db().from("poles").select("pole_no").in("pole_no", nos).limit(20);
      const dups = (data || []).map((d) => d.pole_no).join(", ");
      return NextResponse.json({ error: `เลขเสาซ้ำกับที่มีอยู่แล้ว: ${dups}` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
