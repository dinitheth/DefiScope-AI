import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Zap, ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";
import PublishConfirmModal from "@/components/PublishConfirmModal";
import SodexTradeWidget, { type SodexTradeResult } from "@/components/ai-views/SodexTradeWidget";
import type { StrategyData } from "@/hooks/use-strategy-publisher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FlowPulseStrategyCardProps {
  regime: string;
  allocation: Record<string, number>;
  memo: string;
  reasoning: string[];
  confidence: number;
  ownerKey?: string;
  decisionAction?: "BUY" | "HOLD" | "SELL";
}

// Color tokens matching the app's design system
const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
  surfaceHover: "#1C1C1C",
  border: "#1C1C1C",
  textPrimary: "#FFFFFF",
  textSecondary: "#8B92A5",
  textMuted: "#6B7280",
  accent: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

const ASSET_COLORS: Record<string, string> = {
  BTC: "#F59E0B",
  ETH: "#8B5CF6",
  SOL: "#10B981",
  USDC: "#3B82F6",
  DEFAULT: "#8B92A5",
};

function getRegimeConfig(regime: string) {
  const r = (regime || "").toLowerCase().replace(/_/g, " ");
  if (r.includes("risk-on") || r.includes("bull") || r.includes("bullish") ||
      r.includes("accumulation") || r.includes("trending up")) {
    return { label: "Risk-On", color: C.success, bg: `${C.success}20`, icon: TrendingUp, sodexSide: "BUY" as const };
  }
  if (r.includes("risk-off") || r.includes("bear") || r.includes("bearish") ||
      r.includes("distribution") || r.includes("trending down") || r.includes("volatile")) {
    return { label: "Risk-Off", color: C.danger, bg: `${C.danger}20`, icon: TrendingDown, sodexSide: "SELL" as const };
  }
  return { label: "Mixed", color: C.warning, bg: `${C.warning}20`, icon: Activity, sodexSide: null };
}

function AllocationBar({ asset, pct }: { asset: string; pct: number }) {
  const color = ASSET_COLORS[asset] ?? ASSET_COLORS.DEFAULT;
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[12px] font-semibold w-12 shrink-0"
        style={{ color: C.textSecondary }}
      >
        {asset}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: `${color}20` }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[12px] font-medium w-9 text-right shrink-0" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// Scoring breakdown methodology for transparency
const SCORE_WEIGHTS = [
  { label: "Price Momentum", weight: 30, color: "#F59E0B" },
  { label: "ETF Flow Signal", weight: 25, color: "#8B5CF6" },
  { label: "News Sentiment", weight: 25, color: "#10B981" },
  { label: "Volume Strength", weight: 20, color: "#3B82F6" },
];

export default function FlowPulseStrategyCard({
  regime,
  allocation,
  memo,
  reasoning,
  confidence,
  ownerKey,
  decisionAction,
}: FlowPulseStrategyCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [showScoreMethod, setShowScoreMethod] = useState(false);
  const [sodexLoading, setSodexLoading] = useState(false);
  const [sodexResult, setSodexResult] = useState<SodexTradeResult | null>(null);

  const regimeConfig = getRegimeConfig(regime);
  const RegimeIcon = regimeConfig.icon;

  // Derive SoDEX action: prefer explicit decisionAction, fall back to regime
  const sodexSide = decisionAction === "BUY" ? "BUY"
    : decisionAction === "SELL" ? "SELL"
    : regimeConfig.sodexSide;

  const strategy: StrategyData = { memo, allocation, reasoning, regime, confidence };

  async function executeOnSodex() {
    if (!ownerKey) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to execute trades", variant: "destructive" });
      return;
    }
    if (!sodexSide) {
      toast({ title: "Neutral regime", description: "No directional trade recommended in mixed market" });
      return;
    }
    setSodexLoading(true);
    setSodexResult(null);
    try {
      const res = await supabase.functions.invoke("sodex-executor", {
        body: {
          action: "newOrder",
          asset: "BTC",
          market: "spot",
          side: sodexSide,
          size: "0.001",
        },
        headers: { "x-owner-key": ownerKey ?? "" },
      });
      const d = res.data as SodexTradeResult;
      setSodexResult(d);
      if (d?.ok) {
        toast({ title: "SoDEX order submitted", description: `${sodexSide} BTC · Order: ${d.clOrdID?.slice(0, 16)}…` });
      } else {
        toast({ title: "SoDEX order failed", description: d?.message || "Check SODEX_API_PRIVATE_KEY secret", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "SoDEX error", description: err.message || "Network error", variant: "destructive" });
    } finally {
      setSodexLoading(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: C.border }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-[10px] flex items-center justify-center"
              style={{ background: `${C.accent}20` }}
            >
              <Zap size={16} style={{ color: C.accent }} />
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: C.textPrimary }}>
                FlowPulse Strategy
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>
                AI-Generated Allocation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Regime badge */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: regimeConfig.bg, color: regimeConfig.color }}
            >
              <RegimeIcon size={11} />
              {regimeConfig.label}
            </span>
            {/* Confidence badge */}
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: confidence >= 70 ? `${C.success}20` : `${C.warning}20`,
                color: confidence >= 70 ? C.success : C.warning,
              }}
            >
              {confidence}% conf
            </span>
          </div>
        </div>

        {/* Allocation bars */}
        <div className="px-5 py-4 space-y-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textMuted }}>
              Allocation
            </p>
            <button
              onClick={() => setShowScoreMethod(s => !s)}
              className="flex items-center gap-1 text-[10px] transition-opacity opacity-50 hover:opacity-100"
              style={{ color: C.accent }}
            >
              Score Methodology
              {showScoreMethod ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
          {Object.entries(allocation)
            .sort(([, a], [, b]) => b - a)
            .map(([asset, pct]) => (
              <AllocationBar key={asset} asset={asset} pct={pct} />
            ))}

          {/* Score breakdown methodology */}
          <AnimatePresence>
            {showScoreMethod && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-3 p-3 rounded-xl space-y-2"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
                    Composite Score = Weighted Signal Average
                  </p>
                  {SCORE_WEIGHTS.map(({ label, weight, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[11px] flex-1" style={{ color: C.textSecondary }}>{label}</span>
                      <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
                        <div className="h-full rounded-full" style={{ width: `${weight * 3.33}%`, background: color }} />
                      </div>
                      <span className="text-[11px] font-mono w-8 text-right" style={{ color }}>{weight}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Memo */}
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
            Strategy Memo
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: C.textSecondary }}>
            {memo}
          </p>
        </div>

        {/* Reasoning — collapsible */}
        {reasoning && reasoning.length > 0 && (
          <div className="px-5 pt-3 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setShowReasoning(s => !s)}
              className="flex items-center gap-1.5 w-full text-left mb-2"
            >
              <p className="text-[11px] uppercase tracking-wider flex-1" style={{ color: C.textMuted }}>
                AI Reasoning ({reasoning.length} signals)
              </p>
              {showReasoning ? <ChevronUp size={12} style={{ color: C.textMuted }} /> : <ChevronDown size={12} style={{ color: C.textMuted }} />}
            </button>
            <AnimatePresence>
              {showReasoning && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  {reasoning.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: C.textSecondary }}>
                      <span
                        className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: C.accent }}
                      />
                      {point}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Action row: SoDEX Execute + Publish */}
        <div className="px-5 py-4 space-y-3">
          {/* SoDEX Execute button */}
          {sodexSide && !sodexResult && (
            <button
              onClick={executeOnSodex}
              disabled={sodexLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all disabled:opacity-60 active:scale-[0.99]"
              style={{
                background: sodexSide === "BUY" ? `${C.success}20` : `${C.danger}20`,
                border: `1px solid ${sodexSide === "BUY" ? C.success : C.danger}40`,
                color: sodexSide === "BUY" ? C.success : C.danger,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = sodexSide === "BUY" ? `${C.success}30` : `${C.danger}30`;
                e.currentTarget.style.borderColor = sodexSide === "BUY" ? C.success : C.danger;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = sodexSide === "BUY" ? `${C.success}20` : `${C.danger}20`;
                e.currentTarget.style.borderColor = sodexSide === "BUY" ? `${C.success}40` : `${C.danger}40`;
              }}
            >
              {sodexLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : sodexSide === "BUY" ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              {sodexLoading ? "Submitting to SoDEX…" : `Execute ${sodexSide} BTC on SoDEX Testnet`}
            </button>
          )}

          {/* SoDEX result widget inline */}
          {sodexResult && (
            <SodexTradeWidget result={sodexResult} ownerKey={ownerKey} />
          )}

          {/* SoDEX testnet link */}
          {!sodexResult && (
            <div className="flex items-center justify-center gap-1.5">
              <ExternalLink size={10} style={{ color: C.textDim }} />
              <a
                href="https://testnet.sodex.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] transition-opacity opacity-40 hover:opacity-80"
                style={{ color: C.textSecondary }}
              >
                SoDEX Testnet
              </a>
            </div>
          )}

          {/* Publish to Base button */}
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all"
            style={{
              background: `${C.accent}20`,
              border: `1px solid ${C.accent}40`,
              color: C.accent,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${C.accent}30`;
              e.currentTarget.style.borderColor = C.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${C.accent}20`;
              e.currentTarget.style.borderColor = `${C.accent}40`;
            }}
          >
            <Zap size={14} />
            Publish to Base Testnet
          </button>
        </div>
      </motion.div>

      <PublishConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        strategy={strategy}
        ownerKey={ownerKey ?? ""}
      />
    </>
  );
}
