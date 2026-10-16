-- Generic per-student checklist (visa readiness, etc.).
create table public.student_checklist_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, label)
);

alter table public.student_checklist_items enable row level security;

create policy "student_checklist_items: own rows only"
  on public.student_checklist_items for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

grant select, insert, update, delete on public.student_checklist_items to authenticated;
