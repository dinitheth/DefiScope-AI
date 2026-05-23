// AI Decision Engine - data-driven trading signals with quantified reasoning
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

interface DecisionInput {
  mode: "signal" | "opportunities" | "narrative";
  asset?: string;
  timeframe?: "short" | "medium" | "long";
  riskTolerance?: "low" | "medium" | "high";
  marketData?: {
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
  };
  etfFlow?: {
    dailyInflow: number;
    weeklyInflow: number;
    inflowChangePercent: number;
    trend: "up" | "down" | "flat";
  };
  newsSentiment?: {
    positive: number;
    negative: number;
    neutral: number;
    headlines?: string[];
  };
  topCoins?: Array<{ symbol: string; price: number; change24h: number; volume24h: number }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: DecisionInput = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { systemPrompt, userPrompt, tools, toolName } = buildPrompt(body);

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return jsonRes({ error: "Rate limit exceeded, try again shortly." }, 429);
      if (aiRes.status === 402) return jsonRes({ error: "AI credits exhausted." }, 402);
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return jsonRes({ error: "AI gateway error" }, 500);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const args = JSON.parse(toolCall.function.arguments);
    const normalized = normalizeOutput(body.mode, args);
    return jsonRes(normalized, 200);
  } catch (e) {
    console.error("ai-decision error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function jsonRes(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Normalize confidence/score values that might come back as 0-1 instead of 0-100
function normalizeOutput(mode: string, args: any): any {
  const fixPct = (v: number | undefined) => {
    if (typeof v !== "number") return v;
    if (v > 0 && v <= 1) return Math.round(v * 100);
    return Math.round(v);
  };
  const fixScore10 = (v: number | undefined) => {
    if (typeof v !== "number") return v;
    if (v > 10) return Math.round(v) / 10; // 87 -> 8.7
    return Math.round(v * 10) / 10;
  };

  if (mode === "signal" && args) {
    args.confidence = fixPct(args.confidence);
    if (args.riskBreakdown) {
      args.riskBreakdown.volatility = fixPct(args.riskBreakdown.volatility);
      args.riskBreakdown.newsStability = fixPct(args.riskBreakdown.newsStability);
      args.riskBreakdown.liquidity = fixPct(args.riskBreakdown.liquidity);
    }
    if (args.tradeSetup) {
      args.tradeSetup.entry = Number(args.tradeSetup.entry);
      args.tradeSetup.stopLoss = Number(args.tradeSetup.stopLoss);
      args.tradeSetup.target = Number(args.tradeSetup.target);
      const e = args.tradeSetup.entry, s = args.tradeSetup.stopLoss, t = args.tradeSetup.target;
      if (e && s && t && e !== s) {
        args.tradeSetup.riskReward = Math.round((Math.abs(t - e) / Math.abs(e - s)) * 10) / 10;
      }
    }
  }
  if (mode === "opportunities" && args?.opportunities) {
    args.opportunities = args.opportunities.map((op: any) => ({
      ...op,
      confidence: fixPct(op.confidence),
      rankScore: fixScore10(op.rankScore),
    }));
  }
  return args;
}

function buildPrompt(body: DecisionInput) {
  if (body.mode === "narrative") {
    return {
      systemPrompt: `You are a market narrative analyst. In 2 sentences, describe the dominant macro narrative of the crypto market right now based on the data. Be specific and reference actual numbers.`,
      userPrompt: `Top coins: ${JSON.stringify(body.topCoins)}\nNews sentiment: ${JSON.stringify(body.newsSentiment)}\nETF: ${JSON.stringify(body.etfFlow)}`,
      toolName: "report_narrative",
      tools: [{
        type: "function",
        function: {
          name: "report_narrative",
          description: "Report the current market narrative",
          parameters: {
            type: "object",
            properties: {
              headline: { type: "string", description: "Short 6-10 word headline" },
              narrative: { type: "string", description: "1-2 sentence narrative referencing specific numbers" },
              regime: { type: "string", enum: ["accumulation", "distribution", "trending_up", "trending_down", "consolidation", "volatile"] },
              keyDrivers: { type: "array", items: { type: "string" }, description: "3 key drivers, each quantified" },
            },
            required: ["headline", "narrative", "regime", "keyDrivers"],
          },
        },
      }],
    };
  }

  if (body.mode === "opportunities") {
    return {
      systemPrompt: `You are a quantitative crypto market scanner. Identify 4-5 actionable opportunities from the data. For each: explain WHY using SPECIFIC numbers (not generic phrases). Rank by composite score 0-10.`,
      userPrompt: `Top market data:\n${JSON.stringify(body.topCoins, null, 2)}\n\nNews sentiment: ${JSON.stringify(body.newsSentiment)}\n\nFind real opportunities. Quantify everything.`,
      toolName: "report_opportunities",
      tools: [{
        type: "function",
        function: {
          name: "report_opportunities",
          description: "Report ranked trading opportunities",
          parameters: {
            type: "object",
            properties: {
              opportunities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    type: { type: "string", enum: ["momentum", "reversal", "breakout", "volume_spike", "sentiment_shift", "etf_flow"] },
                    action: { type: "string", enum: ["BUY", "SELL", "WATCH"] },
                    confidence: { type: "number", minimum: 0, maximum: 100, description: "0-100 percentage" },
                    rankScore: { type: "number", minimum: 0, maximum: 10, description: "Composite rank score 0-10, one decimal" },
                    reasoning: { type: "string", description: "1-2 sentences with SPECIFIC numbers (e.g. 'volume +47% vs 7d avg, price broke 30d high at $X')" },
                    drivers: { type: "array", items: { type: "string" }, description: "2-3 short bullet drivers, each with a number" },
                    timeframe: { type: "string", enum: ["short", "medium", "long"] },
                  },
                  required: ["symbol", "type", "action", "confidence", "rankScore", "reasoning", "drivers", "timeframe"],
                },
              },
            },
            required: ["opportunities"],
          },
        },
      }],
    };
  }

  // signal mode
  const tf = body.timeframe ?? "medium";
  const risk = body.riskTolerance ?? "medium";
  return {
    systemPrompt: `You are a senior quantitative crypto strategist. Produce ONE clear decision tailored to the user's timeframe (${tf}) and risk tolerance (${risk}).

Rules for reasoning:
- Every bullet MUST cite a specific number from the data (e.g. "ETF inflow +12.4% (24h)", "4/5 news bullish", "price +2.34% on volume spike")
- NEVER use vague phrases like "strong fundamentals" or "positive sentiment" without a number
- Confidence is 0-100 (integer percentage)
- Trade setup must be realistic given the current price; for BUY: stopLoss < entry < target; for SELL: target < entry < stopLoss; for HOLD: still suggest a range

Confidence formula reference:
- 80-100 = strong conviction (3 of 3 signals aligned + clean data)
- 60-79 = moderate (2 of 3 aligned)
- 40-59 = weak (mixed signals)
- 0-39 = avoid (conflicting signals)`,
    userPrompt: `Asset: ${body.asset}
User timeframe preference: ${tf}
User risk tolerance: ${risk}

Market data: ${JSON.stringify(body.marketData)}
ETF flow: ${JSON.stringify(body.etfFlow)}
News sentiment: ${JSON.stringify(body.newsSentiment)}

Produce a quantified BUY/SELL/HOLD decision. Cite numbers in every bullet.`,
    toolName: "report_decision",
    tools: [{
      type: "function",
      function: {
        name: "report_decision",
        description: "Report a quantified trading decision",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
            confidence: { type: "number", minimum: 0, maximum: 100, description: "Integer percentage 0-100" },
            confidenceBasis: { type: "string", description: "One sentence explaining what drove the confidence (signal alignment count)" },
            conviction: { type: "string", enum: ["low", "medium", "high"] },
            summary: { type: "string", description: "One-sentence headline with at least one number" },
            reasoning: {
              type: "array",
              items: { type: "string" },
              description: "3-5 bullets, EACH with a specific number from the data",
            },
            signals: {
              type: "object",
              properties: {
                momentum: { type: "string", enum: ["bullish", "bearish", "neutral"] },
                institutional: { type: "string", enum: ["bullish", "bearish", "neutral"] },
                sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"] },
              },
              required: ["momentum", "institutional", "sentiment"],
            },
            riskBreakdown: {
              type: "object",
              properties: {
                volatility: { type: "number", minimum: 0, maximum: 100, description: "0-100 risk score" },
                newsStability: { type: "number", minimum: 0, maximum: 100 },
                liquidity: { type: "number", minimum: 0, maximum: 100 },
              },
              required: ["volatility", "newsStability", "liquidity"],
            },
            tradeSetup: {
              type: "object",
              properties: {
                entry: { type: "number", description: "Suggested entry price near current price" },
                stopLoss: { type: "number" },
                target: { type: "number" },
                riskReward: { type: "number", description: "R:R ratio" },
              },
              required: ["entry", "stopLoss", "target", "riskReward"],
            },
            suggestedTimeframe: { type: "string", enum: ["short-term (1-7d)", "medium-term (1-4w)", "long-term (1m+)"] },
          },
          required: ["action", "confidence", "confidenceBasis", "conviction", "summary", "reasoning", "signals", "riskBreakdown", "tradeSetup", "suggestedTimeframe"],
        },
      },
    }],
  };
}
