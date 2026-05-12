// SoSoValue API client - live data only, routed through the `sosovalue`
// edge function so API keys stay server-side and the browser avoids CORS.
import { supabase } from "@/integrations/supabase/client";

type EndpointKey = "coinList" | "coinMarkets" | "etfMetrics" | "etfInflowHistory" | "news";

export const PROVIDER_UNAVAILABLE_MESSAGE = "data provider is temporarily unavailable";

export class SosoProviderUnavailableError extends Error {
  endpoint?: EndpointKey;
  upstreamStatus?: number;
  stale: boolean;

  constructor(endpoint?: EndpointKey, upstreamStatus?: number, stale = false) {
    super(PROVIDER_UNAVAILABLE_MESSAGE);
    this.name = "SosoProviderUnavailableError";
    this.endpoint = endpoint;
    this.upstreamStatus = upstreamStatus;
    this.stale = stale;
  }
}

export function isSosoProviderUnavailable(error: unknown) {
  return error instanceof SosoProviderUnavailableError ||
    (error instanceof Error && error.message.toLowerCase().includes(PROVIDER_UNAVAILABLE_MESSAGE));
}

export async function checkSosoHealth() {
  const { data, error } = await supabase.functions.invoke("sosovalue", {
    body: { endpoint: "health", healthCheck: true },
  });
  if (error || !data) {
    return { ok: false, status: "degraded" as const, error: PROVIDER_UNAVAILABLE_MESSAGE };
  }
  return {
    ok: Boolean((data as any).ok),
    status: ((data as any).status === "healthy" ? "healthy" : "degraded") as "healthy" | "degraded",
    error: (data as any).error || null,
    upstreamStatus: (data as any).upstreamStatus as number | undefined,
    lastCheckedAt: (data as any).lastCheckedAt as number | undefined,
  };
}

async function sosoCall<T>(endpoint: EndpointKey, params?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("sosovalue", {
    body: { endpoint, params },
  });
  if (error) throw new SosoProviderUnavailableError(endpoint);
  if (!data) throw new SosoProviderUnavailableError(endpoint);
  if ((data as any).fallback || (data as any).unavailable) {
    throw new SosoProviderUnavailableError(endpoint, (data as any).upstreamStatus, Boolean((data as any).stale));
  }

  const payload = (data as any).data;
  if (payload == null && (data as any).error) {
    throw new SosoProviderUnavailableError(endpoint, (data as any).upstreamStatus, Boolean((data as any).stale));
  }
  return payload as T;
}

const num = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v === "object" && "value" in v) return Number(v.value) || 0;
  return 0;
};

export interface CoinInfo {
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinLogo: string;
  coinPrice: number;
  priceChangePercent24h: number;
  marketCap: number;
  volume24h: number;
}

export interface EtfMetrics {
  etfName: string;
  totalNetAssets: number;
  totalInflow: number;
  dailyInflow: number;
  dailyInflowChangePercent: number;
  price: number;
  priceChangePercent: number;
}

export interface EtfInflowData {
  date: string;
  totalInflow: number;
  dailyInflow: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export async function fetchCoinList(): Promise<CoinInfo[]> {
  let raw: any;
  try {
    raw = await sosoCall<any>("coinMarkets");
  } catch (error) {
    console.warn("[fetchCoinList] coinMarkets unavailable, falling back to coinList:", error);
    raw = await sosoCall<any>("coinList");
  }
  const arr: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.list)
      ? raw.list
      : Array.isArray(raw?.records)
        ? raw.records
        : [];

  return arr.map((c) => ({
    coinId: String(c.id ?? c.coinId ?? c.currencyId ?? c.symbol ?? ""),
    coinName: c.name ?? c.coinName ?? c.fullName ?? "",
    coinSymbol: String(c.symbol ?? c.coinSymbol ?? c.currencyName ?? "").toUpperCase(),
    coinLogo: c.image ?? c.coinLogo ?? c.logo ?? "",
    coinPrice: num(c.current_price ?? c.coinPrice ?? c.price ?? c.lastPrice),
    priceChangePercent24h: num(c.price_change_percentage_24h ?? c.priceChangePercent24h ?? c.change24h),
    marketCap: num(c.market_cap ?? c.marketCap ?? c.mktCap),
    volume24h: num(c.total_volume ?? c.volume24h ?? c.turnover24h),
  })).filter((c) => c.coinSymbol);
}

export async function fetchEtfMetrics(etfType: string = "btc"): Promise<EtfMetrics[]> {
  const raw = await sosoCall<any>("etfMetrics", { etfType });
  const payload = Array.isArray(raw) ? { list: raw } : raw || {};
  const arr: any[] = Array.isArray(payload.list)
    ? payload.list
    : Array.isArray(payload.records)
      ? payload.records
      : [];

  return arr.map((m) => ({
    etfName: m.ticker ?? m.etfName ?? m.institute ?? m.name ?? "",
    totalNetAssets: num(m.netAssets ?? m.totalNetAssets),
    totalInflow: num(m.cumNetInflow ?? m.totalInflow ?? m.cum_inflow),
    dailyInflow: num(m.dailyNetInflow ?? m.netInflow ?? m.dailyInflow ?? m.net_inflow),
    dailyInflowChangePercent: num(m.netAssetsPercentage ?? m.dailyInflowChangePercent),
    price: num(m.price ?? m.mktPrice ?? m.nav),
    priceChangePercent: num(m.discountPremiumRate ?? m.priceChangePercent),
  }));
}

export async function fetchEtfSummary(etfType: string = "btc"): Promise<{
  totalNetAssets: number;
  dailyNetInflow: number;
  cumNetInflow: number;
}> {
  const raw = await sosoCall<any>("etfMetrics", { etfType });
  const payload = Array.isArray(raw) ? {} : raw || {};
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(payload.list)
      ? payload.list
      : [];

  return {
    totalNetAssets: num(payload.totalNetAssets) || list.reduce((sum: number, row: any) => sum + num(row.netAssets), 0),
    dailyNetInflow: num(payload.dailyNetInflow) || list.reduce((sum: number, row: any) => sum + num(row.dailyNetInflow ?? row.netInflow), 0),
    cumNetInflow: num(payload.cumNetInflow) || list.reduce((sum: number, row: any) => sum + num(row.cumNetInflow), 0),
  };
}

export async function fetchEtfInflowHistory(etfType: string = "btc"): Promise<EtfInflowData[]> {
  const raw = await sosoCall<any>("etfInflowHistory", { etfType });
  const arr: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.list)
      ? raw.list
      : Array.isArray(raw?.records)
        ? raw.records
        : [];

  return arr
    .map((h) => ({
      date: h.date ?? h.day ?? "",
      totalInflow: num(h.cumNetInflow ?? h.totalInflow ?? h.cumInflow),
      dailyInflow: num(h.totalNetInflow ?? h.dailyNetInflow ?? h.dailyInflow ?? h.netInflow),
    }))
    .filter((h) => h.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchNews(): Promise<NewsItem[]> {
  const raw = await sosoCall<any>("news");
  const arr: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.list)
      ? raw.list
      : Array.isArray(raw?.records)
        ? raw.records
        : [];

  return arr.map((n) => {
    const enContent = Array.isArray(n.multilanguageContent)
      ? n.multilanguageContent.find((x: any) => x.language === "en") ?? n.multilanguageContent[0]
      : null;
    const content = enContent?.content ?? n.summary ?? n.description ?? n.content ?? "";

    return {
      id: String(n.id ?? n.newsId ?? n.uuid ?? crypto.randomUUID()),
      title: enContent?.title ?? n.title ?? n.headline ?? "",
      summary: String(content).replace(/<[^>]*>/g, "").slice(0, 300),
      source: n.source ?? n.author ?? n.nickName ?? n.nick_name ?? "SoSoValue",
      publishedAt: n.publishedAt ?? n.releaseTime ?? n.publishTime ?? n.createTime ?? "",
      url: n.url ?? n.sourceLink ?? n.source_link ?? n.link ?? "#",
      imageUrl: n.imageUrl ?? n.featureImage ?? n.feature_image ?? n.cover ?? n.image ?? undefined,
      sentiment: (n.sentiment as any) ?? "neutral",
    };
  });
}
