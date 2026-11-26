import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { KIND_VALUES } from "@/lib/kinds";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// เพิ่มเสาเข้าชั้นของกองที่มีอยู่แล้ว (กรณีกรอกตกชั้น)
// body: { site_id, size_id, tier, nos: [ซ้าย→ขวา], insert?: boolean, kind? }
// insert=true → แทรกชั้นใหม่ที่เลข tier แล้วเลื่อนชั้น tier ขึ้นไปทั้งหมดขึ้น 1 ชั้น
// insert=false → ต่อท้ายทางขวาของชั้น tier (สร้างชั้นใหม่ถ้ายังไม่มี)
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const tier = Number(b.tier);
  const nos: string[] = (Array.isArray(b.nos) ? b.nos : []).map((x: any) => String(x).trim()).filter(Boolean);
  const kind = b.kind || "new";
  if (!b.site_id || !b.size_id) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (!Number.isInteger(tier) || tier < 1 || tier > 50) return NextResponse.json({ error: "เลขชั้นต้องเป็นจำนวนเต็ม 1-50" }, { status: 400 });
  if (!KIND_VALUES.includes(kind)) return NextResponse.json({ error: "ประเภทเสาไม่ถูกต้อง" }, { status: 400 });
  if (nos.length === 0) return NextResponse.json({ error: "ไม่มีเลขเสา" }, { status: 400 });
  if (new Set(nos).size !== nos.length) return NextResponse.json({ error: "มีเลขเสาซ้ำในรายการที่กรอก" }, { status: 400 });

  const s = db();
  const { data: dup } = await s.from("poles").select("pole_no").eq("site_id", b.site_id).in("pole_no", nos).limit(20);
  if (dup && dup.length) return NextResponse.json({ error: `เลขเสาซ้ำกับที่มีอยู่แล้วในกองนี้: ${dup.map((d: any) => d.pole_no).join(", ")}` }, { status: 409 });

  let shifted = 0;
  if (b.insert) {
    // เลื่อนชั้นจากบนลงล่าง
    const { data: ex } = await s.from("poles").select("tier").eq("site_id", b.site_id).gte("tier", tier);
    const ts = Array.from(new Set((ex || []).map((r: any) => Number(r.tier)))).sort((a, c) => c - a);
    for (const t of ts) {
      const { error, count } = await s.from("poles").update({ tier: t + 1, layer: String(t + 1) }, { count: "exact" }).eq("site_id", b.site_id).eq("tier", t);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      shifted += count ?? 0;
    }
  }

  let base = 0;
  if (!b.insert) {
    const { data: last } = await s.from("poles").select("pos").eq("site_id", b.site_id).eq("tier", tier).not("pos", "is", null).order("pos", { ascending: false }).limit(1);
    base = last?.[0]?.pos ?? 0;
  }
  const { data: ph } = await s.from("poles").select("photo_id,photo_url").eq("site_id", b.site_id).not("photo_url", "is", null).limit(1);
  const rows = nos.map((no, i) => ({
    pole_no: no, tier, pos: base + i + 1, layer: String(tier),
    site_id: b.site_id, size_id: b.size_id, kind,
    photo_url: ph?.[0]?.photo_url || null, photo_id: ph?.[0]?.photo_id || null,
  }));
  const { error } = await s.from("poles").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true, count: rows.length, shifted });
}
