import { Sun, Moon, Activity, Wallet, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useWallet, shortenAddress } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { address, isConnected, isConnecting, connectMetaMask, disconnect, error } = useWallet();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-xl bg-background/80">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none tracking-tight">DefiScope</span>
            <span className="text-[10px] text-muted-foreground leading-none">AI Intelligence</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <div className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                {shortenAddress(address)}
                <ChevronDown className="h-3 w-3" />
              </button>
              {walletMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-lg animate-fade-in z-50">
                  <button
                    onClick={() => { disconnect(); setWalletMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-accent rounded-lg transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={connectMetaMask}
              disabled={isConnecting}
              className="h-8 text-xs gap-1.5 rounded-lg border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <Wallet className="h-3.5 w-3.5" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 rounded-lg">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
          {error}
        </div>
      )}
    </header>
  );
}
