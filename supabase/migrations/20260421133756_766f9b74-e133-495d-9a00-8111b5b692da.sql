
-- Chat history for the AI-first interface.
-- Conversations are scoped by an opaque owner_key (wallet address or device id) since
-- the app uses MetaMask/client-side auth only. Public RLS is intentional;
-- the client filters by owner_key.

CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_owner ON public.conversations(owner_key, updated_at DESC);

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  owner_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  steps JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public RLS - the app does its own scoping via owner_key on the client
CREATE POLICY "anyone can read conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "anyone can insert conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update conversations" ON public.conversations FOR UPDATE USING (true);
CREATE POLICY "anyone can delete conversations" ON public.conversations FOR DELETE USING (true);

CREATE POLICY "anyone can read messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "anyone can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update messages" ON public.chat_messages FOR UPDATE USING (true);
CREATE POLICY "anyone can delete messages" ON public.chat_messages FOR DELETE USING (true);

-- Touch updated_at on conversation when a message is added
CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();
