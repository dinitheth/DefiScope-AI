// Agent Chat — conversational interface to the autonomous trading agent.
// Uses Lovable AI tool-calling. Tools execute server-side against the
// trading-agent + sodex-executor functions and the user's data.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const SYSTEM = `You are the DefiScope Strategy Publisher Agent: an AI fund-manager and index-publisher workfloor built for the SoSoValue Builderthon.

Your product is Data -> Decision -> Action:
- Data: pull live SoSoValue prices, ETF flows, and news through tools.
- Decision: convert them into strategy memos, market regimes, ranked signals, and index/rebalance recommendations.
- Action: publish an auditable rebalance plan, and only optionally stage a small SoDEX Testnet execution leg after user confirmation.

Do not behave like a generic "buy BTC now" bot. Act like a crypto index desk, strategy assistant, and opportunity discovery engine. Be decisive, transparent, and risk-aware.

When the user asks to build a strategy, scan, create a memo, check status, or produce a rebalance plan, USE TOOLS - never guess. After tools run, write a short, professional reply (3-8 lines max) summarising what you found, citing real numbers from the tool results. No emojis. No filler. Use **bold** for key numbers/tickers.

If the user explicitly asks for execution, make it clear this is SoDEX Testnet and prefer a risk-controlled lead rebalance leg instead of broad autonomous trading. If execution is blocked by risk rules, explain which rule blocked it.`;

const TOOLS = [
  { type: "function", function: {
    name: "generate_signals",
    description: "Pull live SoSoValue data and generate fresh AI trade signals. Returns the new signals.",
    parameters: { type: "object", properties: {}, additionalProperties: false }
  }},
  { type: "function", function: {
    name: "quick_trade",
    description: "Place a market order on SoDEX Testnet immediately. Use this when the user asks to buy/sell/trade a specific asset.",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", enum: ["BTC", "ETH", "SOL"] },
        side:  { type: "string", enum: ["BUY", "SELL"] },
        market:{ type: "string", enum: ["spot", "perps"] },
        size_pct: { type: "number", description: "Fraction of account balance, e.g. 0.05 = 5%. Defaults to user's max_position_pct." }
      },
      required: ["asset", "side"], additionalProperties: false
    }
  }},
  { type: "function", function: {
    name: "execute_signal",
    description: "Execute a previously generated signal by id (runs risk checks then submits to SoDEX).",
    parameters: { type: "object", properties: { signal_id: { type: "string" } }, required: ["signal_id"], additionalProperties: false }
  }},
  { type: "function", function: {
    name: "get_signals",
    description: "List the most recent trade signals for this user.",
    parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false }
  }},
  { type: "function", function: {
    name: "get_positions",
    description: "List currently open positions.",
    parameters: { type: "object", properties: {}, additionalProperties: false }
  }},
  { type: "function", function: {
    name: "get_trades",
    description: "List recent executed/attempted trades.",
    parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false }
  }},
  { type: "function", function: {
    name: "close_trade",
    description: "Close / cancel an open position on SoDEX Testnet. Use when user says 'close', 'exit', 'cancel my position', etc.",
    parameters: {
      type: "object",
      properties: {
        asset:  { type: "string", enum: ["BTC", "ETH", "SOL"] },
        market: { type: "string", enum: ["spot", "perps"] },
        sodex_order_id: { type: "string", description: "The SoDEX clOrdID if known." }
      },
      required: ["asset"], additionalProperties: false
    }
  }},
  { type: "function", function: {
    name: "get_settings",
    description: "Read current agent risk settings.",
    parameters: { type: "object", properties: {}, additionalProperties: false }
  }},
  { type: "function", function: {
    name: "update_settings",
    description: "Update agent risk settings (only fields provided are changed).",
    parameters: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        market: { type: "string", enum: ["spot", "perps", "both"] },
        min_confidence: { type: "number" },
        max_position_pct: { type: "number" },
        daily_trade_limit: { type: "number" },
        leverage: { type: "number" },
        account_balance_usd: { type: "number" }
      }, additionalProperties: false
    }
  }},
];

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ownerKey = req.headers.get("x-owner-key") || "";
    if (!ownerKey) return jsonRes({ error: "Missing owner key" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { messages = [] } = await req.json();

    const callTradingAgent = async (action: string, body: Record<string, unknown> = {}) => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/trading-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY, "x-owner-key": ownerKey },
        body: JSON.stringify({ action, ...body }),
      });
      const text = await r.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { ok: false, error: text || "trading-agent parse error" };
      }
      if (!r.ok && data?.ok !== false) {
        return { ok: false, status: r.status, error: data?.error || `Trading agent HTTP ${r.status}`, raw: data };
      }
      return data;
    };

    const runTool = async (name: string, args: any) => {
      try {
        if (name === "generate_signals") return await callTradingAgent("generate");
        if (name === "execute_signal") return await callTradingAgent("execute", { signal_id: args.signal_id });
        if (name === "quick_trade") return await callTradingAgent("quick_trade", args);
        if (name === "close_trade") return await callTradingAgent("close_position", {
          asset: args.asset,
          market: args.market || "spot",
          clOrdIDToCancel: args.sodex_order_id,
        });
        if (name === "get_signals") {
          const { data } = await admin.from("signals").select("*").eq("owner_key", ownerKey).order("created_at", { ascending: false }).limit(args?.limit || 10);
          return { signals: data };
        }
        if (name === "get_positions") {
          const { data } = await admin.from("positions").select("*").eq("owner_key", ownerKey).eq("status", "open").order("opened_at", { ascending: false });
          return { positions: data };
        }
        if (name === "get_trades") {
          const { data } = await admin.from("trades").select("*").eq("owner_key", ownerKey).order("created_at", { ascending: false }).limit(args?.limit || 10);
          return { trades: data };
        }
        if (name === "get_settings") {
          const { data } = await admin.from("agent_settings").select("*").eq("owner_key", ownerKey).maybeSingle();
          return { settings: data };
        }
        if (name === "update_settings") {
          const { data: existing } = await admin.from("agent_settings").select("id").eq("owner_key", ownerKey).maybeSingle();
          if (existing) {
            const { data } = await admin.from("agent_settings").update(args).eq("id", existing.id).select().single();
            return { settings: data };
          }
          const { data } = await admin.from("agent_settings").insert({ owner_key: ownerKey, ...args }).select().single();
          return { settings: data };
        }
        return { error: `Unknown tool ${name}` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Tool error" };
      }
    };

    const convo: any[] = [{ role: "system", content: SYSTEM }, ...messages];
    const transcript: any[] = [];

    // Up to 4 tool-calling loops
    for (let i = 0; i < 4; i++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: convo, tools: TOOLS, tool_choice: "auto" }),
      });
      if (!r.ok) {
        if (r.status === 429) return jsonRes({ error: "Rate limit reached. Please wait a moment." }, 429);
        if (r.status === 402) return jsonRes({ error: "AI credits exhausted. Add credits in Workspace." }, 402);
        const t = await r.text();
        console.error("agent-chat AI error", r.status, t);
        return jsonRes({ error: "AI gateway error" }, 500);
      }
      const j = await r.json();
      const msg = j.choices?.[0]?.message;
      if (!msg) return jsonRes({ error: "Empty AI response" }, 500);
      convo.push(msg);

      const calls = msg.tool_calls || [];
      if (!calls.length) {
        return jsonRes({ reply: msg.content || "", transcript });
      }

      for (const c of calls) {
        const name = c.function?.name;
        let args: any = {};
        try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* ignore */ }
        const result = await runTool(name, args);
        transcript.push({ tool: name, args, result });
        convo.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 8000) });
      }
    }

    return jsonRes({ reply: "Reached tool loop limit.", transcript });
  } catch (e) {
    console.error("agent-chat fatal:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

