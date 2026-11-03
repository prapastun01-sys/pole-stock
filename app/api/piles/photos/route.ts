import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// รูปกองเต็ม (รูปที่อัปตอนเพิ่มเสา) + รูปหลังขนล่าสุด ของแต่ละกอง   ?site=id1,id2
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("site") || "").split(",").filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ piles: {} });
  const s = db();

  const piles: Record<string, { full: { id: string; url: string; at: string } | null; after: { photos: { id: string; url: string }[]; at: string; job: string } | null }> = {};
  for (const id of ids) piles[id] = { full: null, after: null };

  // รูปกองเต็ม: รูปล่าสุดที่อัปไว้ในกอง
  const { data: ph } = await s.from("poles").select("site_id,photo_id,photo_url,created_at")
    .in("site_id", ids).not("photo_url", "is", null).order("created_at", { ascending: false }).limit(2000);
  for (const r of ph || []) if (!piles[r.site_id].full) piles[r.site_id].full = { id: r.photo_id, url: r.photo_url, at: r.created_at };

  // รูปหลังขนล่าสุด: ใบเบิกล่าสุดที่แตะกองนี้และมีรูปหลังขน
  const { data: wp } = await s.from("poles").select("site_id,withdrawal_id").in("site_id", ids).not("withdrawal_id", "is", null).limit(5000);
  const bySite = new Map<string, Set<string>>();
  const allW = new Set<string>();
  for (const r of wp || []) {
    if (!bySite.has(r.site_id)) bySite.set(r.site_id, new Set());
    bySite.get(r.site_id)!.add(r.withdrawal_id);
    allW.add(r.withdrawal_id);
  }
  const wl = Array.from(allW);
  const wds: any[] = [];
  for (let i = 0; i < wl.length; i += 60) {
    const { data } = await s.from("withdrawals").select("id,created_at,job_name,after_photos").in("id", wl.slice(i, i + 60));
    wds.push(...(data || []));
  }
  wds.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  for (const id of ids) {
    const mine = bySite.get(id);
    const w = mine && wds.find((x) => mine.has(x.id) && Array.isArray(x.after_photos) && x.after_photos.length > 0);
    if (w) piles[id].after = { photos: w.after_photos, at: w.created_at, job: w.job_name };
  }
  return NextResponse.json({ piles });
}
