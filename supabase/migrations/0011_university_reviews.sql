-- Student reviews / ratings for universities (community-driven).
create table public.university_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, university_id)
);

alter table public.university_reviews enable row level security;

-- Anyone signed in can read reviews; authors manage only their own.
create policy "reviews: authenticated read"
  on public.university_reviews for select to authenticated
  using (true);

create policy "reviews: author inserts own"
  on public.university_reviews for insert to authenticated
  with check (student_id = auth.uid());

create policy "reviews: author updates own"
  on public.university_reviews for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "reviews: author or admin deletes"
  on public.university_reviews for delete to authenticated
  using (student_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.university_reviews to authenticated;
