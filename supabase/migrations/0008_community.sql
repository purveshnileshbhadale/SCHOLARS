-- ============================================================
-- Community + LinkedIn + saved (bookmarked) universities
-- ============================================================

-- 1) LinkedIn profile + community membership on the student profile.
alter table public.student_profiles
  add column if not exists linkedin_url text,
  add column if not exists community_joined_at timestamptz;

-- 2) Students can bookmark universities (star on the directory).
create table public.saved_universities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, university_id)
);

alter table public.saved_universities enable row level security;

create policy "saved_universities: own rows only"
  on public.saved_universities for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

grant select, insert, delete on public.saved_universities to authenticated;

-- 3) Community discussion board.
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

create policy "community_posts: authenticated read"
  on public.community_posts for select to authenticated
  using (true);

create policy "community_posts: author inserts own"
  on public.community_posts for insert to authenticated
  with check (author_id = auth.uid());

create policy "community_posts: author deletes own"
  on public.community_posts for delete to authenticated
  using (author_id = auth.uid());

grant select, insert, delete on public.community_posts to authenticated;

-- 4) Member directory — security definer with a column whitelist so other
--    students only ever see name / course / LinkedIn of JOINED members
--    (never marks, resume, budget …). Only members may list the directory.
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
    select 1 from public.student_profiles
    where user_id = auth.uid() and community_joined_at is not null
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

-- 5) Feed with author names (profiles RLS hides other students' rows,
--    so names are resolved server-side here).
create or replace function public.community_feed()
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text
)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select cp.id, cp.body, cp.created_at, cp.author_id, coalesce(p.name, 'Student')
    from public.community_posts cp
    join public.profiles p on p.id = cp.author_id
    order by cp.created_at desc
    limit 100;
end;
$$;

grant execute on function public.community_members() to authenticated;
grant execute on function public.community_feed() to authenticated;
