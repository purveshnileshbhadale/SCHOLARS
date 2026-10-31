-- ============================================================
-- FULL USER WIPE  ·  Scholars Abroad
-- ============================================================
-- Deletes EVERY auth user and all data that belongs to them.
--
-- What goes:  profiles, student profiles, shortlists, applications,
--             documents rows, LOR requests, bookings, counsellors,
--             SOP versions, QR/checklist rows, community posts,
--             comments, reactions, bookmarks, reviews, reminders,
--             referrals, uni questions/answers, roadmap tasks,
--             gap reports, scholarship applications, outreach rows.
--
-- What stays: universities, scholarships, announcements, app_secrets,
--             import_logs (their admin_id becomes NULL).
--             Reference data is NOT touched.
--
-- Storage files are NOT removed by this script. See STEP 4.
--
-- Run the whole thing in: Supabase Dashboard -> SQL Editor.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 · Look before you delete (read-only, safe)
-- ------------------------------------------------------------
select 'auth.users'                as table_name, count(*) as rows from auth.users
union all select 'public.profiles',        count(*) from public.profiles
union all select 'public.bookings',        count(*) from public.bookings
union all select 'public.counsellors',     count(*) from public.counsellors
union all select 'public.shortlists',      count(*) from public.shortlists
union all select 'public.applications',    count(*) from public.applications
union all select 'public.student_documents', count(*) from public.student_documents
union all select 'public.community_posts', count(*) from public.community_posts
order by table_name;


-- ------------------------------------------------------------
-- STEP 2 · Wipe (single transaction — all or nothing)
-- ------------------------------------------------------------
begin;

-- bookings.counsellor_id is ON DELETE RESTRICT, so bookings must go
-- before counsellors or the cascade from profiles would fail.
delete from public.bookings;
delete from public.counsellors;

-- Everything else hangs off profiles (directly, or transitively).
delete from public.profiles;

-- Catches users who signed up but never got a profile row, and clears
-- every table that references auth.users directly.
delete from auth.users;

commit;


-- ------------------------------------------------------------
-- STEP 3 · Verify
-- ------------------------------------------------------------
select 'auth.users'           as table_name, count(*) as remaining from auth.users
union all select 'public.profiles',     count(*) from public.profiles
union all select 'public.bookings',     count(*) from public.bookings
union all select 'public.counsellors',  count(*) from public.counsellors
union all select 'public.applications', count(*) from public.applications
union all select 'public.shortlists',   count(*) from public.shortlists;

-- Reference data should be untouched — this must NOT be zero:
select count(*) as universities_kept from public.universities;


-- ------------------------------------------------------------
-- STEP 4 · Delete the stored files (do this in the Dashboard)
-- ------------------------------------------------------------
-- Deleting rows from storage.objects via SQL removes only the metadata and
-- leaves the actual file in the bucket (still billed, still orphaned).
-- Use the Storage API instead:
--
--   Dashboard -> Storage -> bucket "documents" -> select all -> Delete
--   Dashboard -> Storage -> bucket "resumes"   -> select all -> Delete
--
-- If a bucket has thousands of files, empty it with the CLI instead:
--   supabase storage rm --recursive --experimental ss:///documents
--   supabase storage rm --recursive --experimental ss:///resumes


-- ------------------------------------------------------------
-- STEP 5 · Get back in afterwards
-- ------------------------------------------------------------
-- There is now no admin. Sign up normally in the app, then run this
-- once with your own email to restore admin access:
--
--   update public.profiles
--      set role = 'admin'
--    where email = 'you@example.com';
--
-- (The protect-role trigger only fires when auth.uid() is set, so it
--  does not block this when run from the SQL editor.)
-- ============================================================
