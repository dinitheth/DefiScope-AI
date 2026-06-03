import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy, Zap,
  Shield, Clock, BarChart2, CheckCircle2, Target, ShieldAlert
} from "lucide-react";
import { useState } from "react";
import TradingViewWidget from "./TradingViewWidget";

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

interface TradeSetup {
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
}

interface SodexLaunchPanelProps {
  regime?: string;
  confidence?: number;
  side?: "BUY" | "SELL";
  asset?: string;
  size?: string;
  memo?: string;
  allocation?: Record<string, number>;
  tradeSetup?: TradeSetup;
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
  tradeSetup,
}: SodexLaunchPanelProps) {
  const [copied, setCopied] = useState(false);

  const assetColor = ASSET_COLORS[asset] ?? ASSET_COLORS.DEFAULT;
  const sideColor = side === "BUY" ? C.success : C.danger;
  const SideIcon = side === "BUY" ? TrendingUp : TrendingDown;

  const symbolMap: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    USDC: "BINANCE:USDCUSDT",
  };
  const tvSymbol = symbolMap[asset] ?? `BINANCE:${asset}USDT`;

  // Fallback default setup if none is provided to populate the signal diagram
  const finalTradeSetup = tradeSetup ?? (asset === "BTC" ? {
    entry: 66037,
    stopLoss: 64500,
    target: 69000,
    riskReward: 2.0
  } : asset === "ETH" ? {
    entry: 3450,
    stopLoss: 3300,
    target: 3750,
    riskReward: 2.0
  } : {
    entry: 145,
    stopLoss: 135,
    target: 165,
    riskReward: 2.0
  });

  const hasTradeSetup = !!finalTradeSetup && finalTradeSetup.entry > 0;

  const formatPrice = (n: number) => {
    if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(4)}`;
  };

  let targetPct = "";
  let stopPct = "";
  if (hasTradeSetup) {
    const targetDiff = ((finalTradeSetup.target - finalTradeSetup.entry) / finalTradeSetup.entry) * 100;
    const stopDiff = ((finalTradeSetup.stopLoss - finalTradeSetup.entry) / finalTradeSetup.entry) * 100;
    targetPct = `${targetDiff > 0 ? "+" : ""}${targetDiff.toFixed(2)}%`;
    stopPct = `${stopDiff > 0 ? "+" : ""}${stopDiff.toFixed(2)}%`;
  }

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

        {/* Real-time Chart Widget */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-2xl overflow-hidden border"
          style={{ background: C.panel, borderColor: C.border }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: C.surface, borderColor: C.border }}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: C.success, animationDuration: "2s" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.success }} />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.textPrimary }}>
                {asset}/USDT Live Spot Chart
              </p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: `${C.accent}20`, color: C.accent }}>
              TradingView
            </span>
          </div>
          <div className="w-full relative bg-[#0D0E12]" style={{ height: "240px" }}>
            <TradingViewWidget symbol={tvSymbol} height={240} />
          </div>
        </motion.div>

        {/* Visual Trade Setup Diagram */}
        {hasTradeSetup && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="rounded-2xl p-5 space-y-4 border"
            style={{ background: C.panel, borderColor: C.border }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                AI Trade Setup Diagram
              </p>
              <div className="px-2.5 py-1 rounded-[8px] text-[10px] font-bold" style={{ background: `${C.accent}20`, color: C.accent }}>
                R:R 1:{finalTradeSetup.riskReward}
              </div>
            </div>

            {/* Vertical gauge diagram + text setup */}
            <div className="flex gap-5 items-center">
              {/* Vertical slider gauge representation */}
              <div className="relative w-2.5 h-24 rounded-full bg-neutral-900 flex flex-col overflow-hidden shrink-0">
                {/* For BUY trade: Top green, bottom red */}
                {side === "BUY" ? (
                  <>
                    <div className="w-full h-1/2 opacity-80" style={{ background: C.success }} />
                    <div className="w-full h-1/2 opacity-80" style={{ background: C.danger }} />
                  </>
                ) : (
                  <>
                    <div className="w-full h-1/2 opacity-80" style={{ background: C.danger }} />
                    <div className="w-full h-1/2 opacity-80" style={{ background: C.success }} />
                  </>
                )}
                {/* Center marker */}
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1.5 bg-white border border-neutral-950 shadow" />
              </div>

              {/* Levels text labels */}
              <div className="flex-1 flex flex-col justify-between h-24 text-[13px] font-mono">
                {/* Target label (top) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Target size={13} />
                    <span className="font-sans font-bold text-[11px] uppercase tracking-wider">Target</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">{formatPrice(finalTradeSetup.target)}</span>
                    <span className="text-[10px] text-emerald-400 ml-2 font-semibold">{targetPct}</span>
                  </div>
                </div>

                {/* Entry label (middle) */}
                <div className="flex items-center justify-between border-y border-dashed py-1.5" style={{ borderColor: C.border }}>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="font-sans font-bold text-[11px] uppercase tracking-wider">Entry</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">{formatPrice(finalTradeSetup.entry)}</span>
                  </div>
                </div>

                {/* Stop Loss label (bottom) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-500">
                    <ShieldAlert size={13} />
                    <span className="font-sans font-bold text-[11px] uppercase tracking-wider">Stop Loss</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">{formatPrice(finalTradeSetup.stopLoss)}</span>
                    <span className="text-[10px] text-rose-500 ml-2 font-semibold">{stopPct}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
