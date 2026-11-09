import { db } from "./supabase";

// ดึงเสาทั้งหมดของกอง (แบ่งหน้าทีละ 1000) เรียงตามชั้นล่าง→บน แล้วซ้าย→ขวา
export async function fetchPoles(siteId: string, sizeId?: string) {
  const s = db();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = s
      .from("poles")
      .select("id,pole_no,tier,pos,status,kind,photo_url,created_at,size_id,withdrawal_id,pole_sizes(name),withdrawals(job_name,team,created_at)")
      .eq("site_id", siteId)
      .order("tier", { ascending: true, nullsFirst: false })
      .order("pos", { ascending: true, nullsFirst: false })
      .order("pole_no")
      .range(from, from + 999);
    if (sizeId) q = q.eq("size_id", sizeId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export type PilePhotos = {
  full: { id: string; url: string; at: string } | null;
  after: { photos: { id: string; url: string }[]; at: string; job: string } | null;
};

// รูปกองเต็ม (รูปที่อัปตอนเพิ่มเสา) + รูปหลังขนของใบเบิกล่าสุดที่แตะกองนั้น
export async function pilePhotos(ids: string[]): Promise<Record<string, PilePhotos>> {
  const out: Record<string, PilePhotos> = {};
  for (const id of ids) out[id] = { full: null, after: null };
  if (ids.length === 0) return out;
  const s = db();

  const { data: ph } = await s.from("poles").select("site_id,photo_id,photo_url,created_at")
    .in("site_id", ids).not("photo_url", "is", null).order("created_at", { ascending: false }).limit(2000);
  for (const r of ph || []) if (!out[r.site_id].full) out[r.site_id].full = { id: r.photo_id, url: r.photo_url, at: r.created_at };

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
    if (w) out[id].after = { photos: w.after_photos, at: w.created_at, job: w.job_name };
  }
  return out;
}
