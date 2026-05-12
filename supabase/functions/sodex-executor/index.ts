// SoDEX Executor — complete implementation against SoDEX REST API v1
//
// AUTHENTICATION (from docs):
//   Signed write endpoints use HTTP headers:
//     X-API-Key   : signer EVM address (the API key)
//     X-API-Sign  : EIP-712 typed signature (0x01 prefix)
//     X-API-Nonce : uint64 millisecond timestamp
//   The request body contains ONLY the params object (NOT the {type, params} wrapper).
//
// ENDPOINTS (testnet):
//   Spot:  https://testnet-gw.sodex.dev/api/v1/spot
//   Perps: https://testnet-gw.sodex.dev/api/v1/perps
//
// ORDER PLACEMENT:
//   POST ${BASE}/trade/orders
//
// CANCEL ORDER (close position):
//   DELETE ${BASE}/trade/orders  (cancelOrder action)
//
// SIGNING (EIP-712):
//   domain.name    = "spot" | "futures"
//   domain.chainId = 138565 (testnet)
//   verifyingContract = 0x0000000000000000000000000000000000000000
//   payloadHash = keccak256(JSON.stringify({type, params}))  -- compact, insertion order
//
// FIELD ORDERS (CRITICAL — must match Go struct serialization order):
//   SpotOrderItem  : clOrdID, modifier, side, type, timeInForce, price*, quantity*, funds*
//   PerpsOrderItem : clOrdID, modifier, side, type, timeInForce, price*, quantity*, funds*, stopPrice*, stopType*, triggerType*, reduceOnly, positionSide
//   (* = DecimalString — must be JSON string "0.001" not number 0.001; omit if zero via omitempty)
//
// SYMBOL NAMES:
//   Spot  : vBTC_vUSDC, vETH_vUSDC (prefixed with v)
//   Perps : BTC-USD, ETH-USD

import { keccak256, toBytes } from "npm:viem@2.21.43";
import { privateKeyToAccount } from "npm:viem@2.21.43/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TESTNET_CHAIN_ID = 138565;
const VERIFYING_CONTRACT = "0x0000000000000000000000000000000000000000";
const SPOT_BASE  = "https://testnet-gw.sodex.dev/api/v1/spot";
const PERPS_BASE = "https://testnet-gw.sodex.dev/api/v1/perps";

// Map asset → symbolID used in signing payload
// Fetched live from /markets/symbols when possible; these are fallback defaults.
// Spot symbolIDs discovered from GET /markets/symbols (testnet).
const SPOT_SYMBOL_MAP: Record<string, { symbolID: number; symbol: string }> = {
  BTC: { symbolID: 1, symbol: "vBTC_vUSDC" },
  ETH: { symbolID: 2, symbol: "vETH_vUSDC" },
  SOL: { symbolID: 3, symbol: "vSOL_vUSDC" },
};
const PERPS_SYMBOL_MAP: Record<string, { symbolID: number; symbol: string }> = {
  BTC: { symbolID: 1, symbol: "BTC-USD" },
  ETH: { symbolID: 2, symbol: "ETH-USD" },
  SOL: { symbolID: 3, symbol: "SOL-USD" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExecuteRequest {
  action?: "newOrder" | "cancelOrder" | "getPositions" | "getOrders" | "getTickers";
  asset: string;
  market: "spot" | "perps";
  side?: "BUY" | "SELL";
  size?: string;           // quantity as decimal string
  clOrdIDToCancel?: string; // for cancelOrder
  reduceOnly?: boolean;
  positionSide?: 1 | 2;    // 1=long, 2=short
  leverage?: number;
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── EIP-712 Signing ─────────────────────────────────────────────────────────
function computePayloadHash(payload: { type: string; params: unknown }): `0x${string}` {
  // CRITICAL: compact JSON, no whitespace, insertion order preserved
  const compact = JSON.stringify(payload);
  return keccak256(toBytes(compact));
}

async function signPayload(
  privateKey: `0x${string}`,
  market: "spot" | "perps",
  payload: { type: string; params: unknown },
): Promise<{ signature: `0x${string}`; nonce: number; payloadHash: `0x${string}`; signer: string }> {
  const account = privateKeyToAccount(privateKey);
  const payloadHash = computePayloadHash(payload);
  const nonce = Date.now(); // ms timestamp — unique, within (T-2d, T+1d)

  const domain = {
    name: market === "spot" ? "spot" : "futures",
    version: "1",
    chainId: TESTNET_CHAIN_ID,
    verifyingContract: VERIFYING_CONTRACT as `0x${string}`,
  };

  const types = {
    ExchangeAction: [
      { name: "payloadHash", type: "bytes32" },
      { name: "nonce",       type: "uint64"  },
    ],
  } as const;

  const message = { payloadHash, nonce: BigInt(nonce) };

  const sig = await account.signTypedData({ domain, types, primaryType: "ExchangeAction", message });

  // SoDEX typed signature = 0x01 prefix + raw sig bytes (docs: append byte 1 before sig bytes)
  const typedSig = ("0x01" + sig.slice(2)) as `0x${string}`;

  return { signature: typedSig, nonce, payloadHash, signer: account.address };
}

// ─── HTTP submit helpers ──────────────────────────────────────────────────────
async function sodexPost(
  base: string,
  path: string,
  body: unknown,
  signer: string,
  signature: string,
  nonce: number,
) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "X-API-Key":     signer,
      "X-API-Sign":    signature,
      "X-API-Nonce":   String(nonce),
    },
    body: JSON.stringify(body),
  });
  // Read body as text first — avoids "Body already consumed" if JSON.parse fails
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}


async function sodexDelete(
  base: string,
  path: string,
  body: unknown,
  signer: string,
  signature: string,
  nonce: number,
) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "X-API-Key":     signer,
      "X-API-Sign":    signature,
      "X-API-Nonce":   String(nonce),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}


async function sodexGet(base: string, path: string) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}


// ─── Live symbol resolution ───────────────────────────────────────────────────
async function resolveSymbol(asset: string, market: "spot" | "perps") {
  const base = market === "spot" ? SPOT_BASE : PERPS_BASE;
  const map  = market === "spot" ? SPOT_SYMBOL_MAP : PERPS_SYMBOL_MAP;
  const fallback = map[asset.toUpperCase()];

  try {
    const result = await sodexGet(base, "/markets/symbols");
    const symbols: any[] = (result.data as any)?.data || [];
    if (symbols.length > 0) {
      // Spot: look for vBTC_vUSDC pattern; Perps: look for BTC-USD pattern
      const keyword = market === "spot"
        ? `v${asset.toUpperCase()}_`
        : `${asset.toUpperCase()}-`;
      const found = symbols.find((s: any) =>
        (s.symbol || s.name || "").includes(keyword)
      );
      if (found) {
        return {
          symbolID: found.symbolID || found.id || fallback.symbolID,
          symbol:   found.symbol   || found.name || fallback.symbol,
        };
      }
    }
  } catch { /* use fallback */ }

  if (!fallback) throw new Error(`Unsupported asset: ${asset}`);
  return fallback;
}

// ─── Build order items (field order MUST match Go struct) ─────────────────────
function buildSpotOrderItem(clOrdID: string, side: number, quantity: string) {
  // SpotOrderItem Go struct field order:
  // clOrdID, modifier, side, type, timeInForce, [price omitted=omitempty], quantity, [funds omitted=omitempty]
  return {
    clOrdID,
    modifier:    1,  // 1 = normal
    side,            // 1=buy, 2=sell
    type:        2,  // 2 = market
    timeInForce: 3,  // 3 = IOC (for market orders)
    quantity,        // DecimalString — must be a quoted string
  };
}

function buildPerpsOrderItem(
  clOrdID: string,
  side: number,
  quantity: string,
  reduceOnly: boolean,
  positionSide: number,
) {
  // PerpsOrderItem Go struct field order (CRITICAL — must match exactly):
  // clOrdID, modifier, side, type, timeInForce, price*, quantity, funds*, stopPrice*, stopType*, triggerType*, reduceOnly, positionSide
  // * = omitempty — DO NOT include when zero/empty
  return {
    clOrdID,
    modifier:     1,
    side,
    type:         2,  // market
    timeInForce:  3,  // IOC
    quantity,
    reduceOnly,
    positionSide,
  };
}

// ─── Account ID auto-discovery ───────────────────────────────────────────────
// SoDEX assigns a numeric accountID when you register your wallet on the testnet.
// We try several API patterns to discover it automatically from the EVM address.
// The SODEX_ACCOUNT_ID env var is OPTIONAL — used only as a manual override.
let _cachedAccountID: number | null = null;

async function resolveAccountID(
  signerAddress: string,
  base: string,
): Promise<number> {
  // 1. Return cached value (avoid repeated lookups per cold start)
  if (_cachedAccountID !== null) return _cachedAccountID;

  // 2. Manual override from env (optional)
  const envVal = Deno.env.get("SODEX_ACCOUNT_ID");
  if (envVal) {
    const n = parseInt(envVal, 10);
    if (!isNaN(n)) { _cachedAccountID = n; return n; }
  }

  // 3. Try SoDEX account lookup endpoints
  const address = signerAddress.toLowerCase();
  const endpoints = [
    `/trade/account?address=${address}`,
    `/user/account?address=${address}`,
    `/trade/accounts?address=${address}`,
    `/account?evmAddress=${address}`,
  ];

  for (const path of endpoints) {
    try {
      const r = await sodexGet(base, path);
      const d = r.data as any;
      // Try common field names for the numeric account ID
      const id = d?.data?.accountID ?? d?.data?.id ?? d?.accountID ?? d?.id
               ?? d?.data?.account_id ?? d?.account_id;
      if (id !== undefined && id !== null) {
        const n = Number(id);
        if (!isNaN(n) && n > 0) {
          _cachedAccountID = n;
          console.log(`[sodex-executor] Discovered accountID=${n} via ${path}`);
          return n;
        }
      }
    } catch { /* try next */ }
  }

  // 4. Could not discover — throw with helpful message
  throw new Error(
    `Could not discover SoDEX accountID for address ${signerAddress}. ` +
    `Please visit https://testnet.sodex.com, connect your wallet, and set ` +
    `SODEX_ACCOUNT_ID in your Supabase edge function secrets. ` +
    `Your wallet address is: ${signerAddress}`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PRIV_RAW = Deno.env.get("SODEX_API_PRIVATE_KEY");
    if (!PRIV_RAW) return jsonRes({
      ok: false,
      error: "SODEX_API_PRIVATE_KEY not configured. Add it in Supabase Dashboard → Settings → Edge Functions → Secrets."
    }, 500);

    const privateKey = (PRIV_RAW.startsWith("0x") ? PRIV_RAW : `0x${PRIV_RAW}`) as `0x${string}`;

    // Derive EVM address — this IS the API key for SoDEX
    const signerAccount = privateKeyToAccount(privateKey);
    const signerAddress = signerAccount.address;

    const body: ExecuteRequest = await req.json().catch(() => ({}));
    const {
      action       = "newOrder",
      asset        = "BTC",
      market       = "spot",
      side         = "BUY",
      size         = "0.001",
      reduceOnly   = false,
      positionSide = 1,
      clOrdIDToCancel,
    } = body;

    const base = market === "spot" ? SPOT_BASE : PERPS_BASE;

    // ── Read-only: no account ID needed ───────────────────────────────────
    if (action === "getTickers") {
      const r = await sodexGet(base, "/markets/tickers");
      return jsonRes({ ok: r.ok, data: r.data, signer: signerAddress });
    }

    // ── Auto-discover account ID (cached, optional env override) ──────────
    const accountID = await resolveAccountID(signerAddress, base);

    if (action === "getPositions") {
      const r = await sodexGet(base, `/trade/positions?accountID=${accountID}`);
      return jsonRes({ ok: r.ok, data: r.data });
    }
    if (action === "getOrders") {
      const r = await sodexGet(base, `/trade/orders?accountID=${accountID}`);
      return jsonRes({ ok: r.ok, data: r.data });
    }

    // ── Resolve symbol ─────────────────────────────────────────────────────
    const { symbolID, symbol } = await resolveSymbol(asset, market);
    const clOrdID = `ds-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const sideCode = side === "BUY" ? 1 : 2;

    // ── Cancel / Close position ────────────────────────────────────────────
    if (action === "cancelOrder") {
      const cancelClOrdID = clOrdIDToCancel || clOrdID;
      const params = { accountID, symbolID, clOrdIDs: [cancelClOrdID] };
      const payload = { type: "cancelOrder", params };
      const { signature, nonce, payloadHash, signer } = await signPayload(privateKey, market, payload);
      const r = await sodexDelete(base, "/trade/orders", params, signer, signature, nonce);
      return jsonRes({ ok: r.ok, status: r.status, sodex: r.data, payloadHash, nonce, signer, clOrdID: cancelClOrdID, symbol });
    }

    // ── New Order ──────────────────────────────────────────────────────────
    const orderItem = market === "spot"
      ? buildSpotOrderItem(clOrdID, sideCode, size)
      : buildPerpsOrderItem(clOrdID, sideCode, size, reduceOnly, positionSide);

    const params = { accountID, symbolID, orders: [orderItem] };
    const signingPayload = { type: "newOrder", params };
    const { signature, nonce, payloadHash, signer } = await signPayload(privateKey, market, signingPayload);
    const r = await sodexPost(base, "/trade/orders", params, signer, signature, nonce);

    return jsonRes({
      ok: r.ok, status: r.status, sodex: r.data,
      payloadHash, nonce, signer, clOrdID, symbol, symbolID,
      side, size, market, asset,
      accountID, // include so UI can show it for debugging
    });

  } catch (e) {
    console.error("sodex-executor fatal:", e);
    return jsonRes({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
