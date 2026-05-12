
-- Agent settings (per-user)
CREATE TABLE public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  market text NOT NULL DEFAULT 'spot' CHECK (market IN ('spot','perps','both')),
  min_confidence numeric NOT NULL DEFAULT 80,
  max_position_pct numeric NOT NULL DEFAULT 0.10,
  daily_trade_limit integer NOT NULL DEFAULT 10,
  volatility_circuit_breaker numeric NOT NULL DEFAULT 3.0,
  leverage numeric NOT NULL DEFAULT 1,
  account_balance_usd numeric NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read settings" ON public.agent_settings FOR SELECT USING (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner insert settings" ON public.agent_settings FOR INSERT WITH CHECK (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner update settings" ON public.agent_settings FOR UPDATE USING (owner_key = current_owner_key());
CREATE POLICY "owner delete settings" ON public.agent_settings FOR DELETE USING (owner_key = current_owner_key());

-- Signals
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  asset text NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY','SELL')),
  market text NOT NULL CHECK (market IN ('spot','perps')),
  confidence numeric NOT NULL,
  conviction text NOT NULL,
  reasoning text NOT NULL,
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric,
  stop_loss numeric,
  target numeric,
  source jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','executed','rejected','expired','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read signals" ON public.signals FOR SELECT USING (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner insert signals" ON public.signals FOR INSERT WITH CHECK (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner update signals" ON public.signals FOR UPDATE USING (owner_key = current_owner_key());
CREATE POLICY "owner delete signals" ON public.signals FOR DELETE USING (owner_key = current_owner_key());
CREATE INDEX signals_owner_created_idx ON public.signals(owner_key, created_at DESC);

-- Positions
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  asset text NOT NULL,
  market text NOT NULL,
  side text NOT NULL,
  size numeric NOT NULL,
  entry_price numeric NOT NULL,
  stop_loss numeric,
  target numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  pnl_usd numeric NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read positions" ON public.positions FOR SELECT USING (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner insert positions" ON public.positions FOR INSERT WITH CHECK (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner update positions" ON public.positions FOR UPDATE USING (owner_key = current_owner_key());
CREATE POLICY "owner delete positions" ON public.positions FOR DELETE USING (owner_key = current_owner_key());

-- Trades
CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  signal_id uuid,
  asset text NOT NULL,
  market text NOT NULL,
  side text NOT NULL,
  size numeric NOT NULL,
  price numeric,
  status text NOT NULL CHECK (status IN ('submitted','filled','rejected','failed','blocked')),
  sodex_order_id text,
  sodex_response jsonb,
  payload_hash text,
  nonce bigint,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read trades" ON public.trades FOR SELECT USING (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner insert trades" ON public.trades FOR INSERT WITH CHECK (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner update trades" ON public.trades FOR UPDATE USING (owner_key = current_owner_key());
CREATE POLICY "owner delete trades" ON public.trades FOR DELETE USING (owner_key = current_owner_key());
CREATE INDEX trades_owner_created_idx ON public.trades(owner_key, created_at DESC);

-- Risk events (audit log)
CREATE TABLE public.risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  event_type text NOT NULL,
  asset text,
  reason text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read risk" ON public.risk_events FOR SELECT USING (owner_key = current_owner_key() AND length(owner_key) > 0);
CREATE POLICY "owner insert risk" ON public.risk_events FOR INSERT WITH CHECK (owner_key = current_owner_key() AND length(owner_key) > 0);

-- updated_at trigger for agent_settings
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER agent_settings_set_updated_at BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
