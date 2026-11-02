import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// แก้ไขจุดกองหมอน (ชื่อ / กอง / พิกัด / หมายเหตุ)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อจุด" }, { status: 400 });
  const num = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

  const { data, error } = await db()
    .from("sites")
    .update({ name, pile: String(b.pile || "").trim(), lat: num(b.lat), lng: num(b.lng), note: b.note || null })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีจุดและกองนี้อยู่แล้ว (ชื่อจุด + กอง ต้องไม่ซ้ำกัน)" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ site: data });
}
