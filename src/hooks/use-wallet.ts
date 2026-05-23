import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  chainId: number | null;
  error: string | null;
}

type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isStarKey?: boolean;
};

function isAllowedWallet(provider: Eip1193Provider | null | undefined) {
  if (!provider || typeof provider.request !== "function") return false;
  if (provider.isStarKey) return false;
  return Boolean(provider.isMetaMask || provider.isRabby || provider.isOkxWallet || provider.isOKExWallet);
}

function walletRank(provider: Eip1193Provider) {
  if (provider.isMetaMask) return 1;
  if (provider.isRabby) return 2;
  if (provider.isOkxWallet || provider.isOKExWallet) return 3;
  return 99;
}

export function getAllowedProvider(): Eip1193Provider | null {
  const ethereum = (window as any).ethereum as Eip1193Provider | undefined;
  const standalone = [
    (window as any).rabby,
    (window as any).okxwallet,
    (window as any).okxwallet?.ethereum,
  ].filter(Boolean) as Eip1193Provider[];

  if (!ethereum && standalone.length === 0) return null;

  const injected = Array.isArray(ethereum?.providers)
    ? ethereum.providers
    : ethereum
      ? [ethereum]
      : [];

  return [...injected, ...standalone]
    .filter(isAllowedWallet)
    .sort((a, b) => walletRank(a) - walletRank(b))[0] || null;
}



export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    const saved = localStorage.getItem("ds_wallet");
    return saved
      ? { ...JSON.parse(saved), isConnecting: false, error: null }
      : { address: null, isConnecting: false, isConnected: false, chainId: null, error: null };
  });

  useEffect(() => {
    if (state.isConnected && state.address) {
      localStorage.setItem("ds_wallet", JSON.stringify({ address: state.address, isConnected: true, chainId: state.chainId }));
    } else {
      localStorage.removeItem("ds_wallet");
    }
  }, [state.isConnected, state.address, state.chainId]);

  const connectMetaMask = useCallback(async () => {
    const ethereum = getAllowedProvider();

    if (!ethereum) {
      const message = "Please install or unlock MetaMask, Rabby, or OKX Wallet. Other injected wallets are ignored.";
      setState((s) => ({ ...s, error: message }));
      toast({ title: "Supported wallets only", description: message, variant: "destructive" });
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts || accounts.length === 0) {
        const message = "No accounts returned. Please unlock your wallet and try again.";
        setState((s) => ({ ...s, isConnecting: false, error: message }));
        toast({ title: "Wallet not connected", description: message, variant: "destructive" });
        return;
      }
      const chainId = await ethereum.request({ method: "eth_chainId" }) as string;
      setState({
        address: accounts[0],
        isConnected: true,
        isConnecting: false,
        chainId: parseInt(chainId, 16),
        error: null,
      });
    } catch (err: any) {
      const msg = err.code === 4001
        ? "Connection rejected. Please approve the request in your wallet."
        : err.message || "Connection failed";
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
      toast({ title: "Wallet connection failed", description: msg, variant: "destructive" });
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, isConnected: false, isConnecting: false, chainId: null, error: null });
    localStorage.removeItem("ds_wallet");
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    const ethereum = getAllowedProvider();
    if (!ethereum) return;

    const handleAccounts = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((s) => ({ ...s, address: accounts[0] }));
      }
    };

    const handleChain = (chainId: string) => {
      setState((s) => ({ ...s, chainId: parseInt(chainId, 16) }));
    };

    ethereum.on?.("accountsChanged", handleAccounts);
    ethereum.on?.("chainChanged", handleChain);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccounts);
      ethereum.removeListener?.("chainChanged", handleChain);
    };
  }, [disconnect]);

  return { ...state, connectMetaMask, disconnect };
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
