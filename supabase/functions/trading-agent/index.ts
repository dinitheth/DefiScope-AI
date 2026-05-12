// Trading Agent — orchestrates signal generation, risk checks, and execution.
// Endpoints (single function, action-based dispatch):
//   action: "generate"        → analyze SoSoValue data, produce ranked signals (saved to DB)
//   action: "execute"         → take a signal_id, run risk checks, call sodex-executor
//   action: "quick_trade"     → place market order directly, minimal risk checks
//   action: "close_position"  → cancel/close an open position via sodex-executor cancelOrder
//   action: "run_cycle"       → generate + auto-execute (when agent.enabled and fully autonomous)
//
// All writes/reads are scoped by owner_key from the x-owner-key header (matches RLS).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const SOSO_FN = "sosovalue";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AgentSettings {
  enabled: boolean;
  market: "spot" | "perps" | "both";
  min_confidence: number;
  max_position_pct: number;
  daily_trade_limit: number;
  volatility_circuit_breaker: number;
  leverage: number;
  account_balance_usd: number;
}

const DEFAULT_SETTINGS: AgentSettings = {
  enabled: false,
  market: "spot",
  min_confidence: 80,
  max_position_pct: 0.05,
  daily_trade_limit: 10,
  volatility_circuit_breaker: 3.0,
  leverage: 1,
  account_balance_usd: 10000,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ownerKey = req.headers.get("x-owner-key") || "";
    if (!ownerKey) return jsonRes({ error: "Missing owner key" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "generate";

    // ── Load / create settings ─────────────────────────────────────────────
    let { data: settingsRow } = await admin
      .from("agent_settings").select("*").eq("owner_key", ownerKey).maybeSingle();
    if (!settingsRow) {
      const { data: created } = await admin
        .from("agent_settings")
        .insert({ owner_key: ownerKey, ...DEFAULT_SETTINGS })
        .select().single();
      settingsRow = created;
    }
    const settings: AgentSettings = { ...DEFAULT_SETTINGS, ...settingsRow };

    // ── Helper: call sodex-executor ────────────────────────────────────────
    const callExecutor = async (payload: Record<string, unknown>) => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/sodex-executor`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${ANON_KEY}`,
          apikey:          ANON_KEY,
          "x-owner-key":   ownerKey,
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { ok: false, error: text || "executor parse error" };
      }
      if (!r.ok && data?.ok !== false) {
        return { ok: false, status: r.status, error: data?.error || `Executor HTTP ${r.status}`, raw: data };
      }
      return data;
    };

    // ── GENERATE ───────────────────────────────────────────────────────────
    if (action === "generate" || action === "run_cycle") {
      const signals = await generateSignals(SUPABASE_URL, ANON_KEY, ownerKey, LOVABLE_API_KEY, settings);
      const inserted: any[] = [];
      for (const sig of signals) {
        const { data, error } = await admin.from("signals")
          .insert({ owner_key: ownerKey, ...sig }).select().single();
        if (!error && data) inserted.push(data);
      }

      if (action === "run_cycle" && settings.enabled) {
        const results: any[] = [];
        for (const sig of inserted) {
          if (sig.confidence < settings.min_confidence) continue;
          const r = await executeSignal(admin, ownerKey, sig.id, settings, callExecutor);
          results.push(r);
        }
        return jsonRes({ ok: true, signals: inserted, executions: results });
      }

      return jsonRes({ ok: true, signals: inserted });
    }

    // ── EXECUTE SIGNAL ─────────────────────────────────────────────────────
    if (action === "execute") {
      const signalId = body.signal_id;
      if (!signalId) return jsonRes({ error: "signal_id required" }, 400);
      const r = await executeSignal(admin, ownerKey, signalId, settings, callExecutor);
      return jsonRes(r);
    }

    // ── QUICK TRADE (user-initiated from chat) ─────────────────────────────
    if (action === "quick_trade") {
      const asset    = String(body.asset || "BTC").toUpperCase();
      const side     = body.side === "SELL" ? "SELL" : "BUY";
      const market   = body.market === "perps" ? "perps"
                     : (settings.market === "perps" ? "perps" : "spot");
      const sizePct  = clamp(Number(body.size_pct ?? settings.max_position_pct), 0.005, 1);

      // Fetch live price (best-effort)
      let refPrice = 0;
      try {
        const px = await fetch(`${SUPABASE_URL}/functions/v1/${SOSO_FN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
          body: JSON.stringify({ endpoint: "coinList" }),
        }).then(r => r.json());
        const coin = (px?.data?.data || []).find((c: any) => c.coinSymbol === asset);
        refPrice = Number(coin?.coinPrice) || 0;
      } catch { /* ignore */ }

      const notional = settings.account_balance_usd * sizePct;
      const size = refPrice > 0 ? (notional / refPrice).toFixed(6) : "0.001";

      // Create audit signal
      const { data: sig } = await admin.from("signals").insert({
        owner_key: ownerKey, asset, side, market,
        confidence: 100, conviction: "high",
        reasoning: "User-initiated quick trade via agent chat",
        drivers: ["manual_user_request"],
        price: refPrice || null,
        stop_loss: null, target: null, status: "pending",
      }).select().single();

      // Call executor directly
      const execData = await callExecutor({
        action: "newOrder", asset, market, side, size,
        positionSide: side === "BUY" ? 1 : 2,
      });

      const tradeStatus = execData.ok ? "submitted" : "failed";
      const { data: trade } = await admin.from("trades").insert({
        owner_key: ownerKey, signal_id: sig?.id || null,
        asset, market, side, size: Number(size), price: refPrice,
        status: tradeStatus,
        sodex_order_id: execData.clOrdID || null,
        sodex_response: execData.sodex || execData,
        payload_hash: execData.payloadHash || null,
        nonce: execData.nonce || null,
        error: execData.error || null,
      }).select().single();

      if (execData.ok) {
        await admin.from("signals").update({ status: "executed" }).eq("id", sig?.id);
        await admin.from("positions").insert({
          owner_key: ownerKey, asset, market, side,
          size: Number(size), entry_price: refPrice,
          stop_loss: null, target: null, status: "open",
          sodex_order_id: execData.clOrdID || null,
        });
      } else {
        await admin.from("signals").update({ status: "failed" }).eq("id", sig?.id);
      }

      return jsonRes({
        ok: execData.ok,
        trade,
        sodex: execData,
        symbol: execData.symbol,
        clOrdID: execData.clOrdID,
        size,
        price: refPrice,
        message: execData.ok
          ? `${side} ${size} ${asset} on SoDEX Testnet (${execData.symbol || market}). Order ID: ${execData.clOrdID || "pending"}`
          : `Trade failed: ${execData.sodex?.error || execData.error || "Unknown error from SoDEX"}`,
      });
    }

    // ── CLOSE POSITION ─────────────────────────────────────────────────────
    if (action === "close_position") {
      const asset   = String(body.asset || "BTC").toUpperCase();
      const market  = body.market === "perps" ? "perps" : "spot";
      const clOrdIDToCancel = body.clOrdIDToCancel || body.sodex_order_id || undefined;

      // Load the open position to get its order ID
      let positionRow: any = null;
      if (!clOrdIDToCancel) {
        const { data: pos } = await admin.from("positions")
          .select("*").eq("owner_key", ownerKey)
          .eq("asset", asset).eq("market", market).eq("status", "open")
          .order("opened_at", { ascending: false }).limit(1).single();
        positionRow = pos;
      }

      const cancelOrderId = clOrdIDToCancel || positionRow?.sodex_order_id || undefined;

      // Call executor with cancelOrder action
      // Also try placing a reduce-only opposite order if no stored order ID
      let execData: any;
      if (cancelOrderId) {
        execData = await callExecutor({
          action: "cancelOrder",
          asset,
          market,
          clOrdIDToCancel: cancelOrderId,
        });
      } else {
        // No stored order ID → place reduce-only opposite side market order
        const pos = positionRow;
        const closeSide = pos?.side === "BUY" ? "SELL" : "BUY";
        const closeSize = pos?.size ? String(pos.size) : "0.001";
        execData = await callExecutor({
          action: "newOrder",
          asset,
          market,
          side: closeSide,
          size: closeSize,
          reduceOnly: market === "perps",
          positionSide: pos?.side === "BUY" ? 1 : 2,
        });
      }

      // Update position record
      if (execData.ok && positionRow?.id) {
        await admin.from("positions")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", positionRow.id);
      }

      // Log the close trade
      await admin.from("trades").insert({
        owner_key: ownerKey,
        asset, market,
        side: positionRow?.side === "BUY" ? "SELL" : "BUY",
        size: positionRow?.size || 0,
        price: positionRow?.entry_price || 0,
        status: execData.ok ? "submitted" : "failed",
        sodex_order_id: execData.clOrdID || cancelOrderId || null,
        sodex_response: execData,
        error: execData.error || null,
      });

      return jsonRes({
        ok: execData.ok,
        sodex: execData,
        clOrdID: execData.clOrdID || cancelOrderId,
        message: execData.ok
          ? `Position closed for ${asset} (${market}). SoDEX response received.`
          : `Close failed: ${execData.sodex?.error || execData.error || "Unknown SoDEX error"}`,
      });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("trading-agent error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ─── Signal generator ─────────────────────────────────────────────────────────
async function generateSignals(
  supabaseUrl: string,
  anonKey: string,
  ownerKey: string,
  apiKey: string,
  settings: AgentSettings,
): Promise<Array<Record<string, unknown>>> {
  const fetchSoso = (endpoint: string, params: Record<string, unknown> = {}) =>
    fetch(`${supabaseUrl}/functions/v1/${SOSO_FN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ endpoint, params }),
    }).then((r) => r.json()).catch(() => ({ data: null, stale: true }));

  const [coins, btcEtfs, ethEtfs, news] = await Promise.all([
    fetchSoso("coinList"),
    fetchSoso("etfMetrics", { type: "us-btc-spot" }),
    fetchSoso("etfMetrics", { type: "us-eth-spot" }),
    fetchSoso("news"),
  ]);

  const coinList    = coins?.data?.data || [];
  const btcMetrics  = btcEtfs?.data?.data || [];
  const ethMetrics  = ethEtfs?.data?.data || [];
  const newsItems   = (news?.data?.data?.list || []).slice(0, 12);

  const summary = {
    btc: pickCoin(coinList, "BTC"),
    eth: pickCoin(coinList, "ETH"),
    btcEtfDailyInflow: sumField(btcMetrics, "dailyInflow"),
    ethEtfDailyInflow: sumField(ethMetrics, "dailyInflow"),
    headlines: newsItems.map((n: any) => ({ title: n.title, sentiment: n.sentiment })),
  };

  const sysPrompt = `You are the DefiScope Signal Generator. Convert live SoSoValue data into 1-3 actionable trade signals for an autonomous trading agent on SoDEX (testnet).

Output STRICT JSON: { "signals": [ { asset, side, market, confidence, conviction, reasoning, drivers, stop_loss_pct, target_pct } ] }

Rules:
- asset ∈ ["BTC","ETH"]; side ∈ ["BUY","SELL"]; market ∈ ${JSON.stringify(settings.market === "both" ? ["spot","perps"] : [settings.market])}
- confidence: integer 0-100. Only emit signals you'd act on (≥60). The agent's min threshold is ${settings.min_confidence}.
- conviction ∈ ["low","medium","high"]
- reasoning: 1-2 sentences citing specific numbers from the data
- drivers: array of 2-4 short bullet strings
- stop_loss_pct: 0.005-0.05 (fraction of entry, e.g. 0.02 = 2%)
- target_pct: 0.01-0.15
- If data is mixed/unclear, return { "signals": [] }. Never invent numbers.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `LIVE SOSOVALUE DATA:\n${JSON.stringify(summary, null, 2)}\n\nGenerate signals.` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiRes.ok) {
    console.error("signal AI gateway error", aiRes.status, await aiRes.text());
    return [];
  }
  const aiJson = await aiRes.json();
  const raw = aiJson.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const sigs = Array.isArray(parsed.signals) ? parsed.signals : [];

  return sigs.map((s: any) => {
    const asset = String(s.asset || "BTC").toUpperCase();
    const refPrice = asset === "BTC" ? Number(summary.btc?.coinPrice) : Number(summary.eth?.coinPrice);
    const stopPct = clamp(Number(s.stop_loss_pct ?? 0.02), 0.005, 0.05);
    const tgtPct  = clamp(Number(s.target_pct   ?? 0.04), 0.01,  0.15);
    const side    = s.side === "SELL" ? "SELL" : "BUY";
    const stop    = side === "BUY" ? refPrice * (1 - stopPct) : refPrice * (1 + stopPct);
    const target  = side === "BUY" ? refPrice * (1 + tgtPct)  : refPrice * (1 - tgtPct);

    return {
      asset,
      side,
      market: settings.market === "both" ? (s.market === "perps" ? "perps" : "spot") : settings.market,
      confidence: clamp(Math.round(Number(s.confidence) || 0), 0, 100),
      conviction: ["low","medium","high"].includes(s.conviction) ? s.conviction : "medium",
      reasoning: String(s.reasoning || ""),
      drivers: Array.isArray(s.drivers) ? s.drivers.slice(0, 4) : [],
      price:     refPrice || null,
      stop_loss: refPrice ? stop   : null,
      target:    refPrice ? target : null,
      source: { btcInflow: summary.btcEtfDailyInflow, ethInflow: summary.ethEtfDailyInflow },
      status: "pending",
    };
  });
}

// ─── Risk check + Execute ─────────────────────────────────────────────────────
async function executeSignal(
  admin: any,
  ownerKey: string,
  signalId: string,
  settings: AgentSettings,
  callExecutor: (p: Record<string, unknown>) => Promise<any>,
) {
  const { data: signal, error: sigErr } = await admin
    .from("signals").select("*").eq("id", signalId).eq("owner_key", ownerKey).single();
  if (sigErr || !signal) return { ok: false, error: "Signal not found" };

  // Risk check 1: confidence threshold
  if (signal.confidence < settings.min_confidence) {
    await logRisk(admin, ownerKey, "blocked_low_confidence", signal.asset,
      `Confidence ${signal.confidence} < threshold ${settings.min_confidence}`, { signalId });
    await admin.from("signals").update({ status: "rejected" }).eq("id", signalId);
    return { ok: false, error: "Below confidence threshold" };
  }

  // Risk check 2: daily trade limit
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("trades").select("*", { count: "exact", head: true })
    .eq("owner_key", ownerKey).gte("created_at", since);
  if ((count ?? 0) >= settings.daily_trade_limit) {
    await logRisk(admin, ownerKey, "circuit_breaker_daily_limit", signal.asset,
      `Daily trade limit reached: ${count}/${settings.daily_trade_limit}`, {});
    await admin.from("trades").insert({
      owner_key: ownerKey, signal_id: signalId, asset: signal.asset, market: signal.market,
      side: signal.side, size: 0, status: "blocked", error: "daily_limit",
    });
    return { ok: false, error: "Daily trade limit reached" };
  }

  // Position sizing
  const notional = settings.account_balance_usd * settings.max_position_pct;
  const refPrice  = Number(signal.price) || 1;
  const size      = (notional / refPrice).toFixed(6);

  await admin.from("signals").update({ status: "executing" }).eq("id", signalId);

  // Call SoDEX executor with the real API
  const execData = await callExecutor({
    action: "newOrder",
    asset: signal.asset,
    market: signal.market,
    side: signal.side,
    size,
    positionSide: signal.side === "BUY" ? 1 : 2,
  });

  const tradeStatus = execData.ok ? "submitted" : "failed";
  const { data: trade } = await admin.from("trades").insert({
    owner_key: ownerKey,
    signal_id: signalId,
    asset: signal.asset,
    market: signal.market,
    side: signal.side,
    size: Number(size),
    price: refPrice,
    status: tradeStatus,
    sodex_order_id: execData.clOrdID || null,
    sodex_response: execData.sodex || execData,
    payload_hash: execData.payloadHash || null,
    nonce: execData.nonce || null,
    error: execData.error || null,
  }).select().single();

  await admin.from("signals").update({
    status: execData.ok ? "executed" : "failed",
  }).eq("id", signalId);

  if (execData.ok) {
    await admin.from("positions").insert({
      owner_key: ownerKey,
      asset: signal.asset, market: signal.market, side: signal.side,
      size: Number(size), entry_price: refPrice,
      stop_loss: signal.stop_loss, target: signal.target,
      status: "open",
      sodex_order_id: execData.clOrdID || null,
    });
  }

  return {
    ok: execData.ok,
    trade,
    sodex: execData,
    symbol: execData.symbol,
    clOrdID: execData.clOrdID,
    message: execData.ok
      ? `${signal.side} ${size} ${signal.asset} on SoDEX (${execData.symbol || signal.market}). Order: ${execData.clOrdID}`
      : `Execution failed: ${execData.error || "SoDEX error"}`,
  };
}

async function logRisk(admin: any, ownerKey: string, type: string, asset: string | null, reason: string, metadata: any) {
  await admin.from("risk_events").insert({ owner_key: ownerKey, event_type: type, asset, reason, metadata });
}

function pickCoin(list: any[], sym: string) {
  return list.find((c: any) => c.coinSymbol === sym) || null;
}
function sumField(arr: any[], k: string) {
  return arr.reduce((s, x) => s + (Number(x?.[k]) || 0), 0);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
