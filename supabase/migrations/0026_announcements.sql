-- Admin power: platform announcements shown as a banner to every signed-in user.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements: any authenticated user reads"
  on public.announcements for select to authenticated
  using (true);

create policy "announcements: admin inserts own"
  on public.announcements for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

create policy "announcements: admin deletes"
  on public.announcements for delete to authenticated
  using (public.is_admin());

create index announcements_created_idx on public.announcements (created_at desc);

-- CLI migrations bypass Supabase's default privileges (see 0022/0025).
-- uuid PK → no sequence, just table grants.
grant select, insert, delete on public.announcements to service_role;
