import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, CheckCircle2, XCircle, ExternalLink,
  Copy, Loader2, RefreshCw, Zap, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SodexTradeResult {
  ok: boolean;
  clOrdID?: string;
  symbol?: string;
  asset?: string;
  side?: string;
  size?: string;
  market?: string;
  message?: string;
  price?: number;
  nonce?: number;
  payloadHash?: string;
  sodex?: {
    code?: number;
    error?: string;
    data?: unknown;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() =>
    toast({ title: "Copied", description: text.slice(0, 60) })
  );
}

function shortenHash(h?: string) {
  if (!h) return "";
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function PulsingDot({ color = "#10B981" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: color, animationDuration: "1.5s" }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ background: color }}
      />
    </span>
  );
}

// ─── Close Position Button ────────────────────────────────────────────────────

function CloseButton({
  result,
  ownerKey,
}: {
  result: SodexTradeResult;
  ownerKey?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [closeId, setCloseId] = useState<string | undefined>();

  async function handleClose() {
    if (state !== "idle") return;
    if (!ownerKey) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    setState("loading");
    try {
      const res = await supabase.functions.invoke("trading-agent", {
        body: { action: "close_position", asset: result.asset || "BTC", market: result.market || "spot" },
        headers: { "x-owner-key": ownerKey },
      });
      const d = res.data as any;
      if (d?.ok) {
        setState("done");
        setCloseId(d?.clOrdID);
        toast({ title: "Position close submitted", description: `Close order: ${d?.clOrdID || "sent"}` });
      } else {
        setState("error");
        toast({ title: "Close failed", description: d?.message || "SoDEX rejected", variant: "destructive" });
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleClose}
        disabled={state === "loading" || state === "done"}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 active:scale-95"
        style={{
          background: state === "done" ? "#10B98120" : state === "error" ? "#EF444420" : "#1C1C1C",
          border: `1px solid ${state === "done" ? "#10B98140" : state === "error" ? "#EF444440" : "#2C2C2C"}`,
          color: state === "done" ? "#10B981" : state === "error" ? "#EF4444" : "#6B7280",
        }}
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        {state === "loading" ? "Closing…" : state === "done" ? "Close Submitted" : "Close Position"}
      </button>
      {state === "done" && closeId && (
        <p className="text-[10px] text-center font-mono text-[#6B7280]">
          Close ID: {closeId}
        </p>
      )}
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function SodexTradeWidget({
  result,
  ownerKey,
}: {
  result: SodexTradeResult;
  ownerKey?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const isBuy = result.side?.toUpperCase() === "BUY";
  const color = result.ok
    ? isBuy ? "#10B981" : "#EF4444"
    : "#EF4444";
  const Icon = isBuy ? TrendingUp : TrendingDown;
  const label = isBuy ? "BUY" : "SELL";

  // SoDEX testnet explorer link (best-effort)
  const explorerUrl = result.clOrdID
    ? `https://testnet.sodex.com`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#0D0D0D",
        border: `1px solid ${color}30`,
        boxShadow: result.ok ? `0 0 30px -10px ${color}40` : undefined,
      }}
    >
      {/* Header bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: `${color}10`, borderBottom: `1px solid ${color}20` }}
      >
        <div className="flex items-center gap-2">
          {result.ok ? (
            <PulsingDot color={color} />
          ) : (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "#EF4444" }} />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>
            SoDEX Testnet · {result.ok ? "Order Submitted" : "Order Failed"}
          </span>
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity"
            style={{ color }}
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">

        {/* Trade summary row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              {result.ok ? (
                <Icon className="h-5 w-5" style={{ color }} />
              ) : (
                <XCircle className="h-5 w-5" style={{ color: "#EF4444" }} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-white">{result.asset || "BTC"}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                >
                  {label}
                </span>
                <span className="text-[10px] text-[#6B7280] uppercase">{result.market}</span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {result.symbol || (result.market === "spot" ? `v${result.asset}_vUSDC` : `${result.asset}-USD`)}
              </p>
            </div>
          </div>

          {/* Size / Status */}
          <div className="text-right">
            {result.size ? (
              <>
                <p className="text-base font-bold text-white tabular-nums">{result.size}</p>
                <p className="text-[10px] text-[#6B7280]">
                  {result.price ? `≈ $${(parseFloat(result.size) * result.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "units"}
                </p>
              </>
            ) : (
              <p className="text-xs text-[#6B7280]">Market order</p>
            )}
          </div>
        </div>

        {/* Order ID */}
        {result.ok && result.clOrdID && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "#141414", border: "1px solid #1C1C1C" }}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span className="text-[10px] text-[#6B7280]">Order ID</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-white">{shortenHash(result.clOrdID)}</span>
              <button
                onClick={() => copyToClipboard(result.clOrdID!)}
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <Copy className="h-3 w-3 text-[#6B7280]" />
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {!result.ok && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "#EF444412", border: "1px solid #EF444430", color: "#EF4444" }}
          >
            <div className="flex items-start gap-1.5">
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="leading-relaxed">
                {result.message || result.sodex?.error || "SoDEX rejected the order. Check account balance and API key."}
              </span>
            </div>
          </div>
        )}

        {/* Toggle technical details */}
        <button
          onClick={() => setShowDetails((s) => !s)}
          className="flex items-center gap-1 text-[10px] transition-opacity opacity-40 hover:opacity-70"
          style={{ color: "#8B92A5" }}
        >
          <RefreshCw className="h-2.5 w-2.5" />
          {showDetails ? "Hide" : "Show"} technical details
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3 rounded-xl font-mono text-[10px] space-y-1"
                style={{ background: "#141414", border: "1px solid #1C1C1C", color: "#6B7280" }}
              >
                {result.clOrdID    && <p>clOrdID: <span className="text-white">{result.clOrdID}</span></p>}
                {result.symbol     && <p>symbol: <span className="text-white">{result.symbol}</span></p>}
                {result.nonce      && <p>nonce: <span className="text-white">{result.nonce}</span></p>}
                {result.payloadHash && <p>payloadHash: <span className="text-white">{shortenHash(result.payloadHash)}</span></p>}
                {result.sodex?.code !== undefined && (
                  <p>SoDEX code: <span className={result.sodex.code === 0 ? "text-[#10B981]" : "text-[#EF4444]"}>{result.sodex.code}</span></p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close position button (only when trade succeeded) */}
        {result.ok && (
          <CloseButton result={result} ownerKey={ownerKey} />
        )}

        {/* Testnet badge */}
        <div className="flex items-center justify-center gap-1.5">
          <Zap className="h-3 w-3 text-[#F59E0B]" />
          <span className="text-[10px] text-[#6B7280]">
            SoDEX Testnet · chainId 138565 · Not real funds
          </span>
        </div>
      </div>
    </motion.div>
  );
}
