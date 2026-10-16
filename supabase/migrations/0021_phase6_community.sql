-- Phase 6: community engagement (reactions, comments, bookmarks, tags),
-- sharing (per-post links) and refer-a-friend.

-- 1) Hashtags on posts
alter table public.community_posts
  add column if not exists tags text[] not null default '{}';

-- 2) Reactions (one per student per post; like / love / helpful)
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'love', 'helpful')),
  created_at timestamptz not null default now(),
  unique (post_id, student_id)
);

alter table public.post_reactions enable row level security;
drop policy if exists "post_reactions: read all" on public.post_reactions;
create policy "post_reactions: read all" on public.post_reactions
  for select to authenticated using (true);
drop policy if exists "post_reactions: insert own" on public.post_reactions;
create policy "post_reactions: insert own" on public.post_reactions
  for insert to authenticated with check (student_id = auth.uid());
drop policy if exists "post_reactions: update own" on public.post_reactions;
create policy "post_reactions: update own" on public.post_reactions
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists "post_reactions: delete own" on public.post_reactions;
create policy "post_reactions: delete own" on public.post_reactions
  for delete to authenticated using (student_id = auth.uid());
grant select, insert, update, delete on public.post_reactions to authenticated;

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

-- 3) Comments on posts
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.post_comments enable row level security;
drop policy if exists "post_comments: read all" on public.post_comments;
create policy "post_comments: read all" on public.post_comments
  for select to authenticated using (true);
drop policy if exists "post_comments: insert own" on public.post_comments;
create policy "post_comments: insert own" on public.post_comments
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "post_comments: delete own" on public.post_comments;
create policy "post_comments: delete own" on public.post_comments
  for delete to authenticated using (author_id = auth.uid());
grant select, insert, delete on public.post_comments to authenticated;

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at asc);

-- 4) Personal bookmarks on posts (own rows only)
create table if not exists public.post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, student_id)
);

alter table public.post_bookmarks enable row level security;
drop policy if exists "post_bookmarks: own rows only" on public.post_bookmarks;
create policy "post_bookmarks: own rows only"
  on public.post_bookmarks for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
grant select, insert, delete on public.post_bookmarks to authenticated;

create index if not exists post_bookmarks_student_idx on public.post_bookmarks (student_id);

-- 5) Refer-a-friend (one row per referred signup; unique on referred_id)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

alter table public.referrals enable row level security;
drop policy if exists "referrals: involved only" on public.referrals;
create policy "referrals: involved only" on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());
drop policy if exists "referrals: insert as referred" on public.referrals;
create policy "referrals: insert as referred" on public.referrals
  for insert to authenticated with check (referred_id = auth.uid());
grant select, insert on public.referrals to authenticated;

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

-- 6) Feed v2: tags + reaction counts + comment counts (columns changed, so
--    the old signature must be dropped first)
drop function if exists public.community_feed();

create function public.community_feed()
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  tags text[],
  reactions jsonb,
  comment_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select
      cp.id,
      cp.body,
      cp.created_at,
      cp.author_id,
      coalesce(p.name, 'Student'),
      coalesce(cp.tags, '{}'::text[]),
      coalesce(
        (
          select jsonb_object_agg(x.kind, x.n)
          from (
            select pr.kind, count(*) as n
            from public.post_reactions pr
            where pr.post_id = cp.id
            group by pr.kind
          ) x
        ),
        '{}'::jsonb
      ),
      (select count(*) from public.post_comments pc where pc.post_id = cp.id)
    from public.community_posts cp
    join public.profiles p on p.id = cp.author_id
    order by cp.created_at desc
    limit 100;
end;
$$;

grant execute on function public.community_feed() to authenticated;

-- 7) Comment author names resolved server-side (profiles RLS hides peers)
create or replace function public.post_comments_feed(p_post_ids uuid[])
returns table (
  id uuid,
  post_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select pc.id, pc.post_id, pc.author_id, coalesce(p.name, 'Student'), pc.body, pc.created_at
  from public.post_comments pc
  join public.profiles p on p.id = pc.author_id
  where pc.post_id = any(p_post_ids)
  order by pc.created_at asc
  limit 500;
$$;

grant execute on function public.post_comments_feed(uuid[]) to authenticated;
