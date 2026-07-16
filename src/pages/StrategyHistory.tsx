import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, Activity, ExternalLink,
  Plus, Clock, Database, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";

const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
  surfaceHover: "#1C1C1C",
  border: "#1C1C1C",
  textPrimary: "#FFFFFF",
  textSecondary: "#8B92A5",
  textMuted: "#6B7280",
  textDim: "#4B5563",
  accent: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

interface StrategyRecord {
  id: string;
  owner_key: string;
  strategy_hash: string;
  tx_hash: string | null;
  base_sepolia_block: number | null;
  regime: string | null;
  allocation: Record<string, number> | null;
  memo: string | null;
  reasoning: string[] | null;
  confidence: number | null;
  created_at: string;
}

function getRegimeConfig(regime: string | null) {
  if (!regime) return { label: "Unknown", color: C.textMuted, icon: Activity };
  const r = regime.toLowerCase().replace(/_/g, " ");
  if (r.includes("risk-on") || r.includes("bull") || r.includes("accumulation") ||
      r.includes("trending up") || r === "trending_up")
    return { label: "Risk-On", color: C.success, icon: TrendingUp };
  if (r.includes("risk-off") || r.includes("bear") || r.includes("distribution") ||
      r.includes("trending down") || r === "trending_down" || r.includes("volatile"))
    return { label: "Risk-Off", color: C.danger, icon: TrendingDown };
  // consolidation, mixed, neutral all map to Mixed/Warning
  return { label: regime.charAt(0).toUpperCase() + regime.slice(1).replace(/_/g, " "), color: C.warning, icon: Activity };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function StrategyCard({ record }: { record: StrategyRecord }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const regime = getRegimeConfig(record.regime);
  const RegimeIcon = regime.icon;
  const allocationEntries = record.allocation
    ? Object.entries(record.allocation).sort(([, a], [, b]) => b - a)
    : [];
  const basescanUrl = record.tx_hash
    ? `https://sepolia.basescan.org/tx/${record.tx_hash}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl overflow-hidden"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: C.border }}
      >
        <div className="flex items-center gap-2">
          <Clock size={13} style={{ color: C.textMuted }} />
          <span className="text-[12px]" style={{ color: C.textMuted }}>
            {formatDate(record.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* On-chain badge */}
          {record.tx_hash ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${C.success}20`, color: C.success }}
            >
              <Zap size={9} /> On-Chain
            </span>
          ) : (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${C.textMuted}20`, color: C.textMuted }}
            >
              <Database size={9} /> Local
            </span>
          )}
          {/* Regime badge */}
          <span
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: `${regime.color}20`, color: regime.color }}
          >
            <RegimeIcon size={10} />
            {regime.label}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-3">
        {/* Allocation summary */}
        {allocationEntries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allocationEntries.map(([asset, pct]) => (
              <span
                key={asset}
                className="px-2.5 py-1 rounded-lg text-[12px] font-medium"
                style={{ background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}
              >
                {asset} <span style={{ color: C.textPrimary }}>{pct}%</span>
              </span>
            ))}
            {record.confidence != null && (
              <span
                className="px-2.5 py-1 rounded-lg text-[12px] font-medium"
                style={{
                  background: record.confidence >= 70 ? `${C.success}15` : `${C.warning}15`,
                  color: record.confidence >= 70 ? C.success : C.warning,
                  border: `1px solid ${record.confidence >= 70 ? C.success : C.warning}30`,
                }}
              >
                {record.confidence}% confidence
              </span>
            )}
          </div>
        )}

        {/* Memo preview */}
        {record.memo && (
          <p
            className="text-[13px] leading-relaxed line-clamp-2"
            style={{ color: C.textSecondary }}
          >
            {record.memo}
          </p>
        )}

        {/* Reasoning — collapsible */}
        {record.reasoning && record.reasoning.length > 0 && (
          <div>
            <button
              onClick={() => setShowReasoning(s => !s)}
              className="flex items-center gap-1.5 text-[11px] transition-opacity opacity-60 hover:opacity-100"
              style={{ color: C.accent }}
            >
              {showReasoning ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showReasoning ? "Hide" : "Show"} AI Reasoning ({record.reasoning.length} signals)
            </button>
            <AnimatePresence>
              {showReasoning && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 space-y-1.5 overflow-hidden"
                >
                  {record.reasoning.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: C.textSecondary }}>
                      <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: C.accent }} />
                      {point}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Basescan link */}
        {basescanUrl && (
          <div className="pt-1">
            <a
              href={basescanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
              style={{ color: C.accent }}
            >
              View on Basescan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Hash (truncated) */}
        <p className="text-[10px] font-mono" style={{ color: C.textDim }}>
          {record.strategy_hash.slice(0, 20)}…
        </p>
      </div>
    </motion.div>
  );
}

export default function StrategyHistory() {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const [records, setRecords] = useState<StrategyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("strategy_records" as any)
      .select("*")
      .eq("owner_key", address)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message);
        } else {
          setRecords((data as unknown as StrategyRecord[]) ?? []);
        }
        setLoading(false);
      });
  }, [address]);

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.textPrimary }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b"
        style={{ background: C.bg, borderColor: C.border }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: C.textSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-[13px] font-semibold transition-all"
          style={{ background: C.accent, color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={14} />
          Generate New Strategy
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-10 w-10 rounded-[12px] flex items-center justify-center"
              style={{ background: `${C.accent}20` }}
            >
              <Zap size={20} style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold" style={{ color: C.textPrimary }}>
                Strategy History
              </h1>
              <p className="text-[13px]" style={{ color: C.textMuted }}>
                Your published FlowPulse strategies
              </p>
            </div>
          </div>
          {address && (
            <p className="text-[12px] mt-3 font-mono" style={{ color: C.textDim }}>
              Wallet: {address}
            </p>
          )}
        </div>

        {/* Content */}
        {!isConnected || !address ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.panel, border: `1px solid ${C.border}` }}
          >
            <Zap size={36} className="mx-auto mb-4" style={{ color: C.textDim }} />
            <p className="text-[15px] font-semibold mb-2" style={{ color: C.textPrimary }}>
              Wallet not connected
            </p>
            <p className="text-[13px]" style={{ color: C.textSecondary }}>
              Connect your MetaMask wallet to view your strategy history.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl h-32 animate-pulse"
                style={{ background: C.panel, border: `1px solid ${C.border}` }}
              />
            ))}
          </div>
        ) : fetchError ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: C.panel, border: `1px solid ${C.danger}30` }}
          >
            <p className="text-[14px] font-semibold mb-1" style={{ color: C.danger }}>
              Failed to load strategies
            </p>
            <p className="text-[13px]" style={{ color: C.textSecondary }}>
              {fetchError}
            </p>
          </div>
        ) : records.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.panel, border: `1px solid ${C.border}` }}
          >
            <Database size={36} className="mx-auto mb-4" style={{ color: C.textDim }} />
            <p className="text-[15px] font-semibold mb-2" style={{ color: C.textPrimary }}>
              No strategies yet
            </p>
            <p className="text-[13px] mb-6" style={{ color: C.textSecondary }}>
              Generate and publish your first AI strategy from the dashboard.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] text-[13px] font-semibold"
              style={{ background: C.accent, color: "#fff" }}
            >
              <Plus size={14} />
              Generate New Strategy
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[12px] mb-4" style={{ color: C.textMuted }}>
              {records.length} strateg{records.length === 1 ? "y" : "ies"} found
            </p>
            {records.map((record) => (
              <StrategyCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
