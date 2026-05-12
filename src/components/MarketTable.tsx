import { useQuery } from "@tanstack/react-query";
import { fetchCoinList } from "@/lib/sosovalue-api";
import { motion } from "framer-motion";

const formatCurrency = (val: number) => {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1) return `$${val.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${val.toFixed(4)}`;
};

export default function MarketTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["coinList"],
    queryFn: fetchCoinList,
    refetchInterval: 30000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Market Overview</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Live prices powered by DefiScope</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 shimmer" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-5 text-xs font-medium text-muted-foreground">#</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Asset</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">24h Change</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Market Cap</th>
                <th className="text-right py-2 px-5 text-xs font-medium text-muted-foreground hidden md:table-cell">Volume (24h)</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((coin, i) => (
                <tr key={coin.coinId} className="border-b border-border/30 hover:bg-accent/50 transition-colors">
                  <td className="py-3 px-5 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {coin.coinSymbol.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{coin.coinName}</p>
                        <p className="text-xs text-muted-foreground">{coin.coinSymbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-medium tabular-nums">{formatCurrency(coin.coinPrice)}</td>
                  <td className={`py-3 px-3 text-right tabular-nums font-medium ${coin.priceChangePercent24h >= 0 ? "value-positive" : "value-negative"}`}>
                    {coin.priceChangePercent24h >= 0 ? "+" : ""}{coin.priceChangePercent24h.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right text-muted-foreground tabular-nums hidden sm:table-cell">{formatCurrency(coin.marketCap)}</td>
                  <td className="py-3 px-5 text-right text-muted-foreground tabular-nums hidden md:table-cell">{formatCurrency(coin.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
