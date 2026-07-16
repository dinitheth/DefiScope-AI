import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy,
  Shield, BarChart2, CheckCircle2, Target, ShieldAlert,
  Sliders, Award, RefreshCw, BarChart, AlertTriangle,
  Gauge, Crosshair, GitBranch, Zap, Info, AlertCircle,
  Database, UserCheck
} from "lucide-react";
import TradingViewWidget from "./TradingViewWidget";
import { fetchCoinList } from "@/lib/sosovalue-api";
import { useWallet } from "@/hooks/use-wallet";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import { toast } from "@/hooks/use-toast";
import {
  fetchMainnetDailyReturns,
  getDataCoverage,
  computePortfolioReturns,
  computeAllRiskMetrics,
  computeConcentration,
  computeCorrelationMatrix,
  computeRiskContributions,
  computeCompositeScore,
  generateRecommendations,
  simulateScenario,
  fetchMainnetWalletSnapshot,
  createDemoWalletSnapshot,
  buildMainnetAllocation,
  findPerformancePatterns,
  type DailyReturn,
  type RiskMetrics,
  type ConcentrationMetrics,
  type CorrelationResult,
  type RiskContribution,
  type CompositeRiskScore,
  type RiskRecommendation,
  type ScenarioResult,
  type ClosedPosition,
  type MainnetWalletSnapshot,
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
  /** A wallet explicitly requested in chat; takes precedence over the connected wallet. */
  targetAddress?: string | null;
  activeTab?: "risk" | "autopsy" | "chart";
  onTabChange?: (tab: "risk" | "autopsy" | "chart") => void;
  regime?: string;
  confidence?: number;
  side?: "BUY" | "SELL";
  asset?: string;
  size?: string;
  memo?: string;
  allocation?: Record<string, number>;
  tradeSetup?: TradeSetup;
  signals?: SodexSignals;
  opportunities?: unknown[];
}

// ─── Animated Gauge SVG ─────────────────────────────────────────────────────
function RiskGauge({ score, grade, label, color }: { score: number; grade: string; label: string; color: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius * 0.75; // 270-degree arc
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 140, height: 110 }}>
        <svg width="140" height="110" viewBox="0 0 140 110">
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
  targetAddress,
  activeTab: activeTabProp,
  onTabChange,
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
  const [localActiveTab, setLocalActiveTab] = useState<"risk" | "autopsy" | "chart">("risk");
  const activeTab = activeTabProp !== undefined ? activeTabProp : localActiveTab;
  const setActiveTab = (tab: "risk" | "autopsy" | "chart") => {
    if (onTabChange) onTabChange(tab);
    else setLocalActiveTab(tab);
  };

  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [activeAsset, setActiveAsset] = useState(asset);

  // Wallet profile is always read from SoDEX mainnet. There is no demo source.
  const { address: connectedAddress } = useWallet();
  const [dataMode, setDataMode] = useState<"live" | "demo">("live");
  const [walletInput, setWalletInput] = useState("");
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [isFetchingWallet, setIsFetchingWallet] = useState(false);
  const [walletSnapshot, setWalletSnapshot] = useState<MainnetWalletSnapshot | null>(null);
  const [walletDataError, setWalletDataError] = useState<string | null>(null);

  // Sync connected wallet to input prefill
  useEffect(() => {
    if (connectedAddress && !targetAddress) {
      if (dataMode === "live") {
        setWalletInput(connectedAddress);
        setActiveAddress(connectedAddress);
      }
    }
  }, [connectedAddress, dataMode, targetAddress]);

  useEffect(() => {
    if (dataMode === "live" && targetAddress && /^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      setWalletInput(targetAddress);
      setActiveAddress(targetAddress);
    }
  }, [dataMode, targetAddress]);

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
  const [dbTrades, setDbTrades] = useState<ClosedPosition[]>([]);

  // Autopsy filters
  const [filterAsset, setFilterAsset] = useState<string>("ALL");
  const [filterRegime, setFilterRegime] = useState<string>("ALL");
  const [filterHour, setFilterHour] = useState<string>("ALL");
  const [excludeWorstPattern, setExcludeWorstPattern] = useState(false);

  const currentAllocation = useMemo(
    () => walletSnapshot ? buildMainnetAllocation(walletSnapshot, coinPrices) : {},
    [walletSnapshot, coinPrices],
  );

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
    if (!walletSnapshot || Object.keys(currentAllocation).length === 0) {
      setDailyReturns([]);
      setRiskMetrics(null);
      setConcentration(null);
      setCorrelation(null);
      setRiskContribs([]);
      setCompositeScore(null);
      setRecommendations([]);
      setRiskLoading(false);
      return;
    }
    setRiskLoading(true);
    // Never retain a prior wallet's risk view while a new account is loading.
    setDailyReturns([]);
    setRiskMetrics(null);
    setConcentration(null);
    setCorrelation(null);
    setRiskContribs([]);
    setCompositeScore(null);
    setRecommendations([]);
    try {
      const assets = Object.keys(currentAllocation).filter((a) => currentAllocation[a] > 0 && a !== "USDC" && a !== "USDT");
      if (assets.length === 0) throw new Error("No price-risk-bearing assets were reported by SoDEX for this wallet. The account is currently stablecoin-only or contains unsupported instruments.");
      const returns = await fetchMainnetDailyReturns(assets, 90);
      if (returns.length < 5) throw new Error("SoDEX mainnet did not return enough daily candles to calculate risk metrics.");
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
      
      const recs = generateRecommendations(score, conc, metrics, corr);
      setCompositeScore(score);
      setRecommendations(recs);
    } catch (err) {
      console.error("Risk engine error:", err);
      setDailyReturns([]);
      setRiskMetrics(null);
      setConcentration(null);
      setCorrelation(null);
      setRiskContribs([]);
      setCompositeScore(null);
      setRecommendations([]);
      setWalletDataError(err instanceof Error ? err.message : "Unable to calculate risk metrics from SoDEX mainnet data.");
    } finally {
      setRiskLoading(false);
    }
  }, [walletSnapshot, currentAllocation]);

  useEffect(() => { runRiskEngine(); }, [runRiskEngine]);

  const loadMainnetWallet = useCallback(async (address: string) => {
    setIsFetchingWallet(true);
    setWalletDataError(null);
    setWalletSnapshot(null);
    setDbTrades([]);
    try {
      const snapshot = await fetchMainnetWalletSnapshot(address);
      setWalletSnapshot(snapshot);
      setDbTrades(snapshot.closedPositions);
      if (snapshot.closedPositions.length === 0 && snapshot.spotTrades.length === 0) {
        setWalletDataError("SoDEX mainnet returned no closed perpetual positions and no spot trade executions for this wallet. No performance or leak metrics are shown.");
      }
      if (snapshot.errors.length > 0) console.warn("Partial SoDEX mainnet response:", snapshot.errors);
    } catch (error) {
      setWalletDataError(error instanceof Error ? error.message : "Unable to load SoDEX mainnet account data.");
    } finally {
      setIsFetchingWallet(false);
    }
  }, []);

  useEffect(() => {
    if (dataMode === "live" && activeAddress) void loadMainnetWallet(activeAddress);
  }, [activeAddress, dataMode, loadMainnetWallet]);

  const switchDataMode = (mode: "live" | "demo") => {
    setDataMode(mode);
    setWalletDataError(null);
    if (mode === "demo") {
      const snapshot = createDemoWalletSnapshot();
      setWalletSnapshot(snapshot);
      setDbTrades(snapshot.closedPositions);
      setActiveAddress(null);
      return;
    }
    setWalletSnapshot(null);
    setDbTrades([]);
    if (connectedAddress) {
      setWalletInput(connectedAddress);
      setActiveAddress(connectedAddress);
    }
  };

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
  // ─── Handle Fetch Wallet ─────────────────────────────────────────────────
  const handleFetchWallet = () => {
    if (dataMode === "demo") return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletInput.trim())) {
      toast({ title: "Invalid Address", description: "Please enter a valid EVM address starting with 0x.", variant: "destructive" });
      return;
    }
    setActiveAddress(walletInput.trim());
  };

  // ─── Autopsy calculations ──────────────────────────────────────────────
  const trades = dbTrades;
  
  const filteredTrades = trades.filter((t) => {
    if (filterAsset !== "ALL" && t.asset !== filterAsset) return false;
    if (filterRegime !== "ALL" && t.regime !== filterRegime) return false;
    if (filterHour !== "ALL") {
      if (filterHour === "NIGHT" && (t.hour < 20 && t.hour > 4)) return false;
      if (filterHour === "DAY" && (t.hour >= 20 || t.hour <= 4)) return false;
    }
    return true;
  });

  const analysisWindowStart = Date.now() - 30 * 86_400_000;
  const trailingTrades = filteredTrades.filter((trade) => trade.closedAt >= analysisWindowStart);
  const totalTradesCount = filteredTrades.length;
  const netPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
  const trailingNetPnl = trailingTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = filteredTrades.filter((t) => t.pnl > 0).length;
  const autopsyWinRate = totalTradesCount > 0 ? (winCount / totalTradesCount) * 100 : 0;
  const expectancy = totalTradesCount > 0 ? netPnl / totalTradesCount : 0;

  const grossGains = filteredTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(filteredTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? (grossGains / grossLosses) : grossGains > 0 ? Infinity : 0;
  const volume = trailingTrades.reduce((sum, t) => sum + t.amount * t.entryPrice, 0);
  const feesPaid = filteredTrades.reduce((sum, trade) => sum + (trade.fee ?? 0), 0);
  const feeCoverage = filteredTrades.length > 0 && filteredTrades.every((trade) => trade.fee !== null);
  const patterns = findPerformancePatterns(filteredTrades);
  const worstPattern = patterns.find((pattern) => pattern.expectancy < 0);
  const bestPattern = [...patterns].reverse().find((pattern) => pattern.expectancy > 0);

  // Edge score & grade based on filtered history
  const winRateWeight = (autopsyWinRate / 100) * 40;
  const pfWeight = Math.min(2.5, profitFactor) / 2.5 * 40;
  const pnlWeight = Math.max(-20, Math.min(20, netPnl / 1000));
  const scoreEligible = totalTradesCount >= 30;
  const evidenceAdjustment = Math.min(1, Math.sqrt(totalTradesCount / 100));
  const edgeScore = scoreEligible ? Math.round(Math.max(0, Math.min(100, (winRateWeight + pfWeight + pnlWeight + 20) * evidenceAdjustment))) : 0;
  const edgeGrade = !scoreEligible ? "Insufficient evidence" : edgeScore >= 85 ? "Elite Edge" : edgeScore >= 65 ? "Consistent Edge" : edgeScore >= 45 ? "Neutral Edge" : "Bleeding Edge";
  const coverage = walletSnapshot ? getDataCoverage(walletSnapshot) : null;

  const getEquityChartData = () => {
    let baseEquity = 0;
    let baseCounterfactual = 0;
    const chartPoints: { name: string; Realized: number; Counterfactual: number }[] = [];
    trades.forEach((t) => {
      baseEquity += t.pnl;
      const timeBucket = t.hour >= 20 || t.hour < 5 ? "UTC night" : "UTC day";
      const isWorstPattern = worstPattern?.label === `${t.asset} ${t.side} · ${timeBucket}`;
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
    <div className="h-full min-h-0 flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar" style={{ background: C.bg, color: C.textPrimary }}>
      {/* Tabs */}
      <div className="sticky top-0 z-20 shrink-0 flex border-b" style={{ background: C.panel, borderColor: C.border }}>
        {([
          { id: "risk", label: "Risk Engine", icon: Gauge },
          { id: "autopsy", label: "Autopsy", icon: Award },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

      {/* Wallet Target Control Panel */}
      <div className="sticky top-[52px] z-10 shrink-0 px-5 pt-4 pb-2 border-b space-y-3 overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserCheck size={14} style={{ color: C.accent }} />
            <span className="truncate text-xs font-bold text-white">SoDEX Mainnet Profile</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: C.surface }}>
            <button onClick={() => switchDataMode("live")} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: dataMode === "live" ? `${C.success}20` : "transparent", color: dataMode === "live" ? C.success : C.textMuted }}>LIVE</button>
            <button onClick={() => switchDataMode("demo")} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: dataMode === "demo" ? `${C.warning}20` : "transparent", color: dataMode === "demo" ? C.warning : C.textMuted }}>DEMO</button>
          </div>
        </div>

        <div className="flex min-w-0 gap-2">
          <input
            type="text"
            placeholder="Paste the SoDEX mainnet wallet address (0x...)"
            value={walletInput}
            disabled={dataMode === "demo"}
            onChange={(e) => setWalletInput(e.target.value)}
            className="min-w-0 flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono focus:outline-none transition-all disabled:opacity-50 text-white"
            style={{ background: C.surface, borderColor: C.border }}
          />
          <button
            onClick={handleFetchWallet}
            disabled={isFetchingWallet || dataMode === "demo"}
            className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all text-white"
            style={{ background: C.accent }}
          >
            {isFetchingWallet ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
            FETCH
          </button>
        </div>
        <p className="text-[10px]" style={{ color: C.textMuted }}>
          {dataMode === "demo" ? "Demo profile — fixture data for workspace exploration only." : activeAddress ? <>Loaded Profile: <span className="font-mono text-white font-semibold">{activeAddress.slice(0, 12)}...{activeAddress.slice(-8)}</span></> : "Connect or enter a wallet to load mainnet data."}
          {walletSnapshot && <span className="ml-2">· {walletSnapshot.closedPositions.filter((trade) => trade.market === "perps").length} closed perps · {walletSnapshot.spotTrades.length} spot executions · {walletSnapshot.closedPositions.filter((trade) => trade.market === "spot").length} FIFO-matched spot lots · refreshed {new Date(walletSnapshot.fetchedAt).toLocaleTimeString()}</span>}
        </p>
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
            ) : walletDataError || !walletSnapshot ? (
              <div className="p-5 rounded-2xl border space-y-2" style={{ background: C.panel, borderColor: `${C.warning}40` }}>
                <AlertTriangle size={16} style={{ color: C.warning }} />
                <p className="text-xs font-bold" style={{ color: C.textPrimary }}>No verified portfolio risk calculation is available.</p>
                <p className="text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
                  {walletDataError || "Load a SoDEX mainnet wallet to calculate risk from reported balances, positions, and mainnet candles."}
                </p>
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
                    <div className="space-y-1">
                      <div className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(3, 1fr)" }}>
                        <div />
                        {["BTC", "ETH", "SOL"].map((a) => (
                          <div key={a} className="text-center text-[9px] font-bold" style={{ color: ASSET_COLORS[a] }}>{a}</div>
                        ))}
                      </div>
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
                      Avg correlation: <span className="font-bold font-mono" style={{ color: correlation.avgAbsCorrelation > 0.7 ? C.danger : C.textSecondary }}>{(correlation.avgAbsCorrelation * 100).toFixed(0)}%</span>
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
                        <div className="flex justify-between"><span style={{ color: C.textMuted }}>HHI Index</span><span className="font-bold font-mono text-white">{concentration.hhi}</span></div>
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
                  <button onClick={runScenario} disabled={Object.keys(currentAllocation).length === 0} className="w-full py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{ background: C.accent, color: "#fff" }}>
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
                          <p className="text-[8px] uppercase" style={{ color: C.textMuted }}>Stressed Risk Score</p>
                          <p className="text-[14px] font-black font-mono" style={{ color: scenarioResult.newRiskScore > 65 ? C.danger : scenarioResult.newRiskScore > 45 ? C.warning : C.success }}>
                            {scenarioResult.newRiskScore}/100
                          </p>
                        </div>
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
                          <p className="text-[10.5px] leading-relaxed text-left" style={{ color: C.textSecondary }}>
                            {rec.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 rounded-2xl border space-y-2" style={{ background: C.panel, borderColor: C.border }}>
                  <div className="flex items-center gap-2">
                    <Shield size={14} style={{ color: C.success }} />
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Data Integrity</p>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
                    This workspace is read-only. It does not simulate trades or create orders; every displayed balance, position, PnL, and risk measure is derived from the loaded SoDEX mainnet account and market data.
                  </p>
                  {coverage && <div className="pt-2 border-t text-[10px] space-y-1" style={{ borderColor: C.border, color: C.textMuted }}>
                    <p><span className="font-bold text-white">Coverage: </span>{coverage.completeness.toUpperCase()} · {coverage.perpsClosedPositions} perps closures · {coverage.perpsExecutions} perps executions · {coverage.spotExecutions} spot executions · {coverage.matchedSpotLots} matched spot lots · {coverage.openOrders} order records.</p>
                    <p>{coverage.note}</p>
                  </div>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ TAB: AUTOPSY ═══════════════════════════════════════════════ */}
        {activeTab === "autopsy" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Trader performance scorecard */}
            <div className="p-5 rounded-2xl border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={14} style={{ color: C.accent }} />
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Performance Audit Profile</span>
              </div>

              {/* Edge Score Circular Meter */}
              <div className="flex flex-col items-center gap-2 mb-5">
                <div className="relative flex items-center justify-center w-28 h-28">
                  <svg className="w-28 h-28 transform -rotate-90">
                    <circle cx="56" cy="56" r="48" fill="none" stroke={C.border} strokeWidth="8" />
                    <motion.circle
                      cx="56" cy="56" r="48" fill="none"
                      stroke={edgeScore >= 85 ? C.success : edgeScore >= 65 ? C.warning : C.danger}
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 48}
                      initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 48 - (edgeScore / 100) * 2 * Math.PI * 48 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{edgeScore}</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Edge score</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: edgeScore >= 85 ? `${C.success}20` : edgeScore >= 65 ? `${C.warning}20` : `${C.danger}20`,
                      color: edgeScore >= 85 ? C.success : edgeScore >= 65 ? C.warning : C.danger
                    }}>
                    {edgeGrade}
                  </span>
                </div>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-3 text-xs mt-3">
                <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ background: C.surface, borderColor: C.border }}>
                  <span style={{ color: C.textMuted }}>30D Volume</span>
                  <span className="text-[15px] font-black text-white font-mono mt-1">${(volume / 1000000).toFixed(2)}M</span>
                </div>
                <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ background: C.surface, borderColor: C.border }}>
                  <span style={{ color: C.textMuted }}>Verified 30D PNL</span>
                  <span className="text-[15px] font-black font-mono mt-1" style={{ color: netPnl >= 0 ? C.success : C.danger }}>
                    {trailingNetPnl >= 0 ? "+" : ""}${trailingNetPnl.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ background: C.surface, borderColor: C.border }}>
                  <span style={{ color: C.textMuted }}>Profit Factor</span>
                  <span className="text-[15px] font-black text-white font-mono mt-1">{Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "Not measurable"}</span>
                </div>
                <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ background: C.surface, borderColor: C.border }}>
                  <span style={{ color: C.textMuted }}>Win Rate</span>
                  <span className="text-[15px] font-black text-white font-mono mt-1">{autopsyWinRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Slicers */}
            <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <Sliders size={14} style={{ color: C.accent }} />
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Trade Slicers Filter</p>
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
                  <p className="text-[12px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Performance Leak Diagnostics */}
            <div className="p-4 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <AlertCircle size={14} style={{ color: C.danger }} />
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>Leaky Setup Diagnostics</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 rounded-xl border" style={{ background: `${C.danger}05`, borderColor: `${C.danger}15` }}>
                  <span style={{ color: C.textMuted }}>Biggest Leak</span>
                  <span className="font-bold text-rose-500">{worstPattern ? `${worstPattern.label} ($${worstPattern.expectancy.toFixed(2)} / trade)` : "Insufficient verified realized-history"}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl border" style={{ background: `${C.success}05`, borderColor: `${C.success}15` }}>
                  <span style={{ color: C.textMuted }}>Best Edge</span>
                  <span className="font-bold text-emerald-400">{bestPattern ? `${bestPattern.label} (+$${bestPattern.expectancy.toFixed(2)} / trade)` : "Insufficient verified realized-history"}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl border" style={{ background: C.surface, borderColor: C.border }}>
                  <span style={{ color: C.textMuted }}>Reported Exchange Fees</span>
                  <span className="font-bold font-mono text-white">{feeCoverage ? `-$${feesPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Not reported by source"}</span>
                </div>
              </div>
            </div>

            {/* Skipped performance anti-pattern alert */}
            <div className="p-3 rounded-xl border space-y-2" style={{ background: `${C.danger}10`, borderColor: `${C.danger}20` }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} style={{ color: C.danger }} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold" style={{ color: C.danger }}>Performance Leak Exclusions</h4>
                  <p className="text-[10px] leading-relaxed mt-1" style={{ color: C.textSecondary }}>
                    {worstPattern ? `Counterfactual analysis excludes the observed ${worstPattern.label} setup; it is based only on verified perps closures and FIFO-matched spot disposal lots.` : "A counterfactual is unavailable until the mainnet account has at least two comparable verified realized lots."}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: `${C.danger}10` }}>
                <span className="text-[10px]" style={{ color: C.textMuted }}>Exclude largest observed loss setup:</span>
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
              <p className="text-[9px]" style={{ color: C.textMuted }}>
                Dashed line simulates overall growth after skipping identified performance leak setups.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="sticky bottom-0 px-5 pb-5 pt-3 space-y-2 border-t" style={{ background: C.bg, borderColor: C.border }}>
        <button onClick={() => window.open("https://sodex.com", "_blank", "noopener,noreferrer")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border hover:opacity-95"
          style={{ background: C.accent, borderColor: C.accent, color: "#FFFFFF" }}>
          <ExternalLink size={13} />
          Open SoDEX Mainnet
        </button>
        <p className="text-center text-[10px]" style={{ color: C.textMuted }}>
          Mainnet read-only mode · Risk Engine & Performance Autopsy · DefiScope AI
        </p>
      </div>
    </div>
  );
}
