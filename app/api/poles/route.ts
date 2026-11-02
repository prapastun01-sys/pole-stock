import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// ค้นหา/ดึงรายการเสา  ?q=เลขเสา&site=&size=&status=available
// เรียงตามชั้น (ล่าง→บน) แล้วตามลำดับซ้าย→ขวา
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  const site = u.searchParams.get("site");
  const size = u.searchParams.get("size");
  const status = u.searchParams.get("status");

  let query = db()
    .from("poles")
    .select("id,pole_no,layer,tier,pos,status,site_id,size_id,sites(name,label,lat,lng),pole_sizes(name)")
    .order("tier", { ascending: true, nullsFirst: false })
    .order("pos", { ascending: true, nullsFirst: false })
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

// เพิ่มเสาเป็นชั้นๆ  body: { site_id, size_id, photo_url, photo_id, tiers: [{ tier, nos: [เลขซ้าย→ขวา] }] }
// ถ้าชั้นนั้นมีเสาอยู่แล้ว จะต่อท้ายทางขวา
export async function POST(req: Request) {
  const b = await req.json();
  if (!b.site_id || !b.size_id) return NextResponse.json({ error: "กรุณาเลือกจุดกองและขนาดเสา" }, { status: 400 });

  const tiers: { tier: number; nos: any[] }[] = Array.isArray(b.tiers) ? b.tiers : [];
  const s = db();
  const nextPos = new Map<number, number>();
  const seen = new Set<string>();
  const rows: any[] = [];

  for (const t of tiers) {
    const tier = Number(t.tier);
    if (!Number.isInteger(tier) || tier < 1) return NextResponse.json({ error: "เลขชั้นต้องเป็นจำนวนเต็มตั้งแต่ 1" }, { status: 400 });
    const nos = (t.nos || []).map((x) => String(x).trim()).filter(Boolean);
    if (nos.length === 0) continue;

    if (!nextPos.has(tier)) {
      const { data: last } = await s.from("poles").select("pos").eq("site_id", b.site_id).eq("tier", tier)
        .not("pos", "is", null).order("pos", { ascending: false }).limit(1);
      nextPos.set(tier, last?.[0]?.pos ?? 0);
    }
    for (const no of nos) {
      if (seen.has(no)) return NextResponse.json({ error: `เลขเสาซ้ำในรายการที่กรอก: ${no}` }, { status: 400 });
      seen.add(no);
      const pos = nextPos.get(tier)! + 1;
      nextPos.set(tier, pos);
      rows.push({
        pole_no: no, tier, pos, layer: String(tier),
        site_id: b.site_id, size_id: b.size_id,
        photo_url: b.photo_url || null, photo_id: b.photo_id || null,
      });
    }
  }

  if (rows.length === 0) return NextResponse.json({ error: "ไม่มีเลขเสา" }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "เพิ่มได้ครั้งละไม่เกิน 2000 ต้น" }, { status: 400 });

  const { error } = await s.from("poles").insert(rows);
  if (error) {
    if (error.code === "23505") {
      const { data } = await s.from("poles").select("pole_no").in("pole_no", rows.map((r) => r.pole_no)).limit(20);
      const dups = (data || []).map((d) => d.pole_no).join(", ");
      return NextResponse.json({ error: `เลขเสาซ้ำกับที่มีอยู่แล้ว: ${dups}` }, { status: 409 });
    }
    if (error.message.includes("tier") || error.message.includes("pos")) {
      return NextResponse.json({ error: "ฐานข้อมูลยังไม่ได้อัปเดต: กรุณารัน migration_003_stack_layout.sql ใน Supabase" }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
