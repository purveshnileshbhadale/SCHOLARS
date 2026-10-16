-- Per-application document checklist (student-managed).
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (application_id, label)
);

alter table public.application_documents enable row level security;

create policy "application_documents: own via application"
  on public.application_documents for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and (a.student_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id and (a.student_id = auth.uid() or public.is_admin())
    )
  );

grant select, insert, update, delete on public.application_documents to authenticated;
