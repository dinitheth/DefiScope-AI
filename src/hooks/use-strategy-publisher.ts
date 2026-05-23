import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllowedProvider } from "@/hooks/use-wallet";


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

      // On-chain publish — use the same provider the app's wallet is connected to
      if (publishOnChain) {
        try {
          const ethereum = getAllowedProvider();
          if (!ethereum) throw new Error("No supported wallet (MetaMask/Rabby/OKX) detected");

          // Request account access
          await ethereum.request({ method: "eth_requestAccounts" });

          // Switch to Base Sepolia (chainId 84532 = 0x14A34)
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x14A34" }],
            });
          } catch (switchError: any) {
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
              // Retry switch after adding
              await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x14A34" }],
              });
            } else {
              throw switchError;
            }
          }

          // Self-send tx: 0 ETH, strategy hash as calldata = permanent on-chain proof
          const txParams = {
            from: ownerKey,
            to: ownerKey,
            value: "0x0",
            data: strategyHash,
          };
          txHash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [txParams],
          }) as string;
        } catch (chainErr: any) {
          console.warn("On-chain publish skipped:", chainErr.message);
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
