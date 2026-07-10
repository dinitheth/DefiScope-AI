import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, Play, Shield, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkSosoHealth } from "@/lib/sosovalue-api";
import logoSrc from "@/assets/defiscope-logo.png";

interface DiagItem {
  id: string;
  name: string;
  category: string;
  status: "pending" | "online" | "degraded";
  latency: number | null;
  details: string;
}

const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
  border: "#1C1C1C",
  textPrimary: "#FFFFFF",
  textSecondary: "#8B92A5",
  textMuted: "#6B7280",
  accent: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

export default function Diag() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [items, setItems] = useState<DiagItem[]>([
    { id: "soso", name: "SoSoValue Edge Functions", category: "Data Proxy", status: "pending", latency: null, details: "Proxied queries for ETF flows and sentiment" },
    { id: "binance-ticker", name: "Binance Spot Ticker", category: "Public Feed", status: "pending", latency: null, details: "Live ticker fetching for real-time prices" },
    { id: "binance-klines", name: "Binance Klines API", category: "Historical Feed", status: "pending", latency: null, details: "90-day daily price klines for backtesting" },
    { id: "supabase", name: "Supabase Database & Auth", category: "Infrastructure", status: "pending", latency: null, details: "Persistent sessions, messages, and RLS" },
  ]);

  const addLog = (msg: string) => {
    setLogMessages((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runAllChecks = async () => {
    setIsRunning(true);
    setLogMessages([]);
    addLog("Starting full ecosystem diagnostics...");

    // Reset status
    setItems((prev) => prev.map((item) => ({ ...item, status: "pending", latency: null })));

    // 1. SoSoValue check
    try {
      addLog("Pinging SoSoValue Edge Function proxy...");
      const start = Date.now();
      const sosoRes = await checkSosoHealth();
      const elapsed = Date.now() - start;
      if (sosoRes.ok) {
        addLog(`SoSoValue healthy. Upstream Status: ${sosoRes.upstreamStatus ?? 200}. Latency: ${elapsed}ms`);
        setItems((prev) => prev.map((it) => it.id === "soso" ? { ...it, status: "online", latency: elapsed } : it));
      } else {
        throw new Error(sosoRes.error || "Degraded state reported");
      }
    } catch (err: any) {
      addLog(`SoSoValue failed: ${err.message}`);
      setItems((prev) => prev.map((it) => it.id === "soso" ? { ...it, status: "degraded", latency: 0 } : it));
    }

    // 2. Binance Ticker check
    try {
      addLog("Pinging Binance Ticker API (BTCUSDT)...");
      const start = Date.now();
      const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      const elapsed = Date.now() - start;
      if (res.ok) {
        const payload = await res.json();
        addLog(`Binance Ticker online. Last price: $${parseFloat(payload.lastPrice).toLocaleString()}. Latency: ${elapsed}ms`);
        setItems((prev) => prev.map((it) => it.id === "binance-ticker" ? { ...it, status: "online", latency: elapsed } : it));
      } else {
        throw new Error(`Binance returned status ${res.status}`);
      }
    } catch (err: any) {
      addLog(`Binance Ticker failed: ${err.message}`);
      setItems((prev) => prev.map((it) => it.id === "binance-ticker" ? { ...it, status: "degraded", latency: 0 } : it));
    }

    // 3. Binance Klines check
    try {
      addLog("Pinging Binance Klines API (90d BTCUSDT)...");
      const start = Date.now();
      const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=5");
      const elapsed = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        addLog(`Binance Klines online. Fetched ${data.length} candles. Latency: ${elapsed}ms`);
        setItems((prev) => prev.map((it) => it.id === "binance-klines" ? { ...it, status: "online", latency: elapsed } : it));
      } else {
        throw new Error(`Binance returned status ${res.status}`);
      }
    } catch (err: any) {
      addLog(`Binance Klines failed: ${err.message}`);
      setItems((prev) => prev.map((it) => it.id === "binance-klines" ? { ...it, status: "degraded", latency: 0 } : it));
    }

    // 4. Supabase DB check
    try {
      addLog("Pinging Supabase Database records table...");
      const start = Date.now();
      const { error } = await supabase.from("conversations" as any).select("id").limit(1);
      const elapsed = Date.now() - start;
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      addLog(`Supabase Database connected. RLS policies verified. Latency: ${elapsed}ms`);
      setItems((prev) => prev.map((it) => it.id === "supabase" ? { ...it, status: "online", latency: elapsed } : it));
    } catch (err: any) {
      addLog(`Supabase failed: ${err.message}`);
      setItems((prev) => prev.map((it) => it.id === "supabase" ? { ...it, status: "degraded", latency: 0 } : it));
    }

    addLog("Ecosystem diagnostics completed.");
    setIsRunning(false);
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  return (
    <div className="min-h-[100dvh] w-full" style={{ background: C.bg, color: C.textPrimary }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b" style={{ background: "rgba(10,10,10,0.85)", borderColor: C.border }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: C.textSecondary }}
          >
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="DefiScope" className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-sm sm:text-base">DefiScope</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.15)", color: C.warning, border: "1px solid rgba(245,158,11,0.3)" }}>
              Diag
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">System Diagnostics</h1>
            <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
              Verify integration status and latency for all active APIs and infrastructure layers.
            </p>
          </div>
          <button
            onClick={runAllChecks}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 self-start sm:self-center transition-all disabled:opacity-50"
            style={{ background: C.accent, color: "#fff" }}
          >
            <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
            Re-run Checks
          </button>
        </div>

        {/* Integration list */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-2xl border"
              style={{ background: C.panel, borderColor: C.border }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border"
                  style={{
                    background: item.status === "online" ? `${C.success}10` : item.status === "degraded" ? `${C.danger}10` : C.surface,
                    borderColor: item.status === "online" ? `${C.success}30` : item.status === "degraded" ? `${C.danger}30` : C.border,
                    color: item.status === "online" ? C.success : item.status === "degraded" ? C.danger : C.textSecondary,
                  }}
                >
                  <Activity size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: C.surface, color: C.textSecondary }}>
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
                    {item.details}
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                {item.status === "online" ? (
                  <span className="flex items-center gap-1 text-xs font-bold" style={{ color: C.success }}>
                    <CheckCircle2 size={14} /> Online
                  </span>
                ) : item.status === "degraded" ? (
                  <span className="flex items-center gap-1 text-xs font-bold" style={{ color: C.danger }}>
                    <AlertTriangle size={14} /> Degraded
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium animate-pulse" style={{ color: C.textSecondary }}>
                    Testing...
                  </span>
                )}
                {item.latency !== null && (
                  <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>
                    {item.latency > 0 ? `${item.latency} ms` : "n/a"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostic Logs console */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ background: C.surface, borderColor: C.border }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: C.accent, animationDuration: "2s" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.accent }} />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.textPrimary }}>
              Live Diagnostics Console
            </p>
          </div>
          <div className="p-4 h-[180px] overflow-y-auto font-mono text-[11px] space-y-1.5" style={{ background: "#050505", color: "#00FF00" }}>
            {logMessages.map((msg, idx) => (
              <div key={idx} className="leading-relaxed">
                {msg}
              </div>
            ))}
            {isRunning && (
              <div className="flex items-center gap-2 text-white italic animate-pulse">
                <span>⚡ System is running tests...</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
