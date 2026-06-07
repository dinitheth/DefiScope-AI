# DefiScope AI

> AI-powered on-chain finance intelligence — ask any crypto question, get live data-backed answers, and publish verifiable strategy records to Base Testnet.

[![SoSoValue Buildathon 2026](https://img.shields.io/badge/SoSoValue-Buildathon%202026-blue)](https://sosovalue.com)
[![Wave 2](https://img.shields.io/badge/Wave-2%20Complete-green)](https://github.com/dinitheth/DefiScope-AI)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What is DefiScope?

DefiScope is a conversational AI research assistant for crypto. Connect your wallet, ask questions in plain English, and the AI fetches live data from the SoSoValue API, runs intelligent analysis, and delivers clear data-backed answers — with rich visualizations.

Then publish your strategy as a **verifiable on-chain record** to Base Testnet.

**Data → Decision → Action → On-Chain Proof.**

---

## Development Toolchain

DefiScope was **scaffolded with Lovable** (UI generation) and then **hand-developed** using:
- TypeScript / React 18 / Vite (frontend logic, tool orchestration, state management)
- Supabase Edge Functions in Deno (all backend AI and data proxy logic)
- Custom two-phase AI architecture (plan → synthesize) written from scratch
- Wave 2 on-chain layer built entirely in-house (hook, modal, history page, DB migration)

Lovable manages Supabase deployment. All business logic, AI architecture, and on-chain features are custom-written.

---

## Features

| Module | What it does |
|---|---|
| **Two-Phase AI Chat** | Phase 1: AI plans which SoSoValue tools to call. Phase 2: AI synthesizes a data-driven analytical response. |
| **AI Decision Engine** | BUY/HOLD/SELL signal with real entry, stop-loss, target prices from Binance live ticker. |
| **ETF Flow Intelligence** | Live spot ETF inflows, AUM, and fund-level breakdown (IBIT, FBTC, ARKB, etc.) for BTC and ETH. |
| **News + Sentiment** | Latest crypto headlines classified by sentiment. |
| **Opportunity Discovery** | BTC, ETH, SOL trade opportunities ranked by momentum and flow signals. |
| **Market Narrative** | Regime classification (accumulation, trending, volatile) with key drivers. |
| **Live Charts** | Candlestick chart data per symbol. |
| **FlowPulse Strategy Card** | Auto-generates after full market briefing: regime, allocation weights, AI reasoning, confidence. |
| **SoDEX Launch Workspace** | Split-screen workspace on the left: interactive TradingView spot chart, AI signals, dynamic Target/Stop levels diagram, and wallet CTAs. |
| **Publish to Base Testnet** | Hash strategy memo → MetaMask confirmation → self-send tx on Base Sepolia → Basescan link. |
| **Strategy History** | All published strategies per wallet at `/strategies`, with on-chain proof links. |
| **Persistent Chat** | Full conversation history per wallet via Supabase RLS. |

---

## SoSoValue API Integration

DefiScope uses the following **live SoSoValue API endpoints**:

| Endpoint | Path | Used For |
|---|---|---|
| ETF Metrics | `POST /openapi/v2/etf/currentEtfDataMetrics` | Per-fund AUM, daily inflow, cumulative flow |
| ETF Inflow History | `POST /openapi/v2/etf/historicalInflowChart` | 30-day flow chart data |
| News Featured | `GET /openapi/v1/news/featured` | Latest headlines with sentiment |
| Coin List | `POST /openapi/v1/data/default/coin/list` | Coin directory (fallback) |

Coin prices are enriched with **Binance public ticker** (`GET /api/v3/ticker/24hr`) — no additional API key required — to provide real-time BTC/ETH/SOL entry, stop-loss, and target values in the AI Decision Engine.

All SoSoValue calls are proxied through the `sosovalue` Supabase Edge Function with server-side auth, 90-second caching, rate limiting (18 req/min), and graceful degradation.

---

## Wave 2 — Base Testnet & SoDEX Panel Integration

### SoDEX Launch Panel & Interactive Workspace
Instead of using blocked third-party iframes, Wave 2 integrates a premium **SoDEX Launch Panel & Chart Workspace** in the split-screen dashboard:
- **Interactive Asset Selector**: Toggle dynamically between `BTC`, `ETH`, and `SOL` in the side panel.
- **TradingView Real-time Chart**: Displays live candlestick spot chart widgets for the chosen asset.
- **AI Market Signals**: Displays Momentum, Institutional, and Sentiment indicators.
- **AI Verification Status**:
  - `✓ AI Verified`: Shows in green when signals are derived from the latest AI decision run (inputs: live prices, ETF flows, and news sentiment).
  - `⚠ Live Price Baseline`: Shows when loading other assets, guiding the user to run a specific briefing in the chat to get AI-verified signals.
- **Visual Trade Setup Diagram**: Visualizes Entry, Target (with percentage gains), and Stop Loss (with percentage losses) calculated dynamically from real-time sosoValue coin prices.
- **Action CTAs**: Safe deep-linking to SoDEX Testnet and copy order details utility.

### On-Chain Strategy Publishing Flow
```
Full Market Briefing (narrative + decision)
        ↓
FlowPulse Strategy Card auto-appears
(regime, allocation, reasoning, confidence)
        ↓
User clicks "Publish to Base Testnet"
        ↓
PublishConfirmModal (MetaMask wallet confirmation)
        ↓
Switch to Base Sepolia (chain 0x14A34) if needed
        ↓
eth_sendTransaction — strategy hash as calldata
        ↓
txHash stored in Supabase strategy_records
        ↓
Basescan link shown + visible in /strategies
```

### FlowPulse Allocation Methodology
Allocations are derived from the AI Decision Engine signal:
- **BUY signal** → BTC 40%, ETH 30%, SOL 20%, USDC 10% (risk-on)
- **HOLD signal** → BTC 25%, ETH 25%, SOL 20%, USDC 30% (balanced)
- **SELL signal** → BTC 10%, ETH 10%, SOL 20%, USDC 60% (defensive)

Each weight reflects the signal conviction and is transparently shown with the full AI reasoning chain.

---

## Architecture

```
User question (plain English)
        ↓
ai-chat Edge Function — Phase 1: Plan (which SoSoValue tools to call)
        ↓
Tools run in parallel:
  sosovalue proxy → SoSoValue ETF API + Binance ticker
  ai-decision Edge Function → BUY/HOLD/SELL signal
        ↓
ai-chat Edge Function — Phase 2: Synthesize (data-driven analytical response)
        ↓
Frontend renders: tool cards + FlowPulse Strategy Card + AI text
        ↓
Optional: Publish strategy hash to Base Sepolia via MetaMask
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Vanilla CSS + shadcn/ui + Framer Motion |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini (via Lovable AI Gateway) |
| Data | SoSoValue REST API v1/v2 |
| Prices | Binance Public Ticker API (no key) |
| Auth | MetaMask / EVM wallet (non-custodial) |
| On-Chain | Base Sepolia Testnet (EIP-1193 via MetaMask) |
| Charts | Recharts |
| Database | Supabase Postgres + RLS |

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/dashboard` | AI Chat + FlowPulse Strategy |
| `/strategies` | Strategy history with on-chain proofs |
| `/how-to-use` | User guide |

---

## Database Tables

| Table | Purpose |
|---|---|
| `conversations` | Chat session metadata per wallet |
| `messages` | Individual messages with tool step data |
| `strategy_records` | Published FlowPulse strategies with tx hashes |

---

## Edge Functions

| Function | Purpose |
|---|---|
| `sosovalue` | SoSoValue proxy + cache + Binance price enrichment |
| `ai-chat` | Two-phase tool-calling AI (plan → synthesize) |
| `ai-decision` | Structured BUY/HOLD/SELL signal generation |

---

## Local Development

```bash
npm install
npm run dev
```

`.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Example Queries

- *"Should I buy BTC right now?"*
- *"Run a full market briefing"* → triggers FlowPulse Strategy Card
- *"ETF flow analysis for BTC"*
- *"Top opportunities today"*
- *"Latest crypto news"*
- *"Live ETH chart"*

---

## License

MIT © [dinitheth](https://github.com/dinitheth)
