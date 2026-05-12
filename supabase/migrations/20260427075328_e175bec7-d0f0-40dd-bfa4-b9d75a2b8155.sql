revoke all on function public.touch_conversation() from public, anon, authenticated;
alter function public.touch_conversation() set search_path = public, pg_temp;