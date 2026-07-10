import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Play, Shield, Activity, Sparkles, BookOpen, Terminal } from "lucide-react";
import logoSrc from "@/assets/defiscope-logo.png";
import { toast } from "@/hooks/use-toast";

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

const MOCK_WALLETS = [
  { label: "Judge Wallet A", address: "0x1111111111111111111111111111111111111111" },
  { label: "Judge Wallet B", address: "0x2222222222222222222222222222222222222222" },
];

export default function Judges() {
  const navigate = useNavigate();
  const [activeAddress, setActiveAddress] = useState<string | null>(() => {
    const saved = localStorage.getItem("ds_wallet");
    if (saved) {
      try {
        return JSON.parse(saved).address;
      } catch {
        return null;
      }
    }
    return null;
  });

  const enableGuestMode = (address: string) => {
    localStorage.setItem(
      "ds_wallet",
      JSON.stringify({ address, isConnected: true, chainId: 8453 }) // Base Mainnet chainId
    );
    setActiveAddress(address);
    toast({
      title: "Reviewer Mode Activated",
      description: `Logged in as guest address: ${address.slice(0, 6)}...${address.slice(-4)}`,
    });
    // Trigger storage event to alert other components
    window.dispatchEvent(new Event("storage"));
  };

  const clearWallet = () => {
    localStorage.removeItem("ds_wallet");
    setActiveAddress(null);
    toast({
      title: "Wallet Cleared",
      description: "Reviewer guest session has been reset.",
    });
    window.dispatchEvent(new Event("storage"));
  };

  const startTest = (query: string) => {
    if (!activeAddress) {
      // Auto-assign Wallet A if none is active to ensure RLS doesn't block the chat
      enableGuestMode(MOCK_WALLETS[0].address);
    }
    navigate(`/dashboard?query=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-[100dvh] w-full animate-fade-in" style={{ background: C.bg, color: C.textPrimary }}>
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
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: "rgba(59,130,246,0.15)", color: C.accent, border: "1px solid rgba(59,130,246,0.3)" }}>
              Judges Portal
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">60-Second Walkthrough</h1>
          <p className="text-sm mt-1.5" style={{ color: C.textSecondary }}>
            Welcome judges! This portal is built to help you review and test the entire stack instantly with zero friction.
          </p>
        </div>

        {/* 1. Reviewer Wallet Session setup */}
        <section className="p-5 rounded-2xl border space-y-4" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center" style={{ background: `${C.accent}15` }}>
              <Shield size={16} style={{ color: C.accent }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">1. Wallet Configuration (Frictionless Testing)</h2>
              <p className="text-xs" style={{ color: C.textSecondary }}>
                Setup your wallet state. No browser extensions, seed phrases, or gas are required to run the chat and backtests.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {MOCK_WALLETS.map((w) => (
              <button
                key={w.address}
                onClick={() => enableGuestMode(w.address)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2"
                style={{
                  background: activeAddress === w.address ? `${C.accent}20` : C.surface,
                  borderColor: activeAddress === w.address ? C.accent : C.border,
                  color: activeAddress === w.address ? C.accent : C.textPrimary,
                }}
              >
                <Sparkles size={12} />
                Use {w.label}
              </button>
            ))}
            {activeAddress && (
              <button
                onClick={clearWallet}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-opacity-85 transition-all text-white border"
                style={{ background: C.danger, borderColor: C.danger }}
              >
                Reset Session
              </button>
            )}
          </div>

          {activeAddress && (
            <div className="p-3.5 rounded-xl border flex items-center justify-between text-xs" style={{ background: C.surface, borderColor: C.border }}>
              <span style={{ color: C.textSecondary }}>Connected Address:</span>
              <span className="font-mono font-bold text-white">{activeAddress}</span>
            </div>
          )}
        </section>

        {/* 2. Fast-Path Testing triggers */}
        <section className="p-5 rounded-2xl border space-y-4" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center" style={{ background: `${C.warning}15` }}>
              <Play size={16} style={{ color: C.warning }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">2. Quick-Start Simulation Cards</h2>
              <p className="text-xs" style={{ color: C.textSecondary }}>
                Click any of these presets to trigger the AI-planning flow. The engine automatically calls the corresponding SoSoValue metrics and outputs rich charts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "Market Briefing",
                desc: "Fetches ETF flows, market regime, news sentiment, and allocations.",
                query: "Run a full market briefing",
              },
              {
                title: "ETF Inflow Analysis",
                desc: "Focuses strictly on BTC/ETH historical inflows and sector flows.",
                query: "ETF flow analysis for the last week",
              },
              {
                title: "Opportunity Scouring",
                desc: "Ranks top tokens using sentiment volatility and volume indicators.",
                query: "Rank market opportunities today",
              },
            ].map((p, i) => (
              <div
                key={i}
                onClick={() => startTest(p.query)}
                className="p-4 rounded-xl border cursor-pointer hover:border-blue-500 hover:scale-[1.01] transition-all flex flex-col justify-between"
                style={{ background: C.surface, borderColor: C.border }}
              >
                <div>
                  <h4 className="font-bold text-[13px] text-white">{p.title}</h4>
                  <p className="text-[11px] mt-1" style={{ color: C.textSecondary }}>{p.desc}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-semibold" style={{ color: C.accent }}>Launch Test</span>
                  <Terminal size={11} style={{ color: C.textMuted }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Deliverables Checklist */}
        <section className="p-5 rounded-2xl border space-y-4" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center" style={{ background: `${C.success}15` }}>
              <BookOpen size={16} style={{ color: C.success }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">3. What to Look For in This Wave</h2>
              <p className="text-xs" style={{ color: C.textSecondary }}>
                Check out the core Wave 3 deliverables in the split-screen dashboard:
              </p>
            </div>
          </div>

          <ul className="space-y-3 text-xs" style={{ color: C.textSecondary }}>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5" style={{ color: C.success }}>✔</span>
              <div>
                <span className="text-white font-semibold">90-Day Strategy Backtester:</span> After executing a briefing query, look inside the **FlowPulse Strategy** widget. Switch to the **Backtest tab** to see live calculations for Sharpe ratio, Max Drawdown, and Sortino Ratio, populated live from Binance.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5" style={{ color: C.success }}>✔</span>
              <div>
                <span className="text-white font-semibold">Base Sepolia Publishing:</span> Click the **"Publish to Base Testnet"** CTA button at the bottom of the strategy card to simulate storing execution parameters on-chain using MetaMask.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5" style={{ color: C.success }}>✔</span>
              <div>
                <span className="text-white font-semibold">Integrations Diagnostics:</span> Head to our live <span onClick={() => navigate("/diag")} className="text-blue-400 font-bold underline cursor-pointer">Diagnostics Page (/diag)</span> to test and verify the endpoints and latency metrics.
              </div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
