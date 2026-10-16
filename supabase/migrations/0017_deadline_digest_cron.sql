-- 0017: daily deadline digest
--   * app_secrets table (RLS on, no client policies → service-role only)
--     with a cron_secret generated HERE in the database so no secret is
--     ever committed to this repo.
--   * pg_cron job (daily 02:30 UTC = 08:00 IST) that calls the
--     daily-digest edge function through pg_net with that secret.

create extension if not exists pg_cron;

create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
-- no policies on purpose: only the service role can read it

do $$
declare
  secret text;
begin
  select value into secret from public.app_secrets where key = 'cron_secret';
  if secret is null then
    insert into public.app_secrets (key, value)
    values ('cron_secret', gen_random_uuid()::text);
  end if;

  begin
    perform cron.unschedule('scholars-daily-digest');
  exception when others then
    null; -- job didn't exist yet
  end;

  perform cron.schedule(
    'scholars-daily-digest',
    '30 2 * * *',
    format(
      $job$select net.http_post(url := %L, headers := '{"Content-Type":"application/json","x-internal-secret":"%s"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 60000)$job$,
      'https://zacbcisgiwejkgeimbmd.supabase.co/functions/v1/daily-digest',
      (select value from public.app_secrets where key = 'cron_secret')
    )
  );
end $$;
