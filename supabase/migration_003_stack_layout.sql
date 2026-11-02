-- =====================================================================
-- เก็บตำแหน่งเสาในกอง: ชั้น (1 = ล่างสุด) และลำดับในชั้น (นับจากซ้ายไปขวา)
-- Supabase > SQL Editor > วางทั้งไฟล์ > Run  (รันซ้ำได้ ข้อมูลเดิมไม่หาย)
-- =====================================================================
alter table public.poles add column if not exists tier int;   -- ชั้น
alter table public.poles add column if not exists pos  int;   -- ลำดับซ้าย→ขวา
create index if not exists poles_site_tier_pos_idx on public.poles (site_id, tier, pos);
