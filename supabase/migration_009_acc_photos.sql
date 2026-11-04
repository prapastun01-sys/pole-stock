-- Migration 009: รูปหลังขนอุปกรณ์เสริม (เก็บเป็น [{id,url}] เหมือนรูปก่อน/หลังขน)
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
alter table public.withdrawals add column if not exists acc_photos jsonb not null default '[]'::jsonb;
