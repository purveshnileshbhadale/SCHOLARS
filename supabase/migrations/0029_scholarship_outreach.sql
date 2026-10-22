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
