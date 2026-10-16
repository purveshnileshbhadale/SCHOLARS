-- Fix: RETURNS TABLE declares OUT columns (user_id, …); unqualified references
-- inside the body are ambiguous with them. Alias every column reference.
create or replace function public.community_members()
returns table (
  user_id uuid,
  name text,
  intended_major text,
  linkedin_url text,
  joined_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.student_profiles x
    where x.user_id = auth.uid() and x.community_joined_at is not null
  ) then
    return;
  end if;
  return query
    select sp.user_id, p.name, sp.intended_major, sp.linkedin_url, sp.community_joined_at
    from public.student_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.community_joined_at is not null
    order by sp.community_joined_at desc;
end;
$$;

grant execute on function public.community_members() to authenticated;
revoke execute on function public.community_members() from public;
