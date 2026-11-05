-- Migration 010: วันขนเสา (ใช้แสดงในปฏิทิน)
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
alter table public.withdrawals add column if not exists move_date date;
update public.withdrawals set move_date = (created_at at time zone 'Asia/Bangkok')::date where move_date is null;
create index if not exists withdrawals_move_date_idx on public.withdrawals(move_date);
