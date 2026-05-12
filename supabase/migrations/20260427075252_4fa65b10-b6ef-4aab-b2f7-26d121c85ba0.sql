create or replace function public.current_owner_key()
returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-owner-key', ''),
    ''
  )
$$;

revoke all on function public.current_owner_key() from public;
grant execute on function public.current_owner_key() to anon, authenticated;