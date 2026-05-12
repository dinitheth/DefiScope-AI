import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, TrendingUp, TrendingDown, ShieldCheck, AlertTriangle,
  Loader2, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  Activity, Clock, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentSignal {
  id?: string;
  asset: "BTC" | "ETH" | string;
  side: "BUY" | "SELL";
  market: "spot" | "perps";
  confidence: number;
  conviction: "low" | "medium" | "high";
  reasoning: string;
  drivers: string[];
  price?: number | null;
  stop_loss?: number | null;
  target?: number | null;
  status?: string;
}

export interface AgentRecommendationData {
  signals: AgentSignal[];
  generatedAt?: string;
}

interface TradeResult {
  clOrdID?: string;
  symbol?: string;
  ok: boolean;
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPrice = (v: number | null | undefined) => {
  if (!v) return "—";
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${v.toFixed(2)}`;
};

const confColor = (c: number) =>
  c >= 80 ? "#10B981" : c >= 60 ? "#F59E0B" : "#6B7280";

const confLabel = (c: number) =>
  c >= 80 ? "High Confidence" : c >= 60 ? "Moderate" : "Low";

// ─── Trade confirmation banner ────────────────────────────────────────────────

function TradeConfirmBanner({ result, side }: { result: TradeResult; side: string }) {
  const color = result.ok ? "#10B981" : "#EF4444";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-2 p-3 rounded-xl text-xs"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}30`,
        color: result.ok ? "#10B981" : "#EF4444",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {result.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="font-medium">
            {result.ok
              ? `${side} order submitted to SoDEX Testnet`
              : "Order failed"}
          </span>
        </div>
        {result.ok && result.clOrdID && (
          <a
            href={`https://testnet.sodex.com/trade?orderId=${result.clOrdID}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 opacity-70 hover:opacity-100 transition-opacity shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            <span>View</span>
          </a>
        )}
      </div>
      {result.clOrdID && (
        <p className="mt-1 font-mono opacity-60 text-[10px]">
          ID: {result.clOrdID}{result.symbol ? ` · ${result.symbol}` : ""}
        </p>
      )}
      {!result.ok && result.message && (
        <p className="mt-1 opacity-70 text-[10px] leading-relaxed">{result.message}</p>
      )}
    </motion.div>
  );
}

// ─── Single Signal Card ───────────────────────────────────────────────────────

function SignalCard({
  signal,
  onTrade,
  onClose,
}: {
  signal: AgentSignal;
  onTrade: (sig: AgentSignal) => Promise<TradeResult>;
  onClose: (sig: AgentSignal) => Promise<TradeResult>;
}) {
  const [tradeState, setTradeState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [closeState, setCloseState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [closeResult, setCloseResult] = useState<TradeResult | null>(null);

  const isBuy  = signal.side === "BUY";
  const color  = isBuy ? "#10B981" : "#EF4444";
  const Icon   = isBuy ? TrendingUp : TrendingDown;
  const cc     = confColor(signal.confidence);

  async function handleExecute() {
    if (tradeState !== "idle") return;
    setTradeState("loading");
    setTradeResult(null);
    try {
      const result = await onTrade(signal);
      setTradeResult(result);
      setTradeState(result.ok ? "done" : "error");
    } catch (e: any) {
      setTradeResult({ ok: false, message: e?.message || "Unknown error" });
      setTradeState("error");
    }
  }

  async function handleClose() {
    if (closeState !== "idle") return;
    setCloseState("loading");
    setCloseResult(null);
    try {
      const result = await onClose(signal);
      setCloseResult(result);
      setCloseState(result.ok ? "done" : "error");
    } catch (e: any) {
      setCloseResult({ ok: false, message: e?.message || "Unknown error" });
      setCloseState("error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl p-4 border relative overflow-hidden"
      style={{
        background: "#0F0F0F",
        borderColor: `${color}30`,
        boxShadow: `0 0 24px -8px ${color}35`,
      }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${color}12` }}
      />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-base text-white">{signal.asset}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                >
                  {signal.side}
                </span>
                <span className="text-[10px] text-[#6B7280] uppercase">{signal.market}</span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {signal.conviction} conviction · {confLabel(signal.confidence)}
              </p>
            </div>
          </div>
          {/* Confidence */}
          <div className="text-right shrink-0">
            <p className="text-xl font-bold tabular-nums" style={{ color: cc }}>
              {signal.confidence}%
            </p>
            <p className="text-[10px] text-[#6B7280]">confidence</p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${signal.confidence}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: cc }}
          />
        </div>

        {/* Reasoning */}
        <p className="text-xs text-[#8B92A5] leading-relaxed">{signal.reasoning}</p>

        {/* Drivers */}
        {signal.drivers?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {signal.drivers.slice(0, 4).map((d, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "#1C1C1C", color: "#8B92A5", border: "1px solid #232323" }}
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Price targets */}
        {(signal.price || signal.stop_loss || signal.target) && (
          <div className="grid grid-cols-3 gap-2">
            <PriceCell label="Entry" value={fmtPrice(signal.price)} />
            <PriceCell
              label="Stop Loss"
              value={fmtPrice(signal.stop_loss)}
              icon={<ArrowDownRight className="h-3 w-3" style={{ color: "#EF4444" }} />}
            />
            <PriceCell
              label="Target"
              value={fmtPrice(signal.target)}
              icon={<ArrowUpRight className="h-3 w-3" style={{ color: "#10B981" }} />}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {/* Open Trade */}
          <button
            onClick={handleExecute}
            disabled={tradeState !== "idle"}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 active:scale-95"
            style={{
              background: tradeState === "done"
                ? "#10B98120" : tradeState === "error"
                ? "#EF444420" : `${color}20`,
              border: `1px solid ${tradeState === "done"
                ? "#10B98140" : tradeState === "error"
                ? "#EF444440" : `${color}40`}`,
              color: tradeState === "done"
                ? "#10B981" : tradeState === "error"
                ? "#EF4444" : color,
            }}
          >
            {tradeState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : tradeState === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : tradeState === "error" ? (
              <XCircle className="h-3.5 w-3.5" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {tradeState === "loading"
              ? "Submitting…"
              : tradeState === "done"
              ? "Submitted!"
              : tradeState === "error"
              ? "Failed — Retry"
              : `Open ${signal.side} Trade`}
          </button>

          {/* Close / Cancel */}
          <button
            onClick={handleClose}
            disabled={closeState === "loading"}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 active:scale-95"
            style={{
              background: closeState === "done" ? "#10B98120" : "#1C1C1C",
              border: "1px solid #2C2C2C",
              color: closeState === "done" ? "#10B981" : "#6B7280",
            }}
          >
            {closeState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : closeState === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {closeState === "loading" ? "Closing…" : closeState === "done" ? "Closed" : "Close"}
          </button>
        </div>

        {/* Trade result banners */}
        <AnimatePresence>
          {tradeResult && (
            <TradeConfirmBanner key="trade-result" result={tradeResult} side={signal.side} />
          )}
          {closeResult && (
            <TradeConfirmBanner key="close-result" result={closeResult} side="CLOSE" />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PriceCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-2 rounded-lg" style={{ background: "#141414", border: "1px solid #1C1C1C" }}>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <p className="text-[9px] uppercase tracking-wider text-[#6B7280]">{label}</p>
      </div>
      <p className="text-xs font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function AgentRecommendationView({
  data,
  ownerKey,
}: {
  data: AgentRecommendationData;
  ownerKey?: string;
}) {
  const signals = data.signals || [];

  /**
   * Calls trading-agent directly (not through agent-chat AI loop) for
   * immediate SoDEX order submission with real order ID feedback.
   */
  async function callTradingAgent(
    action: string,
    body: Record<string, unknown>,
  ): Promise<TradeResult> {
    const res = await supabase.functions.invoke("trading-agent", {
      body: { action, ...body },
      headers: ownerKey ? { "x-owner-key": ownerKey } : {},
    });

    if (res.error) throw res.error;
    const d = res.data as any;
    if (d?.error) throw new Error(d.error);
    return {
      ok:      Boolean(d?.ok),
      clOrdID: d?.clOrdID || d?.sodex?.clOrdID,
      symbol:  d?.symbol  || d?.sodex?.symbol,
      message: d?.message || (d?.ok ? undefined : d?.sodex?.error || "Order rejected by SoDEX"),
    };
  }

  async function handleTrade(sig: AgentSignal): Promise<TradeResult> {
    if (!ownerKey) {
      toast({ title: "Wallet not connected", description: "Connect your EVM wallet to trade.", variant: "destructive" });
      throw new Error("no owner key");
    }

    const result = await callTradingAgent("quick_trade", {
      asset:  sig.asset,
      side:   sig.side,
      market: sig.market,
    });

    if (result.ok) {
      toast({
        title: `${sig.side} ${sig.asset} submitted`,
        description: `Order ${result.clOrdID || ""} sent to SoDEX Testnet${result.symbol ? ` (${result.symbol})` : ""}.`,
      });
    } else {
      toast({
        title: "Trade failed",
        description: result.message || "SoDEX rejected the order.",
        variant: "destructive",
      });
    }
    return result;
  }

  async function handleClose(sig: AgentSignal): Promise<TradeResult> {
    if (!ownerKey) {
      toast({ title: "Wallet not connected", description: "Connect your EVM wallet to close positions.", variant: "destructive" });
      throw new Error("no owner key");
    }

    const result = await callTradingAgent("close_position", {
      asset:  sig.asset,
      market: sig.market,
    });

    if (result.ok) {
      toast({
        title: `${sig.asset} position close submitted`,
        description: `Close order ${result.clOrdID || ""} sent to SoDEX Testnet.`,
      });
    } else {
      toast({
        title: "Close failed",
        description: result.message || "SoDEX rejected the close order.",
        variant: "destructive",
      });
    }
    return result;
  }

  if (signals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 text-center"
        style={{ background: "#0F0F0F", border: "1px solid #1C1C1C" }}
      >
        <Activity className="h-8 w-8 mx-auto text-[#3B82F6] mb-2 opacity-50" />
        <p className="text-sm font-medium text-white">No signals generated</p>
        <p className="text-xs text-[#6B7280] mt-1">
          Market data is mixed. Ask the agent to "generate fresh signals" when conditions are clearer.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: "#3B82F615", border: "1px solid #3B82F630" }}
          >
            <Zap className="h-3.5 w-3.5 text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Agent Recommendations</p>
            <p className="text-[10px] text-[#6B7280]">
              {signals.length} signal{signals.length > 1 ? "s" : ""} · SoDEX Testnet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
          <span className="text-[10px] text-[#10B981] font-medium">Risk checked</span>
        </div>
      </div>

      {/* Signal cards — staggered */}
      <AnimatePresence>
        {signals.map((sig, i) => (
          <motion.div
            key={sig.id || i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <SignalCard signal={sig} onTrade={handleTrade} onClose={handleClose} />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl text-[10px]"
        style={{ background: "#141414", border: "1px solid #1C1C1C", color: "#6B7280" }}
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-[#F59E0B]" />
          <span>Testnet only — not financial advice</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "just now"}</span>
        </div>
      </div>
    </motion.div>
  );
}
