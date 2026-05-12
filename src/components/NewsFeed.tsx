import { useQuery } from "@tanstack/react-query";
import { fetchNews } from "@/lib/sosovalue-api";
import { motion } from "framer-motion";
import { Clock, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const sentimentConfig = {
  positive: { icon: TrendingUp, className: "value-positive", label: "Bullish" },
  negative: { icon: TrendingDown, className: "value-negative", label: "Bearish" },
  neutral: { icon: Minus, className: "text-muted-foreground", label: "Neutral" },
};

export default function NewsFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: fetchNews,
    refetchInterval: 120000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-panel p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Market Intelligence</h3>
        <p className="text-xs text-muted-foreground mt-0.5">AI-curated news from DefiScope</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 shimmer" />
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
          {data?.map((item, i) => {
            const sentiment = sentimentConfig[item.sentiment ?? "neutral"];
            const SentimentIcon = sentiment.icon;
            return (
              <motion.a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="block p-4 rounded-xl border border-border/50 hover:border-primary/20 hover:bg-accent/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{item.source}</span>
                      <span className="text-border">|</span>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${sentiment.className}`}>
                        <SentimentIcon className="h-3 w-3" />
                        {sentiment.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.summary}</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(item.publishedAt)}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </div>
              </motion.a>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
