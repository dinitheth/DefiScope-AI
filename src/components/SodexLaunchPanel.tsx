import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy, Zap,
  Shield, Clock, BarChart2, CheckCircle2, Target, ShieldAlert
} from "lucide-react";
import { useState, useEffect } from "react";
import TradingViewWidget from "./TradingViewWidget";
import { fetchCoinList } from "@/lib/sosovalue-api";

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

interface SodexSignals {
  momentum: string;
  institutional: string;
  sentiment: string;
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
  signals?: SodexSignals;
  opportunities?: any[];
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
  signals,
  opportunities,
}: SodexLaunchPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeAsset, setActiveAsset] = useState(asset);
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    setActiveAsset(asset);
  }, [asset]);

  useEffect(() => {
    fetchCoinList().then((coins) => {
      const priceMap: Record<string, number> = {};
      coins.forEach((c) => {
        if (c.coinSymbol) {
          priceMap[c.coinSymbol.toUpperCase()] = c.coinPrice;
        }
      });
      setCoinPrices(priceMap);
    }).catch(err => console.error("Error fetching coin list in panel:", err));
  }, []);

  const assetColor = ASSET_COLORS[activeAsset] ?? ASSET_COLORS.DEFAULT;
  const sideColor = side === "BUY" ? C.success : C.danger;
  const SideIcon = side === "BUY" ? TrendingUp : TrendingDown;

  const symbolMap: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    USDC: "BINANCE:USDCUSDT",
  };
  const tvSymbol = symbolMap[activeAsset] ?? `BINANCE:${activeAsset}USDT`;

  const PRICE_FALLBACKS: Record<string, number> = {
    BTC: 66037,
    ETH: 3450,
    SOL: 145,
    HYPE: 0.85,
    USDC: 1.00,
    USDT: 1.00,
  };

  // Find active opportunity details
  const activeOpportunity = (opportunities || []).find(o => o.symbol.toUpperCase() === activeAsset.toUpperCase());
  const isMainAsset = activeAsset.toUpperCase() === asset.toUpperCase();

  const finalSide = isMainAsset ? side : (activeOpportunity?.action === "WATCH" ? "BUY" : (activeOpportunity?.action || "BUY"));
  const finalConfidence = isMainAsset ? confidence : (activeOpportunity?.confidence || 52);

  // Setup signals
  const finalSignals = isMainAsset ? (signals ?? { momentum: "neutral", institutional: "neutral", sentiment: "neutral" }) : {
    momentum: activeOpportunity?.action === "BUY" ? "bullish" : activeOpportunity?.action === "SELL" ? "bearish" : "neutral",
    institutional: activeAsset === "ETH" || activeAsset === "BTC" ? (regime.includes("risk-on") ? "bullish" : "neutral") : "neutral",
    sentiment: activeOpportunity ? (activeOpportunity.confidence > 70 ? "bullish" : "neutral") : "neutral",
  };

  // Fallback default setup if none is provided to populate the signal diagram
  const finalTradeSetup = isMainAsset && tradeSetup ? tradeSetup : (() => {
    const entry = coinPrices[activeAsset.toUpperCase()] ?? PRICE_FALLBACKS[activeAsset.toUpperCase()] ?? 1.00;
    const isBuy = finalSide === "BUY";
    const target = isBuy ? entry * 1.05 : entry * 0.95;
    const stopLoss = isBuy ? entry * 0.975 : entry * 1.025;
    return {
      entry,
      target,
      stopLoss,
      riskReward: 2.0,
    };
  })();

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

  // Only BTC, ETH, and SOL are supported in the selector dropdown
  const assetOptions = ["BTC", "ETH", "SOL"];

  const orderSummary = `${finalSide} ${size} ${activeAsset} — AI Signal (${finalConfidence}% confidence)\nRegime: ${regime}\nPlatform: DefiScope AI x SoDEX Testnet`;

  function handleCopy() {
    navigator.clipboard.writeText(orderSummary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openSodex() {
    window.open("https://testnet.sodex.com", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto" style={{ background: C.bg }}>
      {/* Real-time Chart Widget & Visual Trade Setup */}
      <div className="px-6 pt-6 pb-6 space-y-4">
        {/* Asset Selector */}
        <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <BarChart2 size={15} style={{ color: C.accent }} />
            <p className="text-[12px] font-bold text-white">Select Chart & Signals</p>
          </div>
          <select
            value={activeAsset}
            onChange={(e) => setActiveAsset(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] border border-[#1C1C1C] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {assetOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Real-time Chart Widget */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
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
                {activeAsset}/USDT Live Spot Chart
              </p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: `${C.accent}20`, color: C.accent }}>
              TradingView
            </span>
          </div>
          <div className="w-full relative bg-[#0D0E12]" style={{ height: "380px" }}>
            <TradingViewWidget symbol={tvSymbol} height={380} />
          </div>
        </motion.div>

        {/* AI Market Signals */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-2xl p-5 space-y-4 border"
          style={{ background: C.panel, borderColor: C.border }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
              AI Market Signals
            </p>
            <div
              className="px-2.5 py-1 rounded-[8px] text-[10px] font-bold"
              style={{ background: `${sideColor}20`, color: sideColor }}
            >
              {finalSide} Signal ({finalConfidence}% Confidence)
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Momentum", value: finalSignals.momentum },
              { label: "Institutional", value: finalSignals.institutional },
              { label: "Sentiment", value: finalSignals.sentiment },
            ].map(({ label, value }) => {
              const valLower = (value || "neutral").toLowerCase();
              const isBull = valLower === "bullish" || valLower === "bull";
              const isBear = valLower === "bearish" || valLower === "bear";
              const color = isBull ? C.success : isBear ? C.danger : C.textSecondary;
              const bg = isBull ? `${C.success}10` : isBear ? `${C.danger}10` : `${C.surface}`;
              const border = isBull ? `${C.success}20` : isBear ? `${C.danger}20` : C.border;
              return (
                <div
                  key={label}
                  className="p-2.5 rounded-xl border text-center transition-all"
                  style={{ background: bg, borderColor: border }}
                >
                  <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>
                    {label}
                  </p>
                  <p className="text-[11px] font-bold capitalize" style={{ color }}>
                    {value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Verification Badge */}
          <div className="flex items-center justify-between pt-3.5 border-t" style={{ borderColor: C.border }}>
            <span className="text-[10px]" style={{ color: C.textMuted }}>
              Verification status:
            </span>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold"
              style={{
                background: isMainAsset ? `${C.success}15` : `${C.warning}15`,
                color: isMainAsset ? C.success : C.warning,
              }}
            >
              {isMainAsset ? "✓ AI Verified" : "⚠ Live Price Baseline"}
            </span>
          </div>

          <p className="text-[10px] leading-relaxed" style={{ color: C.textMuted }}>
            {isMainAsset
              ? "Generated by the AI Decision engine using live market inputs, SoSoValue ETF flows, and news sentiment."
              : `Calculated from live spot prices. Run a briefing for ${activeAsset} in the chat to get AI Verified signals.`}
          </p>
        </motion.div>

        {/* Visual Trade Setup Diagram */}
        {hasTradeSetup && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
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
                {finalSide === "BUY" ? (
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
