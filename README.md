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

```text
Question -> Live Data -> AI Decision -> Visual Output
```

FlowPulse Strategy turns DefiScope into an AI strategy desk that generates market regimes, ranked opportunities, BTC/ETH/SOL/USDC allocations, and risk-aware plans.

---

# The Problem It Solves

Crypto research and portfolio auditing are highly fragmented:
* Traders check market tickers on one app, read news on another, track ETF flows on third-party tables, and audit their own trade logs manually.
* Most platforms focus purely on *raw data* or *price predictions* instead of explaining **what the data means** or **where the trader is losing money**.

DefiScope AI consolidates this loop. It does not just show data; it explains market context, diagnoses portfolio risk, and identifies evidence-supported execution patterns.

---

# Challenges We Ran Into & Solutions

### 1. Reliable public wallet-history retrieval

* **The Problem**: A wallet may trade spot, perpetuals, or both; a perps-only history query wrongly reports a spot trader as having no history.
* **The Solution**: The mainnet collector now reads SoDEX public perps and spot account endpoints, including balances, positions, executions, funding, order history, and closed positions. It normalizes the returned records into a traceable client-side ledger.

### 2. Accurate performance reporting with incomplete history

* **The Problem**: A spot execution alone does not provide a safe realized PnL. Exchange APIs can also return a partial execution window.
* **The Solution**: Spot PnL is calculated only for FIFO-matched buy/sell lots. Unmatched inventory remains unscored, and a 50-execution spot response is marked potentially partial instead of being claimed as lifetime-complete.

### 3. Wallet-switch state safety

* **The Problem**: Risk values from a previously loaded wallet must never be presented for a newly requested address.
* **The Solution**: Loading a new account clears the preceding risk state before calculations begin. Unsupported or stablecoin-only exposure shows an explicit coverage limitation rather than default BTC/ETH/SOL metrics.

---

## Mainnet Account Analytics Update

The SoDEX workspace now uses public **SoDEX Mainnet** account APIs only. It is read-only: it never requests signing, creates orders, or falls back to testnet, explorers, wallet-hash-seeded profiles, or fabricated PnL.

### Wallet analysis

- Paste a wallet in the profile panel or ask: `Analyse this wallet - 0x...`.
- A wallet supplied in chat overrides the connected wallet for that analysis and synchronizes the Risk Engine and Autopsy panel.
- Perpetuals: balances, positions, closed-position history, executions, and funding records.
- Spot: balances, order-history records, and executions.
- Account responses are normalized into a source-traceable ledger for the UI and AI summary.

### Performance safeguards

- Perpetual PnL uses SoDEX-reported realized PnL.
- Spot realized PnL uses FIFO only when a returned sale can be matched to an earlier returned buy.
- Unmatched spot inventory is shown as activity, not assigned an invented cost basis or PnL.
- The Data Integrity panel reports record counts, source errors, and partial-history warnings.
- “30D” metrics are restricted to the trailing 30-day window.
- Profit factor is displayed as **Not measurable** when there are no realized losses.
- A loss pattern is shown only when its observed expectancy is negative.
- Edge scoring requires at least 30 verified realized lots and includes a sample-size adjustment.
- Risk state is cleared when changing wallets, preventing prior-wallet calculations from appearing for a newly requested address.

### Known coverage limits

Public SoDEX history can be paginated or retention-limited. A 50-execution spot response is marked potentially partial; DefiScope does not claim lifetime-complete analytics unless source coverage supports it. Unsupported or stablecoin-only holdings do not receive made-up market-risk or correlation data.

---

# Technologies Used

| Category | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Vanilla CSS + Tailwind CSS + shadcn/ui + Framer Motion |
| Backend | Supabase + Edge Functions |
| Data | SoSoValue API + SoDEX Mainnet REST APIs |
| AI | AI decision / tool-calling workflow |
| Deployment | Vercel |

---

# How We Built It

DefiScope uses a two-step AI flow.

### Step 1 - Tool Selection

The AI decides which live-data tools to call based on the user's question: market narrative, ETF flows, opportunity discovery, news sentiment, AI decision signal, and charts.

### Step 2 - Synthesis & Rendering

Those tools fetch live data through Supabase Edge Functions that keep provider keys server-side. The AI writes a clear answer and the UI renders the supporting panels inline.

For Agent mode, FlowPulse turns that data into:

```text
Strategy Memo -> Allocation -> Risk Notes -> Optional Action
```

---

# Completed Development Milestones

## Wave 2 - SoDEX Panel & Interactive Workspace

- [x] Interactive asset selection, charts, AI signals, trade setup display, safe SoDEX deep-linking, and allocation visuals.

## Wave 3 - Risk Engine & Performance Autopsy

Wave 3 is the live, read-only SoDEX Mainnet **Risk Engine** and **Performance Autopsy** workspace shown in the application.

### Risk Engine

- [x] **Mainnet portfolio loading**: Reads reported SoDEX balances, open perpetual positions, and account state; nested API balance records are normalized before portfolio allocation is calculated.
- [x] **90-day market-risk analytics**: Historical VaR/CVaR, maximum drawdown, ulcer index, Sharpe, Sortino, Calmar, Omega, daily win rate, annualized return, and annualized volatility.
- [x] **Portfolio risk score**: Concentration, volatility, drawdown, correlation, and tail-risk sub-scores combine into a 0–100 portfolio-risk score and grade.
- [x] **Correlation and contribution analysis**: Correlation matrix, average correlation/contagion warning, concentration metrics, and per-asset risk contributions when supported market data is available.
- [x] **Stress testing**: Mainnet-candle scenario simulator for market-wide or selected-asset shocks; uses actual reported allocation weights, not a seeded portfolio.
- [x] **State isolation**: Clears prior wallet risk state before a new wallet is calculated, preventing stale BTC/ETH/SOL risk results from appearing for another account.
- [x] **Honest unsupported-data handling**: Stablecoin-only or unsupported-instrument accounts display a coverage limitation instead of fabricated correlations, volatility, or risk metrics.

### Performance Autopsy

- [x] **Mainnet-only account collector**: Reads SoDEX perpetual balances, positions, closed-position history, executions, and funding records, plus spot balances, order history, and executions.
- [x] **Chat wallet targeting**: `Analyse this wallet - 0x...` extracts that address, analyzes it directly, and synchronizes the left-side Risk Engine/Autopsy profile to the same wallet.
- [x] **Verified trade coverage**: Shows closed perpetual positions, spot executions, and FIFO-matched spot disposal lots in the profile and AI response.
- [x] **Realized-PnL rules**: Perpetual PnL uses SoDEX-reported values. Spot PnL is calculated only when a sale matches earlier returned buy lots using FIFO; unmatched inventory is not assigned fake cost basis or PnL.
- [x] **Evidence-based scorecard**: Verified 30-day PnL and volume, win rate, expectancy, profit factor, fee coverage, observed patterns, equity curve, and counterfactual analysis.
- [x] **Statistical safeguards**: Edge scoring requires at least 30 verified realized lots and applies a sample-size adjustment; profit factor is labelled “Not measurable” when there are no realized losses.
- [x] **Leak-detection safeguards**: A “largest repeatable loss pattern” is shown only for a genuinely negative observed pattern; profitable patterns are never labelled as leaks.
- [x] **Data integrity panel**: Reports perps closures/executions, spot executions, matched spot lots, order records, source errors, and complete/partial/unavailable coverage.
- [x] **Partial-history protection**: A spot response at the 50-execution boundary is flagged as potentially partial, so the app does not claim lifetime-complete results without source coverage.

### Mainnet data guarantees

- [x] No testnet source in the live analysis path.
- [x] No wallet-hash-seeded profile, benchmark, or synthetic PnL in live mode.
- [x] No explorer substitution for SoDEX trade history.
- [x] Read-only account analysis: no signing, order placement, or execution path.
- [x] `sodex-mainnet-account` Edge Function provides a browser-safe, read-only gateway for SoDEX Mainnet account requests.

---

# What We Learned

* **Actionable forensics require evidence boundaries**: a convincing-looking metric is not useful if the source history or cost basis is incomplete.
* **Real-data UX must expose coverage**: source endpoints, record counts, partial-history warnings, and withheld calculations are as important as the final score.
* **Reliability is better than a synthetic fallback**: when records are absent or unsupported, DefiScope reports that state rather than generating a fake profile.

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
| sosovalue | SoSoValue proxy + cache + price enrichment |
| ai-chat | Two-phase tool-calling AI (plan -> synthesize) |
| ai-decision | Structured BUY/HOLD/SELL signal generation |
| sodex-mainnet-account | Read-only SoDEX Mainnet perps and spot account gateway |

`sodex-mainnet-account` has no signing or execution path. Keep provider keys such as `SOSO_API_KEY` in Edge Function secrets; do not put them in `VITE_*` variables or commit them.

## Local Development

```bash
npm install
npm run dev
```

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Example Queries

- *"Should I buy BTC right now?"*
- *"Run a full market briefing"*
- *"ETF flow analysis for BTC"*
- *"Analyse this wallet - 0x7079002471f8004cd34e8aeaa65dfc2b2e12430b"*
- *"What are the biggest leaks in my trading performance?"*

---

## Product Vision

> DefiScope is an AI market-intelligence and strategy desk that researches markets, explains decisions, and performs source-backed, read-only trade-performance analysis.

## License

MIT © [dinitheth](https://github.com/dinitheth)
