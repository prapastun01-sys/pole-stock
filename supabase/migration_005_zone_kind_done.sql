-- =====================================================================
-- 1) Zone ต่อท้ายชื่อจุด   2) ประเภทเสา (เสาใหม่/รื้อถอน/หมดอายุ/หัก/รับฝาก)
-- 3) ใบเบิก: สถานะงานเสร็จ + เลขใบตัดงาน
-- Supabase > SQL Editor > วางทั้งไฟล์ > Run  (รันซ้ำได้ ข้อมูลเดิมไม่หาย)
-- =====================================================================

-- ---- 1) zone: ต้องสร้างคอลัมน์ label ใหม่ จึงต้องลบ view ก่อนแล้วสร้างกลับ ----
drop view if exists public.v_stock;

alter table public.sites add column if not exists zone text not null default '';
alter table public.sites drop column if exists label;
alter table public.sites add column label text generated always as (
  name
  || case when zone <> '' then ' / ' || zone else '' end
  || case when pile <> '' then ' / ' || pile else '' end
) stored;

drop index if exists public.sites_name_pile_uq;
create unique index if not exists sites_name_zone_pile_uq on public.sites (name, zone, pile);

create view public.v_stock
with (security_invoker = true) as
select
  s.id    as site_id,
  s.label as site_name,
  z.id    as size_id,
  z.name  as size_name,
  z.sort_order,
  count(p.id)                                         as total,
  count(p.id) filter (where p.status = 'available')   as available,
  count(p.id) filter (where p.status = 'withdrawn')   as withdrawn
from public.sites s
cross join public.pole_sizes z
left join public.poles p on p.site_id = s.id and p.size_id = z.id
group by s.id, s.label, z.id, z.name, z.sort_order;

-- ---- 2) ประเภทเสา ----
alter table public.poles add column if not exists kind text not null default 'new';
alter table public.poles drop constraint if exists poles_kind_check;
alter table public.poles add constraint poles_kind_check
  check (kind in ('new','dismantled','expired','broken','deposit'));
-- new=เสาใหม่ dismantled=เสารื้อถอน expired=เสาหมดอายุ broken=เสาหัก deposit=เสารับฝาก

-- ---- 3) งานเสร็จ + เลขใบตัดงาน ----
alter table public.withdrawals add column if not exists done_at timestamptz;
alter table public.withdrawals add column if not exists cut_no  text;
