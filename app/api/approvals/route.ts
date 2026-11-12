import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// จำนวนใบเบิกที่รออนุมัติ (แสดงเป็นตัวเลขบนเมนู)
export async function GET() {
  const { count, error } = await db().from("withdrawals").select("id", { count: "exact", head: true }).is("approved_at", null);
  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count || 0 });
}
