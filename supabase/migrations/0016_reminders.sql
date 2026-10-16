-- 0016: reminders — per-student "remind me" rows surfaced in the action bell
-- and the Deadline Hub. One row per reminder target.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('application', 'scholarship', 'booking', 'intake', 'custom')),
  target_id text,
  title text not null,
  due_at timestamptz not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, due_at)
);

create index if not exists reminders_user_due_idx
  on public.reminders (user_id, due_at);

alter table public.reminders enable row level security;

drop policy if exists "own reminders select" on public.reminders;
create policy "own reminders select" on public.reminders
  for select using (auth.uid() = user_id);

drop policy if exists "own reminders insert" on public.reminders;
create policy "own reminders insert" on public.reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "own reminders update" on public.reminders;
create policy "own reminders update" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reminders delete" on public.reminders;
create policy "own reminders delete" on public.reminders
  for delete using (auth.uid() = user_id);
