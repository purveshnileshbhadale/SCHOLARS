-- ============================================================
-- Scholars Abroad - apply pending schema (0028 + 0029)
-- Safe to run more than once: every statement is idempotent.
-- Run in Supabase -> SQL Editor for project zacbcisgiwejkgeimbmd.
-- ============================================================
-- ============================================================
-- Phase 10 — Roadmap planner + Gap report persistence
-- Engine 5 (roadmap) and Engine 4 (gap analyser) data.
-- ============================================================

-- 1) Roadmap tasks — persisted, editable, status-tracked.
create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  -- Stable engine key for the task ("essays", "english_test", …). Titles can be
  -- reworded by the planner; the key is what progress is tracked against.
  task_key text,
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

-- Older copies of this table have no task_key; add it without touching data.
alter table public.roadmap_tasks add column if not exists task_key text;

-- One row per student per engine task. The frontend upserts on this pair
-- (ON CONFLICT needs a real unique index, not just an index).
create unique index if not exists roadmap_tasks_student_key_idx
  on public.roadmap_tasks (student_id, task_key)
  where task_key is not null;

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

-- ============================================================
-- Phase 11 — Scholarship tracker + Professor outreach pipeline
-- ============================================================

-- 1) Scholarship applications — workflow per scholarship.
create table if not exists public.scholarship_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  scholarship_id uuid,
  scholarship_name text not null,
  provider text,
  amount_aud numeric,
  deadline date,
  status text not null default 'saved'
    check (status in ('saved', 'drafting', 'submitted', 'shortlisted', 'awarded', 'rejected', 'expired')),
  submitted_at timestamptz,
  outcome_at timestamptz,
  notes text,
  doc_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scholarship_applications enable row level security;

drop policy if exists "scholarship_apps: own rows only" on public.scholarship_applications;
create policy "scholarship_apps: own rows only" on public.scholarship_applications
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "scholarship_apps: counsellor/admin read" on public.scholarship_applications;
create policy "scholarship_apps: counsellor/admin read" on public.scholarship_applications
  for select to authenticated
  using (
    public.is_admin()
    or public.has_counsellor_access(student_id)
  );

grant select, insert, update, delete on public.scholarship_applications to authenticated;
create index if not exists scholarship_apps_student_idx
  on public.scholarship_applications (student_id, deadline nulls last, sort_order);

drop trigger if exists scholarship_apps_touch on public.scholarship_applications;
create trigger scholarship_apps_touch before update on public.scholarship_applications
  for each row execute function public.set_updated_at();

-- 2) Outreach contacts — professors, researchers, alumni you cold-email.
create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  institution text,
  department text,
  email text,
  research_area text,
  status text not null default 'to_contact'
    check (status in ('to_contact', 'drafted', 'sent', 'replied', 'meeting_booked', 'closed')),
  last_contacted_at timestamptz,
  follow_up_at date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outreach_contacts enable row level security;

drop policy if exists "outreach: own rows only" on public.outreach_contacts;
create policy "outreach: own rows only" on public.outreach_contacts
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "outreach: counsellor/admin read" on public.outreach_contacts;
create policy "outreach: counsellor/admin read" on public.outreach_contacts
  for select to authenticated
  using (
    public.is_admin()
    or public.has_counsellor_access(student_id)
  );

grant select, insert, update, delete on public.outreach_contacts to authenticated;
create index if not exists outreach_student_idx
  on public.outreach_contacts (student_id, follow_up_at nulls last, sort_order);

drop trigger if exists outreach_contacts_touch on public.outreach_contacts;
create trigger outreach_contacts_touch before update on public.outreach_contacts
  for each row execute function public.set_updated_at();
