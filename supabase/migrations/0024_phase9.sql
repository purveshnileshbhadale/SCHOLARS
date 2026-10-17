-- ============================================================
-- Phase 9 (features 51-58)
-- ============================================================

-- 51) SOP version history — snapshots of the questionnaire answers.
create table if not exists public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  answers jsonb not null,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sop_versions enable row level security;
drop policy if exists "sop_versions: own rows only" on public.sop_versions;
create policy "sop_versions: own rows only" on public.sop_versions
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
grant select, insert, update, delete on public.sop_versions to authenticated;
create index if not exists sop_versions_student_idx on public.sop_versions (student_id, created_at desc);

-- 52) Interview practice log — saved feedback from ScholarAI mock interviews.
create table if not exists public.interview_practice (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  interview_type text not null default 'Admission',
  question text not null,
  answer text not null,
  score integer check (score between 0 and 10),
  feedback text not null,
  created_at timestamptz not null default now()
);

alter table public.interview_practice enable row level security;
drop policy if exists "interview_practice: own rows only" on public.interview_practice;
create policy "interview_practice: own rows only" on public.interview_practice
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
grant select, insert, update, delete on public.interview_practice to authenticated;
create index if not exists interview_practice_student_idx on public.interview_practice (student_id, created_at desc);

-- 53) Visa document checklist, one per application.
create table if not exists public.visa_checklists (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  country text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.visa_checklists enable row level security;
drop policy if exists "visa_checklists: own / admin / counsellor" on public.visa_checklists;
create policy "visa_checklists: own / admin / counsellor" on public.visa_checklists
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = visa_checklists.application_id and a.student_id = auth.uid()
    )
    or public.is_admin()
    or public.has_counsellor_access(
      (select a.student_id from public.applications a where a.id = visa_checklists.application_id)
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = visa_checklists.application_id and a.student_id = auth.uid()
    )
    or public.is_admin()
    or public.has_counsellor_access(
      (select a.student_id from public.applications a where a.id = visa_checklists.application_id)
    )
  );
grant select, insert, update, delete on public.visa_checklists to authenticated;
create index if not exists visa_checklists_application_idx on public.visa_checklists (application_id);

-- 55) Notification preferences (digest opt-out, reminder window).
alter table public.profiles
  add column if not exists email_digest_enabled boolean not null default true,
  add column if not exists reminder_lead_days integer not null default 30;
do $$
begin
  alter table public.profiles
    add constraint profiles_reminder_lead_days_range check (reminder_lead_days between 7 and 90);
exception
  when duplicate_object then null;
end $$;

-- 56) Daily plan checks (gamification: today's tasks + streak).
create table if not exists public.daily_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  task_key text not null,
  created_at timestamptz not null default now(),
  constraint daily_checks_unique unique (user_id, day, task_key)
);

alter table public.daily_checks enable row level security;
drop policy if exists "daily_checks: own rows only" on public.daily_checks;
create policy "daily_checks: own rows only" on public.daily_checks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.daily_checks to authenticated;
create index if not exists daily_checks_user_day_idx on public.daily_checks (user_id, day);

-- 58) Offer conditions tracker (conditional offers: IELTS, transcripts, etc.).
create table if not exists public.offer_conditions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  label text not null,
  met boolean not null default false,
  met_on date,
  created_at timestamptz not null default now()
);

alter table public.offer_conditions enable row level security;
drop policy if exists "offer_conditions: own / admin / counsellor" on public.offer_conditions;
create policy "offer_conditions: own / admin / counsellor" on public.offer_conditions
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = offer_conditions.application_id and a.student_id = auth.uid()
    )
    or public.is_admin()
    or public.has_counsellor_access(
      (select a.student_id from public.applications a where a.id = offer_conditions.application_id)
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = offer_conditions.application_id and a.student_id = auth.uid()
    )
    or public.is_admin()
    or public.has_counsellor_access(
      (select a.student_id from public.applications a where a.id = offer_conditions.application_id)
    )
  );
grant select, insert, update, delete on public.offer_conditions to authenticated;
create index if not exists offer_conditions_application_idx on public.offer_conditions (application_id);
