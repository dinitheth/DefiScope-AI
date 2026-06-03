// use-sodex-trade.ts
// Per-user SoDEX trade execution using the user's own connected wallet.
//
// Flow:
//   1. call prepare()  → edge function returns {payloadHash, nonce, params, eip712*}
//   2. user's MetaMask signs the EIP-712 payload (their own wallet, their own key)
//   3. call execute()  → edge function forwards pre-signed order to SoDEX
//
// No server-side private key required. Each user trades from their own wallet.

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllowedProvider } from "@/hooks/use-wallet";
import { toast } from "@/hooks/use-toast";

export type SodexSide = "BUY" | "SELL";
export type SodexMarket = "spot" | "perps";

export interface SodexTradeParams {
  asset: string;       // "BTC" | "ETH" | "SOL"
  market: SodexMarket;
  side: SodexSide;
  size: string;        // e.g. "0.001"
}

export interface SodexTradeOutcome {
  ok: boolean;
  clOrdID?: string;
  symbol?: string;
  asset?: string;
  side?: string;
  size?: string;
  market?: string;
  signer?: string;
  nonce?: number;
  sodex?: { code?: number; error?: string; data?: unknown };
  message?: string;
  registrationRequired?: boolean;
  registrationUrl?: string;
}

export type TradeState = "idle" | "preparing" | "signing" | "executing" | "done" | "error";

export function useSodexTrade() {
  const [state, setState] = useState<TradeState>("idle");
  const [outcome, setOutcome] = useState<SodexTradeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function execute(
    signerAddress: string,
    tradeParams: SodexTradeParams,
  ): Promise<SodexTradeOutcome | null> {
    if (!signerAddress) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to execute trades", variant: "destructive" });
      return null;
    }

    const provider = getAllowedProvider();
    if (!provider) {
      toast({ title: "No wallet detected", description: "Install MetaMask, Rabby, or OKX Wallet", variant: "destructive" });
      return null;
    }

    setState("preparing");
    setError(null);
    setOutcome(null);

    try {
      // ── Step 1: Prepare — get payload hash and EIP-712 params from edge function ──
      const prepRes = await supabase.functions.invoke("sodex-executor", {
        body: {
          action: "prepare",
          ...tradeParams,
          signerAddress,
        },
        headers: { "x-owner-key": signerAddress },
      });

      const prep = prepRes.data as any;

      if (!prep?.ok) {
        const errMsg = prep?.error ?? "Failed to prepare order";

        // Special case: wallet not registered on SoDEX
        if (prep?.registrationRequired) {
          const out: SodexTradeOutcome = {
            ok: false,
            message: errMsg,
            registrationRequired: true,
            registrationUrl: prep.registrationUrl ?? "https://testnet.sodex.com",
          };
          setOutcome(out);
          setState("error");
          setError(errMsg);
          toast({
            title: "SoDEX registration required",
            description: `Visit testnet.sodex.com to register your wallet first`,
            variant: "destructive",
          });
          return out;
        }

        throw new Error(errMsg);
      }

      const { payloadHash, nonce, params, eip712Domain, eip712Types, eip712Message, clOrdID, symbol, asset, side, size, market } = prep;

      // ── Step 2: Sign — ask user's MetaMask to sign the EIP-712 payload ──
      setState("signing");

      // Ensure MetaMask is on the right account
      await provider.request({ method: "eth_requestAccounts" });

      // eth_signTypedData_v4 expects chainId as a number in the domain
      const typedData = JSON.stringify({
        domain: eip712Domain,
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          ...eip712Types,
        },
        primaryType: "ExchangeAction",
        message: {
          payloadHash,
          // nonce must be a string for uint64 (some wallets don't handle BigInt in JSON)
          nonce: String(nonce),
        },
      });

      let rawSig: string;
      try {
        rawSig = await provider.request({
          method: "eth_signTypedData_v4",
          params: [signerAddress, typedData],
        }) as string;
      } catch (sigErr: any) {
        if (sigErr.code === 4001) throw new Error("Signature rejected by user");
        throw sigErr;
      }

      // SoDEX typed signature format: 0x01 + raw sig bytes (no 0x prefix from raw sig)
      const sodexSig = "0x01" + rawSig.slice(2);

      // ── Step 3: Execute — forward pre-signed order to SoDEX via edge function ──
      setState("executing");

      const execRes = await supabase.functions.invoke("sodex-executor", {
        body: {
          action: "execute",
          params,
          market: tradeParams.market,
          signerAddress,
          signature: sodexSig,
          nonce,
          asset: tradeParams.asset,
          side: tradeParams.side,
          size: tradeParams.size,
          symbol,
        },
        headers: { "x-owner-key": signerAddress },
      });

      const result = execRes.data as SodexTradeOutcome;

      if (result?.ok) {
        toast({
          title: "SoDEX order submitted ✓",
          description: `${tradeParams.side} ${tradeParams.size} ${tradeParams.asset} · Order: ${result.clOrdID?.slice(0, 20)}…`,
        });
        setState("done");
      } else {
        toast({
          title: "SoDEX order failed",
          description: result?.sodex?.error ?? result?.message ?? "Order rejected by SoDEX",
          variant: "destructive",
        });
        setState("error");
        setError(result?.message ?? "Order failed");
      }

      setOutcome(result);
      return result;

    } catch (err: any) {
      const msg = err.message ?? "Unknown error";
      setError(msg);
      setState("error");
      toast({ title: "SoDEX error", description: msg, variant: "destructive" });
      return null;
    }
  }

  function reset() {
    setState("idle");
    setOutcome(null);
    setError(null);
  }

  const stateLabel: Record<TradeState, string> = {
    idle: "",
    preparing: "Preparing order…",
    signing: "Waiting for wallet signature…",
    executing: "Submitting to SoDEX…",
    done: "Order submitted",
    error: "Failed",
  };

  return {
    execute,
    reset,
    state,
    outcome,
    error,
    isLoading: state === "preparing" || state === "signing" || state === "executing",
    isDone: state === "done",
    isError: state === "error",
    stateLabel: stateLabel[state],
  };
}
