import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Zap, ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import PublishConfirmModal from "@/components/PublishConfirmModal";
import SodexTradeWidget, { type SodexTradeResult } from "@/components/ai-views/SodexTradeWidget";
import type { StrategyData } from "@/hooks/use-strategy-publisher";
import { useSodexTrade } from "@/hooks/use-sodex-trade";
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
  const sodex = useSodexTrade();

  const regimeConfig = getRegimeConfig(regime);
  const RegimeIcon = regimeConfig.icon;

  // Derive SoDEX action: prefer explicit decisionAction, fall back to regime
  // Default to BUY for neutral/mixed regime so the Execute button always shows
  const sodexSide: "BUY" | "SELL" = decisionAction === "SELL" ? "SELL"
    : decisionAction === "BUY" ? "BUY"
    : (regimeConfig.sodexSide ?? "BUY");

  const strategy: StrategyData = { memo, allocation, reasoning, regime, confidence };

  const chartData = Object.entries(allocation)
    .filter(([, pct]) => pct > 0)
    .map(([asset, pct]) => ({
      name: asset,
      value: pct,
      color: ASSET_COLORS[asset] ?? ASSET_COLORS.DEFAULT,
    }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl overflow-hidden shadow-lg"
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

        {/* Allocation Pie Chart */}
        <div className="px-5 py-5 border-b" style={{ borderColor: C.border }}>
          <p className="text-[11px] uppercase tracking-wider mb-4 text-left font-semibold" style={{ color: C.textMuted }}>
            Allocation Breakdown
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Pie Chart container */}
            <div className="w-[130px] h-[130px] flex items-center justify-center relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={56}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={1000}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke={C.panel} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div
                            className="px-2 py-1 rounded border text-[11px] font-semibold"
                            style={{ background: C.surface, borderColor: C.border, color: C.textPrimary }}
                          >
                            {data.name}: {data.value}%
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: C.textMuted }}>
                  Total
                </span>
                <span className="text-[13px] font-extrabold text-white">
                  100%
                </span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex-1 w-full space-y-2">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-[12px] font-bold text-white">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color: item.color }}>{item.value}%</span>
                    <span className="text-[10px] text-muted-foreground">allocation</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Memo */}
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: C.border }}>
          <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
            Strategy Memo
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: C.textSecondary }}>
            {memo}
          </p>
        </div>

        {/* Reasoning — collapsible */}
        {reasoning && reasoning.length > 0 && (
          <div className="px-5 pt-3 pb-3 border-b" style={{ borderColor: C.border }}>
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

        {/* Publish to Base Sepolia Testnet CTA */}
        <div className="px-5 py-4" style={{ background: "rgba(0, 0, 0, 0.15)" }}>
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all active:scale-[0.99] border hover:opacity-95"
            style={{
              background: C.accent,
              borderColor: C.accent,
              color: "#FFFFFF",
              boxShadow: `0 4px 12px ${C.accent}30`
            }}
          >
            <Zap size={14} fill="#FFFFFF" />
            Publish to Base Testnet
          </button>
        </div>
      </motion.div>

      <PublishConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        strategy={strategy}
        ownerKey={ownerKey || ""}
      />
    </>
  );
}
