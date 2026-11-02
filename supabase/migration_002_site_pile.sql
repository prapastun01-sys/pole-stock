-- =====================================================================
-- อัปเดตฐานข้อมูลที่ติดตั้งไว้แล้ว: ให้ "จุดเดียวมีหลายกอง" ได้
-- Supabase > SQL Editor > วางทั้งไฟล์ > Run  (รันซ้ำได้ ข้อมูลเดิมไม่หาย)
-- =====================================================================

alter table public.sites add column if not exists pile text not null default '';

-- เลิกบังคับให้ชื่อจุดห้ามซ้ำ
alter table public.sites drop constraint if exists sites_name_key;

-- ห้ามซ้ำเฉพาะ "ชื่อจุด + กอง"
create unique index if not exists sites_name_pile_uq on public.sites (name, pile);

-- ชื่อที่ใช้แสดง เช่น "ที่เช่า / กอง 1"
alter table public.sites add column if not exists label text generated always as (
  case when pile <> '' then name || ' / ' || pile else name end
) stored;

-- ให้ Dashboard แสดงชื่อพร้อมกอง
create or replace view public.v_stock
with (security_invoker = true) as
select
  s.id   as site_id,
  s.label as site_name,
  z.id   as size_id,
  z.name as size_name,
  z.sort_order,
  count(p.id)                                         as total,
  count(p.id) filter (where p.status = 'available')   as available,
  count(p.id) filter (where p.status = 'withdrawn')   as withdrawn
from public.sites s
cross join public.pole_sizes z
left join public.poles p on p.site_id = s.id and p.size_id = z.id
group by s.id, s.label, z.id, z.name, z.sort_order;
