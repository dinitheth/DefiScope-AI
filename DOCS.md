# DefiScope Technical Documentation

DefiScope is an AI-powered on-chain finance intelligence application for the SoSoValue Builderthon. It provides a conversational AI interface that fetches live market data, analyses it through multiple specialized engines, and delivers clear, data-driven answers in plain English.

## 1. System Overview

```text
SoSoValue API
  -> market snapshots, ETF flows, news
  -> AI analysis engines (decision, narrative, opportunities)
  -> plain-English answers with data visualizations
```

The app has one primary surface:

- **AI Chat**: a research assistant that answers market questions using live data from SoSoValue. It can pull ETF flows, market narratives, trade decisions, news sentiment, opportunities, and live charts — all through natural language.

## 2. Data Sources

The `sosovalue` edge function proxies and caches SoSoValue API calls:

| Logical endpoint | Purpose |
|---|---|
| `coinList` | Currency list enriched with market snapshots for top assets. |
| `etfMetrics` | BTC/ETH spot ETF fund metrics and flow snapshots. |
| `etfInflowHistory` | Historical ETF flow series for charts and weekly totals. |
| `news` | Featured news used for market narrative and sentiment context. |

The proxy keeps API keys server-side and rate-limits requests to protect the SoSoValue quota.

## 3. AI Chat — Two-Phase Tool-Calling Architecture

The AI chat uses a two-phase approach:

### Phase 1: Plan
The AI examines the user's question and decides which data tools to call. Available tools:

| Tool | Purpose |
|---|---|
| `get_market_narrative` | Generates a comprehensive market regime narrative. |
| `get_ai_decision` | Scores a BUY/HOLD/SELL decision for BTC or ETH with risk breakdown. |
| `get_opportunities` | Surfaces ranked trade opportunities across BTC, ETH, SOL. |
| `get_etf_flows` | Pulls live ETF inflow/outflow data for BTC or ETH spot ETFs. |
| `get_market_overview` | Returns a broad market snapshot with top movers. |
| `get_news` | Fetches latest crypto headlines with sentiment classification. |
| `get_live_chart` | Returns candlestick chart data for a given symbol. |

### Phase 2: Synthesize
After all tools complete, the AI synthesizes a data-driven analytical response that references real numbers from the tool results.

## 4. Decision Engine

The `ai-decision` edge function produces a structured trade signal:

```json
{
  "action": "BUY",
  "confidence": 72,
  "asset": "BTC",
  "timeframe": "medium",
  "risk_level": "medium",
  "entry": 104500,
  "stop_loss": 99200,
  "target": 112000,
  "risk_reward": "1:2.4",
  "reasoning": {
    "sentiment": "Neutral",
    "momentum": "Bullish",
    "institutional": "Bullish"
  },
  "risk_breakdown": {
    "volatility": "Medium",
    "news_stability": "Medium",
    "liquidity": "High"
  }
}
```

## 5. UI Components

Each tool result renders as a rich visualization:

| Component | Tool | Renders |
|---|---|---|
| `MarketNarrativeView` | `get_market_narrative` | Regime badge, key themes, sector breakdown. |
| `AiDecisionView` | `get_ai_decision` | Action badge, confidence meter, entry/SL/target, risk breakdown. |
| `OpportunityDiscoveryView` | `get_opportunities` | Ranked opportunity cards with momentum scores. |
| `EtfFlowView` | `get_etf_flows` | Flow chart, fund-level breakdown, daily/weekly totals. |
| `MarketOverviewView` | `get_market_overview` | Top movers grid, market cap, 24h volume. |
| `NewsFeedView` | `get_news` | Headline cards with sentiment badges. |
| `LiveChartView` | `get_live_chart` | Candlestick chart with price and volume. |

All tool steps display as an animated carousel during loading, then inline with the AI's response.

## 6. Authentication

- **Wallet-based**: MetaMask / Coinbase Wallet / any EVM-compatible wallet.
- **Non-custodial**: the app never holds keys.
- **Chat history**: persisted per wallet address in Supabase.

## 7. Database Tables

| Table | Purpose |
|---|---|
| `conversations` | Chat conversation metadata (title, owner, timestamps). |
| `messages` | Individual chat messages with tool step data. |

Rows are scoped by `owner_key` through Supabase RLS.

## 8. Edge Functions

| Function | Purpose |
|---|---|
| `sosovalue` | Proxies and caches SoSoValue API requests. |
| `ai-chat` | Two-phase tool-calling AI (plan → synthesize). |
| `ai-decision` | Structured BUY/HOLD/SELL signal generation. |

## 9. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Vanilla CSS + shadcn/ui components |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini (via Supabase AI) |
| Data | SoSoValue REST API |
| Auth | MetaMask wallet (EVM) |
| Charts | Recharts |

## 10. Demo Positioning

DefiScope should be presented as:

> An AI-powered research assistant for crypto, built on the SoSoValue API. Ask any market question in plain English and get an instant, data-backed answer — complete with ETF flow analysis, sentiment scoring, and AI-scored trade signals.

This maps directly to the Builderthon asks:

- Clear user value: instant answers to crypto questions, not raw data.
- Clear use case: AI research assistant / market intelligence desk.
- Complete flow: Question → Data → Analysis → Answer.
- Required integration: SoSoValue API (prices, ETF flows, news).
- Differentiator: tool-calling architecture with visible step-by-step data pipeline.
