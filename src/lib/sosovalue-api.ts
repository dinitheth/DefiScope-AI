// SoSoValue API client — normalizes responses from the `sosovalue` edge function.
//
// CONFIRMED REAL FIELD NAMES (from live API inspection 2026-05-09):
//
// coinList response items:
//   { currencyName: "btc", fullName: "Bitcoin", currencyId: 1673723677... }
//   NOTE: NO price fields — coinList is a directory endpoint only.
//   For market overview, we use the ETF summary data + coinId symbols directly.
//
// etfMetrics response:
//   { data: { totalNetAssets: { value: "106610918466.79" }, dailyNetInflow: { value: "-145651012" },
//             cumNetInflow: { value: "..." }, list: [{ ticker, institute, netAssets.value, netInflow.value, cumNetInflow.value }] } }
//
// etfInflowHistory response items:
//   { date: "2026-05-08", totalNetInflow: -145651012.3, totalNetAssets: 106610918466.8, cumNetInflow: 59340306704.7 }
//
// news response:
//   { data: { list: [{ id, sourceLink, releaseTime, author, multilanguageContent: [{language:"en", title, content}], featureImage }] } }

import { supabase } from "@/integrations/supabase/client";

type EndpointKey = "coinList" | "etfMetrics" | "etfInflowHistory" | "news";

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

/** Helper to safely parse a numeric value from various shapes the API might send */
function numVal(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v !== null && "value" in v) {
    // Nested { value: "123.45", ... } shape used by etfMetrics
    return Number(v.value ?? 0) || 0;
  }
  const n = Number(v);
  return isFinite(n) ? n : 0;
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

  // The proxy returns { data: <payload>, providerStatus, cached }
  let payload = (data as any).data;
  if (payload == null && (data as any).error) {
    throw new SosoProviderUnavailableError(endpoint, (data as any).upstreamStatus, Boolean((data as any).stale));
  }
  return payload as T;
}

// ─────────────────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Fetch functions — normalised to confirmed real field names
// ─────────────────────────────────────────────────────────────

export async function fetchCoinList(): Promise<CoinInfo[]> {
  const raw = await sosoCall<any>("coinList");
  // coinList returns an array of { currencyName, fullName, currencyId }
  // There are NO price fields — this is a directory endpoint.
  // We synthesise minimal CoinInfo objects so the Market Overview renders the coin names.
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr.slice(0, 50).map((c) => ({
    // Real fields from live API:
    coinId:     String(c.currencyId   ?? c.currency_id ?? c.coinId ?? c.id ?? ""),
    coinName:   c.fullName            ?? c.coinName    ?? c.name   ?? "",
    coinSymbol: (c.currencyName       ?? c.symbol      ?? "").toUpperCase(),
    coinLogo:   c.logo                ?? c.coinLogo    ?? c.iconUrl ?? "",
    // Price fields are NOT available from coinList — they default to 0 and are
    // populated by the market snapshot calls in the AI agent / ETF data flows.
    coinPrice:            numVal(c.price          ?? c.coinPrice ?? c.lastPrice),
    priceChangePercent24h:numVal(c.changePct24h   ?? c.change24h ?? c.priceChangePercent24h),
    marketCap:            numVal(c.marketCap      ?? c.mktCap),
    volume24h:            numVal(c.turnover24h     ?? c.volume24h ?? c.vol24h),
  }));
}

export async function fetchEtfMetrics(etfType: string = "btc"): Promise<EtfMetrics[]> {
  const raw = await sosoCall<any>("etfMetrics", { etfType });

  // Real confirmed structure from live API (2026-05-09):
  // {
  //   totalNetAssets: { value: "106610918466.79" },
  //   dailyNetInflow: { value: "-145651012.3" },
  //   list: [
  //     { ticker: "IBIT", institute: "BlackRock",
  //       netAssets: { value: "65744759600" },       ← AUM
  //       dailyNetInflow: { value: "-27222000" },    ← daily flow
  //       cumNetInflow: { value: "923125760" },      ← cum flow
  //     }
  //   ]
  // }
  const obj: any = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  const arr: any[] = Array.isArray(obj.list) ? obj.list
    : Array.isArray(raw) ? raw
    : [];

  return arr.map((m) => ({
    // Use confirmed real field names; numVal handles {value: "..."} shape automatically:
    etfName:                 m.ticker ?? m.institute ?? m.etfName ?? m.name ?? "",
    totalNetAssets:          numVal(m.netAssets),            // { value: "65744759600" }
    totalInflow:             numVal(m.cumNetInflow),          // { value: "923125760" }
    dailyInflow:             numVal(m.dailyNetInflow),        // { value: "-27222000" }
    dailyInflowChangePercent:numVal(m.dailyInflowChangePercent ?? 0),
    price:                   numVal(m.mktPrice ?? m.price ?? m.nav),
    priceChangePercent:      numVal(m.priceChangePercent ?? 0),
  }));
}

// Returns top-level aggregated ETF totals from the metrics response
export async function fetchEtfSummary(etfType: string = "btc"): Promise<{
  totalNetAssets: number;
  dailyNetInflow: number;
  cumNetInflow: number;
}> {
  const raw = await sosoCall<any>("etfMetrics", { etfType });
  const obj: any = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  return {
    totalNetAssets: numVal(obj.totalNetAssets),   // { value: "106610918466.79" }
    dailyNetInflow: numVal(obj.dailyNetInflow),   // { value: "-145651012.3" }
    cumNetInflow:   numVal(obj.cumNetInflow),      // { value: "-6985813254.74" }
  };
}

export async function fetchEtfInflowHistory(etfType: string = "btc"): Promise<EtfInflowData[]> {
  const raw = await sosoCall<any>("etfInflowHistory", { etfType });
  // Real structure: array of { date, totalNetInflow, totalNetAssets, cumNetInflow, totalValueTraded }
  const arr: any[] = Array.isArray(raw) ? raw
    : Array.isArray(raw?.list) ? raw.list
    : [];

  // Sort ascending by date (API returns reverse-chronological)
  const sorted = arr.slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return sorted.map((h) => ({
    // Real field names from live API:
    date:        h.date              ?? h.day          ?? "",
    totalInflow: numVal(h.cumNetInflow    ?? h.totalInflow   ?? h.cumInflow),
    dailyInflow: numVal(h.totalNetInflow  ?? h.dailyInflow   ?? h.netInflow),
  }));
}

export async function fetchNews(): Promise<NewsItem[]> {
  const raw = await sosoCall<any>("news");
  // Real structure: { pageNum, pageSize, total, list: [...] } OR already unwrapped array
  const list: any[] = Array.isArray(raw) ? raw
    : Array.isArray(raw?.list)    ? raw.list
    : Array.isArray(raw?.records) ? raw.records
    : [];

  return list.map((n) => {
    // Real field names from live API (camelCase):
    // multilanguageContent is an array of {language, title, content}
    const enContent = Array.isArray(n.multilanguageContent)
      ? n.multilanguageContent.find((x: any) => x.language === "en") ?? n.multilanguageContent[0]
      : null;

    const title = enContent?.title
      ?? n.title ?? n.headline ?? n.subject ?? "";
    const content = enContent?.content
      ?? n.content ?? n.summary ?? n.description ?? n.body ?? "";

    return {
      id:          String(n.id ?? n.newsId ?? n.uuid ?? crypto.randomUUID()),
      title,
      // Strip HTML tags from content for display
      summary:     content.replace(/<[^>]*>/g, "").slice(0, 300),
      // Real field: `author` or `nickName`
      source:      n.author     ?? n.nickName ?? n.nick_name ?? n.publisher ?? "SoSoValue",
      // Real field: `releaseTime` (timestamp ms)
      publishedAt: n.releaseTime
        ? new Date(Number(n.releaseTime)).toISOString()
        : (n.publishedAt ?? n.publishTime ?? n.createTime ?? ""),
      // Real field: `sourceLink`
      url:         n.sourceLink ?? n.source_link ?? n.url ?? n.link ?? "#",
      // Real field: `featureImage`
      imageUrl:    n.featureImage ?? n.feature_image ?? n.imageUrl ?? n.cover ?? n.image ?? undefined,
      sentiment:   (n.sentiment as any) ?? "neutral",
    };
  });
}
