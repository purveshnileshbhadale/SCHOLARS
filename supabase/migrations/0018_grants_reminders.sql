-- 0018: table-level grants for reminders (RLS alone isn't enough —
-- authenticated also needs SELECT/INSERT/UPDATE/DELETE privileges).

grant select, insert, update, delete on public.reminders to authenticated;
