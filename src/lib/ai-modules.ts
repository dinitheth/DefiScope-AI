// AI-callable data modules. Pure logic - no UI.
// Each function returns structured data that a renderer component can consume.
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCoinList,
  fetchEtfMetrics,
  fetchEtfSummary,
  fetchEtfInflowHistory,
  fetchNews,
  type CoinInfo,
  type EtfMetrics,
  type EtfInflowData,
  type NewsItem,
} from "@/lib/sosovalue-api";

export type Action = "BUY" | "SELL" | "HOLD";
export type Signal = "bullish" | "bearish" | "neutral";

export interface NarrativeData {
  headline: string;
  narrative: string;
  regime: "accumulation" | "distribution" | "trending_up" | "trending_down" | "consolidation" | "volatile";
  keyDrivers: string[];
}

export interface DecisionData {
  asset: "BTC" | "ETH";
  timeframe: "short" | "medium" | "long";
  risk: "low" | "medium" | "high";
  action: Action;
  confidence: number;
  confidenceBasis: string;
  conviction: "low" | "medium" | "high";
  summary: string;
  reasoning: string[];
  signals: { momentum: Signal; institutional: Signal; sentiment: Signal };
  riskBreakdown: { volatility: number; newsStability: number; liquidity: number };
  tradeSetup: { entry: number; stopLoss: number; target: number; riskReward: number };
  suggestedTimeframe: string;
}

export interface Opportunity {
  symbol: string;
  type: "momentum" | "reversal" | "breakout" | "volume_spike" | "sentiment_shift" | "etf_flow";
  action: "BUY" | "SELL" | "WATCH";
  confidence: number;
  rankScore: number;
  reasoning: string;
  drivers: string[];
  timeframe: "short" | "medium" | "long";
}

export interface OpportunitiesData {
  opportunities: Opportunity[];
}

export interface EtfFlowsData {
  etfType: "btc" | "eth";
  metrics: EtfMetrics[];
  history: EtfInflowData[];
  totals: { aum: number; dailyInflow: number; weeklyInflow: number };
}

export interface MarketOverviewData {
  coins: CoinInfo[];
  marketSummary: { gainers: number; losers: number; avgChange: number };
}

export interface NewsFeedData {
  items: NewsItem[];
  sentiment: { positive: number; negative: number; neutral: number };
}

export interface LiveChartData {
  symbol: string;
  tvSymbol: string;
  coinSymbol: string;
}

function summarizeSentiment(news: NewsItem[]) {
  return news.reduce(
    (acc, n) => {
      if (n.sentiment === "positive") acc.positive++;
      else if (n.sentiment === "negative") acc.negative++;
      else acc.neutral++;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );
}

export async function getMarketNarrative(): Promise<NarrativeData> {
  const coins = await fetchCoinList();
  const news = await fetchNews();
  const etfs = await fetchEtfMetrics("btc");
  const sentiment = summarizeSentiment(news);
  const totalDailyInflow = etfs.reduce((s, e) => s + (e.dailyInflow || 0), 0);

  const { data, error } = await supabase.functions.invoke("ai-decision", {
    body: {
      mode: "narrative",
      topCoins: coins.slice(0, 6).map((c) => ({
        symbol: c.coinSymbol, price: c.coinPrice, change24h: c.priceChangePercent24h, volume24h: c.volume24h,
      })),
      newsSentiment: sentiment,
      etfFlow: { dailyInflow: totalDailyInflow, weeklyInflow: totalDailyInflow * 5, inflowChangePercent: 0, trend: totalDailyInflow > 0 ? "up" : "down" },
    },
  });
  if (error) throw error;
  return data as NarrativeData;
}

export async function getAIDecision(
  asset: "BTC" | "ETH" = "BTC",
  timeframe: "short" | "medium" | "long" = "medium",
  risk: "low" | "medium" | "high" = "medium"
): Promise<DecisionData> {
  const coins = await fetchCoinList();
  const etfs = await fetchEtfMetrics(asset.toLowerCase());
  const news = await fetchNews();
  const coin = coins.find((c) => c.coinSymbol === asset) ?? coins[0];
  const totalDailyInflow = etfs.reduce((s, e) => s + (e.dailyInflow || 0), 0);
  const avgInflowChange = etfs.reduce((s, e) => s + (e.dailyInflowChangePercent || 0), 0) / Math.max(etfs.length, 1);
  const sentiment = summarizeSentiment(news);

  const { data, error } = await supabase.functions.invoke("ai-decision", {
    body: {
      mode: "signal",
      asset,
      timeframe,
      riskTolerance: risk,
      marketData: {
        price: coin.coinPrice,
        change24h: coin.priceChangePercent24h,
        volume24h: coin.volume24h,
        marketCap: coin.marketCap,
      },
      etfFlow: {
        dailyInflow: totalDailyInflow,
        weeklyInflow: totalDailyInflow * 5,
        inflowChangePercent: avgInflowChange,
        trend: totalDailyInflow > 0 ? "up" : totalDailyInflow < 0 ? "down" : "flat",
      },
      newsSentiment: { ...sentiment, headlines: news.slice(0, 5).map((n) => n.title) },
    },
  });
  if (error) throw error;
  return { asset, timeframe, risk, ...(data as Omit<DecisionData, "asset" | "timeframe" | "risk">) };
}

export async function getOpportunities(): Promise<OpportunitiesData> {
  const coins = await fetchCoinList();
  const news = await fetchNews();
  const sentiment = summarizeSentiment(news);

  const { data, error } = await supabase.functions.invoke("ai-decision", {
    body: {
      mode: "opportunities",
      topCoins: coins.slice(0, 10).map((c) => ({
        symbol: c.coinSymbol,
        price: c.coinPrice,
        change24h: c.priceChangePercent24h,
        volume24h: c.volume24h,
      })),
      newsSentiment: sentiment,
    },
  });
  if (error) throw error;
  const sorted = [...((data as OpportunitiesData).opportunities || [])].sort((a, b) => b.rankScore - a.rankScore);
  return { opportunities: sorted };
}

export async function getEtfFlows(etfType: "btc" | "eth" = "btc"): Promise<EtfFlowsData> {
  // Run metrics, summary, and history in parallel to stay fast
  const [metrics, summary, history] = await Promise.all([
    fetchEtfMetrics(etfType),
    fetchEtfSummary(etfType),
    fetchEtfInflowHistory(etfType),
  ]);

  // Use top-level summary for accurate AUM and daily flow totals
  // summary.totalNetAssets = total AUM across all funds
  const aum = summary.totalNetAssets || metrics.reduce((s, e) => s + (e.totalNetAssets || 0), 0);
  const dailyInflow = summary.dailyNetInflow || metrics.reduce((s, e) => s + (e.dailyInflow || 0), 0)
    || (history.length > 0 ? history[history.length - 1].dailyInflow : 0);
  const weeklyInflow = history.slice(-7).reduce((s, h) => s + (h.dailyInflow || 0), 0);

  return { etfType, metrics, history, totals: { aum, dailyInflow, weeklyInflow } };
}

export async function getMarketOverview(): Promise<MarketOverviewData> {
  const coins = await fetchCoinList();

  // coinList returns only names/IDs — no prices. Filter to top coins that at
  // least have a symbol, and provide a UI showing the coin directory.
  const topSymbols = ["BTC","ETH","USDT","BNB","SOL","USDC","XRP","DOGE","ADA","AVAX"];
  const displayed = topSymbols
    .map(sym => coins.find(c => c.coinSymbol.toUpperCase() === sym))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // If we couldn't match, fall back to the first 10 coins returned
  const finalCoins = displayed.length >= 5 ? displayed : coins.slice(0, 10);

  // Gainers/losers won't be accurate (prices are 0), but display what we have
  const gainers = finalCoins.filter((c) => c.priceChangePercent24h > 0).length;
  const losers  = finalCoins.filter((c) => c.priceChangePercent24h < 0).length;
  const avgChange = finalCoins.reduce((s, c) => s + c.priceChangePercent24h, 0) / Math.max(finalCoins.length, 1);
  return { coins: finalCoins, marketSummary: { gainers, losers, avgChange } };
}

export async function getNewsData(): Promise<NewsFeedData> {
  const items = await fetchNews();
  return { items, sentiment: summarizeSentiment(items) };
}

export async function getLiveChart(symbol: string = "BTC"): Promise<LiveChartData> {
  const sym = symbol.toUpperCase();
  return { symbol: sym, tvSymbol: `BINANCE:${sym}USDT`, coinSymbol: sym };
}
