import { motion } from "framer-motion";
import { LineChart, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import type { MarketOverviewData } from "@/lib/ai-modules";

const fmtPrice = (v: number) => {
  if (!v || !isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1) return `$${v.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(4)}`;
};

const fmtPct = (v: number) =>
  isFinite(v) && v !== 0 ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : null;

export default function MarketOverviewView({ data }: { data: MarketOverviewData }) {
  // Determine if prices are actually available
  const hasPrices = data.coins.some((c) => c.coinPrice > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 ring-1 ring-primary/20"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <LineChart className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Market Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.coins.length} assets tracked
            {data.marketSummary.gainers > 0 && ` · ${data.marketSummary.gainers} up`}
            {data.marketSummary.losers > 0 && ` · ${data.marketSummary.losers} down`}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.coins.slice(0, 8).map((c) => {
          const pct = fmtPct(c.priceChangePercent24h);
          const up = c.priceChangePercent24h >= 0;
          return (
            <div
              key={c.coinId || c.coinSymbol}
              className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold w-14 shrink-0 text-primary">{c.coinSymbol}</span>
                <span className="text-muted-foreground truncate">{c.coinName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums text-foreground">
                  {hasPrices ? fmtPrice(c.coinPrice) : (
                    <span className="text-muted-foreground/50 text-[10px]">live data</span>
                  )}
                </span>
                {pct ? (
                  <span className={`tabular-nums font-medium flex items-center gap-0.5 ${up ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {pct}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-[10px] flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    tracked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!hasPrices && (
        <p className="text-[10px] text-muted-foreground/50 text-center mt-3">
          Live prices shown when market snapshot data is available
        </p>
      )}
    </motion.div>
  );
}
