-- Functions get EXECUTE to PUBLIC by default — lock the community RPCs
-- down to signed-in users only.
revoke execute on function public.community_members() from public;
revoke execute on function public.community_feed() from public;
grant execute on function public.community_members() to authenticated;
grant execute on function public.community_feed() to authenticated;
