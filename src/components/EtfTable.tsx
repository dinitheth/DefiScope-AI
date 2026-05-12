import { useQuery } from "@tanstack/react-query";
import { fetchEtfMetrics } from "@/lib/sosovalue-api";
import { motion } from "framer-motion";
import { useState } from "react";

const formatCurrency = (val: number) => {
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(0)}`;
};

export default function EtfTable() {
  const [etfType, setEtfType] = useState("btc");
  const { data, isLoading } = useQuery({
    queryKey: ["etfMetrics", etfType],
    queryFn: () => fetchEtfMetrics(etfType),
    refetchInterval: 60000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-panel p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">ETF Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Current metrics for spot ETFs</p>
        </div>
        <div className="flex gap-1">
          {["btc", "eth"].map((type) => (
            <button
              key={type}
              onClick={() => setEtfType(type)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                etfType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 shimmer" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-5 text-xs font-medium text-muted-foreground">Fund</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">AUM</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Total Inflow</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Daily Inflow</th>
                <th className="text-right py-2 px-5 text-xs font-medium text-muted-foreground">Price Chg</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((etf, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-accent/50 transition-colors">
                  <td className="py-2.5 px-5 font-medium text-sm">{etf.etfName}</td>
                  <td className="py-2.5 px-3 text-right text-sm tabular-nums">{formatCurrency(etf.totalNetAssets)}</td>
                  <td className={`py-2.5 px-3 text-right text-sm tabular-nums ${etf.totalInflow >= 0 ? "value-positive" : "value-negative"}`}>
                    {formatCurrency(etf.totalInflow)}
                  </td>
                  <td className={`py-2.5 px-3 text-right text-sm tabular-nums ${etf.dailyInflow >= 0 ? "value-positive" : "value-negative"}`}>
                    {formatCurrency(etf.dailyInflow)}
                  </td>
                  <td className={`py-2.5 px-5 text-right text-sm tabular-nums ${etf.priceChangePercent >= 0 ? "value-positive" : "value-negative"}`}>
                    {etf.priceChangePercent >= 0 ? "+" : ""}{etf.priceChangePercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
