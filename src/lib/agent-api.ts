import { supabase } from "@/integrations/supabase/client";

export interface AgentSettings {
  id?: string;
  owner_key?: string;
  enabled: boolean;
  market: "spot" | "perps" | "both";
  min_confidence: number;
  max_position_pct: number;
  daily_trade_limit: number;
  volatility_circuit_breaker: number;
  leverage: number;
  account_balance_usd: number;
}

export interface Signal {
  id: string;
  asset: string;
  side: "BUY" | "SELL";
  market: "spot" | "perps";
  confidence: number;
  conviction: "low" | "medium" | "high";
  reasoning: string;
  drivers: string[];
  price: number | null;
  stop_loss: number | null;
  target: number | null;
  status: string;
  created_at: string;
}

export interface Trade {
  id: string;
  signal_id: string | null;
  asset: string;
  market: string;
  side: string;
  size: number;
  price: number | null;
  status: string;
  sodex_order_id: string | null;
  payload_hash: string | null;
  nonce: number | null;
  error: string | null;
  created_at: string;
}

export interface Position {
  id: string;
  asset: string;
  market: string;
  side: string;
  size: number;
  entry_price: number;
  stop_loss: number | null;
  target: number | null;
  status: string;
  pnl_usd: number;
  opened_at: string;
}

export async function getAgentSettings(): Promise<AgentSettings | null> {
  const { data, error } = await (supabase as any).from("agent_settings").select("*").maybeSingle();
  if (error) { console.error(error); return null; }
  return data as AgentSettings | null;
}

export async function upsertAgentSettings(patch: Partial<AgentSettings>): Promise<AgentSettings | null> {
  // owner_key is filled by RLS-aware insert; we re-read via current_owner_key()
  const existing = await getAgentSettings();
  if (existing) {
    const { data, error } = await (supabase as any)
      .from("agent_settings").update(patch).eq("id", existing.id).select().single();
    if (error) { console.error(error); return null; }
    return data as AgentSettings;
  }
  // first insert needs owner_key from header (RLS injects via With Check on insert)
  const ownerKey = ((supabase as any).rest?.headers?.["x-owner-key"]) || "";
  const { data, error } = await (supabase as any)
    .from("agent_settings").insert({ owner_key: ownerKey, ...patch }).select().single();
  if (error) { console.error(error); return null; }
  return data as AgentSettings;
}

export async function listSignals(limit = 25): Promise<Signal[]> {
  const { data } = await (supabase as any).from("signals").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data as Signal[]) || [];
}
export async function listTrades(limit = 25): Promise<Trade[]> {
  const { data } = await (supabase as any).from("trades").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data as Trade[]) || [];
}
export async function listPositions(): Promise<Position[]> {
  const { data } = await (supabase as any).from("positions").select("*").eq("status", "open").order("opened_at", { ascending: false });
  return (data as Position[]) || [];
}

export async function generateSignals() {
  const { data, error } = await supabase.functions.invoke("trading-agent", { body: { action: "generate" } });
  if (error) throw error;
  return data;
}

export async function executeSignal(signalId: string) {
  const { data, error } = await supabase.functions.invoke("trading-agent", { body: { action: "execute", signal_id: signalId } });
  if (error) throw error;
  return data;
}

export async function runAgentCycle() {
  const { data, error } = await supabase.functions.invoke("trading-agent", { body: { action: "run_cycle" } });
  if (error) throw error;
  return data;
}
