import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await db().from("accessories").select("id,code,name").eq("active", true).order("sort_order").order("code");
  if (error) return NextResponse.json({ error: error.message + " (ต้องรัน migration_008_accessories.sql)" }, { status: 500 });
  return NextResponse.json({ accessories: data });
}

// เพิ่มรายการอุปกรณ์ใหม่ {code, name}
export async function POST(req: Request) {
  const b = await req.json();
  const code = String(b.code || "").trim(), name = String(b.name || "").trim();
  if (!code || !name) return NextResponse.json({ error: "กรุณากรอกรหัสและชื่ออุปกรณ์" }, { status: 400 });
  const { data, error } = await db().from("accessories").insert({ code, name, sort_order: 100 }).select("id,code,name").single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีรหัสนี้อยู่แล้ว" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ accessory: data });
}
