-- ============================================================
-- Phase 1b: application journey, secure profile sharing,
-- SOP questionnaire readiness, per-university application tracker.
-- ============================================================

-- ---------- student_profiles additions ----------
alter table public.student_profiles
  add column share_consent boolean not null default false,
  add column share_consent_at timestamptz,
  add column shortlist_reviewed_at timestamptz,
  add column shared_with_counsellor_at timestamptz;  -- set ONLY on explicit student confirmation

-- ---------- revocable share tokens ----------
create table public.profile_shares (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.profile_shares enable row level security;

create index profile_shares_student_idx on public.profile_shares (student_id);

create policy "profile_shares: student reads own"
  on public.profile_shares for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

-- Writes happen only through the share-token Edge Function (service role).

-- ---------- SOP questionnaire responses ----------
create table public.sop_responses (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.sop_responses enable row level security;

create policy "sop: own / admin / assigned counsellor"
  on public.sop_responses for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(student_id)
  );

create policy "sop: insert own"
  on public.sop_responses for insert to authenticated
  with check (student_id = auth.uid());

create policy "sop: update own or admin"
  on public.sop_responses for update to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ---------- application tracker ----------
create type public.application_status as enum (
  'Not Started',
  'Preparing Documents',
  'Ready to Apply',
  'Application Submitted',
  'Awaiting Decision',
  'Offer Received',
  'Waitlisted',
  'Rejected',
  'Withdrawn'
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  program text,
  portal_url text,
  admission_deadline date,
  required_documents text[] not null default '{}',
  application_fee_aud numeric,
  scholarship_deadline date,
  status public.application_status not null default 'Not Started',
  submitted_at timestamptz,
  interview_notes text,
  admission_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applications enable row level security;

create index applications_student_idx on public.applications (student_id);

-- Submission timestamp may only be set together with a submitted-or-later
-- status — never fabricated by a stray click.
create or replace function public.applications_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status in ('Application Submitted', 'Awaiting Decision', 'Offer Received', 'Waitlisted', 'Rejected')
     and new.submitted_at is null then
    new.submitted_at := now();
  end if;
  if new.status in ('Not Started', 'Preparing Documents', 'Ready to Apply', 'Withdrawn') then
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

create trigger applications_touch before insert or update on public.applications
  for each row execute function public.applications_touch();

create policy "applications: own / admin / assigned counsellor"
  on public.applications for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(student_id)
  );

create policy "applications: insert own"
  on public.applications for insert to authenticated
  with check (student_id = auth.uid());

create policy "applications: update own / admin / assigned counsellor"
  on public.applications for update to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(student_id)
  )
  with check (
    student_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(student_id)
  );

create policy "applications: delete own or admin"
  on public.applications for delete to authenticated
  using (student_id = auth.uid() or public.is_admin());
