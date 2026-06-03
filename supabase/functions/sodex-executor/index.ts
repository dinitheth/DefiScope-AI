// SoDEX Executor — per-user client-side signing architecture
//
// FLOW (no server private key required):
//   1. Frontend calls action:"prepare" → gets back {payloadHash, nonce, params}
//   2. Frontend asks MetaMask to sign the EIP-712 payload via eth_signTypedData_v4
//   3. Frontend calls action:"execute" with {signature, nonce, params, signerAddress}
//   4. Edge function forwards signed request to SoDEX as CORS proxy
//
// This means each user signs with their OWN wallet — no shared key.
//
// ENDPOINTS (testnet):
//   Spot:  https://testnet-gw.sodex.dev/api/v1/spot
//   Perps: https://testnet-gw.sodex.dev/api/v1/perps

import { keccak256, toBytes } from "npm:viem@2.21.43";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-key",
};

const TESTNET_CHAIN_ID = 138565;
const VERIFYING_CONTRACT = "0x0000000000000000000000000000000000000000";
const SPOT_BASE  = "https://testnet-gw.sodex.dev/api/v1/spot";
const PERPS_BASE = "https://testnet-gw.sodex.dev/api/v1/perps";

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

interface PrepareRequest {
  action: "prepare";
  asset: string;
  market: "spot" | "perps";
  side: "BUY" | "SELL";
  size: string;
  signerAddress: string;
}

interface ExecuteRequest {
  action: "execute";
  params: Record<string, unknown>;
  market: "spot" | "perps";
  signerAddress: string;
  signature: string;
  nonce: number;
  // read-only helpers
  asset?: string;
  side?: string;
  size?: string;
  symbol?: string;
}

interface ReadRequest {
  action: "getTickers" | "getPositions" | "getOrders";
  market: "spot" | "perps";
  accountID?: number;
}

type Request = PrepareRequest | ExecuteRequest | ReadRequest;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function computePayloadHash(payload: { type: string; params: unknown }): `0x${string}` {
  const compact = JSON.stringify(payload);
  return keccak256(toBytes(compact));
}

async function sodexPost(base: string, path: string, body: unknown, signer: string, signature: string, nonce: number) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-Key": signer,
      "X-API-Sign": signature,
      "X-API-Nonce": String(nonce),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function sodexGet(base: string, path: string) {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function buildSpotOrderItem(clOrdID: string, side: number, quantity: string) {
  return { clOrdID, modifier: 1, side, type: 2, timeInForce: 3, quantity };
}

function buildPerpsOrderItem(clOrdID: string, side: number, quantity: string, reduceOnly: boolean, positionSide: number) {
  return { clOrdID, modifier: 1, side, type: 2, timeInForce: 3, quantity, reduceOnly, positionSide };
}

async function resolveAccountID(signerAddress: string, base: string): Promise<number | null> {
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
      const id = d?.data?.accountID ?? d?.data?.id ?? d?.accountID ?? d?.id ?? d?.data?.account_id ?? d?.account_id;
      if (id !== undefined && id !== null) {
        const n = Number(id);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch { /* try next */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Request = await req.json().catch(() => ({ action: "getTickers", market: "spot" } as ReadRequest));

    // ── Read-only endpoints (no signature needed) ─────────────────────────
    if (body.action === "getTickers") {
      const base = (body as ReadRequest).market === "spot" ? SPOT_BASE : PERPS_BASE;
      const r = await sodexGet(base, "/markets/tickers");
      return jsonRes({ ok: r.ok, data: r.data });
    }

    if (body.action === "getPositions" || body.action === "getOrders") {
      const rb = body as ReadRequest;
      const base = rb.market === "spot" ? SPOT_BASE : PERPS_BASE;
      const endpoint = rb.action === "getPositions" ? "positions" : "orders";
      const accountID = rb.accountID;
      if (!accountID) return jsonRes({ ok: false, error: "accountID required for getPositions/getOrders" }, 400);
      const r = await sodexGet(base, `/trade/${endpoint}?accountID=${accountID}`);
      return jsonRes({ ok: r.ok, data: r.data });
    }

    // ── PREPARE: build order + compute payload hash for client-side signing ──
    if (body.action === "prepare") {
      const { asset, market, side, size, signerAddress } = body as PrepareRequest;
      if (!signerAddress) return jsonRes({ ok: false, error: "signerAddress required" }, 400);

      const map = market === "spot" ? SPOT_SYMBOL_MAP : PERPS_SYMBOL_MAP;
      const symbolInfo = map[asset?.toUpperCase()] ?? map["BTC"];
      const { symbolID, symbol } = symbolInfo;

      const base = market === "spot" ? SPOT_BASE : PERPS_BASE;
      const accountID = await resolveAccountID(signerAddress, base);
      if (!accountID) {
        return jsonRes({
          ok: false,
          error: `Wallet not registered on SoDEX testnet. Visit https://testnet.sodex.com, connect your wallet ${signerAddress}, and complete registration first.`,
          registrationRequired: true,
          registrationUrl: "https://testnet.sodex.com",
        }, 400);
      }

      const clOrdID = `ds-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const sideCode = side === "BUY" ? 1 : 2;
      const orderItem = market === "spot"
        ? buildSpotOrderItem(clOrdID, sideCode, size)
        : buildPerpsOrderItem(clOrdID, sideCode, size, false, 1);

      const params = { accountID, symbolID, orders: [orderItem] };
      const signingPayload = { type: "newOrder", params };
      const payloadHash = computePayloadHash(signingPayload);
      const nonce = Date.now();

      // Return signing data to the frontend — NO private key needed server-side
      return jsonRes({
        ok: true,
        ready: true,
        payloadHash,
        nonce,
        params,
        clOrdID,
        symbol,
        symbolID,
        accountID,
        // EIP-712 domain for MetaMask to sign
        eip712Domain: {
          name: market === "spot" ? "spot" : "futures",
          version: "1",
          chainId: TESTNET_CHAIN_ID,
          verifyingContract: VERIFYING_CONTRACT,
        },
        eip712Types: {
          ExchangeAction: [
            { name: "payloadHash", type: "bytes32" },
            { name: "nonce", type: "uint64" },
          ],
        },
        eip712Message: {
          payloadHash,
          nonce,
        },
      });
    }

    // ── EXECUTE: receive pre-signed order from client, forward to SoDEX ──────
    if (body.action === "execute") {
      const { params, market, signerAddress, signature, nonce, asset, side, size, symbol } = body as ExecuteRequest;

      if (!signerAddress || !signature || !nonce || !params) {
        return jsonRes({ ok: false, error: "signerAddress, signature, nonce, and params are required" }, 400);
      }

      // Add 0x01 prefix if not already present (SoDEX typed signature format)
      const typedSig = signature.startsWith("0x01") ? signature : `0x01${signature.slice(2)}`;

      const base = market === "spot" ? SPOT_BASE : PERPS_BASE;
      const r = await sodexPost(base, "/trade/orders", params, signerAddress, typedSig, nonce);

      return jsonRes({
        ok: r.ok,
        status: r.status,
        sodex: r.data,
        clOrdID: (params as any).orders?.[0]?.clOrdID,
        symbol,
        side,
        size,
        market,
        asset: asset ?? "BTC",
        signer: signerAddress,
        nonce,
      });
    }

    return jsonRes({ ok: false, error: "Unknown action" }, 400);

  } catch (e) {
    console.error("sodex-executor fatal:", e);
    return jsonRes({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
