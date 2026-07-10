import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Zap, ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import { useSodexTrade } from "@/hooks/use-sodex-trade";

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
  const [showReasoning, setShowReasoning] = useState(true);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestData, setBacktestData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    winRate: number;
    totalReturn: number;
  } | null>(null);

  const regimeConfig = getRegimeConfig(regime);
  const RegimeIcon = regimeConfig.icon;



  const chartData = Object.entries(allocation)
    .filter(([, pct]) => pct > 0)
    .map(([asset, pct]) => ({
      name: asset,
      value: pct,
      color: ASSET_COLORS[asset] ?? ASSET_COLORS.DEFAULT,
    }));

  useEffect(() => {
    let active = true;
    async function runBacktest() {
      setBacktestLoading(true);
      setBacktestError(null);
      try {
        const assets = Object.keys(allocation).filter(a => a !== "USDC");
        if (assets.length === 0) {
          throw new Error("No tradeable assets in allocation");
        }

        const fetchPromises = assets.map(async (symbol) => {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=90`);
          if (!res.ok) throw new Error(`Binance price fetch failed for ${symbol}`);
          const data = await res.json();
          return {
            symbol,
            prices: data.map((d: any) => ({
              time: d[0],
              close: parseFloat(d[4])
            }))
          };
        });

        const results = await Promise.all(fetchPromises);
        if (!active) return;

        const length = Math.min(...results.map(r => r.prices.length));
        if (length < 2) {
          throw new Error("Insufficient historical data found");
        }

        const simData: any[] = [];
        let prevPortfolioValue = 10000;
        let peaks = 10000;
        let maxDD = 0;
        const dailyReturns: number[] = [];
        let winDays = 0;

        for (let t = 1; t < length; t++) {
          let dayReturn = 0;
          for (const res of results) {
            const weight = (allocation[res.symbol] ?? 0) / 100;
            const pPrev = res.prices[t - 1].close;
            const pCurr = res.prices[t].close;
            const assetReturn = (pCurr - pPrev) / pPrev;
            dayReturn += weight * assetReturn;
          }

          dailyReturns.push(dayReturn);
          if (dayReturn > 0) winDays++;

          const currentVal = prevPortfolioValue * (1 + dayReturn);
          prevPortfolioValue = currentVal;

          peaks = Math.max(peaks, currentVal);
          const dd = (peaks - currentVal) / peaks;
          maxDD = Math.max(maxDD, dd);

          simData.push({
            date: new Date(results[0].prices[t].time).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            value: Math.round(currentVal),
          });
        }

        const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const stdDev = Math.sqrt(dailyReturns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length);
        const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;

        const negativeDiffs = dailyReturns.filter(x => x < 0);
        const downsideDev = negativeDiffs.length > 0
          ? Math.sqrt(negativeDiffs.map(x => Math.pow(x, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length)
          : 0;
        const sortino = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(365) : 0;

        const totalReturn = ((prevPortfolioValue - 10000) / 10000) * 100;
        const winRate = (winDays / dailyReturns.length) * 100;

        setMetrics({
          sharpe: Math.round(sharpe * 100) / 100,
          sortino: Math.round(sortino * 100) / 100,
          maxDrawdown: Math.round(maxDD * 1000) / 10,
          winRate: Math.round(winRate * 10) / 10,
          totalReturn: Math.round(totalReturn * 10) / 10,
        });

        setBacktestData(simData);
      } catch (err: any) {
        console.error("Backtest calculation failed:", err);
        setBacktestError(err.message ?? "Failed to load backtest data");
      } finally {
        setBacktestLoading(false);
      }
    }

    runBacktest();
    return () => {
      active = false;
    };
  }, [allocation]);

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

        {/* Backtest & Risk tab/section */}
        <div className="px-5 py-5 border-b" style={{ borderColor: C.border }}>
          <p className="text-[11px] uppercase tracking-wider mb-3 text-left font-semibold" style={{ color: C.textMuted }}>
            90-Day Strategy Backtest
          </p>

          {backtestLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.accent }} />
              <p className="text-[11px]" style={{ color: C.textSecondary }}>Running historical simulations...</p>
            </div>
          ) : backtestError ? (
            <div className="py-4 text-center">
              <p className="text-[12px] font-semibold" style={{ color: C.danger }}>⚠ {backtestError}</p>
            </div>
          ) : metrics ? (
            <div className="space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Tot Return", value: `${metrics.totalReturn > 0 ? "+" : ""}${metrics.totalReturn}%`, color: metrics.totalReturn > 0 ? C.success : C.danger },
                  { label: "Sharpe Ratio", value: metrics.sharpe, color: metrics.sharpe > 1.5 ? C.success : metrics.sharpe > 1.0 ? C.warning : C.textPrimary },
                  { label: "Max Drawdown", value: `${metrics.maxDrawdown}%`, color: metrics.maxDrawdown < 10 ? C.success : metrics.maxDrawdown < 20 ? C.warning : C.danger },
                  { label: "Daily Win Rate", value: `${metrics.winRate}%`, color: metrics.winRate > 50 ? C.success : C.textPrimary },
                ].map((item) => (
                  <div key={item.label} className="p-2 rounded-xl text-center border" style={{ background: C.surface, borderColor: C.border }}>
                    <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>
                      {item.label}
                    </p>
                    <p className="text-[12px] font-bold" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Equity Line Chart */}
              {backtestData.length > 0 && (
                <div className="h-[130px] w-full mt-2 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestData}>
                      <defs>
                        <linearGradient id="backtestGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={C.accent} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 8, fill: C.textMuted }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.round(backtestData.length / 4)}
                      />
                      <YAxis
                        tick={{ fontSize: 8, fill: C.textMuted }}
                        axisLine={false}
                        tickLine={false}
                        domain={["dataMin - 100", "dataMax + 100"]}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div
                                className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold"
                                style={{ background: C.surface, borderColor: C.border, color: C.textPrimary }}
                              >
                                {data.date}: ${data.value.toLocaleString()}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={C.accent}
                        strokeWidth={1.5}
                        fill="url(#backtestGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[10px] leading-relaxed" style={{ color: C.textMuted }}>
                Simulated 90-day backtest of this portfolio allocation starting at $10,000, assuming daily rebalancing. Prices retrieved live from Binance public Klines.
              </p>
            </div>
          ) : null}
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

      </motion.div>
    </>
  );
}
