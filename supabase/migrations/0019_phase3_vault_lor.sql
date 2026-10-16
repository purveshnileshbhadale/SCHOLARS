-- Phase 3: document vault, LOR tracker, application fee ledger,
-- offer milestones, student booking change requests.

-- 1) Application fee ledger + offer milestone columns
alter table public.applications
  add column if not exists fee_paid_aud numeric,
  add column if not exists fee_paid_on date,
  add column if not exists offer_received_on date,
  add column if not exists offer_accept_by date,
  add column if not exists coe_issued_on date;

-- 2) Student-side booking change requests (flag for counsellor)
alter table public.bookings
  add column if not exists student_request text
    check (student_request is null or student_request in ('cancel', 'reschedule')),
  add column if not exists student_request_note text,
  add column if not exists student_requested_at timestamptz;

-- 3) Document vault
create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'Other'
    check (category in ('Passport', 'Academic', 'English test', 'Financial', 'Offer letter', 'LOR', 'Identity', 'Other')),
  label text not null check (char_length(label) between 1 and 160),
  file_path text not null,
  file_type text,
  file_size bigint,
  doc_date date,
  expires_on date,
  created_at timestamptz not null default now(),
  unique (student_id, file_path)
);

alter table public.student_documents enable row level security;
drop policy if exists "student_documents: own rows only" on public.student_documents;
create policy "student_documents: own rows only" on public.student_documents
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
grant select, insert, update, delete on public.student_documents to authenticated;

create index if not exists student_documents_student_idx
  on public.student_documents (student_id, created_at desc);

-- 4) LOR tracker
create table if not exists public.lor_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  recommender_name text not null check (char_length(recommender_name) between 1 and 120),
  recommender_email text,
  relationship text,
  due_date date,
  status text not null default 'draft'
    check (status in ('draft', 'requested', 'agreed', 'submitted', 'declined')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lor_requests enable row level security;
drop policy if exists "lor_requests: own rows only" on public.lor_requests;
create policy "lor_requests: own rows only" on public.lor_requests
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
grant select, insert, update, delete on public.lor_requests to authenticated;

create index if not exists lor_requests_student_idx
  on public.lor_requests (student_id, due_date nulls last);

-- 5) Private 'documents' storage bucket (10 MB limit) + owner-only policies
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "documents: owner select" on storage.objects;
create policy "documents: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents: owner insert" on storage.objects;
create policy "documents: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents: owner update" on storage.objects;
create policy "documents: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents: owner delete" on storage.objects;
create policy "documents: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
