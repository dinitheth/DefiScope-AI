# DefiScope AI

AI-powered portfolio and performance intelligence - ask any crypto question, get live data-backed answers, and utilize the interactive risk auditing and autopsy workspace panel.

[![SoSoValue Buildathon 2026](https://img.shields.io/badge/SoSoValue-Buildathon%202026-blue)](https://sosovalue.com)
[![Wave 3 Complete](https://img.shields.io/badge/Wave-3%20Complete-green)](https://github.com/dinitheth/DefiScope-AI)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

# What It Does

DefiScope AI is an AI-powered crypto intelligence workfloor built on SoSoValue live data.

Users ask market questions in plain English, and the app turns SoSoValue data into:
- Market briefings
- ETF flow analysis
- News sentiment
- AI decisions (BUY/HOLD/SELL signals, confidence, and target/stop levels)
- Opportunity rankings
- Strategy outputs

The core flow is:
```
Question -> Live Data -> AI Decision -> Visual Output
```

FlowPulse Strategy - Turns DefiScope into an AI strategy desk that generates market regimes, ranked opportunities, BTC/ETH/SOL/USDC allocations, and risk-aware plans.

---

# The Problem It Solves

Crypto research and portfolio auditing are highly fragmented:
*   Traders check market tickers on one app, read news on another, track ETF flows on third-party tables, and audit their own trade logs manually.
*   Most platforms focus purely on *raw data* or *price predictions* instead of explaining **what the data means** or **where the trader is losing money**.

DefiScope AI consolidates this entire loop. It doesn't just show data; it **diagnoses portfolio risk** and **forensically identifies execution leaks** in one click.

---

# Challenges We Ran Into & Solutions

### 1. Public Wallet History Retrieval (Without API Keys)
*   **The Problem**: We wanted users to paste any wallet address to autopsy their historical performance, but querying private exchange databases or requiring users to sign in with API keys breaks the seamless web experience.
*   **The Solution**: By auditing the public REST gateways of SoDEX, we discovered that account position history endpoints (`/perps/accounts/{userAddress}/positions/history`) are fully public and require no auth headers. We implemented a parallel fetcher that pulls from **SoDEX Mainnet**, **SoDEX Testnet**, **Basescan**, and **Etherscan** APIs to compile a real-time ledger on the fly.

### 2. Multi-Asset ERC20 On-Chain Balance Fetching
*   **The Problem**: Wallet balances in React apps are often mocked or restricted to native gas assets. We needed to load the user's real holdings (USDC, BTC, ETH, SOL) to populate the Risk Engine and Rebalancer.
*   **The Solution**: We integrated direct JSON-RPC queries using `window.ethereum` (MetaMask/Rabby). The app dynamically queries the connected chain ID, maps token contracts for both **Base Mainnet** and **Ethereum Mainnet**, and executes standard `eth_call` queries for `balanceOf(address)` to fetch multi-token balances on-chain.

---

# Technologies Used

| Category | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Vanilla CSS + Tailwind CSS + shadcn/ui + Framer Motion |
| Backend | Supabase + Edge Functions |
| Data | SoSoValue API |
| AI | AI decision / tool-calling workflow |
| On-chain | JSON-RPC (`eth_call`, `eth_getBalance`), Basescan, Etherscan |
| DEX Gateways | SoDEX Mainnet & Testnet REST APIs |
| Deployment | Vercel |

---

# How We Built It

DefiScope uses a two-step AI flow.

### Step 1 - Tool Selection
The AI decides which tools to call based on the user's question:
- Market narrative
- ETF flows
- Opportunity discovery
- News sentiment
- AI decision signal
- Live chart

### Step 2 - Synthesis & Rendering
Those tools fetch live data through a Supabase Edge Function that keeps API keys server-side. The AI then writes a clear answer and the UI renders rich panels inline.

For Agent mode, FlowPulse turns that data into:
```
Strategy Memo -> Allocation -> Risk Notes -> Optional Action
```

---

# What We Learned

*   **Actionable Forensics > Generic Signals**: A generic *"Should I buy BTC"* bot is not enough. The true value lies in helping traders understand *where their edge breaks*. Pinpointing a specific performance leak (e.g., trading SOL during bearish regimes at night) saves more capital than typical buy/sell alerts.
*   **Reliability & Fallbacks**: API shapes change and on-chain accounts can be fresh and empty. Building clean, structured fallbacks (e.g., seeding a deterministic mock ledger from the wallet's hash when a fresh wallet connects) ensures the product is always interactive and functional.

---

# Completed Development Milestones

## Wave 2 - SoDEX Panel & Interactive Workspace (Completed!)

Instead of using blocked third-party iframes, Wave 2 integrates a premium SoDEX Launch Panel & Chart Workspace in the split-screen dashboard:
- [x] Interactive Asset Selector: Toggle dynamically between BTC, ETH, and SOL in the side panel.
- [x] TradingView Real-time Chart: Displays live candlestick spot chart widgets for the chosen asset.
- [x] AI Market Signals: Displays Momentum, Institutional, and Sentiment indicators.
- [x] AI Verification Status:
  - `✓ AI Verified`: Shows in green when signals are derived from the latest AI decision run (inputs: live prices, ETF flows, and news sentiment).
  - `⚠ Live Price Baseline`: Shows when loading other assets, guiding the user to run a specific briefing in the chat to get AI-verified signals.
- [x] Visual Trade Setup Diagram: Visualizes Entry, Target (with percentage gains), and Stop Loss (with percentage losses) calculated dynamically from real-time sosoValue coin prices.
- [x] Action CTAs: Safe deep-linking to SoDEX Testnet and copy order details utility.
- [x] Animated Allocation Pie Chart: Auto-drawing donut chart using Recharts for FlowPulse allocations.

---

## Wave 3 - Institutional Risk Engine & Autopsy (Completed Final Wave!)

Wave 3 introduces an institutional-grade Risk Engine and Performance Autopsy workstation:
- [x] **16 Quantitative Risk Metrics**: Sharpe, Sortino, Calmar, Omega, historical VaR/CVaR, and max drawdowns.
- [x] **Correlation Heatmap**: 3x3 pairwise correlation matrix with Contagion warning thresholds.
- [x] **Scenario Stress-Testing**: Shock holdings by up to -50% to evaluate tail-risk impact.
- [x] **Direct SoDEX REST API Integrations**: Pull positions history directly from mainnet and testnet.
- [x] **On-Chain Balance Retrieval**: Standard JSON-RPC ERC20 queries for multi-token balances on Base/Ethereum.
- [x] **Explorer Crawlers**: Fallback to Etherscan/Basescan APIs for transaction history.

---

## Product Vision
> DefiScope stands as a fully operational **AI market intelligence and strategy desk** that researches markets, explains decisions, performs diagnostic trade autopsies, and connects those strategies to simulated execution rails.

---

# Technical Details & API Architecture

## Database Tables

| Table | Purpose |
|---|---|
| conversations | Chat session metadata per wallet |
| messages | Individual messages with tool step data |
| strategy_records | Saved FlowPulse strategies |

## Edge Functions

| Function | Purpose |
|---|---|
| sosovalue | SoSoValue proxy + cache + Binance price enrichment |
| ai-chat | Two-phase tool-calling AI (plan -> synthesize) |
| ai-decision | Structured BUY/HOLD/SELL signal generation |

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
- *"Run a full market briefing"* -> triggers FlowPulse Strategy Card
- *"ETF flow analysis for BTC"*
- *"Top opportunities today"*
- *"Live ETH chart"*

---

## License

MIT © [dinitheth](https://github.com/dinitheth)
