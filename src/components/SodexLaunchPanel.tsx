import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy,
  Shield, BarChart2, CheckCircle2, Target, ShieldAlert,
  Sliders, Award, RefreshCw, BarChart, AlertTriangle,
  Gauge, Crosshair, GitBranch, Zap, Info, AlertCircle
} from "lucide-react";
import TradingViewWidget from "./TradingViewWidget";
import { fetchCoinList } from "@/lib/sosovalue-api";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import { toast } from "@/hooks/use-toast";
import {
  fetchDailyReturns,
  computePortfolioReturns,
  computeAllRiskMetrics,
  computeConcentration,
  computeCorrelationMatrix,
  computeRiskContributions,
  computeCompositeScore,
  generateRecommendations,
  simulateScenario,
  type DailyReturn,
  type RiskMetrics,
  type ConcentrationMetrics,
  type CorrelationResult,
  type RiskContribution,
  type CompositeRiskScore,
  type RiskRecommendation,
  type ScenarioResult,
} from "@/lib/risk-engine";

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
  orange: "#F97316",
};

const ASSET_COLORS: Record<string, string> = {
  BTC: "#F59E0B",
  ETH: "#8B5CF6",
  SOL: "#10B981",
  USDC: "#3B82F6",
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

interface ClosedPosition {
  id: string;
  asset: "BTC" | "ETH" | "SOL";
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  regime: "bullish" | "bearish" | "chop";
  hour: number;
  date: string;
}

const MOCK_TRADES: ClosedPosition[] = [
  { id: "1", asset: "BTC", side: "BUY", entryPrice: 62000, exitPrice: 65000, amount: 0.1, pnl: 300, regime: "bullish", hour: 8, date: "May 10" },
  { id: "2", asset: "ETH", side: "BUY", entryPrice: 3100, exitPrice: 2950, amount: 1.5, pnl: -225, regime: "chop", hour: 14, date: "May 12" },
  { id: "3", asset: "SOL", side: "BUY", entryPrice: 145, exitPrice: 120, amount: 10, pnl: -250, regime: "bearish", hour: 22, date: "May 15" },
  { id: "4", asset: "BTC", side: "SELL", entryPrice: 64000, exitPrice: 62000, amount: 0.15, pnl: 300, regime: "bearish", hour: 8, date: "May 18" },
  { id: "5", asset: "ETH", side: "BUY", entryPrice: 3000, exitPrice: 3300, amount: 2, pnl: 600, regime: "bullish", hour: 9, date: "May 20" },
  { id: "6", asset: "SOL", side: "BUY", entryPrice: 130, exitPrice: 155, amount: 15, pnl: 375, regime: "bullish", hour: 10, date: "May 22" },
  { id: "7", asset: "SOL", side: "BUY", entryPrice: 160, exitPrice: 140, amount: 20, pnl: -400, regime: "bearish", hour: 22, date: "May 25" },
  { id: "8", asset: "BTC", side: "BUY", entryPrice: 68000, exitPrice: 66500, amount: 0.08, pnl: -120, regime: "chop", hour: 15, date: "May 27" },
  { id: "9", asset: "ETH", side: "SELL", entryPrice: 3400, exitPrice: 3550, amount: 1.0, pnl: -150, regime: "bullish", hour: 23, date: "May 30" },
  { id: "10", asset: "SOL", side: "BUY", entryPrice: 150, exitPrice: 135, amount: 25, pnl: -375, regime: "bearish", hour: 21, date: "Jun 02" },
  { id: "11", asset: "BTC", side: "BUY", entryPrice: 67000, exitPrice: 69500, amount: 0.12, pnl: 300, regime: "bullish", hour: 8, date: "Jun 05" },
  { id: "12", asset: "ETH", side: "BUY", entryPrice: 3500, exitPrice: 3750, amount: 1.2, pnl: 300, regime: "bullish", hour: 9, date: "Jun 08" },
  { id: "13", asset: "SOL", side: "BUY", entryPrice: 140, exitPrice: 120, amount: 30, pnl: -600, regime: "bearish", hour: 22, date: "Jun 11" },
  { id: "14", asset: "BTC", side: "SELL", entryPrice: 66000, exitPrice: 67200, amount: 0.05, pnl: -60, regime: "chop", hour: 13, date: "Jun 15" },
  { id: "15", asset: "ETH", side: "BUY", entryPrice: 3600, exitPrice: 3450, amount: 2.0, pnl: -300, regime: "bearish", hour: 22, date: "Jun 18" },
];

// ─── Animated Gauge SVG ─────────────────────────────────────────────────────
function RiskGauge({ score, grade, label, color }: { score: number; grade: string; label: string; color: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius * 0.75; // 270-degree arc
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 140, height: 110 }}>
        <svg width="140" height="110" viewBox="0 0 140 110">
          {/* Background arc */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={C.border}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            transform="rotate(135 70 70)"
          />
          {/* Score arc */}
          <motion.circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            transform="rotate(135 70 70)"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: 8 }}>
          <motion.span
            className="text-[28px] font-black leading-none"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] font-bold mt-0.5" style={{ color: C.textMuted }}>/100</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold" style={{ background: `${color}20`, color }}>
          {grade}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: C.textSecondary }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Correlation Cell ───────────────────────────────────────────────────────
function CorrCell({ value }: { value: number }) {
  const absVal = Math.abs(value);
  let bg: string, textColor: string;
  if (value === 1) { bg = `${C.accent}15`; textColor = C.accent; }
  else if (absVal > 0.7) { bg = `${C.danger}15`; textColor = C.danger; }
  else if (absVal > 0.4) { bg = `${C.warning}15`; textColor = C.warning; }
  else { bg = `${C.success}15`; textColor = C.success; }

  return (
    <div className="flex items-center justify-center p-1.5 rounded-lg text-[11px] font-bold font-mono" style={{ background: bg, color: textColor }}>
      {value === 1 ? "1.00" : value.toFixed(2)}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<"risk" | "autopsy" | "chart">("risk");
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [activeAsset, setActiveAsset] = useState(asset);

  // Risk Engine state
  const [riskLoading, setRiskLoading] = useState(true);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationMetrics | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationResult | null>(null);
  const [riskContribs, setRiskContribs] = useState<RiskContribution[]>([]);
  const [compositeScore, setCompositeScore] = useState<CompositeRiskScore | null>(null);
  const [recommendations, setRecommendations] = useState<RiskRecommendation[]>([]);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [scenarioShock, setScenarioShock] = useState("-20");
  const [scenarioAsset, setScenarioAsset] = useState("ALL");

  // Rebalancer state
  const [holdings, setHoldings] = useState({ BTC: "0.2", ETH: "1.5", SOL: "15.0" });
  const [rebalanceResult, setRebalanceResult] = useState<any[] | null>(null);
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Autopsy filters
  const [filterAsset, setFilterAsset] = useState<string>("ALL");
  const [filterRegime, setFilterRegime] = useState<string>("ALL");
  const [filterHour, setFilterHour] = useState<string>("ALL");
  const [excludeWorstPattern, setExcludeWorstPattern] = useState(false);

  const currentAllocation: Record<string, number> = allocation || { BTC: 40, ETH: 30, SOL: 20, USDC: 10 };

  // ─── Fetch prices ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchCoinList().then((coins) => {
      const priceMap: Record<string, number> = {};
      coins.forEach((c) => {
        if (c.coinSymbol) priceMap[c.coinSymbol.toUpperCase()] = c.coinPrice;
      });
      setCoinPrices(priceMap);
    }).catch(console.error);
  }, []);

  useEffect(() => { setActiveAsset(asset); }, [asset]);

  // ─── Risk Engine computation ────────────────────────────────────────────
  const runRiskEngine = useCallback(async () => {
    setRiskLoading(true);
    try {
      const assets = Object.keys(currentAllocation).filter((a) => currentAllocation[a] > 0);
      const returns = await fetchDailyReturns(assets, 90);
      setDailyReturns(returns);

      const portfolioReturns = computePortfolioReturns(returns, currentAllocation);
      const metrics = computeAllRiskMetrics(portfolioReturns);
      setRiskMetrics(metrics);

      const conc = computeConcentration(currentAllocation);
      setConcentration(conc);

      const corr = computeCorrelationMatrix(returns);
      setCorrelation(corr);

      const contribs = computeRiskContributions(returns, currentAllocation);
      setRiskContribs(contribs);

      const score = computeCompositeScore(conc, metrics, corr);
      setCompositeScore(score);

      const recs = generateRecommendations(score, conc, metrics, corr);
      setRecommendations(recs);
    } catch (err) {
      console.error("Risk engine error:", err);
    } finally {
      setRiskLoading(false);
    }
  }, [JSON.stringify(currentAllocation)]);

  useEffect(() => { runRiskEngine(); }, [runRiskEngine]);

  // ─── Scenario simulation ───────────────────────────────────────────────
  const runScenario = () => {
    const portfolioReturns = computePortfolioReturns(dailyReturns, currentAllocation);
    const result = simulateScenario(
      currentAllocation,
      parseFloat(scenarioShock),
      scenarioAsset,
      coinPrices,
      portfolioReturns
    );
    setScenarioResult(result);
  };

  // ─── Rebalancer ─────────────────────────────────────────────────────────
  const calculateRebalance = () => {
    const prices = { BTC: coinPrices.BTC || 65000, ETH: coinPrices.ETH || 3500, SOL: coinPrices.SOL || 140, USDC: 1.0 };
    const btcVal = (parseFloat(holdings.BTC) || 0) * prices.BTC;
    const ethVal = (parseFloat(holdings.ETH) || 0) * prices.ETH;
    const solVal = (parseFloat(holdings.SOL) || 0) * prices.SOL;
    const totalUSD = btcVal + ethVal + solVal;
    if (totalUSD === 0) return;

    const swaps: any[] = [];
    const targetUSD = {
      BTC: (currentAllocation.BTC / 100) * totalUSD,
      ETH: (currentAllocation.ETH / 100) * totalUSD,
      SOL: (currentAllocation.SOL / 100) * totalUSD,
    };

    const deltas = { BTC: targetUSD.BTC - btcVal, ETH: targetUSD.ETH - ethVal, SOL: targetUSD.SOL - solVal };
    for (const [coin, delta] of Object.entries(deltas)) {
      if (delta > 10) swaps.push({ action: "BUY", asset: coin, amount: (delta / prices[coin as keyof typeof prices]).toFixed(4), value: delta.toFixed(0) });
      else if (delta < -10) swaps.push({ action: "SELL", asset: coin, amount: (Math.abs(delta) / prices[coin as keyof typeof prices]).toFixed(4), value: Math.abs(delta).toFixed(0) });
    }
    setRebalanceResult(swaps);
  };

  const triggerRebalanceSimulation = () => {
    setIsRebalancing(true);
    setTimeout(() => {
      setIsRebalancing(false);
      setRebalanceResult(null);
      toast({ title: "Rebalance Complete", description: "Simulated orders routed through SoDEX Liquidity Router." });
    }, 2000);
  };

  // ─── Autopsy calculations ──────────────────────────────────────────────
  const filteredTrades = MOCK_TRADES.filter((t) => {
    if (filterAsset !== "ALL" && t.asset !== filterAsset) return false;
    if (filterRegime !== "ALL" && t.regime !== filterRegime) return false;
    if (filterHour !== "ALL") {
      if (filterHour === "NIGHT" && (t.hour < 20 && t.hour > 4)) return false;
      if (filterHour === "DAY" && (t.hour >= 20 || t.hour <= 4)) return false;
    }
    return true;
  });

  const totalTradesCount = filteredTrades.length;
  const netPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = filteredTrades.filter((t) => t.pnl > 0).length;
  const autopsyWinRate = totalTradesCount > 0 ? (winCount / totalTradesCount) * 100 : 0;
  const expectancy = totalTradesCount > 0 ? netPnl / totalTradesCount : 0;

  const getEquityChartData = () => {
    let baseEquity = 10000;
    let baseCounterfactual = 10000;
    const chartPoints: any[] = [];
    MOCK_TRADES.forEach((t) => {
      baseEquity += t.pnl;
      const isWorstPattern = t.asset === "SOL" && t.regime === "bearish";
      const isMatchingActiveFilter = (filterAsset !== "ALL" && t.asset === filterAsset) || (filterRegime !== "ALL" && t.regime === filterRegime);
      const shouldSkip = excludeWorstPattern ? isWorstPattern : isMatchingActiveFilter;
      if (!shouldSkip) baseCounterfactual += t.pnl;
      chartPoints.push({ name: t.date, Realized: baseEquity, Counterfactual: baseCounterfactual });
    });
    return chartPoints;
  };

  const chartData = getEquityChartData();

  // ─── Shared data ───────────────────────────────────────────────────────
  const pieData = Object.entries(currentAllocation)
    .filter(([, val]) => val > 0)
    .map(([name, val]) => ({ name, value: val, color: ASSET_COLORS[name] ?? ASSET_COLORS.DEFAULT }));

  const symbolMap: Record<string, string> = { BTC: "BINANCE:BTCUSDT", ETH: "BINANCE:ETHUSDT", SOL: "BINANCE:SOLUSDT" };
  const tvSymbol = symbolMap[activeAsset] ?? `BINANCE:${activeAsset}USDT`;

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  const fmtRatio = (n: number) => n > 10 ? ">10" : n < -10 ? "<-10" : n.toFixed(2);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar" style={{ background: C.bg, color: C.textPrimary }}>
      {/* Tabs */}
      <div className="flex border-b sticky top-0 z-15" style={{ background: C.panel, borderColor: C.border }}>
        {([
          { id: "risk", label: "Risk Engine", icon: Gauge },
          { id: "autopsy", label: "Autopsy", icon: Award },
          { id: "chart", label: "Live Chart", icon: BarChart },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-3.5 flex items-center justify-center gap-2 text-xs font-bold transition-all relative border-r last:border-r-0"
              style={{ borderColor: C.border, color: active ? C.accent : C.textSecondary, background: active ? "rgba(255,255,255,0.02)" : "transparent" }}
            >
              <Icon size={13} />
              {tab.label}
              {active && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.accent }} />}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-5 py-5 space-y-4">
        {/* ═══ TAB: RISK ENGINE ═══════════════════════════════════════════ */}
        {activeTab === "risk" && (
          <div className="space-y-4 animate-fade-in-up">
            {riskLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw size={20} className="animate-spin" style={{ color: C.accent }} />
                <p className="text-xs font-semibold" style={{ color: C.textMuted }}>Computing risk metrics from 90-day price history...</p>
              </div>
            ) : (
              <>
                {/* 1. Composite Risk Score */}
                {compositeScore && (
                  <div className="p-5 rounded-2xl border" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge size={14} style={{ color: C.accent }} />
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Portfolio Risk Score</p>
                    </div>
                    <RiskGauge score={compositeScore.score} grade={compositeScore.grade} label={compositeScore.label} color={compositeScore.color} />
                    {/* Sub-score breakdown */}
                    <div className="grid grid-cols-5 gap-1.5 mt-4">
                      {([
                        { label: "Conc.", value: compositeScore.subScores.concentration },
                        { label: "Vol.", value: compositeScore.subScores.volatility },
                        { label: "DD", value: compositeScore.subScores.drawdown },
                        { label: "Corr.", value: compositeScore.subScores.correlation },
                        { label: "Tail", value: compositeScore.subScores.tailRisk },
                      ]).map((s) => (
                        <div key={s.label} className="text-center p-1.5 rounded-lg" style={{ background: C.surface }}>
                          <p className="text-[8px] uppercase tracking-wider" style={{ color: C.textMuted }}>{s.label}</p>
                          <p className="text-[11px] font-bold" style={{ color: s.value > 65 ? C.danger : s.value > 45 ? C.warning : C.success }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Core Risk Metrics */}
                {riskMetrics && (
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center gap-2">
                      <Shield size={14} style={{ color: C.accent }} />
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Risk Metrics (90-Day)</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { label: "VaR 95%", value: fmtPct(riskMetrics.var95 * 100), color: C.danger },
                        { label: "CVaR 95%", value: fmtPct(riskMetrics.cvar95 * 100), color: C.danger },
                        { label: "Max DD", value: fmtPct(riskMetrics.maxDrawdown * 100), color: C.danger },
                        { label: "Ulcer Idx", value: riskMetrics.ulcerIndex.toFixed(2), color: C.warning },
                      ]).map((m) => (
                        <div key={m.label} className="p-2 rounded-xl text-center border" style={{ background: C.surface, borderColor: C.border }}>
                          <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: C.textMuted }}>{m.label}</p>
                          <p className="text-[11px] font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { label: "Sharpe", value: fmtRatio(riskMetrics.sharpe), color: riskMetrics.sharpe > 0 ? C.success : C.danger },
                        { label: "Sortino", value: fmtRatio(riskMetrics.sortino), color: riskMetrics.sortino > 0 ? C.success : C.danger },
                        { label: "Calmar", value: fmtRatio(riskMetrics.calmar), color: riskMetrics.calmar > 0.5 ? C.success : C.warning },
                        { label: "Omega", value: fmtRatio(riskMetrics.omega), color: riskMetrics.omega > 1 ? C.success : C.danger },
                      ]).map((m) => (
                        <div key={m.label} className="p-2 rounded-xl text-center border" style={{ background: C.surface, borderColor: C.border }}>
                          <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: C.textMuted }}>{m.label}</p>
                          <p className="text-[11px] font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Additional stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { label: "Win Rate", value: `${riskMetrics.dailyWinRate.toFixed(0)}%`, color: riskMetrics.dailyWinRate > 50 ? C.success : C.warning },
                        { label: "Ann. Return", value: fmtPct(riskMetrics.annualizedReturn), color: riskMetrics.annualizedReturn > 0 ? C.success : C.danger },
                        { label: "Ann. Vol", value: `${riskMetrics.annualizedVolatility.toFixed(1)}%`, color: riskMetrics.annualizedVolatility > 80 ? C.danger : C.warning },
                      ]).map((m) => (
                        <div key={m.label} className="p-2 rounded-xl text-center border" style={{ background: C.surface, borderColor: C.border }}>
                          <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: C.textMuted }}>{m.label}</p>
                          <p className="text-[11px] font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Correlation Heatmap */}
                {correlation && (
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch size={14} style={{ color: C.accent }} />
                        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Correlation Matrix (30-Day)</p>
                      </div>
                      {correlation.contagionAlert && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold animate-pulse" style={{ background: `${C.danger}20`, color: C.danger }}>
                          CONTAGION ALERT
                        </span>
                      )}
                    </div>
                    {/* Matrix grid */}
                    <div className="space-y-1">
                      {/* Header row */}
                      <div className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(3, 1fr)" }}>
                        <div />
                        {["BTC", "ETH", "SOL"].map((a) => (
                          <div key={a} className="text-center text-[9px] font-bold" style={{ color: ASSET_COLORS[a] }}>{a}</div>
                        ))}
                      </div>
                      {/* Data rows */}
                      {["BTC", "ETH", "SOL"].map((row) => (
                        <div key={row} className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(3, 1fr)" }}>
                          <div className="flex items-center text-[9px] font-bold" style={{ color: ASSET_COLORS[row] }}>{row}</div>
                          {["BTC", "ETH", "SOL"].map((col) => (
                            <CorrCell key={col} value={correlation.matrix[row]?.[col] ?? 0} />
                          ))}
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px]" style={{ color: C.textMuted }}>
                      Avg correlation: <span className="font-bold" style={{ color: correlation.avgAbsCorrelation > 0.7 ? C.danger : C.textSecondary }}>{(correlation.avgAbsCorrelation * 100).toFixed(0)}%</span>
                      {correlation.contagionAlert ? " — Diversification is ineffective during current regime." : ""}
                    </p>
                  </div>
                )}

                {/* 4. Risk Contribution */}
                {riskContribs.length > 0 && (
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center gap-2">
                      <Crosshair size={14} style={{ color: C.accent }} />
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Risk Contribution by Asset</p>
                    </div>
                    <div className="space-y-2">
                      {riskContribs.map((rc) => (
                        <div key={rc.asset} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold w-8" style={{ color: ASSET_COLORS[rc.asset] }}>{rc.asset}</span>
                          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: C.surface }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: ASSET_COLORS[rc.asset] }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(Math.abs(rc.marginalContribution), 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                          <span className="text-[10px] font-bold font-mono w-12 text-right" style={{ color: C.textSecondary }}>
                            {rc.marginalContribution.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Concentration Risk */}
                {concentration && (
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center gap-2">
                      <Target size={14} style={{ color: C.warning }} />
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Concentration Risk</p>
                    </div>
                    <div className="flex items-center gap-5">
                      {/* Donut */}
                      <div className="w-[80px] h-[80px] relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={24} outerRadius={36} dataKey="value" isAnimationActive>
                              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke={C.panel} strokeWidth={2} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span style={{ color: C.textMuted }}>HHI Index</span><span className="font-bold font-mono" style={{ color: concentration.hhi > 4000 ? C.danger : concentration.hhi > 2500 ? C.warning : C.success }}>{concentration.hhi}</span></div>
                        <div className="flex justify-between"><span style={{ color: C.textMuted }}>Effective Positions</span><span className="font-bold font-mono text-white">{concentration.effectiveN}</span></div>
                        <div className="flex justify-between"><span style={{ color: C.textMuted }}>Top Position</span><span className="font-bold" style={{ color: ASSET_COLORS[concentration.topAsset] }}>{concentration.topAsset} ({(concentration.topAssetWeight * 100).toFixed(0)}%)</span></div>
                        <div className="flex justify-between"><span style={{ color: C.textMuted }}>Grade</span><span className="font-bold" style={{ color: concentration.hhi > 4000 ? C.danger : concentration.hhi > 2500 ? C.warning : C.success }}>{concentration.grade}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Scenario Simulator */}
                <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                  <div className="flex items-center gap-2">
                    <Zap size={14} style={{ color: C.warning }} />
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Scenario Simulator</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Asset</label>
                      <select value={scenarioAsset} onChange={(e) => setScenarioAsset(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none">
                        <option value="ALL">Entire Market</option>
                        <option value="BTC">BTC Only</option>
                        <option value="ETH">ETH Only</option>
                        <option value="SOL">SOL Only</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Shock</label>
                      <select value={scenarioShock} onChange={(e) => setScenarioShock(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none">
                        <option value="-10">-10% Drop</option>
                        <option value="-20">-20% Drop</option>
                        <option value="-30">-30% Crash</option>
                        <option value="-50">-50% Black Swan</option>
                        <option value="10">+10% Surge</option>
                        <option value="20">+20% Rally</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={runScenario} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: C.accent, color: "#fff" }}>
                    Simulate Scenario
                  </button>
                  {scenarioResult && (
                    <div className="p-3 rounded-xl border space-y-2" style={{ background: C.surface, borderColor: C.border }}>
                      <p className="text-[10px] font-bold" style={{ color: C.textMuted }}>{scenarioResult.shockLabel}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-[8px] uppercase" style={{ color: C.textMuted }}>Portfolio Impact</p>
                          <p className="text-[14px] font-black font-mono" style={{ color: scenarioResult.portfolioImpactPct < 0 ? C.danger : C.success }}>
                            {fmtPct(scenarioResult.portfolioImpactPct)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] uppercase" style={{ color: C.textMuted }}>New Risk Score</p>
                          <p className="text-[14px] font-black font-mono" style={{ color: scenarioResult.newRiskScore > 65 ? C.danger : scenarioResult.newRiskScore > 45 ? C.warning : C.success }}>
                            {scenarioResult.newRiskScore}/100
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {scenarioResult.assetImpacts.filter((a) => a.dollarLoss > 0).map((a) => (
                          <div key={a.asset} className="flex justify-between text-[10px]">
                            <span style={{ color: ASSET_COLORS[a.asset] }}>{a.asset}</span>
                            <span className="font-mono" style={{ color: a.impactPct < 0 ? C.danger : C.success }}>
                              {a.impactPct < 0 ? "-" : "+"}${a.dollarLoss.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. AI Risk Recommendations */}
                {recommendations.length > 0 && (
                  <div className="p-4 rounded-2xl border space-y-2.5" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} style={{ color: C.accent }} />
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>AI Risk Recommendations</p>
                    </div>
                    {recommendations.map((rec, idx) => {
                      const iconColor = rec.severity === "critical" ? C.danger : rec.severity === "warning" ? C.warning : C.accent;
                      const SevIcon = rec.severity === "critical" ? AlertTriangle : rec.severity === "warning" ? AlertCircle : Info;
                      return (
                        <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl border" style={{ background: `${iconColor}08`, borderColor: `${iconColor}20` }}>
                          <SevIcon size={13} className="shrink-0 mt-0.5" style={{ color: iconColor }} />
                          <p className="text-[10.5px] leading-relaxed" style={{ color: C.textSecondary }}>
                            {rec.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 8. SoDEX Rebalance Simulator */}
                <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
                  <div className="flex items-center gap-2">
                    <Sliders size={14} style={{ color: C.warning }} />
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>SoDEX Rebalance Simulator</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(holdings).map((coin) => (
                      <div key={coin} className="space-y-1">
                        <label className="text-[10px] font-bold" style={{ color: C.textMuted }}>{coin}</label>
                        <input type="text" value={(holdings as any)[coin]}
                          onChange={(e) => setHoldings({ ...holdings, [coin]: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border text-white text-xs text-center font-mono focus:outline-none"
                          style={{ background: C.surface, borderColor: C.border }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={calculateRebalance} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: C.accent, color: "#fff" }}>
                    Calculate Swaps
                  </button>
                  {rebalanceResult && (
                    <div className="p-3 rounded-xl border space-y-2" style={{ background: C.surface, borderColor: C.border }}>
                      <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Required Orders</p>
                      {rebalanceResult.length === 0 ? (
                        <p className="text-center italic text-xs" style={{ color: C.textMuted }}>Portfolio already aligned</p>
                      ) : (
                        <div className="space-y-1.5 font-mono text-xs">
                          {rebalanceResult.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between items-center border-b pb-1 last:border-b-0" style={{ borderColor: C.border }}>
                              <span className={s.action === "BUY" ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                                {s.action} {s.amount} {s.asset}
                              </span>
                              <span style={{ color: C.textMuted }}>~${s.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {rebalanceResult.length > 0 && (
                        <button onClick={triggerRebalanceSimulation} disabled={isRebalancing}
                          className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                          style={{ background: C.success, color: "#fff" }}>
                          {isRebalancing ? <><RefreshCw size={12} className="animate-spin" /> Simulating...</> : "Execute on SoDEX"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ TAB: AUTOPSY ═══════════════════════════════════════════════ */}
        {activeTab === "autopsy" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <Sliders size={14} style={{ color: C.accent }} />
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Multi-Dimensional Slicers</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Asset</label>
                  <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none">
                    <option value="ALL">All</option><option value="BTC">BTC</option><option value="ETH">ETH</option><option value="SOL">SOL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Regime</label>
                  <select value={filterRegime} onChange={(e) => setFilterRegime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none">
                    <option value="ALL">All</option><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="chop">Chop</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Hour</label>
                  <select value={filterHour} onChange={(e) => setFilterHour(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none">
                    <option value="ALL">All</option><option value="DAY">Day</option><option value="NIGHT">Night</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {([
                { label: "Trades", value: totalTradesCount, color: C.textPrimary },
                { label: "Net PNL", value: `${netPnl > 0 ? "+" : ""}$${netPnl}`, color: netPnl > 0 ? C.success : netPnl < 0 ? C.danger : C.textPrimary },
                { label: "Expectancy", value: `${expectancy > 0 ? "+" : ""}$${expectancy.toFixed(0)}`, color: expectancy > 0 ? C.success : expectancy < 0 ? C.danger : C.textPrimary },
                { label: "Win Rate", value: `${autopsyWinRate.toFixed(0)}%`, color: autopsyWinRate > 50 ? C.success : C.textPrimary },
              ]).map((s) => (
                <div key={s.label} className="p-2 rounded-xl text-center border" style={{ background: C.panel, borderColor: C.border }}>
                  <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>{s.label}</p>
                  <p className="text-[12px] font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl border space-y-2" style={{ background: `${C.danger}10`, borderColor: `${C.danger}20` }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} style={{ color: C.danger }} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold" style={{ color: C.danger }}>Leaking Edge Detected</h4>
                  <p className="text-[10px] leading-relaxed mt-1" style={{ color: C.textSecondary }}>
                    Trading <span className="text-white font-bold">SOL during Bearish regimes</span> has a negative expectancy of <span className="text-white font-bold">-$406/trade</span>. Skipping this recovers <span className="text-emerald-400 font-bold">$1,625</span>.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: `${C.danger}10` }}>
                <span className="text-[10px]" style={{ color: C.textMuted }}>Skip simulation:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={excludeWorstPattern} onChange={(e) => setExcludeWorstPattern(e.target.checked)} className="sr-only peer" />
                  <div className="w-7 h-4 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Counterfactual Equity Curve</p>
              <div className="h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="rlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.success} stopOpacity={0.15} /><stop offset="100%" stopColor={C.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 7, fill: C.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 7, fill: C.textMuted }} axisLine={false} tickLine={false} domain={["dataMin - 200", "dataMax + 200"]} width={25} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload?.length) return (
                        <div className="px-2 py-1.5 rounded border text-[10px] font-semibold space-y-1" style={{ background: C.surface, borderColor: C.border }}>
                          <p style={{ color: C.textPrimary }}>{payload[0].payload.name}</p>
                          <p style={{ color: C.accent }}>Realized: ${payload[0].value}</p>
                          <p style={{ color: C.success }}>Counterfactual: ${payload[1]?.value}</p>
                        </div>
                      );
                      return null;
                    }} />
                    <Area type="monotone" dataKey="Realized" stroke={C.accent} strokeWidth={1} fill="url(#rlGrad)" />
                    <Area type="monotone" dataKey="Counterfactual" stroke={C.success} strokeWidth={1.5} strokeDasharray="4 4" fill="url(#cfGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: LIVE CHART ═══════════════════════════════════════════ */}
        {activeTab === "chart" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2.5">
                <BarChart2 size={15} style={{ color: C.accent }} />
                <p className="text-[12px] font-bold text-white">Select Asset</p>
              </div>
              <select value={activeAsset} onChange={(e) => setActiveAsset(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] border border-[#1C1C1C] text-white focus:outline-none cursor-pointer">
                {["BTC", "ETH", "SOL"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="rounded-2xl overflow-hidden border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-[11px] font-bold uppercase tracking-wider">{activeAsset}/USDT Live Spot Chart</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: `${C.accent}20`, color: C.accent }}>TradingView</span>
              </div>
              <div className="w-full bg-[#0D0E12]" style={{ height: "300px" }}>
                <TradingViewWidget symbol={tvSymbol} height={300} />
              </div>
            </div>

            {signals && (
              <div className="rounded-2xl p-4 space-y-3 border" style={{ background: C.panel, borderColor: C.border }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>AI Market Signals</p>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: `${C.success}20`, color: C.success }}>AI Verified</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["momentum", "institutional", "sentiment"] as const).map((key) => {
                    const val = (signals[key] || "neutral").toLowerCase();
                    const isBull = val === "bullish" || val === "bull";
                    const isBear = val === "bearish" || val === "bear";
                    const color = isBull ? C.success : isBear ? C.danger : C.textSecondary;
                    return (
                      <div key={key} className="p-2.5 rounded-xl border text-center" style={{ background: isBull ? `${C.success}10` : isBear ? `${C.danger}10` : C.surface, borderColor: isBull ? `${C.success}20` : isBear ? `${C.danger}20` : C.border }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>{key}</p>
                        <p className="text-[11px] font-bold capitalize" style={{ color }}>{signals[key]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 px-5 pb-5 pt-3 space-y-2 border-t" style={{ background: C.bg, borderColor: C.border }}>
        <button onClick={() => window.open("https://testnet.sodex.com", "_blank", "noopener,noreferrer")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border hover:opacity-95"
          style={{ background: C.accent, borderColor: C.accent, color: "#FFFFFF" }}>
          <ExternalLink size={13} />
          Open SoDEX Testnet
        </button>
        <p className="text-center text-[10px]" style={{ color: C.textMuted }}>
          Testnet Mode — Risk Engine & Performance Autopsy — DefiScope AI
        </p>
      </div>
    </div>
  );
}
