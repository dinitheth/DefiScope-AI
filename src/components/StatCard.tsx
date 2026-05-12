import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  delay?: number;
}

export default function StatCard({ title, value, change, icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="section-title">{title}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${change >= 0 ? "value-positive" : "value-negative"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
          </span>
          <span className="text-xs text-muted-foreground">vs previous period</span>
        </div>
      )}
    </motion.div>
  );
}
