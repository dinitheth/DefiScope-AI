-- Add sodex_order_id to positions table so close_position can look up the
-- original SoDEX clOrdID for cancel requests.
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS sodex_order_id text;

-- Index for fast lookup by order ID
CREATE INDEX IF NOT EXISTS positions_sodex_order_id_idx
  ON public.positions(sodex_order_id)
  WHERE sodex_order_id IS NOT NULL;

-- Ensure trades table has all needed columns (idempotent guards)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS sodex_order_id text,
  ADD COLUMN IF NOT EXISTS sodex_response jsonb,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS nonce bigint;
