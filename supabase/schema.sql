-- =====================================================================
-- ระบบเบิกเสา : SQL ติดตั้ง Supabase
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- 1) จุดกองหมอน ----------
create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                           -- ชื่อจุด
  pile        text not null default '',                -- กอง (ถ้าจุดเดียวมีหลายกอง)
  label       text generated always as (
                case when pile <> '' then name || ' / ' || pile else name end
              ) stored,                                -- ชื่อที่แสดง เช่น "ที่เช่า / กอง 1"
  lat         double precision,
  lng         double precision,
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists sites_name_pile_uq on public.sites (name, pile);

-- ---------- 2) ขนาดเสา ----------
create table if not exists public.pole_sizes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- 3) ใบเบิก ----------
create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites(id),
  size_id       uuid not null references public.pole_sizes(id),
  job_name      text not null,
  wbs           text,
  network       text,
  responsible   text not null,
  team          text,
  before_photos jsonb not null default '[]'::jsonb,   -- [{id,url}]
  after_photos  jsonb not null default '[]'::jsonb,   -- [{id,url}]
  created_at    timestamptz not null default now()
);

-- ---------- 4) เสาแต่ละต้น ----------
create table if not exists public.poles (
  id            uuid primary key default gen_random_uuid(),
  pole_no       text not null unique,                  -- เลขเสา เช่น 4201
  layer         text,                                  -- (เก่า) ไม่ใช้แล้ว
  tier          int,                                   -- ชั้น (1 = ล่างสุด)
  pos           int,                                   -- ลำดับในชั้น นับจากซ้ายไปขวา
  site_id       uuid not null references public.sites(id),
  size_id       uuid not null references public.pole_sizes(id),
  photo_url     text,
  photo_id      text,
  status        text not null default 'available' check (status in ('available','withdrawn')),
  withdrawal_id uuid references public.withdrawals(id),
  withdrawn_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists poles_site_size_status_idx on public.poles (site_id, size_id, status);
create index if not exists poles_site_tier_pos_idx on public.poles (site_id, tier, pos);
create index if not exists poles_pole_no_idx          on public.poles (pole_no text_pattern_ops);
create index if not exists poles_withdrawal_idx       on public.poles (withdrawal_id);
create index if not exists withdrawals_created_idx    on public.withdrawals (created_at desc);

-- ---------- 5) View สรุปสต๊อก (Dashboard) ----------
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

-- ---------- 6) ฟังก์ชันเบิกเสาแบบ atomic ----------
-- ถ้ามีเสาต้นใดถูกเบิกไปแล้ว/ไม่อยู่ในกองนั้น จะ rollback ทั้งใบ (กันสองคนเบิกซ้ำพร้อมกัน)
create or replace function public.create_withdrawal(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id    uuid;
  v_ids   uuid[];
  v_count int;
begin
  select array(select (jsonb_array_elements_text(p->'pole_ids'))::uuid) into v_ids;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'NO_POLE_SELECTED';
  end if;

  insert into public.withdrawals
    (site_id, size_id, job_name, wbs, network, responsible, team, before_photos, after_photos)
  values (
    (p->>'site_id')::uuid,
    (p->>'size_id')::uuid,
    p->>'job_name',
    p->>'wbs',
    p->>'network',
    p->>'responsible',
    p->>'team',
    coalesce(p->'before_photos', '[]'::jsonb),
    coalesce(p->'after_photos',  '[]'::jsonb)
  )
  returning id into v_id;

  update public.poles
     set status = 'withdrawn', withdrawal_id = v_id, withdrawn_at = now()
   where id = any(v_ids)
     and status = 'available'
     and site_id = (p->>'site_id')::uuid
     and size_id = (p->>'size_id')::uuid;

  get diagnostics v_count = row_count;

  if v_count <> array_length(v_ids, 1) then
    raise exception 'POLE_NOT_AVAILABLE';
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_withdrawal(jsonb) from public, anon, authenticated;
grant execute on function public.create_withdrawal(jsonb) to service_role;

-- ---------- 7) ความปลอดภัย (RLS) ----------
-- เปิด RLS และ "ไม่สร้าง policy" = anon key เข้าถึงข้อมูลไม่ได้เลย
-- เว็บเข้าถึงผ่าน API ฝั่งเซิร์ฟเวอร์ด้วย service_role (ข้าม RLS) เท่านั้น
alter table public.sites       enable row level security;
alter table public.pole_sizes  enable row level security;
alter table public.poles       enable row level security;
alter table public.withdrawals enable row level security;

-- ---------- 8) ข้อมูลตั้งต้น: ขนาดเสา (แก้ไข/เพิ่มได้ตามต้องการ) ----------
insert into public.pole_sizes (name, sort_order) values
  ('8 เมตร',            10),
  ('9 เมตร',            20),
  ('12 เมตร',           30),
  ('12 เมตร (อัดแรง)',  40),
  ('14 เมตร',           50)
on conflict (name) do nothing;
