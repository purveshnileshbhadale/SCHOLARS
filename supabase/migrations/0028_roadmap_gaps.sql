-- ============================================================
-- Phase 10 — Roadmap planner + Gap report persistence
-- Engine 5 (roadmap) and Engine 4 (gap analyser) data.
-- ============================================================

-- 1) Roadmap tasks — persisted, editable, status-tracked.
create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'admin',
  due_date date,
  start_date date,
  hours_per_week numeric,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'skipped')),
  completed_at timestamptz,
  proof_url text,
  gap_id text,
  intensity text not null default 'standard'
    check (intensity in ('light', 'standard', 'intensive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roadmap_tasks enable row level security;

drop policy if exists "roadmap_tasks: own rows only" on public.roadmap_tasks;
create policy "roadmap_tasks: own rows only" on public.roadmap_tasks
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Counsellors and admins can read the student's roadmap when they have access.
drop policy if exists "roadmap_tasks: counsellor/admin read" on public.roadmap_tasks;
create policy "roadmap_tasks: counsellor/admin read" on public.roadmap_tasks
  for select to authenticated
  using (
    public.is_admin()
    or public.has_counsellor_access(student_id)
  );

grant select, insert, update, delete on public.roadmap_tasks to authenticated;
create index if not exists roadmap_tasks_student_idx
  on public.roadmap_tasks (student_id, due_date nulls last, sort_order);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roadmap_tasks_touch on public.roadmap_tasks;
create trigger roadmap_tasks_touch before update on public.roadmap_tasks
  for each row execute function public.set_updated_at();

-- 2) Gap report snapshots — computed engine output stored for history.
create table if not exists public.gap_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.gap_reports enable row level security;

drop policy if exists "gap_reports: own rows only" on public.gap_reports;
create policy "gap_reports: own rows only" on public.gap_reports
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "gap_reports: counsellor/admin read" on public.gap_reports;
create policy "gap_reports: counsellor/admin read" on public.gap_reports
  for select to authenticated
  using (
    public.is_admin()
    or public.has_counsellor_access(student_id)
  );

grant select, insert, update, delete on public.gap_reports to authenticated;
create index if not exists gap_reports_student_idx
  on public.gap_reports (student_id, created_at desc);
