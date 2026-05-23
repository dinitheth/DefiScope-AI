# DefiScope AI — Technical Documentation

DefiScope is an AI-powered on-chain finance intelligence platform built for the SoSoValue Buildathon. It provides a conversational AI research assistant backed by live SoSoValue market data, with a Wave 2 on-chain strategy publishing layer on Base Testnet.

---

## 1. System Overview

```
User question
      ↓
ai-chat (Phase 1: Plan) → decides which tools to call
      ↓
Tools run in parallel:
  sosovalue proxy → SoSoValue API (ETF, news) + Binance (prices)
  ai-decision      → BUY/HOLD/SELL signal engine
      ↓
ai-chat (Phase 2: Synthesize) → analytical response citing real numbers
      ↓
Frontend: tool cards + FlowPulse Strategy Card + AI text
      ↓
Optional: hash + publish strategy to Base Sepolia via MetaMask
```

---

## 2. SoSoValue API Integration (Live Endpoints)

All SoSoValue calls are proxied through the `sosovalue` Supabase Edge Function with:
- Server-side `x-soso-api-key` authentication
- 90-second in-memory cache (per endpoint + params)
- Rate limiting at 18 req/min (headroom below the 20/min limit)
- Graceful degradation: stale cache served on upstream errors

| Endpoint | Method | Path | Data Returned |
|---|---|---|---|
| ETF Metrics | POST | `/openapi/v2/etf/currentEtfDataMetrics` | Per-fund AUM, daily inflow, cumulative flow, price |
| ETF Inflow History | POST | `/openapi/v2/etf/historicalInflowChart` | 30-day daily inflow series for chart rendering |
| News Featured | GET | `/openapi/v1/news/featured` | Latest headlines, authors, timestamps, links |
| Coin List | POST | `/openapi/v1/data/default/coin/list` | Coin directory (ID, name, symbol) — fallback only |

### Price Enrichment
The `coinList` handler bypasses SoSoValue (which returns no price data) and instead calls **Binance's free public ticker API**:

```
GET https://api.binance.com/api/v3/ticker/24hr?symbols=[...]
```

Returns: `lastPrice`, `priceChangePercent`, `quoteVolume` for BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, DOT.

No additional API key required. This provides real-time prices to the AI Decision Engine, eliminating the `$0.0000` placeholder issue.

---

## 3. AI Chat — Two-Phase Architecture

### Phase 1: Plan
The `ai-chat` edge function receives the user's message and calls Gemini with tool definitions. Gemini selects which data tools to call (0–4 tools depending on the question).

**Available tools:**

| Tool | Trigger | Data Source |
|---|---|---|
| `get_market_narrative` | Market regime, briefing, macro questions | SoSoValue ETF + news + Binance prices |
| `get_ai_decision` | BUY/SELL/HOLD questions, asset-specific | Binance prices + SoSoValue ETF + news |
| `get_opportunities` | "Top opportunities", "what to trade" | Binance prices + news sentiment |
| `get_etf_flows` | ETF inflow/outflow questions | SoSoValue ETF metrics + history |
| `get_market_overview` | Price overview, movers | Binance ticker |
| `get_news` | News, headlines, sentiment | SoSoValue news featured |
| `get_live_chart` | "Show me BTC chart" | TradingView widget embed |

### Phase 2: Synthesize
After all tools complete, results are trimmed and sent back to Gemini with the `SYNTH_PROMPT`. The AI writes a 120–250 word analytical response that:
- References every key number in **bold**
- Interprets each number (not just lists it)
- Closes with risk flags and an actionable takeaway

---

## 4. AI Decision Engine

The `ai-decision` edge function accepts:
```typescript
{
  mode: "signal" | "opportunities" | "narrative",
  asset: "BTC" | "ETH",
  timeframe: "short" | "medium" | "long",
  riskTolerance: "low" | "medium" | "high",
  marketData: { price, change24h, volume24h, marketCap },
  etfFlow: { dailyInflow, weeklyInflow, inflowChangePercent, trend },
  newsSentiment: { positive, negative, neutral, headlines[] }
}
```

Returns a structured signal:
```json
{
  "action": "HOLD",
  "confidence": 40,
  "conviction": "low",
  "summary": "BTC holds at $75,456 with mixed signals...",
  "reasoning": ["Price dropped -1.62%...", "ETF outflow -$105M..."],
  "signals": { "momentum": "bearish", "institutional": "bearish", "sentiment": "neutral" },
  "riskBreakdown": { "volatility": "medium", "newsStability": "high", "liquidity": "high" },
  "tradeSetup": { "entry": 75456, "stopLoss": 70000, "target": 80000, "riskReward": 0.8 }
}
```

---

## 5. FlowPulse Strategy Card

Automatically renders in chat when **both** `get_market_narrative` and `get_ai_decision` tools complete in the same message.

### Allocation Methodology

Allocations are derived directly from the AI decision signal:

| Signal | BTC | ETH | SOL | USDC | Regime |
|---|---|---|---|---|---|
| BUY (risk-on) | 40% | 30% | 20% | 10% | Accumulation / Trending Up |
| HOLD (balanced) | 25% | 25% | 20% | 30% | Consolidation / Mixed |
| SELL (defensive) | 10% | 10% | 20% | 60% | Distribution / Risk-off |

The strategy card shows:
- **Regime badge**: accumulation / trending_up / consolidation / volatile / distribution
- **Allocation bars**: per-asset weight with colored progress bars
- **Narrative**: 2–3 sentence market memo from the narrative engine
- **AI Reasoning**: transparent bullet list of WHY the AI made this decision
- **Confidence**: 0–100 score with conviction label
- **Publish button**: opens wallet confirmation modal

---

## 6. Wave 2 — On-Chain Strategy Publishing

### Flow
```
1. FlowPulse Strategy Card appears after full market briefing
2. User clicks "Publish to Base Testnet"
3. PublishConfirmModal shows strategy summary + gas info
4. User clicks "Publish On-Chain" → MetaMask opens
5. wallet_switchEthereumChain to Base Sepolia (0x14A34 / chainId 84532)
   - Auto-adds chain if not present (error code 4902)
6. eth_sendTransaction: self-send with strategy SHA-256 hash as calldata
7. txHash returned → stored in Supabase strategy_records
8. User sees Basescan link: https://sepolia.basescan.org/tx/{txHash}
9. Strategy visible in /strategies history page
```

### Strategy Hash
Strategy is hashed using SubtleCrypto SHA-256 (browser native, no extra package):
```
hash = SHA-256(memo + JSON.stringify(allocation))
```
The hash is stored as the `data` field in the Base Sepolia transaction, creating a permanent, timestamped on-chain proof of the AI-generated strategy.

### strategy_records Table Schema
```sql
id             uuid PRIMARY KEY
owner_key      text NOT NULL          -- wallet address (RLS key)
strategy_hash  text NOT NULL          -- SHA-256 of memo + allocation
tx_hash        text                   -- Base Sepolia transaction hash (nullable if local-only)
base_sepolia_block bigint             -- block number
regime         text                   -- market regime at publish time
allocation     jsonb                  -- { BTC: 40, ETH: 30, SOL: 20, USDC: 10 }
memo           text                   -- full narrative memo
reasoning      jsonb                  -- AI reasoning array
confidence     integer                -- 0-100
created_at     timestamptz
```

Row-level security: all reads and writes scoped to `owner_key = x-owner-key header`.

---

## 7. UI Components

| Component | Trigger | Renders |
|---|---|---|
| `MarketNarrativeView` | `get_market_narrative` | Regime badge, key themes, sector breakdown |
| `AiDecisionView` | `get_ai_decision` | Action, confidence, entry/SL/target, risk breakdown |
| `OpportunityDiscoveryView` | `get_opportunities` | Ranked opportunity cards with momentum scores |
| `EtfFlowView` | `get_etf_flows` | Flow chart, fund-level table, daily/weekly totals |
| `MarketOverviewView` | `get_market_overview` | Top movers grid |
| `NewsFeedView` | `get_news` | Headline cards with sentiment badges |
| `LiveChartView` | `get_live_chart` | TradingView candlestick chart |
| `FlowPulseStrategyCard` | narrative + decision both present | Regime, allocation bars, reasoning, Publish button |
| `PublishConfirmModal` | "Publish to Base" clicked | MetaMask confirmation + success state with Basescan link |

---

## 8. Authentication & Data Isolation

- **Non-custodial**: MetaMask / any EVM wallet. App never holds private keys.
- **Owner key**: wallet address used as `owner_key` in all DB tables.
- **RLS**: Supabase row-level security on `conversations`, `messages`, `strategy_records`.
- **Header**: `x-owner-key` passed in all Supabase function calls for server-side filtering.

---

## 9. Edge Functions

| Function | Runtime | Purpose |
|---|---|---|
| `sosovalue` | Deno | SoSoValue API proxy + Binance price enrichment + caching |
| `ai-chat` | Deno | Two-phase plan+synthesize AI orchestration |
| `ai-decision` | Deno | Structured signal engine (BUY/HOLD/SELL + trade setup) |

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Vanilla CSS + shadcn/ui + Framer Motion |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini (via Lovable AI Gateway) |
| Data | SoSoValue REST API v1/v2 |
| Prices | Binance Public Ticker API (no key required) |
| Auth | MetaMask / EVM wallet |
| On-Chain | Base Sepolia Testnet (EIP-1193) |
| Charts | Recharts + TradingView widget |
| Database | Supabase Postgres + RLS |

---

## 11. Demo Flow (Wave 2)

1. Connect wallet (MetaMask)
2. Ask: *"Run a full market briefing"*
3. Watch 3–4 tools run in parallel (ETF flows, narrative, opportunities)
4. FlowPulse Strategy Card appears with regime, allocation, reasoning
5. Click **"Publish to Base Testnet"** → confirm in MetaMask
6. See txHash + Basescan link
7. Visit `/strategies` to see the published strategy history
