import { motion } from "framer-motion";
import { Newspaper, ExternalLink } from "lucide-react";
import type { NewsFeedData } from "@/lib/ai-modules";

const SENT_COLOR = {
  positive: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30",
  negative: "text-destructive bg-destructive/10 border-destructive/30",
  neutral: "text-muted-foreground bg-secondary/60 border-border/50",
};

export default function NewsFeedView({ data }: { data: NewsFeedData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel p-5 ring-1 ring-primary/20"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Newspaper className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Market Intelligence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.sentiment.positive} bullish · {data.sentiment.negative} bearish · {data.sentiment.neutral} neutral
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {data.items.slice(0, 6).map((n) => {
          const sent = (n.sentiment ?? "neutral") as keyof typeof SENT_COLOR;
          return (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-xl bg-secondary/40 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${SENT_COLOR[sent]}`}>
                  {sent}
                </span>
                <span className="text-[10px] text-muted-foreground">{n.source}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
              </div>
              <h4 className="text-xs font-semibold leading-snug">{n.title}</h4>
              {n.summary && (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{n.summary}</p>
              )}
            </a>
          );
        })}
      </div>
    </motion.div>
  );
}
