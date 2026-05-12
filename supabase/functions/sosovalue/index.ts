// SoSoValue proxy — corrected to use the official v1 API endpoints.
// Base: https://openapi.sosovalue.com/openapi/v1
// Auth: x-soso-api-key header
// Rate limit: 20 req/min, 100k/month

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const SOSO_BASE = "https://openapi.sosovalue.com/openapi/v1";
const CACHE_TTL_MS = 90_000;      // 90s cache — conservative to protect 20 req/min limit
const HEALTH_COOLDOWN_MS = 60_000;
const RATE_LIMIT_PER_MIN = 18;    // leave headroom (actual limit = 20)
const RATE_WINDOW_MS = 60_000;

// Known SoSoValue currency IDs for the top coins — obtained via GET /currencies
// These are stable string IDs used as path params for /currencies/{id}/market-snapshot
const KNOWN_CURRENCY_IDS: Record<string, string> = {
  BTC:  "1",
  ETH:  "2",
  USDT: "825",
  BNB:  "1839",
  SOL:  "5426",
  USDC: "3408",
  XRP:  "52",
  DOGE: "74",
  ADA:  "2010",
  AVAX: "5805",
  DOT:  "6636",
  LINK: "1975",
  MATIC:"3890",
  LTC:  "2",
};

// BTC ETF tickers on US market (most liquid)
const BTC_ETF_TICKERS = ["IBIT", "FBTC", "ARKB", "BITB", "HODL", "BRRR", "EZBC", "BTCO", "GBTC"];
// ETH ETF tickers
const ETH_ETF_TICKERS = ["ETHA", "FETH", "CETH", "ETHW", "EZET", "QETH"];

type EndpointKey = "coinList" | "etfMetrics" | "etfInflowHistory" | "news";

const cache = new Map<string, { ts: number; data: unknown }>();
let providerHealth = { ok: true, status: "healthy", lastCheckedAt: 0, lastStatus: 0, lastError: "" };
const recentCalls: number[] = [];

async function rateLimitGate() {
  while (true) {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0] > RATE_WINDOW_MS) recentCalls.shift();
    if (recentCalls.length < RATE_LIMIT_PER_MIN) { recentCalls.push(now); return; }
    const waitMs = RATE_WINDOW_MS - (now - recentCalls[0]) + 100;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 5_000)));
  }
}

function cacheKey(k: string) { return k; }

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Core HTTP call to SoSoValue v1 API
async function sosoGet(path: string, queryParams: Record<string, string | number | undefined>, apiKey: string): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  await rateLimitGate();
  const url = new URL(`${SOSO_BASE}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-soso-api-key": apiKey, "Accept": "application/json" },
    });
    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    // SoSoValue wraps: { code: 0, msg: "ok", data: ... } or returns array directly
    if (payload && typeof payload === "object" && "code" in payload) {
      if (payload.code !== 0 && payload.code !== "0") {
        return { ok: false, status: res.status, data: null, error: payload.msg || payload.message || `SoSoValue code ${payload.code}` };
      }
      return { ok: true, status: res.status, data: payload.data ?? payload };
    }
    if (!res.ok) return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: payload };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}

// ────────────────────────────────────────────────────
// Endpoint handlers — each implements one logical call
// ────────────────────────────────────────────────────

// 1. Coin list with market data
// Strategy: GET /currencies for list, then GET /currencies/{id}/market-snapshot for top coins
async function handleCoinList(apiKey: string) {
  const ck = cacheKey("coinList");
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return { data: cached.data, cached: true };

  // Fetch list of currencies first
  const listRes = await sosoGet("/currencies", {}, apiKey);
  if (!listRes.ok) return { data: null, error: listRes.error, unavailable: true };

  const allCoins: any[] = Array.isArray(listRes.data) ? listRes.data : [];
  // Pick top coins: BTC, ETH, USDT, BNB, SOL, USDC, XRP, DOGE — by matching symbol
  const targetSymbols = ["BTC","ETH","USDT","BNB","SOL","USDC","XRP","DOGE","ADA","AVAX"];
  const targetCoins = allCoins.filter(c => targetSymbols.includes((c.symbol || "").toUpperCase()));

  // Fetch market snapshot for each (up to 8 to stay under rate limit)
  const snapshotResults = await Promise.allSettled(
    targetCoins.slice(0, 8).map(async (coin) => {
      const snap = await sosoGet(`/currencies/${coin.currency_id}/market-snapshot`, {}, apiKey);
      return {
        coinId:   coin.currency_id,
        coinName: coin.name,
        coinSymbol: (coin.symbol || "").toUpperCase(),
        coinLogo: "",
        coinPrice: snap.ok ? Number((snap.data as any)?.price ?? 0) : 0,
        priceChangePercent24h: snap.ok ? Number((snap.data as any)?.change_pct_24h ?? 0) : 0,
        marketCap: snap.ok ? Number((snap.data as any)?.marketcap ?? 0) : 0,
        volume24h: snap.ok ? Number((snap.data as any)?.turnover_24h ?? 0) : 0,
      };
    })
  );

  const result = snapshotResults
    .filter(r => r.status === "fulfilled")
    .map(r => (r as PromiseFulfilledResult<any>).value);

  cache.set(ck, { ts: Date.now(), data: result });
  return { data: result };
}

// 2. ETF Metrics (per-fund snapshot)
// Strategy: GET /etfs?symbol=BTC&country_code=US → tickers,
// then GET /etfs/{ticker}/market-snapshot for each
async function handleEtfMetrics(symbol: string, apiKey: string) {
  const sym = (symbol || "BTC").toUpperCase();
  const ck = cacheKey(`etfMetrics:${sym}`);
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return { data: cached.data, cached: true };

  // Get ETF list for this symbol
  const listRes = await sosoGet("/etfs", { symbol: sym, country_code: "US" }, apiKey);
  if (!listRes.ok) return { data: null, error: listRes.error, unavailable: true };

  const etfs: any[] = Array.isArray(listRes.data) ? listRes.data : [];
  // Fallback to known tickers if list is empty
  const tickers = etfs.length > 0
    ? etfs.map(e => e.ticker).filter(Boolean)
    : (sym === "BTC" ? BTC_ETF_TICKERS : ETH_ETF_TICKERS);

  // Get market snapshot for top 6 ETFs (rate limit conscious)
  const snapshotResults = await Promise.allSettled(
    tickers.slice(0, 6).map(async (ticker: string) => {
      const snap = await sosoGet(`/etfs/${ticker}/market-snapshot`, {}, apiKey);
      const etfMeta = etfs.find(e => e.ticker === ticker);
      return {
        etfName: etfMeta?.name ?? ticker,
        ticker,
        totalNetAssets: snap.ok ? Number((snap.data as any)?.net_assets ?? 0) : 0,
        totalInflow:    snap.ok ? Number((snap.data as any)?.cum_inflow  ?? 0) : 0,
        dailyInflow:    snap.ok ? Number((snap.data as any)?.net_inflow  ?? 0) : 0,
        dailyInflowChangePercent: 0,
        price:          snap.ok ? Number((snap.data as any)?.mkt_price   ?? 0) : 0,
        priceChangePercent: 0,
      };
    })
  );

  const result = snapshotResults
    .filter(r => r.status === "fulfilled")
    .map(r => (r as PromiseFulfilledResult<any>).value);

  cache.set(ck, { ts: Date.now(), data: result });
  return { data: result };
}

// 3. ETF Inflow History
// GET /etfs/summary-history?symbol=BTC&country_code=US&limit=30
async function handleEtfInflowHistory(symbol: string, apiKey: string) {
  const sym = (symbol || "BTC").toUpperCase();
  const ck = cacheKey(`etfInflowHistory:${sym}`);
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return { data: cached.data, cached: true };

  const res = await sosoGet("/etfs/summary-history", { symbol: sym, country_code: "US", limit: 30 }, apiKey);
  if (!res.ok) return { data: null, error: res.error, unavailable: true };

  const arr: any[] = Array.isArray(res.data) ? res.data : [];
  // Summary history is reverse chronological — reverse to get oldest first for charts
  const result = arr.slice().reverse().map(h => ({
    date:        h.date        ?? "",
    totalInflow: Number(h.cum_net_inflow    ?? h.total_net_inflow ?? 0),
    dailyInflow: Number(h.total_net_inflow  ?? 0),
  }));

  cache.set(ck, { ts: Date.now(), data: result });
  return { data: result };
}

// 4. News
// GET /news/featured?page=1&page_size=20
async function handleNews(apiKey: string) {
  const ck = cacheKey("news");
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return { data: cached.data, cached: true };

  const res = await sosoGet("/news/featured", { page: 1, page_size: 20 }, apiKey);
  if (!res.ok) return { data: null, error: res.error, unavailable: true };

  const payload: any = res.data;
  const list: any[] = Array.isArray(payload) ? payload
    : Array.isArray(payload?.list) ? payload.list
    : [];

  const result = list.map(n => ({
    id:          String(n.id ?? crypto.randomUUID()),
    title:       n.title       ?? "",
    summary:     (n.content    ?? n.summary ?? "").replace(/<[^>]*>/g, "").slice(0, 300),
    source:      n.author      ?? n.nick_name ?? "SoSoValue",
    publishedAt: n.release_time ? new Date(Number(n.release_time)).toISOString() : "",
    url:         n.source_link ?? "#",
    imageUrl:    n.feature_image ?? undefined,
    sentiment:   "neutral" as const,
  }));

  cache.set(ck, { ts: Date.now(), data: result });
  return { data: result };
}

// ────────────────────────────────────────────────────
// Main Deno serve handler
// ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SOSO_API_KEY = Deno.env.get("SOSO_API_KEY");
    if (!SOSO_API_KEY) return jsonRes({ error: "SOSO_API_KEY is not configured on the server" }, 500);

    const body = await req.json().catch(() => ({}));
    const { endpoint, params = {} } = body as { endpoint: string; params: Record<string, string> };

    if (!endpoint) return jsonRes({ error: "endpoint is required" }, 400);

    let result: { data: unknown; error?: string; cached?: boolean; unavailable?: boolean };

    switch (endpoint as EndpointKey) {
      case "coinList":
        result = await handleCoinList(SOSO_API_KEY);
        break;
      case "etfMetrics": {
        const sym = params.etfType ?? params.symbol ?? "BTC";
        result = await handleEtfMetrics(sym, SOSO_API_KEY);
        break;
      }
      case "etfInflowHistory": {
        const sym = params.etfType ?? params.symbol ?? "BTC";
        result = await handleEtfInflowHistory(sym, SOSO_API_KEY);
        break;
      }
      case "news":
        result = await handleNews(SOSO_API_KEY);
        break;
      default:
        return jsonRes({ error: `Unknown endpoint: ${endpoint}` }, 400);
    }

    if (result.unavailable) {
      return jsonRes({
        data: null, fallback: true, stale: false, unavailable: true,
        error: result.error ?? "Provider unavailable",
        providerStatus: "degraded",
      }, 200);
    }

    return jsonRes({ data: result.data, cached: result.cached ?? false, providerStatus: "healthy" }, 200);

  } catch (e) {
    console.error("sosovalue proxy exception:", e);
    return jsonRes({ data: null, fallback: true, unavailable: true, error: String(e), providerStatus: "degraded" }, 200);
  }
});
