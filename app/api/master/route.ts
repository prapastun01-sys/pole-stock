import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { areaCookie, isAreaId, scopedSites } from "@/lib/area";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// ข้อมูลหลัก: จุดกอง (เฉพาะพื้นที่ที่เลือก) + ขนาดเสา + พื้นที่ + ยอดคงเหลือต่อกอง/ขนาด
export async function GET() {
  const s = db();
  const [sites, sizes, areas] = await Promise.all([
    scopedSites("*").order("name").order("zone").order("pile"),
    s.from("pole_sizes").select("*").order("sort_order").order("name"),
    s.from("areas").select("*").order("sort_order").order("name"),
  ]);
  const err = sites.error || sizes.error || areas.error;
  if (err) return NextResponse.json({ error: err.message + " (ถ้าเพิ่งอัปเดตระบบ ให้รัน migration_007_areas.sql ใน Supabase)" }, { status: 500 });

  const ids = (sites.data || []).map((x: any) => x.id);
  let stock: any[] = [];
  if (ids.length) {
    const { data } = await s.from("v_stock").select("site_id,size_id,total,available").in("site_id", ids);
    stock = data || [];
  }
  const a = areaCookie();
  const area = isAreaId(a) ? (areas.data || []).find((x: any) => x.id === a) || null : null;
  return NextResponse.json({ sites: sites.data, sizes: sizes.data, areas: areas.data, stock, area, scope: a || "all" });
}
