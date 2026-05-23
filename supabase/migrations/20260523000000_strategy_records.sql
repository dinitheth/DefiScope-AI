CREATE TABLE IF NOT EXISTS public.strategy_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  strategy_hash text NOT NULL,
  tx_hash text,
  base_sepolia_block bigint,
  regime text,
  allocation jsonb,
  memo text,
  reasoning jsonb,
  confidence integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.strategy_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_own" ON public.strategy_records
  FOR SELECT USING (owner_key = (current_setting('request.headers', true)::jsonb->>'x-owner-key'));

CREATE POLICY "owner_insert_own" ON public.strategy_records
  FOR INSERT WITH CHECK (owner_key = (current_setting('request.headers', true)::jsonb->>'x-owner-key'));
