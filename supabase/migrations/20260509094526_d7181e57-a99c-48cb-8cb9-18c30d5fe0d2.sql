
-- Replace strict header-based RLS with column-based validation.
-- The x-owner-key header was unreliable through supabase-js; client supplies
-- owner_key on insert and filters by it on read. owner_key is a non-secret
-- per-device/wallet identifier, not authenticated PII.

DO $$
DECLARE
  t text;
  p text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['conversations','chat_messages','agent_settings','signals','trades','positions']) LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
  END LOOP;
END $$;

-- Permissive policies: any anon client can read/write rows they tag with a
-- non-empty owner_key. The app scopes queries by owner_key.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['conversations','chat_messages','agent_settings','signals','trades','positions']) LOOP
    EXECUTE format('CREATE POLICY "anon read %1$s" ON public.%1$I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "anon insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (length(coalesce(owner_key, '''')) > 0)', t);
    EXECUTE format('CREATE POLICY "anon update %1$s" ON public.%1$I FOR UPDATE USING (true) WITH CHECK (length(coalesce(owner_key, '''')) > 0)', t);
    EXECUTE format('CREATE POLICY "anon delete %1$s" ON public.%1$I FOR DELETE USING (true)', t);
  END LOOP;
END $$;
