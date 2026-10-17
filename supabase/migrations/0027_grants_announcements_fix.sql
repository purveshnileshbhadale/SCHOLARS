-- Fix: 0026 only granted service_role. CLI-pushed tables are not reliably
-- picking up default grants for `authenticated` either (42501 in E2E), so
-- grant explicitly AND restore the standard default privileges for any
-- table/function created by future migrations.

grant select, insert, update, delete on public.announcements to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on routines to postgres, anon, authenticated, service_role;
