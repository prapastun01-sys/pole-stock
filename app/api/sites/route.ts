import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { areaCookie, isAreaId } from "@/lib/area";

export async function POST(req: Request) {
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อจุดกองหมอน" }, { status: 400 });

  const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  const zone = String(b.zone || "").trim();
  // ช่อง "กอง" คั่นด้วย , (หรือขึ้นบรรทัดใหม่) = สร้างหลายกองพร้อมกัน เช่น "1, 2, 3"
  const piles = Array.from(new Set(String(b.pile || "").split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean)));
  if (piles.length === 0) piles.push("");

  const s = db();
  // ตรวจกองที่มีอยู่แล้ว (ชื่อจุด + Zone + กอง ต้องไม่ซ้ำ) — ถ้ามีซ้ำ ไม่สร้างเลย เพื่อไม่ให้สร้างครึ่ง ๆ กลาง ๆ
  const { data: exist } = await s.from("sites").select("pile").eq("name", name).eq("zone", zone).in("pile", piles);
  if (exist && exist.length)
    return NextResponse.json({ error: `มีกองนี้อยู่แล้ว: ${exist.map((x: any) => x.pile || "กองหลัก").join(", ")} (ชื่อจุด + Zone + กอง ต้องไม่ซ้ำกัน)` }, { status: 409 });

  const area_id = b.area_id || (isAreaId(areaCookie()) ? areaCookie() : null);
  const { data, error } = await s
    .from("sites")
    .insert(piles.map((pile) => ({ area_id, name, zone, pile, lat: num(b.lat), lng: num(b.lng), note: b.note || null })))
    .select();

  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีจุดนี้อยู่แล้ว (ชื่อจุด + Zone + กอง ต้องไม่ซ้ำกัน)" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ site: data?.[0], sites: data, count: data?.length || 0 });
}
