import { useQuery } from "@tanstack/react-query";
import { fetchEtfInflowHistory } from "@/lib/sosovalue-api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";

const formatCurrency = (val: number) => {
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toFixed(0)}`;
};

export default function EtfFlowChart() {
  const [etfType, setEtfType] = useState("btc");
  const { data, isLoading } = useQuery({
    queryKey: ["etfInflow", etfType],
    queryFn: () => fetchEtfInflowHistory(etfType),
    refetchInterval: 60000,
  });

  const chartData = data?.map((d) => ({
    date: d.date,
    inflow: d.dailyInflow,
    cumulative: d.totalInflow,
  })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-panel p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">ETF Flow Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Daily net inflows across spot ETFs</p>
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
        <div className="h-64 shimmer" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(213, 94%, 48%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(213, 94%, 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={formatCurrency}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "12px",
              }}
              formatter={(value: number) => [formatCurrency(value), "Daily Inflow"]}
              labelFormatter={(label) => new Date(label).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}
            />
            <Area
              type="monotone"
              dataKey="inflow"
              stroke="hsl(213, 94%, 48%)"
              strokeWidth={2}
              fill="url(#inflowGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
