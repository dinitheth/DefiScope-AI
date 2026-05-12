import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { EtfFlowsData } from "@/lib/ai-modules";

const fmt = (v: number | null | undefined) => {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "$0";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

export default function EtfFlowView({ data }: { data: EtfFlowsData }) {
  // Sanitize: replace NaN/null/undefined with 0 throughout
  const safeMetrics = (data.metrics || []).map((m) => ({
    ...m,
    totalNetAssets: isFinite(Number(m.totalNetAssets)) ? Number(m.totalNetAssets) : 0,
    dailyInflow:    isFinite(Number(m.dailyInflow))    ? Number(m.dailyInflow)    : 0,
    totalInflow:    isFinite(Number(m.totalInflow))    ? Number(m.totalInflow)    : 0,
  }));
  const safeTotals = {
    aum:         isFinite(Number(data.totals?.aum))         ? Number(data.totals.aum)         : 0,
    dailyInflow: isFinite(Number(data.totals?.dailyInflow)) ? Number(data.totals.dailyInflow) : 0,
    weeklyInflow:isFinite(Number(data.totals?.weeklyInflow))? Number(data.totals.weeklyInflow): 0,
  };
  const safeHistory = (data.history || []).map((h) => ({
    date: h.date || "",
    dailyInflow: isFinite(Number(h.dailyInflow)) ? Number(h.dailyInflow) : 0,
    totalInflow: isFinite(Number(h.totalInflow)) ? Number(h.totalInflow) : 0,
  }));
  const chartData = safeHistory.slice(-30).map((d) => ({ date: (d.date || "").slice(5), inflow: d.dailyInflow }));
  const allZero = safeTotals.aum === 0 && safeTotals.dailyInflow === 0 && safeTotals.weeklyInflow === 0 && safeMetrics.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 ring-1 ring-primary/20"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase">{data.etfType.toUpperCase()} ETF Flows</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Daily net inflows · last 30d</p>
        </div>
      </div>

      {allZero ? (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-medium">ETF flow data unavailable</p>
          <p className="text-xs text-muted-foreground/60">Live data from SoSoValue is temporarily limited.<br />Try again in a moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Total AUM" value={fmt(safeTotals.aum)} />
            <Stat label="Today" value={fmt(safeTotals.dailyInflow)} positive={safeTotals.dailyInflow >= 0} />
            <Stat label="7d" value={fmt(safeTotals.weeklyInflow)} positive={safeTotals.weeklyInflow >= 0} />
          </div>

          <div className="h-44 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="etfFlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={50} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Area type="monotone" dataKey="inflow" stroke="hsl(var(--primary))" fill="url(#etfFlowGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-1.5">
            {safeMetrics.slice(0, 5).map((m) => (
              <div key={m.etfName} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-secondary/40 border border-border/50">
                <span className="font-medium truncate">{m.etfName}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-muted-foreground tabular-nums">{fmt(m.totalNetAssets)}</span>
                  <span className={`tabular-nums font-medium ${m.dailyInflow >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                    {m.dailyInflow >= 0 ? "+" : ""}{fmt(m.dailyInflow)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? "text-foreground" : positive ? "text-[hsl(var(--success))]" : "text-destructive";
  return (
    <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}
