drop policy if exists "anyone can read conversations" on public.conversations;
drop policy if exists "anyone can read messages" on public.chat_messages;
drop policy if exists "delete conversations with owner" on public.conversations;
drop policy if exists "insert conversations with owner" on public.conversations;
drop policy if exists "update conversations with owner" on public.conversations;
drop policy if exists "delete messages with owner" on public.chat_messages;
drop policy if exists "insert messages with owner" on public.chat_messages;
drop policy if exists "update messages with owner" on public.chat_messages;

create or replace function public.current_owner_key()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-owner-key', ''),
    ''
  )
$$;

create policy "owner can read conversations"
  on public.conversations for select
  using (owner_key = public.current_owner_key() and length(owner_key) > 0);

create policy "owner can insert conversations"
  on public.conversations for insert
  with check (owner_key = public.current_owner_key() and length(owner_key) > 0);

create policy "owner can update conversations"
  on public.conversations for update
  using (owner_key = public.current_owner_key());

create policy "owner can delete conversations"
  on public.conversations for delete
  using (owner_key = public.current_owner_key());

create policy "owner can read messages"
  on public.chat_messages for select
  using (owner_key = public.current_owner_key() and length(owner_key) > 0);

create policy "owner can insert messages"
  on public.chat_messages for insert
  with check (owner_key = public.current_owner_key() and length(owner_key) > 0);

create policy "owner can update messages"
  on public.chat_messages for update
  using (owner_key = public.current_owner_key());

create policy "owner can delete messages"
  on public.chat_messages for delete
  using (owner_key = public.current_owner_key());