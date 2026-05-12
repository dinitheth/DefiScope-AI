# DefiScope AI

> AI-powered on-chain finance intelligence — ask any crypto question and get instant, data-driven answers using live SoSoValue data.

[![SoSoValue Buildathon 2026](https://img.shields.io/badge/SoSoValue-Buildathon%202026-blue)](https://sosovalue.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What is DefiScope?

DefiScope is a conversational AI research assistant for crypto. You connect your wallet, ask questions in plain English, and the AI fetches live data from the SoSoValue API, runs intelligent analysis, and delivers clear data-backed answers — complete with rich visualizations.

**Data → Decision → Insight.**

---

## Features

| Module | What it does |
|---|---|
| **AI Decision Engine** | Scores market conviction for BTC/ETH with BUY/HOLD/SELL direction, entry, stop-loss, target, and risk breakdown. |
| **ETF Flow Intelligence** | Live spot ETF inflows, AUM, and fund-level breakdown for BTC and ETH. |
| **News + Sentiment** | Latest crypto headlines classified by sentiment — bullish, bearish, or neutral. |
| **Opportunity Discovery** | Surfaces BTC, ETH, and SOL trade opportunities ranked by momentum and flow signals. |
| **Tool-Calling AI Chat** | Ask anything in plain English. The AI picks the right data tools, runs them live, and explains the result. |
| **Risk-Aware Analysis** | Every recommendation includes volatility, liquidity, and sentiment risk scores. |
| **Market Narrative** | Comprehensive market regime narrative covering macro, ETF, and sentiment signals. |
| **Live Charts** | Candlestick chart data for any supported symbol. |
| **Persistent Chat History** | All conversations stored per wallet via Supabase with row-level security. |

---

## How It Works

```
User question (plain English)
        ↓
AI plans which SoSoValue tools to call  [Phase 1: Plan]
        ↓
Tools run in parallel with live SoSoValue data
        ↓
AI synthesizes a data-driven analytical response  [Phase 2: Synthesize]
        ↓
Rich UI components render inline (charts, cards, flows)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Vanilla CSS + shadcn/ui + Framer Motion |
| Backend | Supabase Edge Functions (Deno) |
| AI | Google Gemini (via Supabase AI) |
| Data | SoSoValue REST API |
| Auth | MetaMask / EVM wallet (non-custodial) |
| Charts | Recharts |

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/dashboard` | AI Chat interface |
| `/how-to-use` | User guide |

---

## Edge Functions

| Function | Purpose |
|---|---|
| `sosovalue` | Server-side SoSoValue proxy and cache. |
| `ai-chat` | Two-phase tool-calling AI (plan → synthesize). |
| `ai-decision` | Structured BUY/HOLD/SELL signal generation. |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Set the following in your `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Required Supabase Secrets

| Secret | Purpose |
|---|---|
| `SOSO_API_KEY` | SoSoValue API authentication. |
| `LOVABLE_API_KEY` | AI model access for chat and decision engines. |

---

## Example Questions

- *"Should I buy BTC right now with medium risk?"*
- *"Show me ETF flow analysis for the last week"*
- *"What are today's top crypto opportunities?"*
- *"Give me a full market briefing"*
- *"Latest crypto news — anything bullish?"*
- *"Live BTC chart"*

---

## License

MIT © [dinitheth](https://github.com/dinitheth)
