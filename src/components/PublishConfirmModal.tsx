import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CheckCircle, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { useStrategyPublisher } from "@/hooks/use-strategy-publisher";
import type { StrategyData } from "@/hooks/use-strategy-publisher";

export interface PublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: StrategyData;
  ownerKey: string;
}

const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
  surfaceHover: "#1C1C1C",
  border: "#1C1C1C",
  textPrimary: "#FFFFFF",
  textSecondary: "#8B92A5",
  textMuted: "#6B7280",
  accent: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

function getRegimeColor(regime: string) {
  const r = regime.toLowerCase();
  if (r.includes("risk-on") || r.includes("bull")) return C.success;
  if (r.includes("risk-off") || r.includes("bear")) return C.danger;
  return C.warning;
}

export default function PublishConfirmModal({
  isOpen,
  onClose,
  strategy,
  ownerKey,
}: PublishConfirmModalProps) {
  const { publish, isPublishing, error } = useStrategyPublisher();
  const [result, setResult] = useState<{ txHash: string | null; basescanUrl: string | null; strategyId: string } | null>(null);

  const handlePublishOnChain = async () => {
    if (!ownerKey) return;
    const res = await publish(ownerKey, strategy, true);
    if (res) setResult(res);
  };

  const handleSaveLocally = async () => {
    if (!ownerKey) return;
    const res = await publish(ownerKey, strategy, false);
    if (res) setResult(res);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const regimeColor = getRegimeColor(strategy.regime);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: C.panel, border: `1px solid ${C.border}` }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: C.border }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-[10px] flex items-center justify-center"
                    style={{ background: `${C.accent}20` }}
                  >
                    <Zap size={16} style={{ color: C.accent }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: C.textPrimary }}>
                      Publish Strategy
                    </p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>
                      Base Testnet
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: C.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
                >
                  <X size={18} />
                </button>
              </div>

              {result ? (
                /* Success state */
                <div className="px-5 py-6 text-center">
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${C.success}20` }}
                  >
                    <CheckCircle size={28} style={{ color: C.success }} />
                  </div>
                  <p className="text-[16px] font-bold mb-1" style={{ color: C.textPrimary }}>
                    Strategy Published!
                  </p>
                  <p className="text-[13px] mb-5" style={{ color: C.textSecondary }}>
                    Your strategy has been saved successfully.
                  </p>

                  {result.txHash && (
                    <div
                      className="rounded-xl p-3 mb-4 text-left"
                      style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    >
                      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: C.textMuted }}>
                        Transaction Hash
                      </p>
                      <p className="text-[12px] font-mono break-all mb-2" style={{ color: C.textSecondary }}>
                        {result.txHash}
                      </p>
                      {result.basescanUrl && (
                        <a
                          href={result.basescanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                          style={{ color: C.accent }}
                        >
                          View on Basescan <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  )}

                  <p className="text-[11px]" style={{ color: C.textMuted }}>
                    Strategy ID: <span className="font-mono">{result.strategyId.slice(0, 16)}…</span>
                  </p>

                  <button
                    onClick={handleClose}
                    className="mt-5 w-full py-2.5 rounded-[14px] text-[13px] font-semibold transition-all"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Confirm state */
                <div className="px-5 py-5 space-y-4">
                  {/* Summary */}
                  <div
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px]" style={{ color: C.textMuted }}>Regime</span>
                      <span className="text-[12px] font-semibold" style={{ color: regimeColor }}>
                        {strategy.regime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px]" style={{ color: C.textMuted }}>Confidence</span>
                      <span className="text-[12px] font-semibold" style={{ color: C.textPrimary }}>
                        {strategy.confidence}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px]" style={{ color: C.textMuted }}>Allocation</span>
                      <span className="text-[12px] font-semibold" style={{ color: C.textPrimary }}>
                        {Object.entries(strategy.allocation)
                          .sort(([, a], [, b]) => b - a)
                          .map(([k, v]) => `${k} ${v}%`)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>

                  {/* Info box */}
                  <div
                    className="rounded-xl p-3.5 flex items-start gap-3"
                    style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30` }}
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
                    <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>
                      This will send a transaction on <strong style={{ color: C.accent }}>Base Sepolia</strong> with your strategy hash as proof. No real funds required — only testnet gas.
                    </p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div
                      className="rounded-xl p-3 flex items-start gap-2"
                      style={{ background: `${C.danger}10`, border: `1px solid ${C.danger}30` }}
                    >
                      <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: C.danger }} />
                      <p className="text-[12px]" style={{ color: C.danger }}>{error}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleSaveLocally}
                      disabled={isPublishing || !ownerKey}
                      className="flex-1 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        color: C.textSecondary,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.textSecondary;
                        e.currentTarget.style.color = C.textPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.color = C.textSecondary;
                      }}
                    >
                      Save Locally Only
                    </button>
                    <button
                      onClick={handlePublishOnChain}
                      disabled={isPublishing || !ownerKey}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all disabled:opacity-50"
                      style={{ background: C.accent, color: "#fff" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Publishing…
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          Publish On-Chain
                        </>
                      )}
                    </button>
                  </div>

                  {!ownerKey && (
                    <p className="text-[11px] text-center" style={{ color: C.warning }}>
                      Connect your wallet to publish strategies.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
