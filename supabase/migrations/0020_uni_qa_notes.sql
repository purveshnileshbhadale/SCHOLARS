-- Phase 5: personal notes on saved universities + university Q&A.

-- 1) Notes on saved universities
alter table public.saved_universities
  add column if not exists notes text check (notes is null or char_length(notes) <= 4000);

-- existing grants from 0008 covered select/insert/delete only
grant update on public.saved_universities to authenticated;

-- 2) University questions (community)
create table if not exists public.uni_questions (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 5 and 600),
  created_at timestamptz not null default now()
);

alter table public.uni_questions enable row level security;
drop policy if exists "uni_questions: readable" on public.uni_questions;
create policy "uni_questions: readable" on public.uni_questions
  for select to authenticated using (true);
drop policy if exists "uni_questions: insert own" on public.uni_questions;
create policy "uni_questions: insert own" on public.uni_questions
  for insert to authenticated with check (student_id = auth.uid());
drop policy if exists "uni_questions: delete own or admin" on public.uni_questions;
create policy "uni_questions: delete own or admin" on public.uni_questions
  for delete to authenticated using (student_id = auth.uid() or public.is_admin());
grant select, insert, delete on public.uni_questions to authenticated;

create index if not exists uni_questions_uni_idx
  on public.uni_questions (university_id, created_at desc);

-- 3) Answers to questions
create table if not exists public.uni_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.uni_questions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(answer) between 5 and 2000),
  created_at timestamptz not null default now()
);

alter table public.uni_answers enable row level security;
drop policy if exists "uni_answers: readable" on public.uni_answers;
create policy "uni_answers: readable" on public.uni_answers
  for select to authenticated using (true);
drop policy if exists "uni_answers: insert own" on public.uni_answers;
create policy "uni_answers: insert own" on public.uni_answers
  for insert to authenticated with check (student_id = auth.uid());
drop policy if exists "uni_answers: delete own or admin" on public.uni_answers;
create policy "uni_answers: delete own or admin" on public.uni_answers
  for delete to authenticated using (student_id = auth.uid() or public.is_admin());
grant select, insert, delete on public.uni_answers to authenticated;

create index if not exists uni_answers_question_idx
  on public.uni_answers (question_id, created_at asc);
