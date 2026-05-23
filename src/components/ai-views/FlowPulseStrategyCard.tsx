import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import PublishConfirmModal from "@/components/PublishConfirmModal";
import type { StrategyData } from "@/hooks/use-strategy-publisher";

interface FlowPulseStrategyCardProps {
  regime: string;
  allocation: Record<string, number>;
  memo: string;
  reasoning: string[];
  confidence: number;
  ownerKey?: string;
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
  const r = regime.toLowerCase();
  if (r.includes("risk-on") || r.includes("bull") || r.includes("bullish")) {
    return { label: "Risk-On", color: C.success, bg: `${C.success}20`, icon: TrendingUp };
  }
  if (r.includes("risk-off") || r.includes("bear") || r.includes("bearish")) {
    return { label: "Risk-Off", color: C.danger, bg: `${C.danger}20`, icon: TrendingDown };
  }
  return { label: "Mixed", color: C.warning, bg: `${C.warning}20`, icon: Activity };
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

export default function FlowPulseStrategyCard({
  regime,
  allocation,
  memo,
  reasoning,
  confidence,
  ownerKey,
}: FlowPulseStrategyCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const regimeConfig = getRegimeConfig(regime);
  const RegimeIcon = regimeConfig.icon;

  const strategy: StrategyData = { memo, allocation, reasoning, regime, confidence };

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
          <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: C.textMuted }}>
            Allocation
          </p>
          {Object.entries(allocation)
            .sort(([, a], [, b]) => b - a)
            .map(([asset, pct]) => (
              <AllocationBar key={asset} asset={asset} pct={pct} />
            ))}
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

        {/* Reasoning */}
        {reasoning && reasoning.length > 0 && (
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>
              Reasoning
            </p>
            <ul className="space-y-1.5">
              {reasoning.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: C.textSecondary }}>
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: C.accent }}
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Publish button */}
        <div className="px-5 py-4">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all"
            style={{
              background: `${C.accent}20`,
              border: `1px solid ${C.accent}40`,
              color: C.accent,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${C.accent}30`;
              e.currentTarget.style.borderColor = C.accent;
            }}
            onMouseLeave={(e) => {
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
