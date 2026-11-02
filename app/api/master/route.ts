import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = db();
  const [sites, sizes] = await Promise.all([
    s.from("sites").select("*").order("name"),
    s.from("pole_sizes").select("*").order("sort_order").order("name"),
  ]);
  if (sites.error || sizes.error)
    return NextResponse.json({ error: (sites.error || sizes.error)!.message }, { status: 500 });
  return NextResponse.json({ sites: sites.data, sizes: sizes.data });
}
