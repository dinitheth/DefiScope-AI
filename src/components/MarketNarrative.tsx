import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Telescope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCoinList, fetchNews, fetchEtfMetrics } from "@/lib/sosovalue-api";

interface Narrative {
  headline: string;
  narrative: string;
  regime: "accumulation" | "distribution" | "trending_up" | "trending_down" | "consolidation" | "volatile";
  keyDrivers: string[];
}

const REGIME_STYLE: Record<Narrative["regime"], { label: string; color: string }> = {
  accumulation: { label: "Accumulation", color: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30" },
  distribution: { label: "Distribution", color: "text-destructive bg-destructive/10 border-destructive/30" },
  trending_up: { label: "Trending Up", color: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30" },
  trending_down: { label: "Trending Down", color: "text-destructive bg-destructive/10 border-destructive/30" },
  consolidation: { label: "Consolidation", color: "text-primary bg-primary/10 border-primary/30" },
  volatile: { label: "Volatile", color: "text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30" },
};

export default function MarketNarrative() {
  const { data, isLoading, isFetching, refetch } = useQuery<Narrative>({
    queryKey: ["marketNarrative"],
    queryFn: async () => {
      const [coins, news, etfs] = await Promise.all([fetchCoinList(), fetchNews(), fetchEtfMetrics("btc")]);
      const sentiment = news.reduce(
        (acc, n) => {
          if (n.sentiment === "positive") acc.positive++;
          else if (n.sentiment === "negative") acc.negative++;
          else acc.neutral++;
          return acc;
        },
        { positive: 0, negative: 0, neutral: 0 }
      );
      const totalDailyInflow = etfs.reduce((s, e) => s + (e.dailyInflow || 0), 0);

      const { data, error } = await supabase.functions.invoke("ai-decision", {
        body: {
          mode: "narrative",
          topCoins: coins.slice(0, 6).map((c) => ({
            symbol: c.coinSymbol, price: c.coinPrice, change24h: c.priceChangePercent24h, volume24h: c.volume24h,
          })),
          newsSentiment: sentiment,
          etfFlow: { dailyInflow: totalDailyInflow, weeklyInflow: totalDailyInflow * 5, inflowChangePercent: 0, trend: totalDailyInflow > 0 ? "up" : "down" },
        },
      });
      if (error) throw error;
      return data as Narrative;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const regime = data ? REGIME_STYLE[data.regime] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Telescope className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold">Market Narrative Engine</h3>
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">What the market is doing right now</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 w-7 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Refresh narrative"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-5 shimmer rounded w-2/3" />
            <div className="h-3 shimmer rounded w-full" />
            <div className="h-3 shimmer rounded w-3/4" />
          </div>
        ) : data ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h4 className="text-base font-semibold leading-snug flex-1 min-w-0">{data.headline}</h4>
              {regime && (
                <span className={`text-[10px] px-2 py-1 rounded-md font-medium border whitespace-nowrap ${regime.color}`}>
                  {regime.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed italic">"{data.narrative}"</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.keyDrivers.map((d, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="text-[10px] px-2 py-1 rounded-md bg-secondary/60 border border-border/50 text-foreground/80"
                >
                  {d}
                </motion.span>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}
