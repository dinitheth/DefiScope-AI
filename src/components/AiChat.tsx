import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Check, Wrench, Plus, MessageSquare, Trash2, Menu, X, ArrowUp, Wallet, LogOut, ChevronDown, RefreshCw, Bot, BarChart2, Columns2,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import logoSrc from "@/assets/defiscope-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWallet, shortenAddress } from "@/hooks/use-wallet";
import {
  getMarketNarrative, getAIDecision, getOpportunities, getEtfFlows,
  getMarketOverview, getNewsData, getLiveChart,
  type NarrativeData, type DecisionData, type OpportunitiesData,
  type EtfFlowsData, type MarketOverviewData, type NewsFeedData, type LiveChartData,
} from "@/lib/ai-modules";
import MarketNarrativeView from "./ai-views/MarketNarrativeView";
import AiDecisionView from "./ai-views/AiDecisionView";
import OpportunityDiscoveryView from "./ai-views/OpportunityDiscoveryView";
import EtfFlowView from "./ai-views/EtfFlowView";
import MarketOverviewView from "./ai-views/MarketOverviewView";
import NewsFeedView from "./ai-views/NewsFeedView";
import LiveChartView from "./ai-views/LiveChartView";
import AgentRecommendationView, { type AgentRecommendationData, type AgentSignal } from "./ai-views/AgentRecommendationView";
import SodexTradeWidget, { type SodexTradeResult } from "./ai-views/SodexTradeWidget";
import FlowPulseStrategyCard from "./ai-views/FlowPulseStrategyCard";
import ToolCarousel from "./ai-views/ToolCarousel";

import Typewriter from "./ai-views/Typewriter";
import { useChatHistory } from "@/hooks/use-chat-history";
import {
  checkSosoHealth,
  isSosoProviderUnavailable,
  PROVIDER_UNAVAILABLE_MESSAGE,
} from "@/lib/sosovalue-api";

type ToolName =
  | "get_market_narrative" | "get_ai_decision" | "get_opportunities"
  | "get_etf_flows" | "get_market_overview" | "get_news" | "get_live_chart";

type ToolStatus = "pending" | "running" | "done" | "error";
type ToolResult =
  | NarrativeData | DecisionData | OpportunitiesData | EtfFlowsData
  | MarketOverviewData | NewsFeedData | LiveChartData;

interface ToolStep {
  name: ToolName;
  label: string;
  status: ToolStatus;
  args?: Record<string, unknown>;
  result?: ToolResult;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: ToolStep[];
  ts?: number;
  animate?: boolean;
  retryText?: string;
}



const TOOL_LABEL: Record<ToolName, string> = {
  get_market_narrative: "Market Narrative Engine",
  get_ai_decision: "AI Decision Engine",
  get_opportunities: "Opportunity Discovery",
  get_etf_flows: "ETF Flow Analysis",
  get_market_overview: "Market Overview",
  get_news: "News Intelligence",
  get_live_chart: "Live Chart",
};

const SUGGESTIONS_CHAT = [
  "Run a full market briefing",
  "ETF flow analysis for the last week",
  "Should I buy BTC right now?",
  "Show me today's top opportunities",
  "Latest crypto news with sentiment",
  "Live BTC chart",
];


function isProviderUnavailableText(value?: string) {
  if (!value) return false;
  const v = value.toLowerCase();
  return v.includes(PROVIDER_UNAVAILABLE_MESSAGE) || v.includes("live data is taking a short break");
}

// Brand color tokens
const C = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  surface: "#141414",
  surfaceHover: "#1C1C1C",
  border: "#1C1C1C",
  borderHover: "#232323",
  textPrimary: "#FFFFFF",
  textSecondary: "#8B92A5",
  textMuted: "#6B7280",
  textDim: "#4B5563",
  accent: "#3B82F6",
  accentHover: "#2563EB",
  success: "#10B981",
};

function formatTime(ts?: number) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

export default function AiChat() {
  const history = useChatHistory();
  const isMobile = useIsMobile();
  const wallet = useWallet();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sodexPanelOpen, setSodexPanelOpen] = useState(false);
  const [now, setNow] = useState(() => formatTime());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // Sidebar default for mobile
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(formatTime()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Auto-open SoDEX side panel when a full market briefing completes
  useEffect(() => {
    if (isMobile) return; // don't split on mobile
    const latestAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (!latestAssistant?.steps) return;
    const narrativeDone = latestAssistant.steps.some(
      s => s.name === "get_market_narrative" && s.status === "done" && s.result
    );
    const allSettled = latestAssistant.steps.every(
      s => s.status === "done" || s.status === "error"
    );
    if (narrativeDone && allSettled && !sodexPanelOpen) {
      setSodexPanelOpen(true);
    }
  }, [messages, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`;
  }, [input]);

  const startNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);


  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    if (isMobile) setSidebarOpen(false);
    const stored = await history.loadMessages(id);
    setMessages(
      stored.map((m) => ({
        id: m.id, role: m.role, content: m.content,
        steps: (m.steps as ToolStep[] | null) ?? undefined,
      }))
    );
  }, [history, isMobile]);

  async function runTool(step: ToolStep): Promise<ToolStep> {
    try {
      const a = (step.args || {}) as Record<string, string>;
      let result: ToolResult | undefined;
      switch (step.name) {
        case "get_market_narrative": result = await getMarketNarrative(); break;
        case "get_opportunities":   result = await getOpportunities(); break;
        case "get_ai_decision":     result = await getAIDecision(
          (a.asset as "BTC" | "ETH") || "BTC",
          (a.timeframe as "short" | "medium" | "long") || "medium",
          (a.risk as "low" | "medium" | "high") || "medium",
        ); break;
        case "get_etf_flows":       result = await getEtfFlows((a.etfType as "btc" | "eth") || "btc"); break;
        case "get_market_overview": result = await getMarketOverview(); break;
        case "get_news":            result = await getNewsData(); break;
        case "get_live_chart":      result = await getLiveChart(a.symbol || "BTC"); break;
      }
      return { ...step, status: "done", result };
    } catch (e) {
      return {
        ...step,
        status: "error",
        error: isSosoProviderUnavailable(e) ? PROVIDER_UNAVAILABLE_MESSAGE : e instanceof Error ? e.message : "Unable to load data",
      };
    }
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");

    let convoId = activeId;
    if (!convoId) {
      const newId = await history.createConversation(text.slice(0, 60));
      if (!newId) {
        // Check browser console for the actual Supabase error (RLS policy, network, etc.)
        toast({
          title: "Couldn't create chat",
          description: "Database error — check browser console (F12) for details. You may need to run the RLS fix SQL in Supabase.",
          variant: "destructive",
        });

        setBusy(false);
        return;
      }
      convoId = newId;
      setActiveId(newId);
    }

    const ts = Date.now();
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text, ts };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", steps: [], ts: ts + 1 };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    history.saveMessage(convoId, "user", text).catch(() => {});


    try {
      // Build conversation context (exclude the empty assistant placeholder)
      const convo = messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      convo.push({ role: "user", content: text });

      // PHASE 1: ask AI which tools to call
      const planRes = await supabase.functions.invoke("ai-chat", {
        body: { phase: "plan", messages: convo },
      });
      if (planRes.error) throw planRes.error;
      if (planRes.data?.error) throw new Error(planRes.data.error);

      const plan: Array<{ name: ToolName; args: Record<string, unknown> }> = planRes.data?.tools || [];
      const steps: ToolStep[] = plan.map((p) => ({
        name: p.name,
        label: TOOL_LABEL[p.name] || p.name,
        status: "pending",
        args: p.args,
      }));

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, steps } : m))
      );

      if (steps.length > 0) {
        const health = await checkSosoHealth();
        if (!health.ok) {
          const unavailableSteps = steps.map((s) => ({ ...s, status: "error" as const, error: PROVIDER_UNAVAILABLE_MESSAGE }));
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? {
              ...m,
              steps: unavailableSteps,
              content: PROVIDER_UNAVAILABLE_MESSAGE,
              animate: true,
              retryText: text,
            } : m))
          );
          history.saveMessage(convoId, "assistant", PROVIDER_UNAVAILABLE_MESSAGE, unavailableSteps).catch(() => {});
          return;
        }
      }

      // Run each tool sequentially with visible status updates
      for (let i = 0; i < steps.length; i++) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const next = [...(m.steps || [])];
            next[i] = { ...next[i], status: "running" };
            return { ...m, steps: next };
          })
        );
        const finished = await runTool(steps[i]);
        steps[i] = finished;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const next = [...(m.steps || [])];
            next[i] = finished;
            return { ...m, steps: next };
          })
        );
      }

      const allProviderUnavailable = steps.length > 0 && steps.every((s) =>
        s.status === "error" && isProviderUnavailableText(s.error)
      );
      if (allProviderUnavailable) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? {
            ...m,
            content: PROVIDER_UNAVAILABLE_MESSAGE,
            animate: true,
            retryText: text,
          } : m))
        );
        history.saveMessage(convoId, "assistant", PROVIDER_UNAVAILABLE_MESSAGE, steps).catch(() => {});
        return;
      }

      // PHASE 2: synthesize an analytical reply quoting real numbers
      let reply = "";
      if (steps.length === 0) {
        // No tools called (greeting etc) — use a quick second pass with no results
        const synthRes = await supabase.functions.invoke("ai-chat", {
          body: { phase: "synthesize", messages: convo, toolResults: [] },
        });
        if (synthRes.error) throw synthRes.error;
        if (synthRes.data?.error) throw new Error(synthRes.data.error);
        reply = synthRes.data?.reply || "";
      } else {
        const synthRes = await supabase.functions.invoke("ai-chat", {
          body: {
            phase: "synthesize",
            messages: convo,
            toolResults: steps.map((s) => ({
              name: s.name, args: s.args, result: s.result, error: s.error,
            })),
          },
        });
        if (synthRes.error) throw synthRes.error;
        if (synthRes.data?.error) throw new Error(synthRes.data.error);
        reply = synthRes.data?.reply || "";
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: reply, animate: true } : m))
      );

      const stepsForStorage = steps.map((s) => ({
        name: s.name, label: s.label, status: s.status, args: s.args, result: s.result, error: s.error,
      }));
      history.saveMessage(convoId, "assistant", reply, stepsForStorage).catch(() => {});
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong";
      const friendly = isSosoProviderUnavailable(e)
        ? "Live data is taking a short break. Please try again in a moment."
        : "We couldn't complete that request just now. Please try again.";
      toast({ title: "Live data paused", description: friendly });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: friendly, animate: true, retryText: text } : m))
      );
      // Surface raw cause to console for debugging without showing it to the user
      console.warn("[AiChat] send failed:", raw);
    } finally {
      setBusy(false);
    }
  }

  // Retry: drop the trailing failed assistant (and its user prompt) so a retry
  // doesn't render two DefiScope AI bubbles for what looks like one question.
  function handleRetry(text: string) {
    setMessages((prev) => {
      const next = [...prev];
      // Pop trailing assistant if it's the failed one with this retryText
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant" && next[i].retryText === text) {
          next.splice(i, 1);
          // Also pop the immediately preceding user message with the same text
          if (i - 1 >= 0 && next[i - 1].role === "user" && next[i - 1].content === text) {
            next.splice(i - 1, 1);
          }
          break;
        }
      }
      return next;
    });
    // Defer send so state update flushes first
    setTimeout(() => send(text), 0);
  }


  // Determine if we should show the global typing indicator: only when no assistant
  // message is currently being filled (avoids the "double DefiScope AI" bug).
  // We also filter out empty placeholder assistant messages (content='' and steps undefined/null)
  // from the visible list so they don't render alongside the TypingIndicator.
  const lastMsg = messages[messages.length - 1];
  const showTyping =
    busy &&
    (!lastMsg ||
      lastMsg.role !== "assistant" ||
      // Show typing only when the placeholder has NO steps yet (steps is null/undefined)
      (lastMsg.content === "" && (lastMsg.steps === undefined || lastMsg.steps === null)));

  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden"
      style={{ background: C.bg, color: C.textPrimary }}
    >
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`${isMobile ? "fixed z-40" : "relative"} top-0 left-0 h-full w-[260px] shrink-0 flex flex-col border-r`}
            style={{ background: C.panel, borderColor: C.border }}
          >
            <div className="flex items-center justify-between gap-2.5 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <img src={logoSrc} alt="DefiScope" width={36} height={36} className="h-9 w-9" />
                <div className="flex flex-col leading-tight">
                  <span className="text-base font-semibold tracking-tight">DefiScope AI</span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Testnet</span>
                </div>
              </div>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg"
                  style={{ color: C.textSecondary }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="px-3 pb-3">
              <button
                onClick={startNewChat}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-[16px] text-white font-medium transition-all shadow-sm text-sm"
                style={{ background: C.accent }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
              >
                <Plus size={16} />
                New chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar">
              {history.conversations.length === 0 && (
                <p className="text-[11px] text-center px-2 py-4" style={{ color: C.textMuted }}>
                  No chats yet
                </p>
              )}
              {history.conversations.map((c) => {
                const active = activeId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className="group flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] cursor-pointer transition-colors mb-0.5"
                    style={{
                      background: active ? C.surface : "transparent",
                      color: active ? C.accent : C.textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = C.surface;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="text-[13px] truncate flex-1 font-medium">{c.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        history.deleteConversation(c.id).then(() => {
                          if (c.id === activeId) startNewChat();
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center transition-all"
                      style={{ color: C.textMuted }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Strategies nav link */}
            <div className="px-3 pb-3 border-t" style={{ borderColor: C.border }}>
              <button
                onClick={() => {
                  if (isMobile) setSidebarOpen(false);
                  navigate("/strategies");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13px] font-medium transition-colors mt-3"
                style={{ color: C.textSecondary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.surface;
                  e.currentTarget.style.color = C.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = C.textSecondary;
                }}
              >
                <BarChart2 size={14} className="shrink-0" />
                Strategy History
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex min-w-0 overflow-hidden" style={{ background: C.bg }}>

        {/* ── SoDEX side panel — left half ───────────────────────────── */}
        <AnimatePresence initial={false}>
          {sodexPanelOpen && !isMobile && (
            <motion.div
              key="sodex-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "50%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 flex flex-col border-r overflow-hidden"
              style={{ borderColor: C.border }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b shrink-0"
                style={{ background: C.panel, borderColor: C.border }}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981", animationDuration: "2s" }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: C.textPrimary }}>SoDEX Testnet</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "#F59E0B20", color: "#F59E0B" }}>Testnet</span>
                </div>
                <button
                  onClick={() => setSodexPanelOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: C.textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
                >
                  <X size={15} />
                </button>
              </div>
              {/* SoDEX iframe */}
              <iframe
                src="https://testnet.sodex.com"
                className="flex-1 w-full border-0"
                title="SoDEX Testnet"
                allow="wallet; clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                style={{ background: "#0A0A0A" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chat panel — right half (or full width) ─────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onToggleSidebar={() => setSidebarOpen((s) => !s)}
            sodexPanelOpen={sodexPanelOpen}
            onToggleSodex={() => setSodexPanelOpen(s => !s)}
          />

          {/* Chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <div className="space-y-6">
                {messages.length === 0 ? (
                  <EmptyState time={now} walletAddress={wallet.address} onSend={send} />
                ) : (
                  <>
                  {messages
                    .filter((m) => !(m.role === "assistant" && m.content === "" && (!m.steps || m.steps.length === 0)))
                    .map((m) => (
                      <MessageBubble key={m.id} message={m} onRetry={handleRetry} busy={busy} walletAddress={wallet.address} />
                    ))}
                  {showTyping && <TypingIndicator />}
                  </>
                )}
              </div>
            </div>
          </div>


          <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-2" style={{ background: C.bg }}>
            <div className="max-w-3xl mx-auto">
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {SUGGESTIONS_CHAT.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={busy}
                      className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full transition-all text-xs sm:text-sm shadow-sm disabled:opacity-50"
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: C.textSecondary,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.borderHover;
                        e.currentTarget.style.background = C.surfaceHover;
                        e.currentTarget.style.color = C.textPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.background = C.surface;
                        e.currentTarget.style.color = C.textSecondary;
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="relative rounded-[24px] shadow-sm"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Message DefiScope AI..."
                  disabled={busy}
                  rows={1}
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none pt-4 pb-14 pl-5 pr-5 text-[15px] sm:text-base scrollbar-hide block leading-relaxed disabled:opacity-50"
                  style={{ color: C.textPrimary, minHeight: "108px", maxHeight: "180px" }}
                />

                {/* Bottom bar — just the send button */}
                <div className="absolute left-4 right-2 bottom-2 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={!input.trim() || busy}
                    className="h-9 w-9 rounded-[12px] flex items-center justify-center transition-all duration-200"
                    style={{
                      background: input.trim() && !busy ? C.accent : C.surfaceHover,
                      color: input.trim() && !busy ? "#FFFFFF" : C.textDim,
                    }}
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>


              <div className="flex justify-between items-center mt-3 px-1 gap-2">
                <div className="flex items-center gap-2 text-[10px] shrink-0" style={{ color: C.textMuted }}>
                  <span className="relative flex items-center justify-center w-1.5 h-1.5">
                    <span
                      className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
                      style={{ background: C.success, animationDuration: "2s" }}
                    />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ background: C.success }} />
                  </span>
                  LIVE • {now}
                </div>
                <span className="text-[10px] truncate text-right" style={{ color: C.textMuted }}>
                  SoSoValue · SoDEX Testnet
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(28, 28, 28, 1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(35, 35, 35, 1); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        /* Markdown styling inside chat */
        .ds-md p { margin-bottom: 0.75rem; line-height: 1.65; }
        .ds-md p:last-child { margin-bottom: 0; }
        .ds-md strong {
          color: ${C.accent};
          font-weight: 600;
          background: ${C.accent}15;
          padding: 0.5px 5px;
          border-radius: 4px;
        }
        .ds-md ul { margin: 0.5rem 0 0.75rem 0; padding-left: 1.1rem; }
        .ds-md li { margin-bottom: 0.35rem; line-height: 1.55; list-style: disc; }
        .ds-md a { color: ${C.accent}; text-decoration: underline; }
        .ds-md code { background: ${C.surface}; padding: 1px 6px; border-radius: 4px; font-size: 0.9em; }

        /* Positive = green, Negative = red in AI analysis text */
        .ds-md .ds-neg, .ds-neg { color: #EF4444 !important; font-weight: 600; }
        .ds-md .ds-pos, .ds-pos { color: #10B981 !important; font-weight: 600; }
      ` }} />
    </div>
  );
}

function TopBar({
  onToggleSidebar,
  sodexPanelOpen,
  onToggleSodex,
}: {
  onToggleSidebar: () => void;
  sodexPanelOpen?: boolean;
  onToggleSodex?: () => void;
}) {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, connectMetaMask, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-4 py-3 border-b shrink-0"
      style={{ background: C.bg, borderColor: C.border }}
    >
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: C.textSecondary }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = C.surface;
          e.currentTarget.style.color = C.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = C.textSecondary;
        }}
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex items-center justify-center w-2 h-2">
            <span
              className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
              style={{ background: C.success }}
            />
            <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: C.success }} />
          </span>
          <span className="text-xs font-medium" style={{ color: C.success }}>LIVE</span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ml-1" style={{ background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}40` }}>Testnet</span>
        </div>

        {/* SoDEX side-panel toggle */}
        {onToggleSodex && (
          <button
            onClick={onToggleSodex}
            title={sodexPanelOpen ? "Close SoDEX panel" : "Open SoDEX side panel"}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-[12px] text-xs font-medium transition-all"
            style={{
              background: sodexPanelOpen ? `${C.accent}20` : "transparent",
              border: `1px solid ${sodexPanelOpen ? C.accent : C.border}`,
              color: sodexPanelOpen ? C.accent : C.textSecondary,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = sodexPanelOpen ? C.accent : C.border;
              e.currentTarget.style.color = sodexPanelOpen ? C.accent : C.textSecondary;
            }}
          >
            <Columns2 size={14} />
            <span>SoDEX</span>
          </button>
        )}

        <button
          onClick={() => navigate("/how-to-use")}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-[12px] text-xs sm:text-sm font-medium transition-all"
          style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; }}
        >
          <MessageSquare size={14} />
          <span className="hidden xs:inline">How to use</span>
        </button>


        {isConnected && address ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((s) => !s)}
              className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-[12px] text-xs sm:text-sm font-medium transition-all"
              style={{ background: "transparent", border: `1px solid ${C.accent}`, color: C.accent }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `${C.accent}15`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Wallet size={14} />
              <span className="hidden xs:inline sm:inline">{shortenAddress(address)}</span>
              <ChevronDown size={12} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl p-1 shadow-lg z-50"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <button
                  onClick={() => { disconnect(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors"
                  style={{ color: "#EF4444" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={14} />
                  Disconnect Wallet
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={connectMetaMask}
            disabled={isConnecting}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-[12px] text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: "transparent", border: `1px solid ${C.accent}`, color: C.accent }}
            onMouseEnter={(e) => !isConnecting && (e.currentTarget.style.background = `${C.accent}15`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Wallet size={14} />
            <span className="hidden xs:inline">{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
            <span className="xs:hidden inline">{isConnecting ? "..." : "Connect"}</span>
          </button>
        )}
      </div>
    </header>
  );
}

function EmptyState({
  time,
  mode,
  walletAddress,
  onSend,
}: {
  time: string;
  mode: ChatMode;
  walletAddress?: string;
  onSend: (text: string) => void;
}) {
  if (mode === "agent") {
    return null;
  }
  return (
    <div className="animate-fade-in-up flex gap-3">
      <div
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <img src={logoSrc} alt="DefiScope" className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>DefiScope AI</span>
          <span className="text-[11px]" style={{ color: C.textMuted }}>{time}</span>
        </div>
        <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.textPrimary }}>
          New session started. Ask me about ETF flows, market opportunities, BTC/ETH signals, or live news — I'll pull live data from SoSoValue and explain it in plain English.
        </p>
      </div>
    </div>
  );
}

// ─── Agent Ready Panel — shown when user switches to Agent mode ───────────────
// Auto-fetches a fresh batch of signals from the trading-agent edge function
// and renders them as actionable cards immediately (before the user types anything).

function AgentReadyPanel({
  walletAddress,
  onSend,
  tradeTicket,
  onTradeTicketChange,
  strategyTicket,
  onStrategyTicketChange,
}: {
  walletAddress?: string;
  onSend: (text: string) => void;
  tradeTicket: TradeTicketIntent | null;
  onTradeTicketChange: (intent: TradeTicketIntent | null) => void;
  strategyTicket: StrategyTicketIntent | null;
  onStrategyTicketChange: (intent: StrategyTicketIntent | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [recs, setRecs] = useState<AgentRecommendationData | null>(null);

  async function fetchSignals() {
    setStatus("loading");
    try {
      const res = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: [{ role: "user", content: "Generate fresh trade signals and show my recommendations." }],
        },
        headers: walletAddress ? { "x-owner-key": walletAddress } : {},
      });
      if (res.error) throw res.error;
      const transcript: any[] = res.data?.transcript || [];
      const sigTool = transcript.find((t: any) => t.tool === "generate_signals" || t.tool === "get_signals");
      const rawSigs = sigTool?.result?.signals || sigTool?.result?.data?.signals || [];
      setRecs({ signals: rawSigs, generatedAt: new Date().toISOString() });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Agent welcome header */}
      <div className="flex gap-3">
        <div
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <img src={logoSrc} alt="DefiScope" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 pt-0.5">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>DefiScope Agent</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}30` }}
            >
              AUTONOMOUS
            </span>
          </div>
          <p className="text-[14px] leading-relaxed" style={{ color: C.textSecondary }}>
            I turn SoSoValue ETF flows, market snapshots, and news into an AI-published crypto strategy index with risk notes and optional <span style={{ color: C.accent }}>SoDEX Testnet</span> rebalance execution.
          </p>
        </div>
      </div>

      {/* Quick-action pills */}
      <div className="flex flex-wrap gap-2 pl-11">
        {["Build FlowPulse Index", "Generate strategy brief", "Create rebalance plan", "Explain market regime"].map((s) => (
          <button
            key={s}
            onClick={() => {
              if (s.includes("FlowPulse") || s.includes("rebalance") || s.includes("strategy")) {
                onStrategyTicketChange({ theme: "FlowPulse Index" });
              } else {
                onSend(s);
              }
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.textSecondary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.color = C.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textSecondary;
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Live signal loader */}
      <div className="pl-11">
        {strategyTicket && (
          <div className="mb-4">
            <StrategyPublisherPanel
              initial={strategyTicket}
              ownerKey={walletAddress}
            />
          </div>
        )}

        {tradeTicket && (
          <div className="mb-4">
            <SodexTradeTicket
              initial={tradeTicket}
              ownerKey={walletAddress}
              onClose={() => onTradeTicketChange(null)}
            />
          </div>
        )}

        {status === "idle" && (
          <button
            onClick={fetchSignals}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-semibold transition-all"
            style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40`, color: C.accent }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${C.accent}25`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = `${C.accent}15`)}
          >
            <Bot size={15} />
            Generate live strategy
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2.5 py-2" style={{ color: C.textSecondary }}>
            <Loader2 size={15} className="animate-spin" style={{ color: C.accent }} />
            <span className="text-sm">Scanning market data and generating signals…</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2.5 py-2">
            <span className="text-sm" style={{ color: "#EF4444" }}>
              Could not load signals — check your connection.
            </span>
            <button
              onClick={fetchSignals}
              className="text-xs underline"
              style={{ color: C.accent }}
            >
              Retry
            </button>
          </div>
        )}

        {status === "done" && recs && (
          <AgentRecommendationView data={recs} ownerKey={walletAddress} />
        )}
      </div>
    </motion.div>
  );
}

interface StrategyPlan {
  generatedAt: string;
  theme: StrategyTicketIntent["theme"];
  regime: "risk-on" | "risk-off" | "mixed";
  confidence: number;
  allocations: Array<{ asset: "BTC" | "ETH" | "SOL" | "USDC"; weight: number; rationale: string }>;
  signals: AgentSignal[];
  thesis: string;
  risks: string[];
  actions: string[];
}

function getStrategyOwnerKey(ownerKey?: string) {
  if (ownerKey) return ownerKey;
  const storageKey = "ds_strategy_demo_owner";
  let value = localStorage.getItem(storageKey);
  if (!value) {
    value = `demo:${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, value);
  }
  return value;
}

function buildStrategyPlan(theme: StrategyTicketIntent["theme"], signals: AgentSignal[]): StrategyPlan {
  const usable = signals.filter((s) => ["BTC", "ETH", "SOL"].includes(s.asset));
  const avgConfidence = Math.round(
    usable.reduce((sum, s) => sum + Number(s.confidence || 0), 0) / Math.max(usable.length, 1)
  ) || 62;
  const buyCount = usable.filter((s) => s.side === "BUY").length;
  const sellCount = usable.filter((s) => s.side === "SELL").length;
  const regime: StrategyPlan["regime"] = buyCount > sellCount ? "risk-on" : sellCount > buyCount ? "risk-off" : "mixed";

  const weights: Record<"BTC" | "ETH" | "SOL" | "USDC", number> = {
    BTC: theme === "Risk-Off Rotation" ? 35 : 45,
    ETH: theme === "Momentum Basket" ? 35 : 30,
    SOL: theme === "Momentum Basket" ? 15 : 10,
    USDC: theme === "Risk-Off Rotation" ? 25 : 15,
  };

  for (const signal of usable) {
    const asset = signal.asset as "BTC" | "ETH" | "SOL";
    const adjustment = Math.min(12, Math.max(4, Math.round(signal.confidence / 10)));
    if (signal.side === "BUY") {
      weights[asset] += adjustment;
      weights.USDC -= Math.min(weights.USDC - 5, adjustment);
    } else {
      weights[asset] = Math.max(5, weights[asset] - adjustment);
      weights.USDC += adjustment;
    }
  }

  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const allocations = (Object.keys(weights) as Array<keyof typeof weights>).map((asset) => {
    const signal = usable.find((s) => s.asset === asset);
    return {
      asset,
      weight: Math.max(0, Math.round((weights[asset] / total) * 100)),
      rationale: asset === "USDC"
        ? "Dry-powder sleeve for drawdown control and next rebalance."
        : signal?.reasoning || `${asset} sleeve set by the ${theme} baseline and current market regime.`,
    };
  });

  const topSignal = usable.slice().sort((a, b) => b.confidence - a.confidence)[0];
  return {
    generatedAt: new Date().toISOString(),
    theme,
    regime,
    confidence: avgConfidence,
    allocations,
    signals: usable,
    thesis: topSignal
      ? `${theme} is ${regime} with ${topSignal.asset} as the lead signal at ${topSignal.confidence}% confidence. The plan converts SoSoValue market data into an auditable index rebalance instead of a one-off trade.`
      : `${theme} is mixed. The safest output is a conservative model portfolio with USDC reserve until SoSoValue signals strengthen.`,
    risks: [
      "ETF flow reversals can invalidate the regime quickly.",
      "News sentiment is noisy; confirmation is required before execution.",
      "SoDEX execution is testnet-only in this demo and should be treated as a verifiable action layer.",
    ],
    actions: [
      "Publish the allocation and thesis as the current strategy memo.",
      "Watch the lead signal until confidence clears the risk threshold.",
      "Optionally execute only the lead rebalance leg on SoDEX Testnet after confirmation.",
    ],
  };
}

function StrategyPublisherPanel({
  initial,
  ownerKey,
}: {
  initial: StrategyTicketIntent;
  ownerKey?: string;
}) {
  const [theme, setTheme] = useState<StrategyTicketIntent["theme"]>(initial.theme);
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [result, setResult] = useState<SodexTradeResult | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "executing">("idle");

  async function generatePlan() {
    setStatus("generating");
    setResult(null);
    try {
      const res = await supabase.functions.invoke("trading-agent", {
        body: { action: "generate" },
        headers: { "x-owner-key": getStrategyOwnerKey(ownerKey) },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      setPlan(buildStrategyPlan(theme, res.data?.signals || []));
    } catch (e) {
      toast({
        title: "Strategy generation failed",
        description: e instanceof Error ? e.message : "Could not load SoSoValue strategy inputs.",
        variant: "destructive",
      });
    } finally {
      setStatus("idle");
    }
  }

  async function executeLeadLeg() {
    const lead = plan?.signals.slice().sort((a, b) => b.confidence - a.confidence)[0];
    if (!lead) return;
    setStatus("executing");
    setResult(null);
    try {
      const res = await supabase.functions.invoke("trading-agent", {
        body: { action: "quick_trade", asset: lead.asset, side: lead.side, market: lead.market, size_pct: 0.025 },
        headers: { "x-owner-key": getStrategyOwnerKey(ownerKey) },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      const d = res.data as any;
      setResult({
        ok: Boolean(d.ok),
        clOrdID: d.clOrdID || d.sodex?.clOrdID,
        symbol: d.symbol || d.sodex?.symbol,
        asset: lead.asset,
        side: lead.side,
        size: d.size ? String(d.size) : undefined,
        market: lead.market,
        price: d.price,
        message: d.message,
        nonce: d.nonce || d.sodex?.nonce,
        payloadHash: d.payloadHash || d.sodex?.payloadHash,
        sodex: d.sodex,
      });
    } catch (e) {
      setResult({
        ok: false,
        asset: lead.asset,
        side: lead.side,
        market: lead.market,
        message: e instanceof Error ? e.message : "SoDEX rebalance leg failed.",
      });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0F0F0F", border: `1px solid ${C.accent}35`, boxShadow: `0 0 28px -16px ${C.accent}` }}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: `${C.accent}10`, borderBottom: `1px solid ${C.accent}20` }}>
        <div>
          <p className="text-sm font-semibold text-white">FlowPulse Strategy Publisher</p>
          <p className="text-[11px]" style={{ color: C.textSecondary }}>SoSoValue data to AI index decision to auditable rebalance action.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-md" style={{ color: C.accent, border: `1px solid ${C.accent}35`, background: `${C.accent}12` }}>
          BUILDERTHON
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <TicketSelect
            label="Strategy"
            value={theme}
            options={["FlowPulse Index", "Risk-Off Rotation", "Momentum Basket"]}
            onChange={(v) => {
              setTheme(v as StrategyTicketIntent["theme"]);
              setPlan(null);
              setResult(null);
            }}
          />
          <button
            onClick={generatePlan}
            disabled={status !== "idle"}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}40`, color: C.accent }}
          >
            {status === "generating" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Generate live strategy
          </button>
        </div>

        {!plan && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {["Data: ETF flows, prices, news", "Decision: AI weighted index", "Action: rebalance memo + SoDEX option"].map((item) => (
              <div key={item} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textSecondary }}>
                {item}
              </div>
            ))}
          </div>
        )}

        {plan && (
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-white">{plan.theme} memo</span>
                <span className="text-[10px] uppercase" style={{ color: plan.regime === "risk-on" ? "#10B981" : plan.regime === "risk-off" ? "#EF4444" : "#F59E0B" }}>
                  {plan.regime} - {plan.confidence}% confidence
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.textSecondary }}>{plan.thesis}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {plan.allocations.map((a) => (
                <div key={a.asset} className="rounded-xl p-3" style={{ background: "#141414", border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">{a.asset}</span>
                    <span className="text-sm font-bold" style={{ color: a.asset === "USDC" ? C.textSecondary : C.accent }}>{a.weight}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${a.weight}%`, background: a.asset === "USDC" ? C.textSecondary : C.accent }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="font-semibold text-white mb-2">Risk controls</p>
                {plan.risks.map((risk) => <p key={risk} className="mb-1.5" style={{ color: C.textSecondary }}>- {risk}</p>)}
              </div>
              <div className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <p className="font-semibold text-white mb-2">Action output</p>
                {plan.actions.map((action) => <p key={action} className="mb-1.5" style={{ color: C.textSecondary }}>- {action}</p>)}
              </div>
            </div>

            <button
              onClick={executeLeadLeg}
              disabled={status !== "idle" || plan.signals.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
              style={{ background: "#10B98118", border: "1px solid #10B98140", color: "#10B981" }}
            >
              {status === "executing" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Optional: execute lead rebalance leg on SoDEX Testnet
            </button>
          </div>
        )}

        {result && <SodexTradeWidget result={result} ownerKey={getStrategyOwnerKey(ownerKey)} />}
      </div>
    </motion.div>
  );
}

function SodexTradeTicket({
  initial,
  ownerKey,
  onClose,
}: {
  initial: TradeTicketIntent;
  ownerKey?: string;
  onClose: () => void;
}) {
  const [asset, setAsset] = useState<TradeTicketIntent["asset"]>(initial.asset);
  const [side, setSide] = useState<TradeTicketIntent["side"]>(initial.side);
  const [market, setMarket] = useState<TradeTicketIntent["market"]>(initial.market);
  const [sizePct, setSizePct] = useState(initial.sizePct);
  const [signal, setSignal] = useState<AgentSignal | null>(null);
  const [result, setResult] = useState<SodexTradeResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading-signal" | "submitting">("idle");

  const isBuy = side === "BUY";
  const color = isBuy ? "#10B981" : "#EF4444";

  async function loadSignal() {
    setStatus("loading-signal");
    setResult(null);
    try {
      const res = await supabase.functions.invoke("trading-agent", {
        body: { action: "generate" },
        headers: ownerKey ? { "x-owner-key": ownerKey } : {},
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      const signals: AgentSignal[] = res.data?.signals || [];
      const best = signals.find((s) => s.asset === asset) || signals[0] || null;
      setSignal(best);
      if (best) {
        setAsset(best.asset as TradeTicketIntent["asset"]);
        setSide(best.side);
        setMarket(best.market);
      }
    } catch (e) {
      toast({
        title: "Signal scan failed",
        description: e instanceof Error ? e.message : "Could not load SoSoValue signal.",
        variant: "destructive",
      });
    } finally {
      setStatus("idle");
    }
  }

  async function submitTrade() {
    if (!ownerKey) {
      toast({ title: "Wallet not connected", description: "Connect your EVM wallet to trade on SoDEX Testnet.", variant: "destructive" });
      return;
    }
    setStatus("submitting");
    setResult(null);
    try {
      const res = await supabase.functions.invoke("trading-agent", {
        body: { action: "quick_trade", asset, side, market, size_pct: sizePct },
        headers: { "x-owner-key": ownerKey },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      const d = res.data as any;
      const tradeResult: SodexTradeResult = {
        ok: Boolean(d.ok),
        clOrdID: d.clOrdID || d.sodex?.clOrdID,
        symbol: d.symbol || d.sodex?.symbol,
        asset,
        side,
        size: d.size ? String(d.size) : undefined,
        market,
        price: d.price,
        message: d.message,
        nonce: d.nonce || d.sodex?.nonce,
        payloadHash: d.payloadHash || d.sodex?.payloadHash,
        sodex: d.sodex,
      };
      setResult(tradeResult);
      toast({
        title: tradeResult.ok ? `${side} ${asset} submitted` : "Trade failed",
        description: tradeResult.message || "SoDEX Testnet response received.",
        variant: tradeResult.ok ? "default" : "destructive",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "SoDEX trade failed.";
      setResult({ ok: false, asset, side, market, message });
      toast({ title: "Trade failed", description: message, variant: "destructive" });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0F0F0F", border: `1px solid ${color}35`, boxShadow: `0 0 28px -14px ${color}` }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            {isBuy ? <TrendingUp size={16} style={{ color }} /> : <TrendingDown size={16} style={{ color }} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">SoDEX trade ticket</p>
            <p className="text-[11px] truncate" style={{ color: C.textSecondary }}>Review details, scan SoSoValue signals, then submit to testnet.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: C.textMuted }}>
          <X size={15} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TicketSelect label="Asset" value={asset} options={["BTC", "ETH", "SOL"]} onChange={(v) => setAsset(v as TradeTicketIntent["asset"])} />
          <TicketSelect label="Side" value={side} options={["BUY", "SELL"]} onChange={(v) => setSide(v as TradeTicketIntent["side"])} />
          <TicketSelect label="Market" value={market} options={["spot", "perps"]} formatOption={(v) => v.toUpperCase()} onChange={(v) => setMarket(v as TradeTicketIntent["market"])} />
          <label className="rounded-xl px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <span className="block text-[10px] uppercase mb-1" style={{ color: C.textMuted }}>Size</span>
            <input
              type="number"
              min="0.5"
              max="100"
              step="0.5"
              value={Math.round(sizePct * 1000) / 10}
              onChange={(e) => setSizePct(Math.max(0.005, Math.min(1, Number(e.target.value) / 100)))}
              className="w-full bg-transparent outline-none text-sm font-semibold text-white"
            />
          </label>
        </div>

        {signal && (
          <div className="rounded-xl p-3 text-xs" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textSecondary }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-white">SoSoValue signal: {signal.side} {signal.asset}</span>
              <span style={{ color: signal.confidence >= 80 ? "#10B981" : "#F59E0B" }}>{signal.confidence}% confidence</span>
            </div>
            <p className="leading-relaxed">{signal.reasoning}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={loadSignal}
            disabled={status !== "idle"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.accent }}
          >
            {status === "loading-signal" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Load SoSoValue signal
          </button>
          <button
            onClick={submitTrade}
            disabled={status !== "idle"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            style={{ background: `${color}22`, border: `1px solid ${color}45`, color }}
          >
            {status === "submitting" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Submit {side} {asset}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px]" style={{ color: C.textMuted }}>
          <SlidersHorizontal size={12} />
          <span>{Math.round(sizePct * 1000) / 10}% account sizing through DefiScope risk settings. SoDEX Testnet only.</span>
        </div>

        {result && <SodexTradeWidget result={result} ownerKey={ownerKey} />}
      </div>
    </motion.div>
  );
}

function TicketSelect({
  label,
  value,
  options,
  formatOption = (option) => option,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  formatOption?: (option: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl px-3 py-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <span className="block text-[10px] uppercase mb-1" style={{ color: C.textMuted }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none text-sm font-semibold text-white"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#141414] text-white">
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}



function MessageBubble({ message, onRetry, busy, walletAddress }: { message: ChatMessage; onRetry: (text: string) => void; busy: boolean; walletAddress?: string }) {
  const isUser = message.role === "user";
  const time = formatTime(message.ts);
  const providerUnavailable = !isUser && isProviderUnavailableText(message.content);

  const completedSteps = (message.steps || []).filter((s) => s.status === "done" && s.result);
  const allStepsSettled =
    !message.steps ||
    message.steps.length === 0 ||
    message.steps.every((s) => s.status === "done" || s.status === "error");

  // Build carousel items from successful tool results
  const carouselItems = completedSteps.map((step, i) => ({
    key: `${step.name}-${i}`,
    label: step.label,
    node: <ToolResultRender step={step} />,
  }));

  return (
    <div className="animate-fade-in-up flex gap-3">
      <div
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
        style={{
          background: isUser ? C.surface : C.surface,
          border: `1px solid ${C.border}`,
          color: isUser ? C.textSecondary : C.textPrimary,
        }}
      >
        {isUser ? "U" : <img src={logoSrc} alt="DefiScope" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 pt-0.5 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>
            {isUser ? "You" : "DefiScope AI"}
          </span>
          <span className="text-[11px]" style={{ color: C.textMuted }}>{time}</span>
        </div>

        {/* 1. Tool-step badges: show live progress while the AI is calling data modules. */}
        {message.steps && message.steps.length > 0 && (() => {
          // Deduplicate by tool name — same tool called for BTC + ETH should appear once
          const seen = new Set<string>();
          const unique = message.steps.filter((s) => {
            if (seen.has(s.name)) return false;
            seen.add(s.name);
            return true;
          });
          return (
            <div className="flex flex-wrap gap-2">
              {unique.map((step, i) => (
                <ToolStepBadge key={i} step={step} />
              ))}
            </div>
          );
        })()}

        {/* 2. Tool results — rendered as a right-to-left slideshow once loaded.
               Shown BEFORE the analytical text so the user sees the live data first. */}
        {allStepsSettled && carouselItems.length > 0 && (
          <ToolCarousel items={carouselItems} />
        )}

        {/* 2a. FlowPulse Strategy Card — appears whenever market narrative data is present.
               If ai-decision also ran, uses its signal for allocation; otherwise uses
               regime-based default allocation so the Publish button is always accessible. */}
        {allStepsSettled && (() => {
          if (!message.steps) return null;
          const narrative = message.steps.find(s => s.name === "get_market_narrative" && s.result);
          if (!narrative?.result) return null;
          const n = narrative.result as NarrativeData;
          const decision = message.steps.find(s => s.name === "get_ai_decision" && s.result);
          const d = decision?.result as DecisionData | undefined;

          // Derive allocation: use AI decision signal if present, else use regime
          const isRiskOn  = d?.action === "BUY"  || ["accumulation","trending_up"].includes(n.regime ?? "");
          const isRiskOff = d?.action === "SELL" || ["distribution","volatile"].includes(n.regime ?? "");
          const allocation: Record<string, number> = {
            BTC:  isRiskOn ? 40 : isRiskOff ? 10 : 25,
            ETH:  isRiskOn ? 30 : isRiskOff ? 10 : 25,
            SOL:  20,
            USDC: isRiskOff ? 60 : isRiskOn ? 10 : 30,
          };

          // Build reasoning from decision if present, else derive from narrative themes
          const reasoning: string[] = d?.reasoning?.length
            ? d.reasoning
            : (n.themes ?? []).slice(0, 4).map((t: string) => t);

          return (
            <FlowPulseStrategyCard
              regime={n.regime}
              allocation={allocation}
              memo={n.narrative}
              reasoning={reasoning}
              confidence={d?.confidence ?? 50}
              ownerKey={walletAddress}
            />
          );
        })()}


        {/* 2b. SoDEX trade result widget — shown when agent executed a quick_trade/close */}
        {!isUser && message.tradeResult && (
          <SodexTradeWidget result={message.tradeResult} ownerKey={walletAddress} />
        )}

        {/* 2c. Agent recommendations — signal cards with Open/Close trade buttons */}
        {!isUser && message.agentRecs && message.agentRecs.signals.length > 0 && (
          <AgentRecommendationView
            data={message.agentRecs}
            ownerKey={walletAddress}
          />
        )}


        {/* 3. Analytical text — typed out once all tools are done. */}
        {providerUnavailable ? (
          <ProviderUnavailableNotice retryText={message.retryText} onRetry={onRetry} busy={busy} />
        ) : message.content && (
          isUser ? (
            <p className="text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: C.textPrimary }}>
              {message.content}
            </p>
          ) : (
            <Typewriter text={message.content} instant={!message.animate} />
          )
        )}
      </div>
    </div>
  );
}

function ProviderUnavailableNotice({ retryText, onRetry, busy }: { retryText?: string; onRetry: (text: string) => void; busy: boolean }) {
  return (
    <div
      className="rounded-[14px] px-4 py-3.5 flex flex-col gap-2.5"
      style={{ background: `${C.accent}0D`, border: `1px solid ${C.accent}33`, color: C.textPrimary }}
    >
      <div className="flex items-start gap-2.5">
        <RefreshCw size={15} className="mt-0.5 shrink-0" style={{ color: C.accent }} />
        <div className="space-y-1">
          <p className="text-[14px] sm:text-[15px] font-medium leading-snug">Live data is taking a short break</p>
          <p className="text-[13px] sm:text-[13.5px] leading-relaxed" style={{ color: C.textSecondary }}>
            Our market data feed is busy right now. Give it a moment and try again — your chat history is safe.
          </p>
        </div>
      </div>
      {retryText && (
        <button
          onClick={() => onRetry(retryText)}
          disabled={busy}
          className="self-start mt-1 inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: C.accent, color: "#FFFFFF" }}
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
          Try again
        </button>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="animate-fade-in-up flex gap-3">
      <div
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <img src={logoSrc} alt="DefiScope" className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 pt-0.5">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>DefiScope AI</span>
        </div>
        <div className="flex items-center gap-1.5 py-2">
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.textSecondary, animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.textSecondary, animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.textSecondary, animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ToolStepBadge({ step }: { step: ToolStep }) {
  const providerUnavailable = step.status === "error" && isProviderUnavailableText(step.error);
  const stateColor =
    step.status === "running" ? C.accent :
    step.status === "done" ? C.success :
    step.status === "error" ? C.textSecondary :
    C.textSecondary;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="inline-flex items-center gap-2 text-[11px] sm:text-[12px] px-2.5 py-1.5 rounded-[10px] mr-2"
      style={{
        background: `${stateColor}10`,
        border: `1px solid ${stateColor}30`,
        color: stateColor,
      }}
    >
      {step.status === "running" ? <Loader2 size={11} className="animate-spin" />
        : step.status === "done" ? <Check size={11} />
        : step.status === "error" ? <RefreshCw size={11} />
        : <Wrench size={11} />}
      <span className="font-medium">
        {step.status === "running" && `Calling ${step.label}...`}
        {step.status === "done" && `${step.label} loaded`}
        {step.status === "pending" && `Queued: ${step.label}`}
        {step.status === "error" && (providerUnavailable ? `${step.label} paused` : `${step.label} unavailable`)}
      </span>
    </motion.div>
  );
}

function ToolResultRender({ step }: { step: ToolStep }) {
  if (!step.result) return null;
  // Wrap in a smaller, scaled container so cards don't dominate the chat
  const compact = (node: React.ReactNode) => (
    <div className="rounded-2xl overflow-hidden" style={{ fontSize: "13px" }}>
      {node}
    </div>
  );
  switch (step.name) {
    case "get_market_narrative": return compact(<MarketNarrativeView data={step.result as NarrativeData} />);
    case "get_ai_decision":      return compact(<AiDecisionView data={step.result as DecisionData} />);
    case "get_opportunities":    return compact(<OpportunityDiscoveryView data={step.result as OpportunitiesData} />);
    case "get_etf_flows":        return compact(<EtfFlowView data={step.result as EtfFlowsData} />);
    case "get_market_overview":  return compact(<MarketOverviewView data={step.result as MarketOverviewData} />);
    case "get_news":             return compact(<NewsFeedView data={step.result as NewsFeedData} />);
    case "get_live_chart":       return compact(<LiveChartView data={step.result as LiveChartData} />);
    default: return null;
  }
}
