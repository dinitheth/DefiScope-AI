import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Wallet, BarChart3, Brain, Newspaper, Cpu, Info } from "lucide-react";
import logoSrc from "@/assets/defiscope-logo.png";

const STEPS = [
  {
    icon: Wallet,
    title: "1. Connect your wallet",
    body: "Click Connect (top right). MetaMask is recommended. Your wallet address becomes your identity — every conversation is scoped to your wallet via row-level security. No private keys are ever shared.",
  },
  {
    icon: MessageSquare,
    title: "2. Ask a question in plain English",
    body: "Type any market question into the chat. Try: 'Should I buy BTC right now?', 'Run a full market briefing', 'ETF flow analysis for the last week', or 'Latest crypto news'. The AI understands natural language — no commands needed.",
  },
  {
    icon: Cpu,
    title: "3. Watch the AI fetch live data",
    body: "DefiScope automatically picks the right SoSoValue data tools for your question — ETF flows, market narrative, trade decision, news, opportunities, or live charts. You can see each tool running in real time as animated status badges.",
  },
  {
    icon: Brain,
    title: "4. Get a data-driven answer",
    body: "Once the tools complete, the AI synthesizes a clear, analytical response that references real numbers. You'll see rich inline visualizations — decision cards, flow charts, news feeds, candlestick charts — alongside the explanation.",
  },
  {
    icon: BarChart3,
    title: "5. Explore specific modules",
    body: "Ask for focused analysis: 'AI decision for ETH with low risk', 'BTC ETF flows', 'top opportunities today', or 'live SOL chart'. Each module surfaces a different layer of market intelligence from SoSoValue.",
  },
  {
    icon: Newspaper,
    title: "6. Read, iterate, continue",
    body: "Your full conversation history is saved per wallet. Ask follow-up questions, start a new chat anytime, or pick up a previous conversation from the sidebar. All history persists across sessions.",
  },
];

const TIPS = [
  "All data is fetched live from the SoSoValue API — answers reflect real-time market conditions.",
  "Conversations persist per wallet address. Switch wallets to switch data scope.",
  "Tool calls are visible as animated step badges — you can see exactly what data was pulled.",
  "The AI uses a two-phase approach: first it plans which tools to call, then synthesizes a response using the results.",
];

export default function HowToUse() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] w-full" style={{ background: "#0A0A0A", color: "#FFFFFF" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b" style={{ background: "rgba(10,10,10,0.85)", borderColor: "#1C1C1C" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "#8B92A5" }}
          >
            <ArrowLeft size={16} /> Back to chat
          </button>
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="DefiScope" className="h-7 w-7" />
            <span className="font-semibold tracking-tight text-sm sm:text-base">DefiScope</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
              Testnet
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">How to use DefiScope</h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "#8B92A5" }}>
            DefiScope is an <span className="text-white font-medium">AI-powered on-chain intelligence</span> platform. Ask any crypto question in plain English — the AI fetches live SoSoValue data, analyses it through specialized engines, and delivers a clear, data-backed answer with rich visualizations.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="flex gap-4 p-5 rounded-2xl"
                style={{ background: "#0F0F0F", border: "1px solid #1C1C1C" }}
              >
                <div
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] mb-1.5">{s.title}</h3>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "#8B92A5" }}>{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 p-5 rounded-2xl" style={{ background: "#0F0F0F", border: "1px solid #1C1C1C" }}>
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} style={{ color: "#3B82F6" }} />
            <h3 className="font-semibold text-[15px]">Good to know</h3>
          </div>
          <ul className="space-y-2">
            {TIPS.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "#8B92A5" }}>
                <span style={{ color: "#3B82F6" }}>•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: "#3B82F6", color: "#FFFFFF" }}
          >
            Open the chat
          </button>
        </div>
      </main>
    </div>
  );
}
