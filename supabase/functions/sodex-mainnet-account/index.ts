// Read-only gateway for the user's public SoDEX MAINNET account analytics.
// It intentionally has no testnet URL, signing path, synthetic fallback, or
// block-explorer substitution. It only returns source records from SoDEX.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPS_MAINNET = "https://mainnet-gw.sodex.dev/api/v1/perps";
const SPOT_MAINNET = "https://mainnet-gw.sodex.dev/api/v1/spot";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function read(path: string, market: "perps" | "spot" = "perps") {
  const response = await fetch(`${market === "spot" ? SPOT_MAINNET : PERPS_MAINNET}${path}`, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { payload = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) throw new Error(`SoDEX mainnet ${path}: HTTP ${response.status}`);
  if ((payload as { code?: number }).code !== undefined && (payload as { code?: number }).code !== 0) {
    throw new Error(String((payload as { error?: unknown }).error || `SoDEX mainnet rejected ${path}`));
  }
  return payload;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const { address } = await request.json();
    if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return json({ error: "A valid EVM address is required." }, 400);
    }
    const wallet = encodeURIComponent(address.toLowerCase());
    const paths = {
      state: `/accounts/${wallet}/state`,
      balances: `/accounts/${wallet}/balances`,
      positions: `/accounts/${wallet}/positions`,
      closedPositions: `/accounts/${wallet}/positions/history?limit=500`,
      trades: `/accounts/${wallet}/trades?limit=1000`,
      fundingPayments: `/accounts/${wallet}/fundings?limit=1000`,
      spotState: `/accounts/${wallet}/state`,
      spotBalances: `/accounts/${wallet}/balances`,
      spotOrders: `/accounts/${wallet}/orders/history`,
      spotTrades: `/accounts/${wallet}/trades`,
    };
    const settled = await Promise.allSettled(Object.entries(paths).map(async ([key, path]) => [key, await read(path, key.startsWith("spot") ? "spot" : "perps")]));
    const data: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") data[result.value[0] as string] = result.value[1];
      else errors.push(result.reason instanceof Error ? result.reason.message : "SoDEX mainnet request failed");
    }
    if (Object.keys(data).length === 0) return json({ error: errors[0] || "SoDEX mainnet is unavailable", errors }, 502);
    return json({ address: address.toLowerCase(), source: "sodex-mainnet", fetchedAt: new Date().toISOString(), data, errors });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 500);
  }
});
