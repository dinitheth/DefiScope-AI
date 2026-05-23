// SoSoValue proxy - keeps API keys server-side, avoids browser CORS,
// caches responses, and degrades gracefully when the upstream is busy.
// coinList uses Binance public ticker for real prices (no extra API key needed).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const SOSO_BASE = "https://openapi.sosovalue.com";
const PROVIDER_UNAVAILABLE = "data provider is temporarily unavailable";
const HEALTH_COOLDOWN_MS = 45_000;
const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_PER_MIN = 20;
const RATE_WINDOW_MS = 60_000;

type EndpointKey = "coinList" | "coinMarkets" | "etfMetrics" | "etfInflowHistory" | "news";
type ProviderHealth = {
  ok: boolean;
  status: "healthy" | "degraded";
  lastCheckedAt: number;
  lastStatus?: number;
  lastError?: string;
};

const ENDPOINTS: Record<EndpointKey, {
  path: string;
  method: "GET" | "POST";
  defaults?: Record<string, unknown>;
  base?: string;
  auth?: boolean;
}> = {
  coinList: { path: "/openapi/v1/data/default/coin/list", method: "POST" },
  coinMarkets: {
    path: "/api/v3/coins/markets",
    method: "GET",
    base: "https://api.coingecko.com",
    auth: false,
    defaults: {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 25,
      page: 1,
      price_change_percentage: "24h",
    },
  },
  etfMetrics: { path: "/openapi/v2/etf/currentEtfDataMetrics", method: "POST" },
  etfInflowHistory: { path: "/openapi/v2/etf/historicalInflowChart", method: "POST" },
  news: {
    path: "/openapi/v1/news/featured",
    method: "GET",
    defaults: { pageNum: 1, pageSize: 20 },
  },
};

// Binance ticker metadata
const BINANCE_PAIRS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT","DOTUSDT"];
const PAIR_META: Record<string, { coinName: string; coinSymbol: string }> = {
  BTCUSDT:  { coinName: "Bitcoin",   coinSymbol: "BTC"  },
  ETHUSDT:  { coinName: "Ethereum",  coinSymbol: "ETH"  },
  SOLUSDT:  { coinName: "Solana",    coinSymbol: "SOL"  },
  BNBUSDT:  { coinName: "BNB",       coinSymbol: "BNB"  },
  XRPUSDT:  { coinName: "XRP",       coinSymbol: "XRP"  },
  DOGEUSDT: { coinName: "Dogecoin",  coinSymbol: "DOGE" },
  ADAUSDT:  { coinName: "Cardano",   coinSymbol: "ADA"  },
  AVAXUSDT: { coinName: "Avalanche", coinSymbol: "AVAX" },
  LINKUSDT: { coinName: "Chainlink", coinSymbol: "LINK" },
  DOTUSDT:  { coinName: "Polkadot",  coinSymbol: "DOT"  },
};

const cache = new Map<string, { ts: number; data: unknown }>();
let providerHealth: ProviderHealth = { ok: true, status: "healthy", lastCheckedAt: 0 };
const recentCalls: number[] = [];

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cacheKey(endpoint: string, params: Record<string, unknown>) {
  return `${endpoint}::${JSON.stringify(params)}`;
}

function markProviderDegraded(status?: number, error?: string) {
  providerHealth = { ok: false, status: "degraded", lastCheckedAt: Date.now(), lastStatus: status, lastError: error || PROVIDER_UNAVAILABLE };
}

function markProviderHealthy() {
  providerHealth = { ok: true, status: "healthy", lastCheckedAt: Date.now() };
}

async function rateLimitGate() {
  while (true) {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0] > RATE_WINDOW_MS) recentCalls.shift();
    if (recentCalls.length < RATE_LIMIT_PER_MIN) { recentCalls.push(now); return; }
    const waitMs = RATE_WINDOW_MS - (now - recentCalls[0]) + 50;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 5_000)));
  }
}

function normalizeParams(endpoint: EndpointKey, params: Record<string, unknown>) {
  const out = { ...params };
  if (endpoint === "etfMetrics" || endpoint === "etfInflowHistory") {
    const rawType = String(out.type ?? out.etfType ?? out.symbol ?? "btc").toLowerCase();
    delete out.etfType; delete out.symbol;
    if (rawType === "btc" || rawType === "us-btc-spot") out.type = "us-btc-spot";
    else if (rawType === "eth" || rawType === "us-eth-spot") out.type = "us-eth-spot";
    else out.type = rawType;
  }
  return out;
}

function providerUnavailableRes(endpoint: string, cached: { ts: number; data: unknown } | undefined, status?: number, error?: string) {
  markProviderDegraded(status, error);
  return jsonRes({ data: cached?.data ?? null, fallback: true, stale: Boolean(cached), unavailable: true, error: PROVIDER_UNAVAILABLE, providerStatus: providerHealth.status, endpoint, upstreamStatus: status, cachedAt: cached?.ts }, 200);
}

// Fetch real-time coin prices from Binance public API (no API key needed)
async function fetchCoinListWithPrices(): Promise<unknown> {
  const symbolsParam = encodeURIComponent(JSON.stringify(BINANCE_PAIRS));
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Binance ticker failed: ${res.status}`);
  const tickers: any[] = await res.json();
  return BINANCE_PAIRS.map((pair) => {
    const meta = PAIR_META[pair];
    const t = tickers.find((x: any) => x.symbol === pair);
    return {
      coinId: pair,
      coinName: meta.coinName,
      coinSymbol: meta.coinSymbol,
      coinLogo: "",
      coinPrice: t ? Number(t.lastPrice) : 0,
      priceChangePercent24h: t ? Number(t.priceChangePercent) : 0,
      marketCap: 0,
      volume24h: t ? Number(t.quoteVolume) : 0,
    };
  });
}

async function callProvider(endpoint: EndpointKey, params: Record<string, unknown>, apiKey: string) {
  const cfg = ENDPOINTS[endpoint];
  const merged = normalizeParams(endpoint, { ...(cfg.defaults || {}), ...params });

  let url = `${cfg.base ?? SOSO_BASE}${cfg.path}`;
  let body: string | undefined;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.auth !== false) headers["x-soso-api-key"] = apiKey;

  if (cfg.method === "GET") {
    const u = new URL(url);
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") u.searchParams.set(key, String(value));
    });
    url = u.toString();
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(merged);
  }

  await rateLimitGate();
  const res = await fetch(url, { method: cfg.method, headers, body });
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

  if (payload && typeof payload === "object" && typeof payload.code === "number" && payload.code !== 0) {
    return { ok: false, status: payload.code === 402901 ? 429 : (res.status || 500), payload };
  }
  if (!res.ok) return { ok: false, status: res.status, payload };
  return { ok: true, status: res.status, payload };
}

async function healthCheck(apiKey: string): Promise<ProviderHealth> {
  const now = Date.now();
  if (now - providerHealth.lastCheckedAt < HEALTH_COOLDOWN_MS) return providerHealth;
  const result = await callProvider("coinList", {}, apiKey);
  if (result.ok) {
    markProviderHealthy();
    const data = result.payload && typeof result.payload === "object" && "data" in result.payload ? result.payload.data : result.payload;
    cache.set(cacheKey("coinList", {}), { ts: now, data });
  } else {
    markProviderDegraded(result.status, result.payload?.message || result.payload?.msg || `SoSoValue ${result.status}`);
  }
  return providerHealth;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SOSO_API_KEY = Deno.env.get("SOSO_API_KEY");
    if (!SOSO_API_KEY) return jsonRes({ error: "SOSO_API_KEY is not configured" }, 500);

    const { endpoint, params = {}, healthCheck: wantsHealthCheck } = await req.json().catch(() => ({}));

    if (wantsHealthCheck || endpoint === "health") {
      const health = await healthCheck(SOSO_API_KEY);
      return jsonRes({ ok: health.ok, status: health.status, fallback: !health.ok, error: health.ok ? null : PROVIDER_UNAVAILABLE, lastCheckedAt: health.lastCheckedAt, upstreamStatus: health.lastStatus });
    }

    if (!endpoint || !(endpoint in ENDPOINTS)) {
      return jsonRes({ error: `Invalid endpoint: ${endpoint}` }, 400);
    }

    const key = cacheKey(endpoint, params || {});
    const cached = cache.get(key);
    const now = Date.now();
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return jsonRes({ data: cached.data, cached: true, providerStatus: providerHealth.status });
    }

    // coinList: use Binance public ticker for real prices
    if (endpoint === "coinList") {
      try {
        const data = await fetchCoinListWithPrices();
        cache.set(key, { ts: now, data });
        markProviderHealthy();
        return jsonRes({ data, providerStatus: "healthy" });
      } catch (e) {
        console.warn("Binance ticker failed, falling back to SoSoValue coinList:", e);
        // fall through to normal provider call below
      }
    }

    let result = await callProvider(endpoint as EndpointKey, params || {}, SOSO_API_KEY);
    for (let attempt = 0; result.status === 429 && attempt < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
      result = await callProvider(endpoint as EndpointKey, params || {}, SOSO_API_KEY);
    }

    if (!result.ok) {
      console.error(`provider error ${result.status}`, result.payload);
      return providerUnavailableRes(endpoint, cached, result.status, result.payload?.message || result.payload?.msg || `Provider ${result.status}`);
    }

    const data = result.payload && typeof result.payload === "object" && "data" in result.payload ? result.payload.data : result.payload;
    markProviderHealthy();
    cache.set(key, { ts: now, data });
    return jsonRes({ data, providerStatus: providerHealth.status });

  } catch (e) {
    console.error("sosovalue proxy exception:", e);
    markProviderDegraded(undefined, e instanceof Error ? e.message : "Unknown error");
    return jsonRes({ data: null, fallback: true, stale: false, unavailable: true, error: PROVIDER_UNAVAILABLE, providerStatus: "degraded" });
  }
});
