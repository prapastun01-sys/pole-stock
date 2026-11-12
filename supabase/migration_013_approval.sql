-- Migration 013: ใบเบิกต้อง "อนุมัติ" ก่อน (approved_at = null → รออนุมัติ)
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
alter table public.withdrawals add column if not exists approved_at timestamptz;
-- ใบเบิกที่มีอยู่แล้วทั้งหมด ถือว่าอนุมัติแล้ว
update public.withdrawals set approved_at = created_at where approved_at is null;
create index if not exists withdrawals_pending_idx on public.withdrawals(created_at) where approved_at is null;
