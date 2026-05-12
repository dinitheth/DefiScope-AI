import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Wallet, Shield, Brain, Newspaper, BarChart3, Cpu, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet, shortenAddress } from "@/hooks/use-wallet";
import logoSrc from "@/assets/defiscope-logo.png";

const FEATURES = [
  { icon: Brain,          title: "AI Decision Engine",        desc: "Scores market conviction across BTC and ETH using live data, then gives clear BUY / HOLD / SELL direction with reasoning." },
  { icon: BarChart3,      title: "ETF Flow Intelligence",     desc: "Live spot ETF inflows, AUM, and fund-level breakdown for BTC and ETH — the institutional pulse." },
  { icon: Newspaper,      title: "News + Sentiment",          desc: "Latest crypto headlines classified by sentiment, so you know what's driving the market right now." },
  { icon: Cpu,            title: "Opportunity Discovery",     desc: "Surfaces BTC, ETH, and SOL trade opportunities ranked by momentum and flow signals." },
  { icon: MessageSquare,  title: "Tool-Calling AI Chat",      desc: "Ask anything in plain English. The AI picks the right data tools, runs them live, and explains the result." },
  { icon: Shield,         title: "Risk-Aware Analysis",       desc: "Every recommendation comes with volatility, liquidity, and sentiment risk breakdowns." },
];

const STEPS = [
  { n: "01", title: "Ask anything",     desc: "Type a question like 'Should I buy BTC?' or 'Show me ETF flows' in plain English." },
  { n: "02", title: "AI fetches data",  desc: "DefiScope calls the right SoSoValue tools — prices, ETF flows, news — and runs them in real time." },
  { n: "03", title: "Get answers",      desc: "A clear, data-driven analysis with numbers, charts, and actionable insight — not generic advice." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, connectMetaMask, error } = useWallet();

  const enterApp = () => navigate("/dashboard");

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-white overflow-x-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.2, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-[#3B82F6]/8 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -30, 20, 0], y: [0, 30, -20, 0], scale: [1, 0.9, 1.15, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-[#3B82F6]/6 blur-3xl"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Nav */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between py-5 sm:py-6"
        >
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="DefiScope" width={36} height={36} className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">DefiScope</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>Testnet</span>
          </div>
          <button
            onClick={enterApp}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-[#8B92A5] hover:text-white transition-colors"
          >
            Open app <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.header>

        {/* HERO */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-center pt-4 sm:pt-8 pb-16">
          {/* Left: pitch */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-5 sm:space-y-6 order-2 lg:order-1"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-xs font-medium text-[#3B82F6]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3B82F6]" />
              </span>
              SoSoValue Buildathon 2026
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              AI-powered{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] via-[#60A5FA] to-[#3B82F6]">
                on-chain intelligence
              </span>{" "}
              for crypto.
            </h1>

            <p className="text-base sm:text-lg text-[#8B92A5] max-w-xl leading-relaxed">
              Ask any crypto question and get instant, data-driven answers powered by live SoSoValue data — ETF flows, market signals, news sentiment, and AI-scored trade decisions.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                onClick={enterApp}
                className="h-11 px-6 rounded-xl font-medium gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              >
                Launch DefiScope <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
                className="h-11 px-6 rounded-xl font-medium border-[#1C1C1C] bg-transparent text-[#8B92A5] hover:bg-[#141414] hover:text-white"
              >
                How it works
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-xs text-[#8B92A5]">
              <span>Wallet-based, non-custodial</span>
              <span className="text-[#1C1C1C]">·</span>
              <span>Live SoSoValue API</span>
              <span className="text-[#1C1C1C]">·</span>
              <span>Persistent chat history</span>
            </div>
          </motion.div>

          {/* Right: auth */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="order-1 lg:order-2"
          >
            <div className="rounded-2xl border border-[#1C1C1C] bg-[#0F0F0F]/80 backdrop-blur p-5 sm:p-7 space-y-5">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Get Started</h2>
                <p className="text-xs sm:text-sm text-[#8B92A5]">Connect an EVM-compatible wallet to continue</p>
              </div>

              <div className="space-y-3">
                {isConnected && address ? (
                  <>
                    <div className="p-4 rounded-xl bg-[#3B82F6]/5 border border-[#3B82F6]/20 text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
                        </span>
                        <span className="text-sm font-medium text-[#3B82F6]">Wallet Connected</span>
                      </div>
                      <p className="text-xs text-[#8B92A5] font-mono">{shortenAddress(address)}</p>
                    </div>
                    <Button onClick={enterApp} className="w-full h-11 rounded-xl font-medium gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white">
                      Enter DefiScope <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={connectMetaMask}
                      disabled={isConnecting}
                      variant="outline"
                      className="w-full h-12 rounded-xl font-medium gap-3 border-[#1C1C1C] bg-transparent hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/5 text-white"
                    >
                      <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="h-6 w-6" />
                      {isConnecting ? "Connecting..." : "Connect MetaMask"}
                    </Button>
                    <p className="text-center text-[11px] text-[#6B7280]">Secure, non-custodial EVM wallet authentication</p>
                    <div className="rounded-xl border border-[#1C1C1C] bg-[#141414] px-3 py-2.5 text-[11px] text-[#6B7280] space-y-1">
                      <p className="font-medium text-[#8B92A5]">Supported wallets</p>
                      <p>MetaMask · Coinbase Wallet · Rabby · Any EVM-compatible wallet</p>
                      <p className="text-[10px] mt-1 text-[#4B5563]">Non-EVM wallets (Phantom, Solana, etc.) are not supported.</p>
                    </div>
                  </>
                )}
                {error && <p className="text-xs text-red-400 text-center p-2 rounded-lg bg-red-500/10">{error}</p>}
              </div>
            </div>

            <p className="text-center text-[10px] text-[#6B7280] mt-4">Powered by SoSoValue API · EVM chains only</p>
          </motion.div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="py-12 sm:py-16">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#3B82F6] uppercase mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              From question to live answer in seconds.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl p-5 sm:p-6 bg-[#0F0F0F] border border-[#1C1C1C]"
              >
                <p className="text-xs font-mono text-[#3B82F6] mb-2">{s.n}</p>
                <h3 className="text-base font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-[#8B92A5] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-12 sm:py-16">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#3B82F6] uppercase mb-3">What's inside</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Data → Decision → Insight.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#8B92A5] max-w-2xl mx-auto">
              An AI research assistant that ingests live SoSoValue data, runs intelligent analysis, and delivers clear, data-backed answers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-5 bg-[#0F0F0F] border border-[#1C1C1C] hover:border-[#3B82F6]/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center mb-3">
                  <f.icon className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-[#8B92A5] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SAMPLE QUESTIONS */}
        <section className="py-12 sm:py-16">
          <div className="rounded-2xl border border-[#1C1C1C] bg-gradient-to-br from-[#0F0F0F] to-[#0A0A0A] p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#3B82F6] uppercase mb-3">Try asking</p>
                <h3 className="text-xl sm:text-2xl font-bold mb-4">Real questions you can paste in.</h3>
                <div className="space-y-2">
                  {[
                    "Should I buy BTC right now with medium risk?",
                    "Show me ETF flow analysis for the last week",
                    "What are today's top opportunities?",
                    "Give me a full market briefing",
                    "Latest crypto news signals — anything bullish?",
                  ].map((q) => (
                    <div key={q} className="flex items-center gap-2.5 text-sm text-[#8B92A5]">
                      <span className="h-1 w-1 rounded-full bg-[#3B82F6] shrink-0" />
                      <span>"{q}"</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={enterApp} className="h-12 px-7 rounded-xl font-medium gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white shrink-0">
                Open DefiScope <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-[#6B7280]">
          DefiScope · Built on SoSoValue API · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
