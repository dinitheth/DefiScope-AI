import { motion } from "framer-motion";
import { Sparkles, Telescope } from "lucide-react";
import type { NarrativeData } from "@/lib/ai-modules";

const REGIME_STYLE: Record<NarrativeData["regime"], { label: string; color: string }> = {
  accumulation: { label: "Accumulation", color: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30" },
  distribution: { label: "Distribution", color: "text-destructive bg-destructive/10 border-destructive/30" },
  trending_up: { label: "Trending Up", color: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30" },
  trending_down: { label: "Trending Down", color: "text-destructive bg-destructive/10 border-destructive/30" },
  consolidation: { label: "Consolidation", color: "text-primary bg-primary/10 border-primary/30" },
  volatile: { label: "Volatile", color: "text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30" },
};

export default function MarketNarrativeView({ data }: { data: NarrativeData }) {
  const regime = REGIME_STYLE[data.regime];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 relative overflow-hidden ring-1 ring-primary/20 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]"
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
                <h3 className="text-sm font-semibold">Market Narrative</h3>
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">What the market is doing right now</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h4 className="text-base font-semibold leading-snug flex-1 min-w-0">{data.headline}</h4>
            <span className={`text-[10px] px-2 py-1 rounded-md font-medium border whitespace-nowrap ${regime.color}`}>
              {regime.label}
            </span>
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
        </div>
      </div>
    </motion.div>
  );
}
