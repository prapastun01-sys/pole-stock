import { db } from "./supabase";

// ดึงเสาทั้งหมดของกอง (แบ่งหน้าทีละ 1000) เรียงตามชั้นล่าง→บน แล้วซ้าย→ขวา
export async function fetchPoles(siteId: string, sizeId?: string) {
  const s = db();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = s
      .from("poles")
      .select("id,pole_no,tier,pos,status,photo_url,created_at,size_id,withdrawal_id,pole_sizes(name),withdrawals(job_name)")
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
