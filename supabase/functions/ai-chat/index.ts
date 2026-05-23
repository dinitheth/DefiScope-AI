// AI Router with two-pass execution:
//   phase "plan"       -> AI decides which tools to call (returns tool plan only)
//   phase "synthesize" -> client sends back tool results, AI writes a deep analytical reply
//                         that quotes the real SoSoValue numbers (bolded with **).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const PLAN_PROMPT = `You are DefiScope AI, a crypto market intelligence assistant.

Your job in THIS step is ONLY to decide which internal data tools to call to answer the user. Do NOT write a final answer yet.

Available tools:
1. get_market_narrative — overall market regime, mood, key drivers
2. get_ai_decision — quantified BUY/SELL/HOLD for BTC or ETH (args: asset BTC|ETH, timeframe short|medium|long, risk low|medium|high)
3. get_opportunities — ranked trade ideas across top coins
4. get_etf_flows — spot ETF AUM, daily inflows, fund-by-fund (args: etfType btc|eth)
5. get_market_overview — top coin prices and 24h changes
6. get_news — latest crypto news with sentiment
7. get_live_chart — TradingView chart embed (args: symbol BTC|ETH|SOL|...)

Rules:
- For ANY market question, call at least one tool. Never answer from memory.
- Compose multiple tools when the question needs it (full briefing -> narrative + opportunities + etf_flows).
- For BTC/ETH BUY/SELL questions, default timeframe=medium, risk=medium unless the user specifies.
- For pure greetings (hi, thanks), call NO tools.
- Always respond by calling tools — do not write prose in this step.`;

const SYNTH_PROMPT = `You are DefiScope AI — a senior crypto market analyst. The system has just fetched LIVE data from the SoSoValue API (provided below as JSON tool results).

Write a production-grade analytical answer to the user's last question. Rules (all mandatory):

1. GROUND EVERY CLAIM IN THE DATA. Every analytical statement must reference a specific number, ticker, fund name, or sentiment count from the JSON. Wrap each SoSoValue-sourced value in **bold** markdown. Examples: **$84,532.21**, **+2.34%**, **$645M**, **BTC**, **IBIT (BlackRock)**, **4 bullish / 0 bearish**.
2. EXPLAIN, DON'T RESTATE. For each number you cite, add a short interpretation — what it means for price action, institutional positioning, sentiment regime, or risk. Never just list values.
3. STRUCTURE: 3–5 short paragraphs. Open with a one-line verdict, then dissect the signals (price + momentum, ETF flows + institutional, news + sentiment), then close with risk flags and a clear actionable takeaway. Use markdown bullets when listing multiple drivers; do not use tables.
4. DO NOT describe the visual cards ("the chart shows..."). The user sees them above your text — your job is to add the expert interpretation.
5. If a tool returned an error or empty data, acknowledge it in one sentence and reason from what IS available. Never invent numbers.
6. TONE: professional, confident, concise. No emojis. No filler ("As an AI…", "I hope this helps"). No disclaimers.
7. Length: 120–250 words. Dense, every sentence earning its place.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phase = "plan", messages, toolResults } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    if (phase === "plan") {
      const plan = await planTools(messages, GEMINI_API_KEY);
      return jsonRes({ tools: plan }, 200);
    }

    if (phase === "synthesize") {
      const reply = await synthesize(messages, toolResults || [], GEMINI_API_KEY);
      return jsonRes({ reply }, 200);
    }

    return jsonRes({ error: "Unknown phase" }, 400);
  } catch (e) {
    console.error("ai-chat error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function planTools(messages: any[], apiKey: string) {
  const tools = [
    fnDef("get_market_narrative", "Fetch the current crypto market narrative, regime, and key drivers.", {}),
    fnDef("get_ai_decision", "BUY/SELL/HOLD signal for BTC or ETH with confidence and trade setup.", {
      asset: { type: "string", enum: ["BTC", "ETH"] },
      timeframe: { type: "string", enum: ["short", "medium", "long"] },
      risk: { type: "string", enum: ["low", "medium", "high"] },
    }, ["asset", "timeframe", "risk"]),
    fnDef("get_opportunities", "Scan top coins and return ranked trading opportunities.", {}),
    fnDef("get_etf_flows", "Spot ETF AUM, daily inflows, fund-by-fund breakdown, 30-day history.", {
      etfType: { type: "string", enum: ["btc", "eth"] },
    }),
    fnDef("get_market_overview", "Top coin prices and 24h changes table.", {}),
    fnDef("get_news", "Latest crypto news with AI sentiment tags.", {}),
    fnDef("get_live_chart", "Embedded TradingView price chart for an asset.", {
      symbol: { type: "string", description: "Ticker e.g. BTC, ETH, SOL" },
    }, ["symbol"]),
  ];

  const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [{ role: "system", content: PLAN_PROMPT }, ...messages],
      tools,
      tool_choice: "auto",
    }),
  });

  if (!aiRes.ok) {
    if (aiRes.status === 429) throw new Error("Rate limit exceeded, try again shortly.");
    if (aiRes.status === 402) throw new Error("AI credits exhausted.");
    const t = await aiRes.text();
    console.error("plan gateway error", aiRes.status, t);
    throw new Error("AI gateway error during planning");
  }

  const aiJson = await aiRes.json();
  const toolCalls = aiJson.choices?.[0]?.message?.tool_calls || [];
  return toolCalls.map((tc: any) => ({
    name: tc.function.name,
    args: safeParse(tc.function.arguments),
  }));
}

async function synthesize(messages: any[], toolResults: any[], apiKey: string) {
  // Compact the tool results so the prompt isn't huge
  const compact = toolResults.map((r: any) => ({
    tool: r.name,
    args: r.args || {},
    error: r.error || undefined,
    data: trimResult(r.name, r.result),
  }));

  const userTail = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: SYNTH_PROMPT },
        ...messages,
        {
          role: "user",
          content: `LIVE DATA FROM SOSOVALUE (use these exact numbers and bold them):\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\`\n\nNow write the analytical answer to the user's last question: "${userTail}"`,
        },
      ],
    }),
  });

  if (!aiRes.ok) {
    if (aiRes.status === 429) throw new Error("Rate limit exceeded, try again shortly.");
    if (aiRes.status === 402) throw new Error("AI credits exhausted.");
    const t = await aiRes.text();
    console.error("synth gateway error", aiRes.status, t);
    throw new Error("AI gateway error during synthesis");
  }
  const aiJson = await aiRes.json();
  return aiJson.choices?.[0]?.message?.content || "";
}

// Strip giant arrays so we keep prompts small and meaningful
function trimResult(name: string, data: any): any {
  if (!data) return null;
  switch (name) {
    case "get_market_overview":
      return {
        marketSummary: data.marketSummary,
        topCoins: (data.coins || []).slice(0, 8).map((c: any) => ({
          symbol: c.coinSymbol, price: c.coinPrice, change24h: c.priceChangePercent24h,
          marketCap: c.marketCap, volume24h: c.volume24h,
        })),
      };
    case "get_etf_flows":
      return {
        etfType: data.etfType,
        totals: data.totals,
        topFunds: (data.metrics || []).slice(0, 5).map((m: any) => ({
          name: m.etfName, aum: m.totalNetAssets, dailyInflow: m.dailyInflow, dailyChangePct: m.dailyInflowChangePercent,
        })),
        last7d: (data.history || []).slice(-7),
      };
    case "get_news":
      return {
        sentiment: data.sentiment,
        headlines: (data.items || []).slice(0, 6).map((n: any) => ({
          title: n.title, source: n.source, sentiment: n.sentiment,
        })),
      };
    case "get_opportunities":
      return { opportunities: (data.opportunities || []).slice(0, 6) };
    case "get_live_chart":
      return { symbol: data.symbol };
    default:
      return data; // narrative + decision are already compact
  }
}

function fnDef(name: string, description: string, properties: any, required: string[] = []) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required },
    },
  };
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

function jsonRes(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
