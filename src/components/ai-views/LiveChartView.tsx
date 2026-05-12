import { motion } from "framer-motion";
import { CandlestickChart } from "lucide-react";
import TradingViewWidget from "@/components/TradingViewWidget";
import type { LiveChartData } from "@/lib/ai-modules";

export default function LiveChartView({ data }: { data: LiveChartData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel overflow-hidden ring-1 ring-primary/20"
    >
      <div className="flex items-center gap-2.5 p-5 pb-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <CandlestickChart className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{data.symbol} Live Chart</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time price · TradingView</p>
        </div>
      </div>
      <div className="h-[360px]">
        <TradingViewWidget symbol={data.tvSymbol} />
      </div>
    </motion.div>
  );
}
