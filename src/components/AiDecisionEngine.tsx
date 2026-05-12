import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw, Activity, AlertCircle, Info, Target as TargetIcon, ShieldAlert, ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCoinList, fetchEtfMetrics, fetchNews } from "@/lib/sosovalue-api";

type Action = "BUY" | "SELL" | "HOLD";
type Signal = "bullish" | "bearish" | "neutral";

interface Decision {
  action: Action;
  confidence: number;
  confidenceBasis: string;
  conviction: "low" | "medium" | "high";
  summary: string;
  reasoning: string[];
  signals: { momentum: Signal; institutional: Signal; sentiment: Signal };
  riskBreakdown: { volatility: number; newsStability: number; liquidity: number };
  tradeSetup: { entry: number; stopLoss: number; target: number; riskReward: number };
  suggestedTimeframe: string;
}

const ACTION_STYLE = {
  BUY: { bg: "bg-[hsl(var(--success))]/15", border: "border-[hsl(var(--success))]/40", text: "text-[hsl(var(--success))]", bar: "bg-[hsl(var(--success))]", icon: TrendingUp },
  SELL: { bg: "bg-destructive/15", border: "border-destructive/40", text: "text-destructive", bar: "bg-destructive", icon: TrendingDown },
  HOLD: { bg: "bg-primary/15", border: "border-primary/40", text: "text-primary", bar: "bg-primary", icon: Minus },
};

const SIGNAL_COLOR: Record<Signal, string> = {
  bullish: "text-[hsl(var(--success))]",
  bearish: "text-destructive",
  neutral: "text-muted-foreground",
};

const formatPrice = (n: number) => {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
};

const riskColor = (score: number) =>
  score >= 70 ? "text-destructive" : score >= 40 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]";
const riskLabel = (score: number) => (score >= 70 ? "High" : score >= 40 ? "Medium" : "Low");

export default function AiDecisionEngine() {
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [timeframe, setTimeframe] = useState<"short" | "medium" | "long">("medium");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");

  const { data: decision, isLoading, isFetching, refetch, error } = useQuery<Decision>({
    queryKey: ["aiDecision", asset, timeframe, risk],
    queryFn: async () => {
      const [coins, etfs, news] = await Promise.all([
        fetchCoinList(),
        fetchEtfMetrics(asset.toLowerCase()),
        fetchNews(),
      ]);
      const coin = coins.find((c) => c.coinSymbol === asset) ?? coins[0];
      const totalDailyInflow = etfs.reduce((s, e) => s + (e.dailyInflow || 0), 0);
      const avgInflowChange = etfs.reduce((s, e) => s + (e.dailyInflowChangePercent || 0), 0) / Math.max(etfs.length, 1);
      const sentiment = news.reduce(
        (acc, n) => {
          if (n.sentiment === "positive") acc.positive++;
          else if (n.sentiment === "negative") acc.negative++;
          else acc.neutral++;
          return acc;
        },
        { positive: 0, negative: 0, neutral: 0 }
      );

      const { data, error } = await supabase.functions.invoke("ai-decision", {
        body: {
          mode: "signal",
          asset,
          timeframe,
          riskTolerance: risk,
          marketData: {
            price: coin.coinPrice,
            change24h: coin.priceChangePercent24h,
            volume24h: coin.volume24h,
            marketCap: coin.marketCap,
          },
          etfFlow: {
            dailyInflow: totalDailyInflow,
            weeklyInflow: totalDailyInflow * 5,
            inflowChangePercent: avgInflowChange,
            trend: totalDailyInflow > 0 ? "up" : totalDailyInflow < 0 ? "down" : "flat",
          },
          newsSentiment: { ...sentiment, headlines: news.slice(0, 5).map((n) => n.title) },
        },
      });
      if (error) throw error;
      return data as Decision;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const style = decision ? ACTION_STYLE[decision.action] : ACTION_STYLE.HOLD;
  const ActionIcon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 relative overflow-hidden"
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">AI Decision Engine</h3>
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Quantified signals · momentum · flows · sentiment</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 w-7 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Refresh decision"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* User input panel */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border/50">
          <ControlGroup label="Asset">
            {(["BTC", "ETH"] as const).map((a) => (
              <Pill key={a} active={asset === a} onClick={() => setAsset(a)}>{a}</Pill>
            ))}
          </ControlGroup>
          <ControlGroup label="Timeframe">
            {([
              { k: "short", l: "1-7d" },
              { k: "medium", l: "1-4w" },
              { k: "long", l: "1m+" },
            ] as const).map((t) => (
              <Pill key={t.k} active={timeframe === t.k} onClick={() => setTimeframe(t.k)}>{t.l}</Pill>
            ))}
          </ControlGroup>
          <ControlGroup label="Risk">
            {(["low", "medium", "high"] as const).map((r) => (
              <Pill key={r} active={risk === r} onClick={() => setRisk(r)}>{r === "low" ? "Low" : r === "medium" ? "Med" : "High"}</Pill>
            ))}
          </ControlGroup>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <div className="h-24 shimmer rounded-xl" />
            <div className="h-3 shimmer rounded w-3/4" />
            <div className="h-3 shimmer rounded w-1/2" />
            <p className="text-center text-xs text-muted-foreground pt-2">AI is analyzing market signals...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">AI engine unavailable</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Try refreshing in a moment.</p>
            </div>
          </div>
        ) : decision ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${asset}-${timeframe}-${risk}-${decision.action}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-3.5"
            >
              {/* Action card */}
              <div className={`p-4 rounded-xl border-2 ${style.bg} ${style.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-10 w-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center`}>
                      <ActionIcon className={`h-5 w-5 ${style.text}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold tracking-tight ${style.text}`}>{decision.action}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {decision.conviction} conviction · {decision.suggestedTimeframe}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">{decision.confidence}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">confidence</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${decision.confidence}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full ${style.bar}`}
                  />
                </div>
                <p className="text-xs text-foreground/90 mt-3 font-medium">{decision.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1.5">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  <span><span className="font-medium">Confidence basis:</span> {decision.confidenceBasis}</span>
                </p>
              </div>

              {/* Signal grid */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(decision.signals) as Array<[keyof typeof decision.signals, Signal]>).map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{key}</p>
                    <p className={`text-xs font-semibold mt-1 capitalize ${SIGNAL_COLOR[val]}`}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Reasoning */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Reasoning (data-driven)</p>
                <ul className="space-y-1.5">
                  {decision.reasoning.map((r, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex gap-2 text-xs text-muted-foreground"
                    >
                      <Activity className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Risk breakdown */}
              <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider font-medium">Risk Breakdown</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["Volatility", decision.riskBreakdown.volatility],
                    ["News Stability", decision.riskBreakdown.newsStability],
                    ["Liquidity", decision.riskBreakdown.liquidity],
                  ] as const).map(([label, score]) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className={`text-[10px] font-semibold ${riskColor(score)}`}>{riskLabel(score)}</p>
                      </div>
                      <div className="h-1 rounded-full bg-background/60 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.6 }}
                          className={`h-full ${score >= 70 ? "bg-destructive" : score >= 40 ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trade Simulator */}
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <TargetIcon className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Trade Simulator</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <SetupCell label="Entry" value={formatPrice(decision.tradeSetup.entry)} icon={null} />
                  <SetupCell label="Stop Loss" value={formatPrice(decision.tradeSetup.stopLoss)} icon={<ArrowDown className="h-3 w-3 text-destructive" />} />
                  <SetupCell label="Target" value={formatPrice(decision.tradeSetup.target)} icon={<ArrowUp className="h-3 w-3 text-[hsl(var(--success))]" />} />
                  <SetupCell label="R:R" value={`1:${decision.tradeSetup.riskReward}`} icon={null} highlight />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}

        {/* Trust strip */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5">How this works</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Combines <span className="text-foreground font-medium">SoSoValue ETF flows</span>, live <span className="text-foreground font-medium">market data</span> and <span className="text-foreground font-medium">news sentiment</span> through a multi-factor model. Confidence reflects signal alignment (momentum + institutional + sentiment).
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">{label}</p>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded-md transition-all ${
        active ? "bg-primary text-primary-foreground" : "bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SetupCell({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`text-xs font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
