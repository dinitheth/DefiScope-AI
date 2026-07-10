# DefiScope AI

> AI-powered on-chain finance intelligence — ask any crypto question, get live data-backed answers, and utilize the interactive SoDEX workspace panel.

[![SoSoValue Buildathon 2026](https://img.shields.io/badge/SoSoValue-Buildathon%202026-blue)](https://sosovalue.com)
[![Wave 3 Complete](https://img.shields.io/badge/Wave-3%20Complete-green)](https://github.com/dinitheth/DefiScope-AI)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

# 🚀 What It Does

**DefiScope AI** is an AI-powered crypto intelligence workfloor built on **SoSoValue live data**.

Users ask market questions in plain English, and the app turns SoSoValue data into:
- 📊 Market briefings
- 💸 ETF flow analysis
- 📰 News sentiment
- 🧠 AI decisions (BUY/HOLD/SELL signals, confidence, and target/stop levels)
- ⚡ Opportunity rankings
- 📋 Strategy outputs

**The core flow is:**
```
Question → Live Data → AI Decision → Visual Output
```

> 🆕 **FlowPulse Strategy Publisher** — Turns DefiScope into an AI strategy desk that generates market regimes, ranked opportunities, BTC/ETH/SOL/USDC allocations, and risk-aware plans.

---

# 🎯 The Problem It Solves

Crypto research is scattered across dashboards, charts, news feeds, ETF trackers, and exchanges. DefiScope brings that entire workflow into **one place**.

Instead of showing raw data, it **explains what the data means**. A user can quickly understand:
- 📈 Market direction
- 💸 ETF flow pressure
- 📰 News sentiment
- ⚡ Opportunity quality
- 🛡️ Risk — all before making a decision

---

# 🧩 Challenges We Ran Into

The hardest part was making **live data reliable**. 

Some SoSoValue endpoints provide market intelligence, while coin price data needed stronger normalization. The Opportunity Discovery panel was rendering, but some data was missing or empty.

**Fixes applied:**
- 🔧 Improved the SoSoValue client proxy
- 🔧 Added `coinMarkets` integration for live Binance price data
- 🔧 Added fallback opportunity ranking
- 🔧 Made the UI handle empty states safely

Another challenge was finding the **right use case**. A simple *"Trade BTC now"* agent felt too generic, so Agent mode was reframed into a **strategy publisher workflow** with Base Testnet proofs on the roadmap.

---

# 🛠️ Technologies Used

| Category | Stack |
|---|---|
| **Frontend** | React + TypeScript + Vite |
| **Styling** | Vanilla CSS + Tailwind CSS + shadcn/ui + Framer Motion |
| **Backend** | Supabase + Edge Functions |
| **Data** | SoSoValue API |
| **AI** | AI decision / tool-calling workflow |
| **On-chain** | SoDEX Testnet API |
| **Deployment** | Vercel |
| **Planned** | Base Testnet blockchain integration |

---

# 🏗️ How We Built It

DefiScope uses a **two-step AI flow**.

### Step 1 — Tool Selection
The AI decides which tools to call based on the user's question:
- 📊 Market narrative
- 💸 ETF flows
- ⚡ Opportunity discovery
- 📰 News sentiment
- 🧠 AI decision signal
- 📈 Live chart

### Step 2 — Synthesis & Rendering
Those tools fetch live data through a **Supabase Edge Function** that keeps API keys server-side. The AI then writes a clear answer and the UI renders **rich panels inline**.

For Agent mode, **FlowPulse** turns that data into:
```
Strategy Memo → Allocation → Risk Notes → Optional Action
```

---

# 💡 What We Learned

The best product is **not just an AI trading button**.
> The stronger use case is an **AI market intelligence and strategy desk**.

We also learned that **data reliability matters as much as AI quality**. If API shapes change or return empty arrays, the user experience breaks entirely. Strong normalization, fallback logic, and clear empty states are **essential**.

---

# 🔮 What's Next for DefiScope AI

## 🌊 Current Wave (Wave 2) — SoDEX Panel & Interactive Workspace (Completed!)

Instead of using blocked third-party iframes, Wave 2 integrates a premium **SoDEX Launch Panel & Chart Workspace** in the split-screen dashboard:
- [x] **Interactive Asset Selector**: Toggle dynamically between `BTC`, `ETH`, and `SOL` in the side panel.
- [x] **TradingView Real-time Chart**: Displays live candlestick spot chart widgets for the chosen asset.
- [x] **AI Market Signals**: Displays Momentum, Institutional, and Sentiment indicators.
- [x] **AI Verification Status**:
  - `✓ AI Verified`: Shows in green when signals are derived from the latest AI decision run (inputs: live prices, ETF flows, and news sentiment).
  - `⚠ Live Price Baseline`: Shows when loading other assets, guiding the user to run a specific briefing in the chat to get AI-verified signals.
- [x] **Visual Trade Setup Diagram**: Visualizes Entry, Target (with percentage gains), and Stop Loss (with percentage losses) calculated dynamically from real-time sosoValue coin prices.
- [x] **Action CTAs**: Safe deep-linking to SoDEX Testnet and copy order details utility.
- [x] **Animated Allocation Pie Chart**: Auto-drawing donut chart using Recharts for FlowPulse allocations.

---

## 🌊🌊 Wave 3 — Base Testnet & Verification Suite (Completed!)

Wave 3 completes **Base Testnet blockchain integration** and adds professional analytics and verification pages to match buildathon flagship standards:
- [x] **Base Sepolia strategy publishing**: Store FlowPulse strategy memo hashes on Base Sepolia.
- [x] **Diagnostics Page (`/diag`)**: Real-time integration check with latency indicators for SoSoValue and Binance feeds.
- [x] **Judges Walkthrough (`/judges`)**: Reviewer script with 1-click test simulation and MetaMask guest profile simulation.
- [x] **90-Day Strategy Backtesting**: Run live portfolio performance simulation on 90-day price history with Sharpe ratio, Sortino, Max Drawdown, and Win Rate metrics.
- [x] **Onboarding presets**: Quick suggestion cards at the bottom of empty chats to trigger planning logic immediately.

---

## 🌊🌊🌊 Wave 4 — Full On-Chain Strategy Platform (Planned Roadmap)

Wave 4 expands DefiScope into a fuller **on-chain strategy platform**:
- [ ] Tokenized strategy baskets on Base Testnet
- [ ] Testnet rebalance simulation
- [ ] Scheduled AI strategy updates
- [ ] Followable public strategy profiles
- [ ] AI index-publisher mode
- [ ] Optional SoDEX execution for strategy actions

### 🏁 Long-Term Vision
> DefiScope becomes a **lightweight AI fund-manager assistant** that researches markets, explains decisions, publishes verifiable strategy records on Base Testnet, and connects those strategies to execution rails.

---

# 📂 Technical Details & API Architecture

## Database Tables

| Table | Purpose |
|---|---|
| `conversations` | Chat session metadata per wallet |
| `messages` | Individual messages with tool step data |
| `strategy_records` | Published FlowPulse strategies with tx hashes |

## Edge Functions

| Function | Purpose |
|---|---|
| `sosovalue` | SoSoValue proxy + cache + Binance price enrichment |
| `ai-chat` | Two-phase tool-calling AI (plan → synthesize) |
| `ai-decision` | Structured BUY/HOLD/SELL signal generation |

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

## Example Queries

- *"Should I buy BTC right now?"*
- *"Run a full market briefing"* → triggers FlowPulse Strategy Card
- *"ETF flow analysis for BTC"*
- *"Top opportunities today"*
- *"Live ETH chart"*

---

## License

MIT © [dinitheth](https://github.com/dinitheth)
