-- Migration 012: ใบเบิกที่เบิกเฉพาะอุปกรณ์เสริม (ไม่มีเสา)
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
alter table public.withdrawals add column if not exists pole_free boolean not null default false;  -- true = ไม่มีเสาในใบนี้
alter table public.withdrawals add column if not exists area_id uuid references public.areas(id);  -- พื้นที่ (ใช้เฉพาะใบที่ไม่มีเสา)
