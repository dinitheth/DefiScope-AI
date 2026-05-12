import { useEffect, useRef, memo } from "react";
import { useTheme } from "@/hooks/use-theme";

const TradingViewTicker = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "BINANCE:BTCUSDT", title: "BTC/USDT" },
        { proName: "BINANCE:ETHUSDT", title: "ETH/USDT" },
        { proName: "BINANCE:SOLUSDT", title: "SOL/USDT" },
        { proName: "BINANCE:BNBUSDT", title: "BNB/USDT" },
        { proName: "BINANCE:XRPUSDT", title: "XRP/USDT" },
        { proName: "BINANCE:AVAXUSDT", title: "AVAX/USDT" },
        { proName: "BINANCE:ADAUSDT", title: "ADA/USDT" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: theme === "dark" ? "dark" : "light",
      locale: "en",
    });

    containerRef.current.appendChild(script);
  }, [theme]);

  return (
    <div className="tradingview-widget-container w-full overflow-hidden">
      <div ref={containerRef} />
    </div>
  );
});

TradingViewTicker.displayName = "TradingViewTicker";
export default TradingViewTicker;
