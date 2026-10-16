-- ============================================================
-- Scholars Abroad — Phase 1 schema (Australia only)
-- Tables, roles, RLS, triggers, storage, seed data.
-- Country column exists on universities so multi-country
-- expansion later needs no schema change.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type public.user_role as enum ('student', 'counsellor', 'admin');
create type public.booking_status as enum ('pending', 'paid', 'scheduled', 'completed', 'cancelled');

-- ---------- helper functions (security definer, avoid RLS recursion) ----------
-- plpgsql so they can be declared before the tables they reference exist.
create or replace function public.is_admin()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end;
$$;

create or replace function public.is_counsellor()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'counsellor');
end;
$$;

-- A counsellor may see a student's data only through a paid/active booking.
-- (plpgsql so it can be declared before the bookings/counsellors tables exist)
create or replace function public.has_counsellor_access(target_student uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1
    from bookings b
    join counsellors c on c.id = b.counsellor_id
    where c.user_id = auth.uid()
      and b.student_id = target_student
      and b.status in ('paid', 'scheduled', 'completed')
  );
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_counsellor() from public, anon;
revoke all on function public.has_counsellor_access(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_counsellor() to authenticated, service_role;
grant execute on function public.has_counsellor_access(uuid) to authenticated, service_role;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user may never change their own role; only admins (or the service role) can.
create or replace function public.profiles_protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'only an admin can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.profiles_protect_role();

-- Seed profile + empty student_profiles row at signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  insert into public.student_profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: read self, admin, or assigned counsellor"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (public.is_counsellor() and public.has_counsellor_access(id))
  );

create policy "profiles: update self or admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------- student_profiles ----------
create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  intended_major text,
  class_10_marks numeric,
  class_12_marks numeric,
  grading_system text,
  ielts numeric,
  toefl numeric,
  pte numeric,
  sat numeric,
  budget_aud_per_year numeric,
  needs_scholarship boolean not null default false,
  preferred_cities text[] not null default '{}',
  priorities_ranked text[] not null default '{}',
  career_goal text,
  resume_url text,
  resume_parsed jsonb,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

-- is_complete is computed server-side; the client cannot fake it.
create or replace function public.compute_is_complete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_complete := (
    nullif(trim(coalesce(new.intended_major, '')), '') is not null
    and new.class_10_marks is not null
    and new.class_12_marks is not null
    and nullif(trim(coalesce(new.grading_system, '')), '') is not null
    and new.budget_aud_per_year is not null
    and new.budget_aud_per_year > 0
    and (new.ielts is not null or new.toefl is not null or new.pte is not null)
    and nullif(trim(coalesce(new.career_goal, '')), '') is not null
    and nullif(trim(coalesce(new.resume_url, '')), '') is not null
    and coalesce(array_length(new.preferred_cities, 1), 0) >= 1
    and coalesce(array_length(new.priorities_ranked, 1), 0) >= 1
  );
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_profiles_complete before insert or update on public.student_profiles
  for each row execute function public.compute_is_complete();

create policy "student_profiles: own / admin / assigned counsellor"
  on public.student_profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(user_id)
  );

create policy "student_profiles: insert own"
  on public.student_profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "student_profiles: update own or admin"
  on public.student_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------- universities ----------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'Australia',
  city text,
  state text,
  cricos_code text,
  qs_rank integer,
  the_rank integer,
  cs_subject_rank integer,
  tuition_aud numeric,
  living_cost_aud numeric,
  ielts_min numeric,
  toefl_min numeric,
  pte_min numeric,
  min_academic_requirement text,
  intakes text[] not null default '{}',
  cs_program_highlights text,
  post_study_work_years numeric,
  data_year integer,
  confidence text not null default 'sample' check (confidence in ('sample', 'low', 'medium', 'high')),
  sources jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (name, country)
);

alter table public.universities enable row level security;

create policy "universities: readable by everyone"
  on public.universities for select
  using (true);

create policy "universities: admin write"
  on public.universities for insert to authenticated
  with check (public.is_admin());

create policy "universities: admin update"
  on public.universities for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "universities: admin delete"
  on public.universities for delete to authenticated
  using (public.is_admin());

-- ---------- scholarships ----------
create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  name text not null,
  amount text,
  coverage text,
  eligibility text,
  international_eligible boolean not null default true,
  deadline text,
  url text
);

alter table public.scholarships enable row level security;

create policy "scholarships: readable by everyone"
  on public.scholarships for select
  using (true);

create policy "scholarships: admin write"
  on public.scholarships for insert to authenticated
  with check (public.is_admin());

create policy "scholarships: admin update"
  on public.scholarships for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "scholarships: admin delete"
  on public.scholarships for delete to authenticated
  using (public.is_admin());

-- ---------- shortlists (written only by the Edge Function via service role) ----------
create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  generated_at timestamptz not null default now(),
  result jsonb not null,
  model_version text
);

alter table public.shortlists enable row level security;

create index shortlists_student_idx on public.shortlists (student_id, generated_at desc);

create policy "shortlists: own / admin / assigned counsellor"
  on public.shortlists for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.has_counsellor_access(student_id)
  );

-- ---------- counsellors ----------
create table public.counsellors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text,
  specialisation text,
  price_inr numeric not null default 0,
  is_active boolean not null default true
);

alter table public.counsellors enable row level security;

create policy "counsellors: active list for students, own, admin"
  on public.counsellors for select to authenticated
  using (is_active or user_id = auth.uid() or public.is_admin());

create policy "counsellors: admin insert"
  on public.counsellors for insert to authenticated
  with check (public.is_admin());

create policy "counsellors: own or admin update"
  on public.counsellors for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "counsellors: admin delete"
  on public.counsellors for delete to authenticated
  using (public.is_admin());

-- ---------- bookings ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  counsellor_id uuid not null references public.counsellors(id) on delete restrict,
  status public.booking_status not null default 'pending',
  scheduled_at timestamptz,
  payment_id text,
  razorpay_order_id text,
  amount_inr numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create index bookings_student_idx on public.bookings (student_id);
create index bookings_counsellor_idx on public.bookings (counsellor_id);
create index bookings_order_idx on public.bookings (razorpay_order_id);

-- Payment state may only be set by the service role (webhook / verify
-- function) or an admin (offline payments). Students/counsellors cannot.
create or replace function public.bookings_protect_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.status = 'paid' and old.status <> 'paid' then
      raise exception 'payment status can only be set by the server';
    end if;
    if new.payment_id is distinct from old.payment_id then
      raise exception 'payment_id can only be set by the server';
    end if;
    if new.razorpay_order_id is distinct from old.razorpay_order_id then
      raise exception 'razorpay_order_id can only be set by the server';
    end if;
    if new.amount_inr is distinct from old.amount_inr then
      raise exception 'amount_inr can only be set by the server';
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_protect_payment before update on public.bookings
  for each row execute function public.bookings_protect_payment();

create policy "bookings: student own"
  on public.bookings for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.counsellors c
      where c.id = bookings.counsellor_id and c.user_id = auth.uid()
    )
  );

create policy "bookings: student creates own pending"
  on public.bookings for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending');

-- Students may only cancel their own pending booking; counsellors manage their own.
create policy "bookings: student cancels own pending"
  on public.bookings for update to authenticated
  using (
    (student_id = auth.uid() and status = 'pending')
    or public.is_admin()
    or exists (
      select 1 from public.counsellors c
      where c.id = bookings.counsellor_id and c.user_id = auth.uid()
    )
  )
  with check (
    (
      student_id = auth.uid()
      and status in ('cancelled', 'pending')
      and payment_id is null
      and razorpay_order_id is null
      and scheduled_at is null
    )
    or public.is_admin()
    or exists (
      select 1 from public.counsellors c
      where c.id = bookings.counsellor_id and c.user_id = auth.uid()
    )
  );

create policy "bookings: admin delete"
  on public.bookings for delete to authenticated
  using (public.is_admin());

-- ---------- counsellor_notes (private to counsellor + admin) ----------
create table public.counsellor_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  counsellor_id uuid not null references public.counsellors(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.counsellor_notes enable row level security;

create index counsellor_notes_booking_idx on public.counsellor_notes (booking_id);

create policy "notes: counsellor on own booking or admin"
  on public.counsellor_notes for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.counsellors c
      where c.id = counsellor_notes.counsellor_id and c.user_id = auth.uid()
    )
  );

create policy "notes: counsellor inserts on own booking"
  on public.counsellor_notes for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.counsellors c
      where c.id = counsellor_notes.counsellor_id and c.user_id = auth.uid()
    )
  );

create policy "notes: admin delete"
  on public.counsellor_notes for delete to authenticated
  using (public.is_admin());

-- ---------- import log ----------
create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  file_name text,
  rows_total integer not null default 0,
  rows_added integer not null default 0,
  rows_updated integer not null default 0,
  rows_rejected integer not null default 0,
  errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.import_logs enable row level security;

create policy "import_logs: admin read"
  on public.import_logs for select to authenticated
  using (public.is_admin());

-- ---------- resumes storage bucket ----------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resumes: student uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: owner, admin, or assigned counsellor reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public.has_counsellor_access(((storage.foldername(name))[1])::uuid)
    )
  );

-- ============================================================
-- Seed: sample Australian universities (confidence = 'sample').
-- Replace/extend via the Admin Excel import. Verify figures
-- against official sources before going live.
-- ============================================================
insert into public.universities
  (name, country, city, state, qs_rank, the_rank, cs_subject_rank, tuition_aud, living_cost_aud,
   ielts_min, toefl_min, pte_min, min_academic_requirement, intakes, cs_program_highlights,
   post_study_work_years, data_year, confidence, sources)
values
  ('University of Melbourne','Australia','Melbourne','VIC',13,37,32,52000,24000,6.5,79,58,'Strong Year 12 / equivalent bachelor''s','{Feb,Jul}','MS CS, AI, Software Engineering; strong research labs',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('University of Sydney','Australia','Sydney','NSW',18,61,41,55000,25000,6.5,85,61,'Competitive academic record','{Feb,Aug}','Computing, Data Science, Cybersecurity',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('UNSW Sydney','Australia','Sydney','NSW',19,67,36,54000,25000,6.5,90,64,'Strong mathematical background','{Feb,Sep}','CS & AI, Cybersecurity, SE; co-op programs',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('Monash University','Australia','Melbourne','VIC',37,58,51,48000,22000,6.5,79,58,'Year 12 or pathway','{Feb,Jul}','Computer Science, AI & Data Science, Cybersecurity',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('Australian National University','Australia','Canberra','ACT',30,73,49,50000,23000,6.5,80,64,'High academic merit','{Feb,Jul}','Computing, Machine Learning, Cybersecurity',4,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('University of Technology Sydney','Australia','Sydney','NSW',88,130,64,45000,23000,6.5,79,58,'Relevant prior study or foundation','{Feb,Aug}','Computer Science, Data Science, Cybersecurity; industry capstones',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('University of Queensland','Australia','Brisbane','QLD',40,70,60,47000,22000,6.5,87,64,'Competitive Year 12 / bachelor''s','{Feb,Jul}','Computer Science, Cybersecurity, Data Analytics',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('University of Adelaide','Australia','Adelaide','SA',82,111,72,44000,20000,6.5,79,58,'Standard bachelor''s entry','{Feb,Jul}','Computer Science, Machine Learning, Cybersecurity',4,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('University of Western Australia','Australia','Perth','WA',72,120,84,46000,21000,6.5,82,62,'Solid academic record','{Feb,Jul}','Computer Science, Data Science',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('RMIT University','Australia','Melbourne','VIC',123,251,101,42000,22000,6.5,79,58,'Diploma / foundation pathways available','{Feb,Jul}','Computer Science, AI, Cybersecurity; industry-linked',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('Deakin University','Australia','Melbourne','VIC',197,251,101,38000,21000,6.5,79,58,'Pathway options available','{Mar,Jul,Nov}','Computer Science, Cybersecurity, AI',3,2025,'sample','[{"label":"seed placeholder — verify"}]'),
  ('Macquarie University','Australia','Sydney','NSW',198,180,101,40000,23000,6.5,83,62,'Standard entry or pathway','{Feb,Jul}','Computer Science, Data Science, Cybersecurity',3,2025,'sample','[{"label":"seed placeholder — verify"}]');

insert into public.scholarships (university_id, name, amount, coverage, eligibility, url)
select u.id, s.name, s.amount, s.coverage, s.eligibility, s.url
from (values
  ('University of Melbourne','International Merit Scholarship','AUD 10,000','tuition fee reduction','High-achieving international students','https://study.unimelb.edu.au/'),
  ('University of Sydney','International Student Scholarship','AUD 5,000 – 40,000','tuition fee reduction','Based on academic merit','https://www.sydney.edu.au/'),
  ('UNSW Sydney','International Scholarships','AUD 5,000 – 20,000','first year tuition','Strong academic results','https://www.unsw.edu.au/'),
  ('Monash University','International Merit Scholarship','AUD 6,000 – 10,000 per year','tuition fee reduction','Top academic performers','https://www.monash.edu/'),
  ('Australian National University','ANU International Merit Scholarship','AUD 25,000','first year tuition','Merit-based','https://www.anu.edu.au/'),
  ('University of Queensland','UQ International Scholarship','AUD 6,000 – 12,000','tuition fee reduction','Academic merit','https://www.uq.edu.au/'),
  ('University of Adelaide','Adelaide Global Scholarship','AUD 15,000','first year tuition','All international students','https://www.adelaide.edu.au/'),
  ('RMIT University','RMIT International Scholarship','AUD 10,000','first year tuition','Merit + need','https://www.rmit.edu.au/'),
  ('Deakin University','Deakin Vice-Chancellor''s International Scholarship','AUD 20,000','tuition fee reduction','Top-tier academic results','https://www.deakin.edu.au/')
) as s(uni_name, name, amount, coverage, eligibility, url)
join public.universities u on u.name = s.uni_name and u.country = 'Australia';
