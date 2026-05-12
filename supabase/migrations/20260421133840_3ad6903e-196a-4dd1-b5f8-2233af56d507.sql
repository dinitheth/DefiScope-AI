
-- Replace permissive write policies with owner_key length check.
DROP POLICY IF EXISTS "anyone can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "anyone can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "anyone can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "anyone can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "anyone can update messages" ON public.chat_messages;
DROP POLICY IF EXISTS "anyone can delete messages" ON public.chat_messages;

CREATE POLICY "insert conversations with owner" ON public.conversations
  FOR INSERT WITH CHECK (length(owner_key) > 0);
CREATE POLICY "update conversations with owner" ON public.conversations
  FOR UPDATE USING (length(owner_key) > 0);
CREATE POLICY "delete conversations with owner" ON public.conversations
  FOR DELETE USING (length(owner_key) > 0);

CREATE POLICY "insert messages with owner" ON public.chat_messages
  FOR INSERT WITH CHECK (length(owner_key) > 0);
CREATE POLICY "update messages with owner" ON public.chat_messages
  FOR UPDATE USING (length(owner_key) > 0);
CREATE POLICY "delete messages with owner" ON public.chat_messages
  FOR DELETE USING (length(owner_key) > 0);
