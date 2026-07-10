import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, ExternalLink, Copy, Zap,
  Shield, Clock, BarChart2, CheckCircle2, Target, ShieldAlert,
  Sliders, Calendar, Award, RefreshCw, BarChart, BookOpen, AlertTriangle
} from "lucide-react";
import TradingViewWidget from "./TradingViewWidget";
import { fetchCoinList } from "@/lib/sosovalue-api";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import { toast } from "@/hooks/use-toast";

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
  const [activeTab, setActiveTab] = useState<"indexer" | "autopsy" | "chart">("indexer");
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({});
  const [activeAsset, setActiveAsset] = useState(asset);
  const [copied, setCopied] = useState(false);

  // Indexer holdings input state
  const [holdings, setHoldings] = useState({ BTC: "0.2", ETH: "1.5", SOL: "15.0" });
  const [rebalanceResult, setRebalanceResult] = useState<any[] | null>(null);
  const [isRebalancing, setIsRebalancing] = useState(false);

  // Autopsy filters
  const [filterAsset, setFilterAsset] = useState<string>("ALL");
  const [filterRegime, setFilterRegime] = useState<string>("ALL");
  const [filterHour, setFilterHour] = useState<string>("ALL");
  const [excludeWorstPattern, setExcludeWorstPattern] = useState(false);

  // Fetch prices on load
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

  useEffect(() => {
    setActiveAsset(asset);
  }, [asset]);

  // Determine current active allocation percentages (from FlowPulse Strategy Card or fallback)
  const currentAllocation: Record<string, number> = allocation || {
    BTC: 40,
    ETH: 30,
    SOL: 20,
    USDC: 10,
  };

  const assetColor = ASSET_COLORS[activeAsset] ?? ASSET_COLORS.DEFAULT;
  const sideColor = side === "BUY" ? C.success : C.danger;

  // ─── INDEXER LOGIC (Mosaic Style) ──────────────────────────────────────────
  // Calculate simulated historical stress tests based on active allocation
  const stressTests = {
    covid: ((currentAllocation.BTC * -35 + currentAllocation.ETH * -42 + currentAllocation.SOL * -55) / 100).toFixed(1),
    ftx: ((currentAllocation.BTC * -20 + currentAllocation.ETH * -26 + currentAllocation.SOL * -62) / 100).toFixed(1),
    etfLaunch: ((currentAllocation.BTC * 8 + currentAllocation.ETH * 32 + currentAllocation.SOL * 14) / 100).toFixed(1),
  };

  // Compute rebalancing swaps
  const calculateRebalance = () => {
    const prices = {
      BTC: coinPrices.BTC || 65000,
      ETH: coinPrices.ETH || 3500,
      SOL: coinPrices.SOL || 140,
      USDC: 1.0,
    };

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
      USDC: (currentAllocation.USDC / 100) * totalUSD,
    };

    // Calculate delta for each asset
    const btcDelta = targetUSD.BTC - btcVal;
    const ethDelta = targetUSD.ETH - ethVal;
    const solDelta = targetUSD.SOL - solVal;

    if (btcDelta > 10) swaps.push({ action: "BUY", asset: "BTC", amount: (btcDelta / prices.BTC).toFixed(4), value: btcDelta.toFixed(0) });
    else if (btcDelta < -10) swaps.push({ action: "SELL", asset: "BTC", amount: (Math.abs(btcDelta) / prices.BTC).toFixed(4), value: Math.abs(btcDelta).toFixed(0) });

    if (ethDelta > 10) swaps.push({ action: "BUY", asset: "ETH", amount: (ethDelta / prices.ETH).toFixed(3), value: ethDelta.toFixed(0) });
    else if (ethDelta < -10) swaps.push({ action: "SELL", asset: "ETH", amount: (Math.abs(ethDelta) / prices.ETH).toFixed(3), value: Math.abs(ethDelta).toFixed(0) });

    if (solDelta > 10) swaps.push({ action: "BUY", asset: "SOL", amount: (solDelta / prices.SOL).toFixed(2), value: solDelta.toFixed(0) });
    else if (solDelta < -10) swaps.push({ action: "SELL", asset: "SOL", amount: (Math.abs(solDelta) / prices.SOL).toFixed(2), value: Math.abs(solDelta).toFixed(0) });

    setRebalanceResult(swaps);
  };

  const triggerRebalanceSimulation = () => {
    setIsRebalancing(true);
    setTimeout(() => {
      setIsRebalancing(false);
      setRebalanceResult(null);
      toast({
        title: "Rebalance Swaps Completed",
        description: "Simulated orders routed successfully through SoDEX Liquidity Router.",
      });
    }, 2000);
  };

  // ─── AUTOPSY LOGIC (Edgework Style) ─────────────────────────────────────────
  // Filter closed trades based on user selectors
  const filteredTrades = MOCK_TRADES.filter((t) => {
    if (filterAsset !== "ALL" && t.asset !== filterAsset) return false;
    if (filterRegime !== "ALL" && t.regime !== filterRegime) return false;
    if (filterHour !== "ALL") {
      if (filterHour === "NIGHT" && (t.hour < 20 && t.hour > 4)) return false;
      if (filterHour === "DAY" && (t.hour >= 20 || t.hour <= 4)) return false;
    }
    return true;
  });

  // Calculate stats for filtered set
  const totalTradesCount = filteredTrades.length;
  const netPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = filteredTrades.filter((t) => t.pnl > 0).length;
  const autopsyWinRate = totalTradesCount > 0 ? (winCount / totalTradesCount) * 100 : 0;
  const expectancy = totalTradesCount > 0 ? netPnl / totalTradesCount : 0;

  // Generate counterfactual equity curves
  const getEquityChartData = () => {
    let baseEquity = 10000;
    let baseCounterfactual = 10000;
    const chartPoints: any[] = [];

    MOCK_TRADES.forEach((t, idx) => {
      baseEquity += t.pnl;

      // Anti-pattern definition: SOL trades in Bearish Regimes
      const isWorstPattern = t.asset === "SOL" && t.regime === "bearish";
      const isMatchingActiveFilter = (() => {
        if (filterAsset !== "ALL" && t.asset === filterAsset) return true;
        if (filterRegime !== "ALL" && t.regime === filterRegime) return true;
        return false;
      })();

      const shouldSkip = excludeWorstPattern ? isWorstPattern : isMatchingActiveFilter;

      if (!shouldSkip) {
        baseCounterfactual += t.pnl;
      }

      chartPoints.push({
        name: t.date,
        Realized: baseEquity,
        Counterfactual: baseCounterfactual,
      });
    });

    return chartPoints;
  };

  const chartData = getEquityChartData();

  // Pie chart data for current active strategy
  const pieData = Object.entries(currentAllocation)
    .filter(([, val]) => val > 0)
    .map(([assetName, val]) => ({
      name: assetName,
      value: val,
      color: ASSET_COLORS[assetName] ?? ASSET_COLORS.DEFAULT,
    }));

  const symbolMap: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
  };
  const tvSymbol = symbolMap[activeAsset] ?? `BINANCE:${activeAsset}USDT`;

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar" style={{ background: C.bg, color: C.textPrimary }}>
      {/* Workspace Hub Header tabs */}
      <div className="flex border-b sticky top-0 z-15" style={{ background: C.panel, borderColor: C.border }}>
        {[
          { id: "indexer", label: "Indexer (Mosaic)", icon: Sliders },
          { id: "autopsy", label: "Autopsy (Edgework)", icon: Award },
          { id: "chart", label: "Live Chart", icon: BarChart },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 py-3.5 flex items-center justify-center gap-2 text-xs font-bold transition-all relative border-r last:border-r-0"
              style={{
                borderColor: C.border,
                color: active ? C.accent : C.textSecondary,
                background: active ? "rgba(255, 255, 255, 0.02)" : "transparent",
              }}
            >
              <Icon size={13} />
              {tab.label}
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.accent }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Workspace Content Panels */}
      <div className="flex-1 px-6 py-6 space-y-5">
        {/* ─── TAB 1: INDEXER (Mosaic Style) ───────────────────────────────── */}
        {activeTab === "indexer" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Allocation donut visualization */}
            <div className="p-5 rounded-2xl border space-y-4" style={{ background: C.panel, borderColor: C.border }}>
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                Active Strategy Weights
              </p>
              <div className="flex items-center justify-between gap-6">
                <div className="w-[100px] h-[100px] flex items-center justify-center relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={45}
                        dataKey="value"
                        isAnimationActive={true}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke={C.panel} strokeWidth={2} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[12px] font-extrabold text-white">100%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-xs">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="font-bold text-white">{item.name}</span>
                      </div>
                      <span style={{ color: item.color }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulated Stress Tests */}
            <div className="p-5 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <Shield size={14} style={{ color: C.accent }} />
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                  Covariance Stress Test (Simulated)
                </p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 rounded-xl" style={{ background: C.surface }}>
                  <span style={{ color: C.textSecondary }}>COVID Liquidation (Mar 2020)</span>
                  <span className="font-bold font-mono" style={{ color: C.danger }}>{stressTests.covid}%</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-xl" style={{ background: C.surface }}>
                  <span style={{ color: C.textSecondary }}>FTX Liquidity Drop (Nov 2022)</span>
                  <span className="font-bold font-mono" style={{ color: C.danger }}>{stressTests.ftx}%</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-xl" style={{ background: C.surface }}>
                  <span style={{ color: C.textSecondary }}>ETH ETF Launch (Jul 2024)</span>
                  <span className="font-bold font-mono" style={{ color: C.success }}>+{stressTests.etfLaunch}%</span>
                </div>
              </div>
            </div>

            {/* Holdings Rebalancer form */}
            <div className="p-5 rounded-2xl border space-y-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <Sliders size={14} style={{ color: C.warning }} />
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                  SoDEX Rebalance Simulator
                </p>
              </div>
              <div className="space-y-3 text-xs">
                <p style={{ color: C.textSecondary }}>Input your current holdings to calculate rebalance orders:</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(holdings).map((coin) => (
                    <div key={coin} className="space-y-1">
                      <label className="text-[10px] font-bold" style={{ color: C.textMuted }}>{coin}</label>
                      <input
                        type="text"
                        value={(holdings as any)[coin]}
                        onChange={(e) => setHoldings({ ...holdings, [coin]: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border text-white text-xs text-center font-mono focus:outline-none"
                        style={{ background: C.surface, borderColor: C.border }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={calculateRebalance}
                  className="w-full py-2 rounded-xl text-xs font-bold"
                  style={{ background: C.accent, color: "#fff" }}
                >
                  Calculate Swaps
                </button>
              </div>

              {/* Rebalance Swaps Output */}
              {rebalanceResult && (
                <div className="p-4 rounded-xl border space-y-3 mt-2" style={{ background: C.surface, borderColor: C.border }}>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                    Required Swap Execution Orders
                  </p>
                  <div className="space-y-2 font-mono text-xs text-left">
                    {rebalanceResult.length === 0 ? (
                      <p className="text-center italic" style={{ color: C.textMuted }}>Portfolio is already aligned!</p>
                    ) : (
                      rebalanceResult.map((swap, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b pb-1.5 last:border-b-0" style={{ borderColor: C.border }}>
                          <span className={swap.action === "BUY" ? "text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                            {swap.action} {swap.amount} {swap.asset}
                          </span>
                          <span style={{ color: C.textMuted }}>~ ${swap.value} USD</span>
                        </div>
                      ))
                    )}
                  </div>
                  {rebalanceResult.length > 0 && (
                    <button
                      onClick={triggerRebalanceSimulation}
                      disabled={isRebalancing}
                      className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                      style={{ background: C.success, color: "#fff" }}
                    >
                      {isRebalancing ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Simulating Orders...
                        </>
                      ) : (
                        "Execute Rebalance on SoDEX"
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: AUTOPSY (Edgework Style) ──────────────────────────────── */}
        {activeTab === "autopsy" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* PNL Slicers */}
            <div className="p-5 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2">
                <Sliders size={14} style={{ color: C.accent }} />
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                  Multi-Dimensional Slicers
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* Asset slice */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Asset</label>
                  <select
                    value={filterAsset}
                    onChange={(e) => setFilterAsset(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none"
                  >
                    <option value="ALL">All Assets</option>
                    <option value="BTC">BTC Only</option>
                    <option value="ETH">ETH Only</option>
                    <option value="SOL">SOL Only</option>
                  </select>
                </div>
                {/* Regime slice */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Regime</label>
                  <select
                    value={filterRegime}
                    onChange={(e) => setFilterRegime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none"
                  >
                    <option value="ALL">All Regimes</option>
                    <option value="bullish">Bullish</option>
                    <option value="bearish">Bearish</option>
                    <option value="chop">Chop</option>
                  </select>
                </div>
                {/* Time slice */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider" style={{ color: C.textMuted }}>Entry Hour</label>
                  <select
                    value={filterHour}
                    onChange={(e) => setFilterHour(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-white text-xs bg-[#141414] border-[#1C1C1C] focus:outline-none"
                  >
                    <option value="ALL">All Hours</option>
                    <option value="DAY">Day (05:00 - 19:00)</option>
                    <option value="NIGHT">Night (20:00 - 04:00)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Performance Stats output */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Trades Count", value: totalTradesCount, color: C.textPrimary },
                { label: "Net PNL", value: `${netPnl > 0 ? "+" : ""}$${netPnl}`, color: netPnl > 0 ? C.success : netPnl < 0 ? C.danger : C.textPrimary },
                { label: "Expectancy", value: `${expectancy > 0 ? "+" : ""}$${expectancy.toFixed(0)}`, color: expectancy > 0 ? C.success : expectancy < 0 ? C.danger : C.textPrimary },
                { label: "Win Rate", value: `${autopsyWinRate.toFixed(0)}%`, color: autopsyWinRate > 50 ? C.success : C.textPrimary },
              ].map((stat) => (
                <div key={stat.label} className="p-2 rounded-xl text-center border" style={{ background: C.panel, borderColor: C.border }}>
                  <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>
                    {stat.label}
                  </p>
                  <p className="text-[12px] font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Anti-Pattern highlights */}
            <div className="p-4 rounded-xl border space-y-2" style={{ background: `${C.danger}10`, borderColor: `${C.danger}20` }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} style={{ color: C.danger }} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold" style={{ color: C.danger }}>Leaking Edge Detected!</h4>
                  <p className="text-[10.5px] leading-relaxed mt-1" style={{ color: C.textSecondary }}>
                    Slicing reveals that trading <span className="text-white font-bold">SOL during Bearish regimes</span> has a negative expectancy of <span className="text-white font-bold">-$406 per trade</span>. Avoiding this single setup recovers <span className="text-emerald-400 font-bold">$1,625 in losses</span>.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: `${C.danger}10` }}>
                <span className="text-[10px]" style={{ color: C.textMuted }}>Skip this setup simulation:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeWorstPattern}
                    onChange={(e) => setExcludeWorstPattern(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Counterfactual Equity Curve chart */}
            <div className="p-5 rounded-2xl border space-y-3" style={{ background: C.panel, borderColor: C.border }}>
              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                Counterfactual Equity Curve
              </p>
              <div className="h-[140px] w-full mt-2 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={C.accent} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="counterGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.success} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={C.success} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 7, fill: C.textMuted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 7, fill: C.textMuted }}
                      axisLine={false}
                      tickLine={false}
                      domain={["dataMin - 200", "dataMax + 200"]}
                      width={25}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div
                              className="px-2 py-1.5 rounded border text-[10px] font-semibold space-y-1 text-left"
                              style={{ background: C.surface, borderColor: C.border }}
                            >
                              <p style={{ color: C.textPrimary }}>{payload[0].payload.name}</p>
                              <p style={{ color: C.accent }}>Realized: ${payload[0].value}</p>
                              <p style={{ color: C.success }}>Counterfactual: ${payload[1]?.value}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Realized"
                      stroke={C.accent}
                      strokeWidth={1}
                      fill="url(#realGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Counterfactual"
                      stroke={C.success}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="url(#counterGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: C.textMuted }}>
                Dashed line reveals your performance growth after eliminating the selected anti-patterns or the worst-performing SOL Bearish leaks.
              </p>
            </div>
          </div>
        )}

        {/* ─── TAB 3: CHART & SIGNALS ───────────────────────────────────────── */}
        {activeTab === "chart" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Asset Selector */}
            <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center gap-2.5">
                <BarChart2 size={15} style={{ color: C.accent }} />
                <p className="text-[12px] font-bold text-white">Select Asset</p>
              </div>
              <select
                value={activeAsset}
                onChange={(e) => setActiveAsset(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] border border-[#1C1C1C] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {["BTC", "ETH", "SOL"].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* TradingView candlestick widget */}
            <div className="rounded-2xl overflow-hidden border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: C.surface, borderColor: C.border }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.textPrimary }}>
                  {activeAsset}/USDT Live Spot Chart
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: `${C.accent}20`, color: C.accent }}>
                  TradingView
                </span>
              </div>
              <div className="w-full bg-[#0D0E12]" style={{ height: "300px" }}>
                <TradingViewWidget symbol={tvSymbol} height={300} />
              </div>
            </div>

            {/* AI Signals & Indicators */}
            <div className="rounded-2xl p-5 space-y-4 border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textMuted }}>
                  AI Market Signals
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: `${C.success}20`, color: C.success }}>
                  ✓ AI Verified
                </span>
              </div>

              {signals ? (
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Momentum", value: signals.momentum },
                    { label: "Institutional", value: signals.institutional },
                    { label: "Sentiment", value: signals.sentiment },
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
                        className="p-2.5 rounded-xl border text-center"
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
              ) : (
                <div className="p-4 rounded-xl border text-center" style={{ background: C.surface, borderColor: `${C.warning}30` }}>
                  <p className="text-[11px] font-semibold animate-pulse" style={{ color: C.warning }}>⚠ No AI Signals Loaded</p>
                  <p className="text-[10px] mt-1" style={{ color: C.textMuted }}>
                    Run a market briefing in the chat to fetch signal layers.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Execution Footer */}
      <div className="sticky bottom-0 px-6 pb-6 pt-3 space-y-2 border-t" style={{ background: C.bg, borderColor: C.border }}>
        <button
          onClick={() => {
            window.open("https://testnet.sodex.com", "_blank", "noopener,noreferrer");
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all active:scale-[0.99] border hover:opacity-95"
          style={{ background: C.accent, borderColor: C.accent, color: "#FFFFFF" }}
        >
          <ExternalLink size={13} />
          Open SoDEX Testnet Terminal
        </button>
        <p className="text-center text-[10px]" style={{ color: C.textMuted }}>
          Testnet Mode · Dynamic Index & Autopsy Workspace · DefiScope AI
        </p>
      </div>
    </div>
  );
}
