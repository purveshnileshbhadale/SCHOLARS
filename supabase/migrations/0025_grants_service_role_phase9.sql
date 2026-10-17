-- Phase 9 tables (0024) missed service_role grants for the same reason as
-- 0022: CLI-pushed migrations don't inherit Supabase's default privileges.
-- Re-run the blanket grant so edge functions and service-role reads work on
-- every table, present and future-at-this-point.

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

grant execute on all functions in schema public to service_role;
