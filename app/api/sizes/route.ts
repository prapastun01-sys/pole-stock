import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export async function POST(req: Request) {
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกขนาดเสา" }, { status: 400 });

  const { data, error } = await db().from("pole_sizes").insert({ name, sort_order: 100 }).select().single();
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "มีขนาดนี้อยู่แล้ว" : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ size: data });
}
