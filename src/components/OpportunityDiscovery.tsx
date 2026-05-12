import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Compass, Zap, RefreshCw, ArrowUpRight, ArrowDownRight, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCoinList, fetchNews } from "@/lib/sosovalue-api";

interface Opportunity {
  symbol: string;
  type: "momentum" | "reversal" | "breakout" | "volume_spike" | "sentiment_shift" | "etf_flow";
  action: "BUY" | "SELL" | "WATCH";
  confidence: number;
  rankScore: number;
  reasoning: string;
  drivers: string[];
  timeframe: "short" | "medium" | "long";
}

const ACTION_ICON = { BUY: ArrowUpRight, SELL: ArrowDownRight, WATCH: Eye };
const ACTION_COLOR = {
  BUY: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30",
  SELL: "text-destructive bg-destructive/10 border-destructive/30",
  WATCH: "text-primary bg-primary/10 border-primary/30",
};

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  momentum: "Momentum",
  reversal: "Reversal",
  breakout: "Breakout",
  volume_spike: "Volume Spike",
  sentiment_shift: "Sentiment Shift",
  etf_flow: "ETF Flow",
};

const scoreColor = (s: number) =>
  s >= 8 ? "text-[hsl(var(--success))]" : s >= 6 ? "text-primary" : s >= 4 ? "text-[hsl(var(--warning))]" : "text-muted-foreground";

export default function OpportunityDiscovery() {
  const { data, isLoading, isFetching, refetch, error } = useQuery<{ opportunities: Opportunity[] }>({
    queryKey: ["aiOpportunities"],
    queryFn: async () => {
      const [coins, news] = await Promise.all([fetchCoinList(), fetchNews()]);
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
          mode: "opportunities",
          topCoins: coins.slice(0, 10).map((c) => ({
            symbol: c.coinSymbol,
            price: c.coinPrice,
            change24h: c.priceChangePercent24h,
            volume24h: c.volume24h,
          })),
          newsSentiment: sentiment,
        },
      });
      if (error) throw error;
      // Sort by rankScore descending
      const sorted = { ...data, opportunities: [...(data.opportunities || [])].sort((a, b) => b.rankScore - a.rankScore) };
      return sorted;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-panel p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Compass className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">Opportunity Discovery</h3>
              <Zap className="h-3 w-3 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">AI-ranked signals with composite score (0-10)</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 w-7 rounded-lg bg-secondary hover:bg-accent flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label="Refresh opportunities"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 shimmer rounded-xl" />)}
          <p className="text-center text-xs text-muted-foreground pt-2">AI is scanning the market...</p>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive text-center py-6">Unable to load opportunities. Try refreshing.</p>
      ) : (
        <div className="space-y-2">
          {data?.opportunities?.map((op, i) => {
            const Icon = ACTION_ICON[op.action];
            return (
              <motion.div
                key={`${op.symbol}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-xl bg-secondary/40 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${ACTION_COLOR[op.action]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{op.symbol}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${ACTION_COLOR[op.action]}`}>
                        {op.action}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/50 text-muted-foreground">
                        {TYPE_LABEL[op.type]}
                      </span>
                      <div className="ml-auto text-right">
                        <p className={`text-sm font-bold tabular-nums leading-none ${scoreColor(op.rankScore)}`}>{op.rankScore.toFixed(1)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">rank · {op.confidence}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{op.reasoning}</p>
                    {op.drivers?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {op.drivers.map((d, di) => (
                          <span key={di} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/50 text-foreground/70">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
