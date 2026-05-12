import { motion } from "framer-motion";
import { Compass, Zap, ArrowUpRight, ArrowDownRight, Eye } from "lucide-react";
import type { OpportunitiesData, Opportunity } from "@/lib/ai-modules";

const ACTION_ICON = { BUY: ArrowUpRight, SELL: ArrowDownRight, WATCH: Eye };
const ACTION_COLOR = {
  BUY: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30",
  SELL: "text-destructive bg-destructive/10 border-destructive/30",
  WATCH: "text-primary bg-primary/10 border-primary/30",
};
const TYPE_LABEL: Record<Opportunity["type"], string> = {
  momentum: "Momentum", reversal: "Reversal", breakout: "Breakout",
  volume_spike: "Volume Spike", sentiment_shift: "Sentiment Shift", etf_flow: "ETF Flow",
};
const scoreColor = (s: number) =>
  s >= 8 ? "text-[hsl(var(--success))]" : s >= 6 ? "text-primary" : s >= 4 ? "text-[hsl(var(--warning))]" : "text-muted-foreground";

export default function OpportunityDiscoveryView({ data }: { data: OpportunitiesData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 ring-1 ring-primary/20 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Compass className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Opportunity Discovery</h3>
            <Zap className="h-3 w-3 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">AI-ranked signals · composite score (0-10)</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.opportunities.map((op, i) => {
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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${ACTION_COLOR[op.action]}`}>{op.action}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/50 text-muted-foreground">{TYPE_LABEL[op.type]}</span>
                    <div className="ml-auto text-right">
                      <p className={`text-sm font-bold tabular-nums leading-none ${scoreColor(op.rankScore)}`}>{op.rankScore.toFixed(1)}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">rank · {op.confidence}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{op.reasoning}</p>
                  {op.drivers?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {op.drivers.map((d, di) => (
                        <span key={di} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/50 text-foreground/70">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
