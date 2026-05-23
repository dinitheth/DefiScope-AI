import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StrategyData {
  memo: string;
  allocation: Record<string, number>;
  reasoning: string[];
  regime: string;
  confidence: number;
}

export interface PublishResult {
  txHash: string | null;
  strategyId: string;
  basescanUrl: string | null;
  savedToDb: boolean;
}

async function hashStrategy(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function useStrategyPublisher() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async (
    ownerKey: string,
    strategy: StrategyData,
    publishOnChain: boolean = false
  ): Promise<PublishResult | null> => {
    setIsPublishing(true);
    setError(null);
    try {
      const strategyHash = await hashStrategy(strategy.memo + JSON.stringify(strategy.allocation));
      let txHash: string | null = null;

      // On-chain publish via MetaMask
      if (publishOnChain && typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const ethereum = (window as any).ethereum;

          // Request account access
          await ethereum.request({ method: "eth_requestAccounts" });

          // Switch to Base Sepolia
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x14A34" }], // 84532 in hex
            });
          } catch (switchError: any) {
            // Add Base Sepolia if not present
            if (switchError.code === 4902) {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: "0x14A34",
                  chainName: "Base Sepolia",
                  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://sepolia.base.org"],
                  blockExplorerUrls: ["https://sepolia.basescan.org"],
                }],
              });
            }
          }

          // Send a simple data transaction (no contract needed initially)
          // The memo hash is stored in tx data field as proof
          const txParams = {
            from: ownerKey,
            to: ownerKey, // self-send as proof of timestamp
            value: "0x0",
            data: strategyHash, // hash as calldata = on-chain proof
          };

          txHash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [txParams],
          });
        } catch (chainErr: any) {
          console.warn("On-chain publish failed, saving to DB only:", chainErr.message);
        }
      }

      // Save to Supabase
      const { data: record, error: dbErr } = await supabase
        .from("strategy_records" as any)
        .insert({
          owner_key: ownerKey,
          strategy_hash: strategyHash,
          tx_hash: txHash,
          regime: strategy.regime,
          allocation: strategy.allocation,
          memo: strategy.memo,
          reasoning: strategy.reasoning,
          confidence: strategy.confidence,
        })
        .select("id")
        .single();

      if (dbErr) throw dbErr;

      return {
        txHash,
        strategyId: (record as any)?.id ?? crypto.randomUUID(),
        basescanUrl: txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null,
        savedToDb: true,
      };
    } catch (err: any) {
      setError(err.message ?? "Publish failed");
      return null;
    } finally {
      setIsPublishing(false);
    }
  };

  return { publish, isPublishing, error };
}
