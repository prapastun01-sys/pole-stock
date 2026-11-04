-- =====================================================================
-- พื้นที่ (นครพนม / ธาตุพนม / นาแก / บ้านแพง) + สรุปยอดแยกตามประเภทเสา
-- Supabase > SQL Editor > วางทั้งไฟล์ > Run  (รันซ้ำได้ ข้อมูลเดิมไม่หาย)
-- =====================================================================
create table if not exists public.areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
alter table public.areas enable row level security;

insert into public.areas (name, sort_order) values
  ('นครพนม', 10), ('ธาตุพนม', 20), ('นาแก', 30), ('บ้านแพง', 40)
on conflict (name) do nothing;

alter table public.sites add column if not exists area_id uuid references public.areas(id);
create index if not exists sites_area_idx on public.sites (area_id);

-- สรุปยอดแยกตามประเภทเสา (เสาใหม่/รื้อถอน/หมดอายุ/หัก/รับฝาก)
create or replace view public.v_stock_kind
with (security_invoker = true) as
select
  p.site_id, p.size_id, p.kind,
  count(*)                                         as total,
  count(*) filter (where p.status = 'available')   as available,
  count(*) filter (where p.status = 'withdrawn')   as withdrawn
from public.poles p
group by p.site_id, p.size_id, p.kind;

-- จุดกองที่สร้างไว้ก่อนหน้านี้ยังไม่มีพื้นที่: กำหนดได้ที่หน้า "จุดกอง" (ปุ่มแก้ไข)
-- หรือกำหนดทั้งหมดในครั้งเดียว (เอาเครื่องหมาย -- ออก แล้วแก้ชื่อพื้นที่ให้ตรง):
-- update public.sites set area_id = (select id from public.areas where name = 'นครพนม') where area_id is null;
