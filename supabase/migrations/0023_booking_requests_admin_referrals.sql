-- 1) Phase 3's student reschedule/cancel requests never worked: the student
-- update policy only allows updates while status = 'pending', so filing a
-- request on a paid/scheduled booking was rejected (and the UI swallowed the
-- error). A definer RPC lets the owner file/withdraw requests on their own
-- booking while touching ONLY the request columns.
create or replace function public.file_booking_request(
  p_booking uuid,
  p_kind text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind is null then
    update public.bookings
       set student_request = null,
           student_request_note = null,
           student_requested_at = null
     where id = p_booking
       and student_id = auth.uid();
    return;
  end if;

  if p_kind not in ('cancel', 'reschedule') then
    raise exception 'invalid request kind';
  end if;

  update public.bookings
     set student_request = p_kind,
         student_request_note = nullif(trim(p_note), ''),
         student_requested_at = now()
   where id = p_booking
     and student_id = auth.uid()
     and status in ('paid', 'scheduled');

  if not found then
    raise exception 'cannot file a request on this booking';
  end if;
end;
$$;

revoke execute on function public.file_booking_request(uuid, text, text) from public, anon;
grant execute on function public.file_booking_request(uuid, text, text) to authenticated;

-- 2) Admin funnel analytics counts referrals, but the only select policy is
-- "involved only" — admins saw a hard-coded zero.
drop policy if exists "referrals: admin read" on public.referrals;
create policy "referrals: admin read" on public.referrals
  for select to authenticated
  using (public.is_admin());
