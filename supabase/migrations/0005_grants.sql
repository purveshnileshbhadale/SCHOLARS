-- Explicit role grants (Supabase's default privileges don't always
-- cover tables created inside a migration — this makes it deterministic).
grant usage on schema public to anon, authenticated, service_role;

grant select on public.universities, public.scholarships to anon, authenticated;

grant select, insert, update
  on public.profiles, public.student_profiles, public.shortlists, public.counsellors,
     public.bookings, public.counsellor_notes, public.applications, public.sop_responses,
     public.profile_shares, public.import_logs
  to authenticated;

grant delete on public.bookings, public.applications to authenticated;

grant all on all tables in schema public to service_role;
