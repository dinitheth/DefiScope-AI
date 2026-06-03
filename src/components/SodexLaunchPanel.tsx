import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy, Zap,
  Shield, Clock, BarChart2, CheckCircle2,
} from "lucide-react";
import { useState } from "react";

const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
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
  DEFAULT: "#8B92A5",
};

interface SodexLaunchPanelProps {
  regime?: string;
  confidence?: number;
  side?: "BUY" | "SELL";
  asset?: string;
  size?: string;
  memo?: string;
  allocation?: Record<string, number>;
}

function RegimeBadge({ regime }: { regime: string }) {
  const r = (regime || "").toLowerCase().replace(/_/g, " ");
  const isRiskOn = r.includes("bull") || r.includes("accumulation") || r.includes("trending up") || r.includes("risk-on");
  const isRiskOff = r.includes("bear") || r.includes("distribution") || r.includes("trending down") || r.includes("volatile") || r.includes("risk-off");
  const color = isRiskOn ? C.success : isRiskOff ? C.danger : C.warning;
  const Icon = isRiskOn ? TrendingUp : isRiskOff ? TrendingDown : Activity;
  const label = isRiskOn ? "Risk-On" : isRiskOff ? "Risk-Off" : regime.charAt(0).toUpperCase() + regime.slice(1).replace(/_/g, " ");
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${color}20`, color }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

export default function SodexLaunchPanel({
  regime = "consolidation",
  confidence = 50,
  side = "BUY",
  asset = "BTC",
  size = "0.001",
  memo,
  allocation,
}: SodexLaunchPanelProps) {
  const [copied, setCopied] = useState(false);

  const assetColor = ASSET_COLORS[asset] ?? ASSET_COLORS.DEFAULT;
  const sideColor = side === "BUY" ? C.success : C.danger;
  const SideIcon = side === "BUY" ? TrendingUp : TrendingDown;

  const orderSummary = `${side} ${size} ${asset} — AI Signal (${confidence}% confidence)\nRegime: ${regime}\nPlatform: DefiScope AI x SoDEX Testnet`;

  function handleCopy() {
    navigator.clipboard.writeText(orderSummary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openSodex() {
    window.open("https://testnet.sodex.com", "_blank", "noopener,noreferrer");
  }

  const steps = [
    { icon: Shield, text: "Connect your wallet on SoDEX" },
    { icon: BarChart2, text: `Select ${asset}/USDC spot market` },
    { icon: SideIcon, text: `Place ${side} order · ${size} ${asset}` },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto" style={{ background: C.bg }}>
      {/* Header hero */}
      <div className="px-6 pt-8 pb-6 space-y-4">
        {/* AI Signal badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <div className="h-8 w-8 rounded-[10px] flex items-center justify-center" style={{ background: `${C.accent}20` }}>
            <Zap size={15} style={{ color: C.accent }} />
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: C.textPrimary }}>DefiScope AI Signal</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Ready to execute on SoDEX</p>
          </div>
        </motion.div>

        {/* Big trade card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: C.panel, border: `1px solid ${sideColor}30` }}
        >
          {/* Asset + side */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black"
                style={{ background: `${assetColor}15`, color: assetColor, border: `1px solid ${assetColor}30` }}
              >
                {asset[0]}
              </div>
              <div>
                <p className="text-xl font-black" style={{ color: C.textPrimary }}>{asset}/USDC</p>
                <p className="text-[11px]" style={{ color: C.textMuted }}>Spot · SoDEX Testnet</p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-[15px] font-bold"
              style={{ background: `${sideColor}20`, color: sideColor, border: `1px solid ${sideColor}40` }}
            >
              <SideIcon size={16} />
              {side}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Size", value: size, unit: asset, color: assetColor },
              { label: "Confidence", value: `${confidence}%`, unit: "", color: confidence >= 70 ? C.success : C.warning },
              { label: "Signal", value: side, unit: "", color: sideColor },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>{label}</p>
                <p className="text-[14px] font-bold" style={{ color }}>
                  {value}<span className="text-[10px] ml-0.5" style={{ color: C.textMuted }}>{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Regime + memo */}
          <div className="flex items-center gap-2 flex-wrap">
            <RegimeBadge regime={regime} />
            <span className="text-[11px]" style={{ color: C.textMuted }}>·</span>
            <Clock size={11} style={{ color: C.textMuted }} />
            <span className="text-[11px]" style={{ color: C.textMuted }}>Live signal</span>
          </div>

          {memo && (
            <p className="text-[12px] leading-relaxed line-clamp-3" style={{ color: C.textSecondary }}>
              {memo}
            </p>
          )}
        </motion.div>

        {/* Allocation mini-bars */}
        {allocation && Object.keys(allocation).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-xl p-4 space-y-2.5"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.textMuted }}>AI Portfolio Allocation</p>
            {Object.entries(allocation)
              .sort(([, a], [, b]) => b - a)
              .map(([tkr, pct]) => {
                const c = ASSET_COLORS[tkr] ?? ASSET_COLORS.DEFAULT;
                return (
                  <div key={tkr} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold w-10 shrink-0" style={{ color: C.textSecondary }}>{tkr}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${c}20` }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: c }}
                      />
                    </div>
                    <span className="text-[11px] font-mono w-8 text-right" style={{ color: c }}>{pct}%</span>
                  </div>
                );
              })}
          </motion.div>
        )}

        {/* Steps guide */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="rounded-xl p-4 space-y-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>How to execute</p>
          {steps.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.accent}15` }}>
                <Icon size={12} style={{ color: C.accent }} />
              </div>
              <span className="text-[12px]" style={{ color: C.textSecondary }}>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Sticky CTA footer */}
      <div className="sticky bottom-0 px-6 pb-6 pt-3 space-y-2" style={{ background: C.bg }}>
        {/* Main open button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
          onClick={openSodex}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[16px] text-[14px] font-bold transition-all active:scale-[0.99]"
          style={{
            background: `linear-gradient(135deg, ${sideColor}CC, ${sideColor}99)`,
            color: "#FFFFFF",
            boxShadow: `0 4px 24px ${sideColor}30`,
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <ExternalLink size={16} />
          Open SoDEX Testnet
        </motion.button>

        {/* Copy order details */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[12px] font-medium transition-all"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: copied ? C.success : C.textMuted,
          }}
        >
          {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy order details"}
        </button>

        <p className="text-center text-[10px]" style={{ color: C.textMuted }}>
          Testnet only · No real funds · SoDEX Buildathon
        </p>
      </div>
    </div>
  );
}
