-- Students cannot read other users' profiles (RLS: self/admin/assigned only),
-- so counsellor cards on /counsellors and /bookings embedded names as null.
-- Carry a public display name on the counsellor row instead.

alter table public.counsellors
  add column if not exists display_name text;

-- Auto-fill display name from the profile on insert.
create or replace function public.counsellors_fill_display_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is null or btrim(new.display_name) = '' then
    select coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1))
    into new.display_name
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger counsellors_fill_display_name before insert on public.counsellors
  for each row execute function public.counsellors_fill_display_name();

-- The admin flow is two steps (promote role -> create counsellor profile).
-- Finish the missing row for an already-promoted counsellor so the student
-- search page is not empty. No-op if that user does not exist here.
insert into public.counsellors (user_id, display_name, price_inr, is_active)
select p.id, 'Amit Jain', 9999, true
from public.profiles p
where p.email = 'amit.jain@scholarsabroad.com'
  and p.role = 'counsellor'
  and not exists (select 1 from public.counsellors c where c.user_id = p.id);
