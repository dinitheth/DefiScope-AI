import { useEffect, useRef, memo } from "react";
import { useTheme } from "@/hooks/use-theme";

interface TradingViewWidgetProps {
  symbol?: string;
  height?: number | string;
}

const TradingViewWidget = memo(({ symbol = "BINANCE:BTCUSDT", height = "100%" }: TradingViewWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: theme === "dark" ? "dark" : "light",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0, 0, 0, 0)",
      gridColor: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);
  }, [symbol, theme]);

  return (
    <div className="tradingview-widget-container w-full" style={{ height }}>
      <div ref={containerRef} className="tradingview-widget-container__widget w-full h-full" />
    </div>
  );
});

TradingViewWidget.displayName = "TradingViewWidget";
export default TradingViewWidget;
