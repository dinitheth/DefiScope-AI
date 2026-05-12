import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Minus, Sparkles, Activity, Info, Target as TargetIcon, ShieldAlert, ArrowDown, ArrowUp } from "lucide-react";
import type { DecisionData, Signal } from "@/lib/ai-modules";

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

const riskColor = (s: number) => (s >= 70 ? "text-destructive" : s >= 40 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]");
const riskLabel = (s: number) => (s >= 70 ? "High" : s >= 40 ? "Medium" : "Low");

export default function AiDecisionView({ data }: { data: DecisionData }) {
  const style = ACTION_STYLE[data.action];
  const ActionIcon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 relative overflow-hidden ring-1 ring-primary/20 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]"
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">AI Decision · {data.asset}</h3>
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {data.timeframe === "short" ? "1-7d" : data.timeframe === "medium" ? "1-4w" : "1m+"} · {data.risk} risk
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${style.bg} ${style.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`h-10 w-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center`}>
                <ActionIcon className={`h-5 w-5 ${style.text}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold tracking-tight ${style.text}`}>{data.action}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  {data.conviction} conviction · {data.suggestedTimeframe}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{data.confidence}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">confidence</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${data.confidence}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`h-full ${style.bar}`} />
          </div>
          <p className="text-xs text-foreground/90 mt-3 font-medium">{data.summary}</p>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1.5">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span><span className="font-medium">Confidence basis:</span> {data.confidenceBasis}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(data.signals) as Array<[keyof typeof data.signals, Signal]>).map(([key, val]) => (
            <div key={key} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{key}</p>
              <p className={`text-xs font-semibold mt-1 capitalize ${SIGNAL_COLOR[val]}`}>{val}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Reasoning (data-driven)</p>
          <ul className="space-y-1.5">
            {data.reasoning.map((r, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="flex gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                <span>{r}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-wider font-medium">Risk Breakdown</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ["Volatility", data.riskBreakdown.volatility],
              ["News Stability", data.riskBreakdown.newsStability],
              ["Liquidity", data.riskBreakdown.liquidity],
            ] as const).map(([label, score]) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className={`text-[10px] font-semibold ${riskColor(score)}`}>{riskLabel(score)}</p>
                </div>
                <div className="h-1 rounded-full bg-background/60 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.6 }} className={`h-full ${score >= 70 ? "bg-destructive" : score >= 40 ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <TargetIcon className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Trade Simulator</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Cell label="Entry" value={formatPrice(data.tradeSetup.entry)} />
            <Cell label="Stop Loss" value={formatPrice(data.tradeSetup.stopLoss)} icon={<ArrowDown className="h-3 w-3 text-destructive" />} />
            <Cell label="Target" value={formatPrice(data.tradeSetup.target)} icon={<ArrowUp className="h-3 w-3 text-[hsl(var(--success))]" />} />
            <Cell label="R:R" value={`1:${data.tradeSetup.riskReward}`} highlight />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Cell({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
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
