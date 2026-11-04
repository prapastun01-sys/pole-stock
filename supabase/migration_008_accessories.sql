-- =====================================================================
-- Migration 008: อุปกรณ์เสริมที่เบิกพร้อมเสา (Anchor plate / Crossarm / Beam ...)
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
-- =====================================================================
create table if not exists public.accessories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.accessories enable row level security;

insert into public.accessories (code, name, sort_order) values
  ('1-00-004-0001', 'ANCHOR,PLATE, CONCRETE 550X550X150 MM.', 1),
  ('1-00-004-0003', 'ANCHOR, PLATE, CONCRETE 600X600X180 MM.', 2),
  ('1-00-011-0000', 'CROSSARM 100X100X1,500 MM.', 3),
  ('1-00-011-0001', 'CROSSARM 100X100X2,500 MM.', 4),
  ('1-00-011-0003', 'CROSSARM (FOR D/E) 120X120X2,000 MM.', 5),
  ('1-00-011-0004', 'CROSSARM (FOR D/E) 120X120X2,500 MM.', 6),
  ('1-00-011-0006', 'CROSSARM 100X100X2,500 MM. HPC', 7),
  ('1-00-011-0008', 'CROSSARM 120X120X2,000 MM. HPC', 8),
  ('1-00-011-0009', 'CROSSARM 120X120X2,500 MM. HPC', 9),
  ('1-00-021-0000', 'BEAM, SPUN 100X100X3,200 MM.', 10),
  ('1-00-021-0003', 'BEAM 150X250X3,550 MM.', 11)
on conflict (code) do nothing;

-- รายการอุปกรณ์ที่เบิกในแต่ละใบเบิก: [{code, name, qty, detail}]
alter table public.withdrawals add column if not exists items jsonb not null default '[]'::jsonb;
