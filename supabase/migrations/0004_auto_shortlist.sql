-- ============================================================
-- Full automation: when a student profile flips to is_complete,
-- fire the shortlist Edge Function via pg_net. The AI shortlist
-- is generated server-side with no client involved.
-- The service-role key lives in Vault — never in this file.
-- ============================================================

create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- One-time: the key is inserted out-of-band (CLI/API), not here.
-- See vault row name: 'shortlist_service_key'

create or replace function public.fire_shortlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  svc_key text;
begin
  -- Only fire on the transition into complete, and only once.
  if new.is_complete and (old is null or not old.is_complete) then
    select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'shortlist_service_key';
    if svc_key is not null then
      perform net.http_post(
        url := 'https://zacbcisgiwejkgeimbmd.supabase.co/functions/v1/shortlist',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body := jsonb_build_object('user_id', new.user_id),
        timeout_milliseconds := 5000
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists student_profiles_fire_shortlist on public.student_profiles;
create trigger student_profiles_fire_shortlist
  after insert or update on public.student_profiles
  for each row execute function public.fire_shortlist();
