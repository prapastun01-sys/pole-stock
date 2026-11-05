import { cookies } from "next/headers";
import { db } from "./supabase";

// พื้นที่ที่เลือกอยู่ (เก็บใน cookie ps_area): uuid | "none" (ยังไม่ระบุพื้นที่) | "all" (ทุกพื้นที่) | ไม่มี = ทุกพื้นที่
export function areaCookie(): string | null {
  return cookies().get("ps_area")?.value || null;
}

export function isAreaId(a: string | null): a is string {
  return !!a && a !== "all" && a !== "none";
}

// query รายการจุดกองที่อยู่ในพื้นที่ที่เลือก (ส่งคืน query builder ให้ต่อ .eq/.order ได้)
export function scopedSites(cols: string): any {
  const a = areaCookie();
  let q: any = db().from("sites").select(cols);
  if (a === "none") q = q.is("area_id", null);
  else if (isAreaId(a)) q = q.eq("area_id", a);
  return q;
}

// id ของจุดกองในพื้นที่ที่เลือก (null = ไม่กรอง/ทุกพื้นที่)
export async function areaSiteIds(): Promise<string[] | null> {
  const a = areaCookie();
  if (!a || a === "all") return null;
  const { data } = await scopedSites("id");
  return (data || []).map((r: any) => r.id);
}

// ใบเบิกที่ไม่มีเสา (เบิกเฉพาะอุปกรณ์): อยู่ในพื้นที่ที่เลือกหรือไม่
export function poleFreeInScope(w: { pole_free?: boolean; area_id?: string | null }): boolean {
  if (!w.pole_free) return false;
  const a = areaCookie();
  if (!a || a === "all") return true;
  if (a === "none") return !w.area_id;
  return w.area_id === a;
}
