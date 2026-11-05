-- Migration 011: เลขเสาซ้ำข้ามกองได้ แต่ห้ามซ้ำภายในกองเดียวกัน
-- รันใน Supabase → SQL Editor → Run (รันซ้ำได้)
do $$
declare c text;
begin
  -- ลบ unique เดิมที่บังคับเฉพาะคอลัมน์ pole_no (ไม่ว่าชื่ออะไร)
  for c in
    select con.conname from pg_constraint con
    join pg_class t on t.oid = con.conrelid and t.relname = 'poles'
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where con.contype = 'u' and array_length(con.conkey, 1) = 1
      and (select attname from pg_attribute where attrelid = t.oid and attnum = con.conkey[1]) = 'pole_no'
  loop
    execute format('alter table public.poles drop constraint %I', c);
  end loop;
end $$;
drop index if exists public.poles_pole_no_key;
create unique index if not exists poles_site_pole_no_uniq on public.poles (site_id, pole_no);
