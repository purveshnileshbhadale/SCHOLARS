-- Tables created by CLI-pushed migrations did not receive service_role grants
-- (Supabase's default privileges only cover tables created in the dashboard).
-- Edge functions run queries as service_role, so daily-digest and friends
-- would hit "permission denied" on reminders, documents, community tables etc.
-- service_role bypasses RLS regardless; this just restores table privileges.

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant all on table public.%I to service_role', r.tablename);
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('grant usage, select on sequence public.%I to service_role', r.sequencename);
  end loop;
end $$;

grant usage on schema public to service_role;
grant execute on all functions in schema public to service_role;
