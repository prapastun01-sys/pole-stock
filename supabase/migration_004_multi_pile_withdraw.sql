-- =====================================================================
-- ใบเบิก 1 ใบ เบิกเสาได้หลายกอง/หลายขนาด
-- Supabase > SQL Editor > วางทั้งไฟล์ > Run  (รันซ้ำได้ ข้อมูลเดิมไม่หาย)
-- =====================================================================
alter table public.withdrawals alter column site_id drop not null;
alter table public.withdrawals alter column size_id drop not null;

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
    (job_name, wbs, network, responsible, team, before_photos, after_photos)
  values (
    p->>'job_name', p->>'wbs', p->>'network', p->>'responsible', p->>'team',
    coalesce(p->'before_photos', '[]'::jsonb),
    coalesce(p->'after_photos',  '[]'::jsonb)
  )
  returning id into v_id;

  -- เสาแต่ละต้นรู้กอง/ขนาดของตัวเองอยู่แล้ว; ต้องยัง available ทุกต้น ไม่งั้น rollback ทั้งใบ
  update public.poles
     set status = 'withdrawn', withdrawal_id = v_id, withdrawn_at = now()
   where id = any(v_ids) and status = 'available';

  get diagnostics v_count = row_count;
  if v_count <> array_length(v_ids, 1) then
    raise exception 'POLE_NOT_AVAILABLE';
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_withdrawal(jsonb) from public, anon, authenticated;
grant execute on function public.create_withdrawal(jsonb) to service_role;
