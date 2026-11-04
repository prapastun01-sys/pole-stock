import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { areaCookie, isAreaId } from "@/lib/area";

export async function POST(req: Request) {
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อจุดกองหมอน" }, { status: 400 });

  const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  const { data, error } = await db()
    .from("sites")
    .insert({ area_id: b.area_id || (isAreaId(areaCookie()) ? areaCookie() : null), name, zone: String(b.zone || "").trim(), pile: String(b.pile || "").trim(), lat: num(b.lat), lng: num(b.lng), note: b.note || null })
    .select()
    .single();

  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีจุดนี้อยู่แล้ว (ชื่อจุด + Zone + กอง ต้องไม่ซ้ำกัน)" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ site: data });
}
