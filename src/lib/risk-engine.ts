// ─────────────────────────────────────────────────────────────────────────────
// DefiScope AI — Risk Engine Core
// Institutional-grade portfolio risk analytics computed entirely client-side.
// All functions are pure: they accept returns/weights and output typed results.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

export interface DailyReturn {
  date: string;
  returns: Record<string, number>; // asset symbol → daily log return
}

export interface RiskMetrics {
  var95: number;        // Value at Risk (95% confidence) — daily, as negative %
  var99: number;        // Value at Risk (99% confidence)
  cvar95: number;       // Conditional VaR / Expected Shortfall (95%)
  cvar99: number;       // Conditional VaR / Expected Shortfall (99%)
  sharpe: number;       // Sharpe Ratio (annualized, rf = 0.04)
  sortino: number;      // Sortino Ratio (annualized, MAR = 0)
  calmar: number;       // Calmar Ratio (annualized return / max drawdown)
  omega: number;        // Omega Ratio (threshold = 0)
  ulcerIndex: number;   // Ulcer Index (drawdown pain)
  maxDrawdown: number;  // Max Drawdown (as negative %)
  maxDrawdownDuration: number; // Days in worst drawdown
  currentDrawdown: number;     // Current drawdown from peak
  recoveryEstimateDays: number; // Estimated days to recover
  dailyWinRate: number; // % of days with positive return
  totalReturn: number;  // Total cumulative return %
  annualizedReturn: number;
  annualizedVolatility: number;
}

export interface ConcentrationMetrics {
  hhi: number;          // Herfindahl-Hirschman Index (0-10000)
  effectiveN: number;   // Equivalent number of equal-weight positions
  topAsset: string;     // Name of largest position
  topAssetWeight: number; // Weight of largest position (0-1)
  grade: "Well Diversified" | "Moderate" | "Concentrated" | "Highly Concentrated";
}

export interface CorrelationResult {
  matrix: Record<string, Record<string, number>>; // asset → asset → correlation
  avgAbsCorrelation: number;
  contagionAlert: boolean; // true if avg > 0.75
  pairs: { a: string; b: string; corr: number }[];
}

export interface RiskContribution {
  asset: string;
  weight: number;
  marginalContribution: number; // % of total portfolio risk
  absoluteContribution: number;
}

export interface ScenarioResult {
  shockLabel: string;
  shockPct: number;
  portfolioImpactPct: number;
  newPortfolioValue: number; // from $10000 base
  assetImpacts: { asset: string; impactPct: number; dollarLoss: number }[];
  newRiskScore: number;
}

export interface RiskRecommendation {
  severity: "info" | "warning" | "critical";
  message: string;
  metric: string;
}

export type RiskGrade = "A+" | "A" | "B" | "C" | "D";

export interface CompositeRiskScore {
  score: number;       // 0-100
  grade: RiskGrade;
  label: string;
  color: string;
  subScores: {
    concentration: number;
    volatility: number;
    drawdown: number;
    correlation: number;
    tailRisk: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_FREE_RATE = 0.04; // ~4% annualized (stablecoin yield proxy)
const TRADING_DAYS_YEAR = 365; // crypto trades 24/7/365

// ─── Utility Functions ──────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

// ─── Core Metric Calculators ────────────────────────────────────────────────

/**
 * Compute weighted portfolio daily returns from per-asset returns and allocation weights.
 */
export function computePortfolioReturns(
  dailyReturns: DailyReturn[],
  allocation: Record<string, number> // symbol → weight as % (e.g. BTC: 40)
): number[] {
  const assets = Object.keys(allocation);
  const totalWeight = Object.values(allocation).reduce((s, v) => s + v, 0);
  if (totalWeight === 0) return [];

  return dailyReturns.map((day) => {
    let portfolioReturn = 0;
    for (const asset of assets) {
      const weight = (allocation[asset] || 0) / totalWeight;
      const assetReturn = day.returns[asset] || 0;
      portfolioReturn += weight * assetReturn;
    }
    return portfolioReturn;
  });
}

/**
 * Value at Risk — Historical Simulation method.
 * Returns negative numbers (e.g. -0.045 means "5% chance of losing more than 4.5% in a day").
 */
export function computeVaR(returns: number[], confidence: number = 0.95): number {
  if (returns.length < 5) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const alpha = 1 - confidence;
  return percentile(sorted, alpha);
}

/**
 * Conditional VaR / Expected Shortfall.
 * Average of all returns worse than VaR.
 */
export function computeCVaR(returns: number[], confidence: number = 0.95): number {
  if (returns.length < 5) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const alpha = 1 - confidence;
  const cutoffIdx = Math.max(1, Math.floor(sorted.length * alpha));
  const tailReturns = sorted.slice(0, cutoffIdx);
  return mean(tailReturns);
}

/**
 * Sharpe Ratio — annualized, using stablecoin yield as risk-free rate.
 */
export function computeSharpe(returns: number[]): number {
  if (returns.length < 5) return 0;
  const avgDaily = mean(returns);
  const dailyStd = stdDev(returns);
  if (dailyStd === 0) return 0;
  const dailyRf = RISK_FREE_RATE / TRADING_DAYS_YEAR;
  return ((avgDaily - dailyRf) / dailyStd) * Math.sqrt(TRADING_DAYS_YEAR);
}

/**
 * Sortino Ratio — only penalizes downside volatility.
 */
export function computeSortino(returns: number[], mar: number = 0): number {
  if (returns.length < 5) return 0;
  const avgDaily = mean(returns);
  const downsideReturns = returns.filter((r) => r < mar);
  if (downsideReturns.length === 0) return avgDaily > 0 ? 99 : 0;
  const downsideDev = Math.sqrt(
    downsideReturns.reduce((s, r) => s + (r - mar) ** 2, 0) / downsideReturns.length
  );
  if (downsideDev === 0) return 0;
  return ((avgDaily - mar) / downsideDev) * Math.sqrt(TRADING_DAYS_YEAR);
}

/**
 * Calmar Ratio — annualized return divided by max drawdown.
 */
export function computeCalmar(returns: number[]): number {
  const mdd = computeMaxDrawdown(returns);
  if (mdd.maxDrawdown === 0) return 0;
  const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const annualized = Math.pow(1 + totalReturn, TRADING_DAYS_YEAR / returns.length) - 1;
  return annualized / Math.abs(mdd.maxDrawdown);
}

/**
 * Omega Ratio — full distribution risk/reward (threshold = 0).
 */
export function computeOmega(returns: number[], threshold: number = 0): number {
  const gains = returns.filter((r) => r > threshold).reduce((s, r) => s + (r - threshold), 0);
  const losses = returns.filter((r) => r < threshold).reduce((s, r) => s + Math.abs(r - threshold), 0);
  if (losses === 0) return gains > 0 ? 99 : 1;
  return gains / losses;
}

/**
 * Ulcer Index — measures drawdown depth and duration "pain".
 */
export function computeUlcerIndex(returns: number[]): number {
  if (returns.length === 0) return 0;
  let peak = 1;
  let equity = 1;
  let sumSquaredDD = 0;

  for (const r of returns) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    const drawdownPct = ((peak - equity) / peak) * 100;
    sumSquaredDD += drawdownPct * drawdownPct;
  }

  return Math.sqrt(sumSquaredDD / returns.length);
}

/**
 * Max Drawdown calculation with duration tracking.
 */
export function computeMaxDrawdown(returns: number[]): {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  currentDrawdown: number;
  recoveryEstimateDays: number;
  equityCurve: { day: number; equity: number; drawdown: number }[];
} {
  if (returns.length === 0) {
    return { maxDrawdown: 0, maxDrawdownDuration: 0, currentDrawdown: 0, recoveryEstimateDays: 0, equityCurve: [] };
  }

  let peak = 1;
  let equity = 1;
  let maxDD = 0;
  let maxDDDuration = 0;
  let currentDDStart = -1;
  const equityCurve: { day: number; equity: number; drawdown: number }[] = [];

  for (let i = 0; i < returns.length; i++) {
    equity *= 1 + returns[i];
    if (equity > peak) {
      peak = equity;
      currentDDStart = -1;
    } else {
      if (currentDDStart === -1) currentDDStart = i;
    }

    const dd = (peak - equity) / peak;
    equityCurve.push({ day: i, equity, drawdown: -dd });

    if (dd > maxDD) {
      maxDD = dd;
      if (currentDDStart >= 0) {
        maxDDDuration = i - currentDDStart + 1;
      }
    }
  }

  const currentDD = (peak - equity) / peak;
  const avgDailyReturn = mean(returns);
  let recoveryDays = 0;
  if (currentDD > 0.001 && avgDailyReturn > 0) {
    recoveryDays = Math.ceil(Math.log(peak / equity) / Math.log(1 + avgDailyReturn));
  } else if (currentDD > 0.001) {
    recoveryDays = 999; // Cannot recover with negative avg return
  }

  return {
    maxDrawdown: -maxDD, // Negative number
    maxDrawdownDuration: maxDDDuration,
    currentDrawdown: -currentDD,
    recoveryEstimateDays: Math.min(recoveryDays, 999),
    equityCurve,
  };
}

/**
 * Complete risk metrics suite from portfolio returns.
 */
export function computeAllRiskMetrics(returns: number[]): RiskMetrics {
  const dd = computeMaxDrawdown(returns);
  const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const annualizedReturn = Math.pow(1 + totalReturn, TRADING_DAYS_YEAR / Math.max(returns.length, 1)) - 1;
  const annualizedVol = stdDev(returns) * Math.sqrt(TRADING_DAYS_YEAR);
  const winDays = returns.filter((r) => r > 0).length;

  return {
    var95: computeVaR(returns, 0.95),
    var99: computeVaR(returns, 0.99),
    cvar95: computeCVaR(returns, 0.95),
    cvar99: computeCVaR(returns, 0.99),
    sharpe: computeSharpe(returns),
    sortino: computeSortino(returns),
    calmar: computeCalmar(returns),
    omega: computeOmega(returns),
    ulcerIndex: computeUlcerIndex(returns),
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownDuration: dd.maxDrawdownDuration,
    currentDrawdown: dd.currentDrawdown,
    recoveryEstimateDays: dd.recoveryEstimateDays,
    dailyWinRate: returns.length > 0 ? (winDays / returns.length) * 100 : 0,
    totalReturn: totalReturn * 100,
    annualizedReturn: annualizedReturn * 100,
    annualizedVolatility: annualizedVol * 100,
  };
}

// ─── Concentration Analysis ─────────────────────────────────────────────────

export function computeConcentration(allocation: Record<string, number>): ConcentrationMetrics {
  const entries = Object.entries(allocation).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return { hhi: 0, effectiveN: 0, topAsset: "-", topAssetWeight: 0, grade: "Well Diversified" };
  }

  const weights = entries.map(([name, val]) => ({ name, weight: val / total }));
  const hhi = weights.reduce((s, w) => s + (w.weight * 100) ** 2, 0);
  const effectiveN = hhi > 0 ? 10000 / hhi : 0;
  const sorted = [...weights].sort((a, b) => b.weight - a.weight);

  let grade: ConcentrationMetrics["grade"];
  if (hhi < 1500) grade = "Well Diversified";
  else if (hhi < 2500) grade = "Moderate";
  else if (hhi < 5000) grade = "Concentrated";
  else grade = "Highly Concentrated";

  return {
    hhi: Math.round(hhi),
    effectiveN: parseFloat(effectiveN.toFixed(1)),
    topAsset: sorted[0]?.name || "-",
    topAssetWeight: sorted[0]?.weight || 0,
    grade,
  };
}

// ─── Correlation Matrix ─────────────────────────────────────────────────────

export function computeCorrelationMatrix(dailyReturns: DailyReturn[]): CorrelationResult {
  if (dailyReturns.length < 5) {
    return { matrix: {}, avgAbsCorrelation: 0, contagionAlert: false, pairs: [] };
  }

  const assets = Object.keys(dailyReturns[0].returns);
  const returnArrays: Record<string, number[]> = {};
  for (const asset of assets) {
    returnArrays[asset] = dailyReturns.map((d) => d.returns[asset] || 0);
  }

  const matrix: Record<string, Record<string, number>> = {};
  const pairs: { a: string; b: string; corr: number }[] = [];

  for (const a of assets) {
    matrix[a] = {};
    for (const b of assets) {
      if (a === b) {
        matrix[a][b] = 1;
        continue;
      }
      const ra = returnArrays[a];
      const rb = returnArrays[b];
      const corr = pearsonCorrelation(ra, rb);
      matrix[a][b] = corr;
      // Avoid duplicate pairs
      if (a < b) {
        pairs.push({ a, b, corr });
      }
    }
  }

  const avgAbs = pairs.length > 0 ? mean(pairs.map((p) => Math.abs(p.corr))) : 0;

  return {
    matrix,
    avgAbsCorrelation: avgAbs,
    contagionAlert: avgAbs > 0.75,
    pairs,
  };
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

// ─── Risk Contribution ──────────────────────────────────────────────────────

export function computeRiskContributions(
  dailyReturns: DailyReturn[],
  allocation: Record<string, number>
): RiskContribution[] {
  const assets = Object.keys(allocation).filter((a) => (allocation[a] || 0) > 0);
  const total = Object.values(allocation).reduce((s, v) => s + v, 0);
  if (total === 0 || dailyReturns.length < 5) return [];

  const weights = assets.map((a) => (allocation[a] || 0) / total);
  const returnArrays = assets.map((a) => dailyReturns.map((d) => d.returns[a] || 0));

  // Compute covariance matrix
  const n = dailyReturns.length;
  const covMatrix: number[][] = [];
  for (let i = 0; i < assets.length; i++) {
    covMatrix[i] = [];
    const mi = mean(returnArrays[i]);
    for (let j = 0; j < assets.length; j++) {
      const mj = mean(returnArrays[j]);
      let cov = 0;
      for (let k = 0; k < n; k++) {
        cov += (returnArrays[i][k] - mi) * (returnArrays[j][k] - mj);
      }
      covMatrix[i][j] = cov / (n - 1);
    }
  }

  // Portfolio variance = w' * Sigma * w
  let portfolioVariance = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      portfolioVariance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  const portfolioVol = Math.sqrt(portfolioVariance);
  if (portfolioVol === 0) return [];

  // Marginal contribution: MCR_i = w_i * (Sigma * w)_i / sigma_p
  return assets.map((asset, i) => {
    let sigmaW = 0;
    for (let j = 0; j < assets.length; j++) {
      sigmaW += covMatrix[i][j] * weights[j];
    }
    const marginal = (weights[i] * sigmaW) / portfolioVariance;
    return {
      asset,
      weight: weights[i],
      marginalContribution: marginal * 100, // as percentage of total risk
      absoluteContribution: weights[i] * sigmaW * Math.sqrt(TRADING_DAYS_YEAR) * 100,
    };
  });
}

// ─── Scenario Simulator ─────────────────────────────────────────────────────

export function simulateScenario(
  allocation: Record<string, number>,
  shockPct: number, // e.g. -30 for "BTC drops 30%"
  shockedAsset: string | "ALL",
  currentPrices: Record<string, number>,
  portfolioReturns: number[]
): ScenarioResult {
  const total = Object.values(allocation).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return { shockLabel: "", shockPct, portfolioImpactPct: 0, newPortfolioValue: 10000, assetImpacts: [], newRiskScore: 50 };
  }

  const baseValue = 10000;
  let portfolioImpact = 0;
  const assetImpacts: ScenarioResult["assetImpacts"] = [];

  for (const [asset, weight] of Object.entries(allocation)) {
    if (weight <= 0) continue;
    const w = weight / total;
    const shock = (shockedAsset === "ALL" || asset === shockedAsset) ? shockPct / 100 : 0;
    const impact = w * shock;
    portfolioImpact += impact;
    assetImpacts.push({
      asset,
      impactPct: shock * 100,
      dollarLoss: Math.abs(baseValue * w * shock),
    });
  }

  // Estimate new risk score post-shock (simplified: increase proportionally to shock severity)
  const currentMetrics = computeAllRiskMetrics(portfolioReturns);
  const shockSeverity = Math.abs(shockPct) / 100;
  const baseScore = computeCompositeScore(
    computeConcentration(allocation),
    currentMetrics,
    { avgAbsCorrelation: 0.5, contagionAlert: false } as CorrelationResult
  );
  const stressedScore = Math.min(100, baseScore.score + shockSeverity * 30);

  const shockLabel = shockedAsset === "ALL"
    ? `Market-wide ${shockPct}% crash`
    : `${shockedAsset} drops ${Math.abs(shockPct)}%`;

  return {
    shockLabel,
    shockPct,
    portfolioImpactPct: portfolioImpact * 100,
    newPortfolioValue: baseValue * (1 + portfolioImpact),
    assetImpacts,
    newRiskScore: Math.round(stressedScore),
  };
}

// ─── Composite Risk Score ───────────────────────────────────────────────────

export function computeCompositeScore(
  concentration: ConcentrationMetrics,
  metrics: RiskMetrics,
  correlation: CorrelationResult
): CompositeRiskScore {
  // Normalize each sub-score to 0-100 (higher = more risk)
  const concScore = normalize(concentration.hhi, 0, 10000) * 100;
  const volScore = normalize(metrics.annualizedVolatility / 100, 0, 1.5) * 100; // 150% annual vol = max risk
  const ddScore = normalize(Math.abs(metrics.maxDrawdown / 100), 0, 0.6) * 100; // 60% drawdown = max risk
  const corrScore = normalize(correlation.avgAbsCorrelation, 0, 1) * 100;
  const tailScore = normalize(Math.abs(metrics.var95), 0, 0.12) * 100; // 12% daily VaR = max risk

  const score = Math.round(
    0.25 * concScore +
    0.25 * volScore +
    0.20 * ddScore +
    0.15 * corrScore +
    0.15 * tailScore
  );

  const clampedScore = clamp(score, 0, 100);

  let grade: RiskGrade, label: string, color: string;
  if (clampedScore <= 25) { grade = "A+"; label = "Conservative"; color = "#10B981"; }
  else if (clampedScore <= 45) { grade = "A"; label = "Balanced"; color = "#3B82F6"; }
  else if (clampedScore <= 65) { grade = "B"; label = "Moderate Risk"; color = "#F59E0B"; }
  else if (clampedScore <= 80) { grade = "C"; label = "Elevated Risk"; color = "#F97316"; }
  else { grade = "D"; label = "Critical Risk"; color = "#EF4444"; }

  return {
    score: clampedScore,
    grade,
    label,
    color,
    subScores: {
      concentration: Math.round(concScore),
      volatility: Math.round(volScore),
      drawdown: Math.round(ddScore),
      correlation: Math.round(corrScore),
      tailRisk: Math.round(tailScore),
    },
  };
}

// ─── AI Risk Recommendations ────────────────────────────────────────────────

export function generateRecommendations(
  score: CompositeRiskScore,
  concentration: ConcentrationMetrics,
  metrics: RiskMetrics,
  correlation: CorrelationResult
): RiskRecommendation[] {
  const recs: RiskRecommendation[] = [];

  // Concentration recommendations
  if (concentration.hhi > 4000) {
    recs.push({
      severity: "critical",
      message: `Portfolio is extremely concentrated (HHI ${concentration.hhi}). Reduce ${concentration.topAsset} from ${(concentration.topAssetWeight * 100).toFixed(0)}% — target below 35% for balanced risk.`,
      metric: "HHI",
    });
  } else if (concentration.hhi > 2500) {
    recs.push({
      severity: "warning",
      message: `High concentration detected (HHI ${concentration.hhi}). Consider spreading allocation across more assets — effective positions: ${concentration.effectiveN.toFixed(1)}.`,
      metric: "HHI",
    });
  }

  // VaR recommendations
  if (Math.abs(metrics.var95) > 0.06) {
    recs.push({
      severity: "critical",
      message: `Daily VaR exceeds 6% — a ${(Math.abs(metrics.var95) * 100).toFixed(1)}% loss is possible on any given day (95% confidence). Increase USDC allocation to reduce tail exposure.`,
      metric: "VaR",
    });
  } else if (Math.abs(metrics.var95) > 0.035) {
    recs.push({
      severity: "warning",
      message: `Daily Value at Risk is ${(Math.abs(metrics.var95) * 100).toFixed(1)}% — consider adding a stablecoin buffer to protect against single-day swings.`,
      metric: "VaR",
    });
  }

  // Drawdown recommendations
  if (Math.abs(metrics.currentDrawdown) > 0.15) {
    recs.push({
      severity: "critical",
      message: `Portfolio is ${(Math.abs(metrics.currentDrawdown) * 100).toFixed(1)}% below its peak. Estimated ${metrics.recoveryEstimateDays > 500 ? "500+" : metrics.recoveryEstimateDays} days to recover at current pace.`,
      metric: "Drawdown",
    });
  } else if (Math.abs(metrics.currentDrawdown) > 0.05) {
    recs.push({
      severity: "warning",
      message: `Currently ${(Math.abs(metrics.currentDrawdown) * 100).toFixed(1)}% in drawdown. Recovery expected in ~${metrics.recoveryEstimateDays} trading days.`,
      metric: "Drawdown",
    });
  }

  // Correlation recommendations
  if (correlation.contagionAlert) {
    recs.push({
      severity: "critical",
      message: `Contagion risk detected — average cross-asset correlation is ${(correlation.avgAbsCorrelation * 100).toFixed(0)}%. Diversification is ineffective; assets are moving in lockstep.`,
      metric: "Correlation",
    });
  } else if (correlation.avgAbsCorrelation > 0.55) {
    recs.push({
      severity: "info",
      message: `Cross-asset correlation is moderate (${(correlation.avgAbsCorrelation * 100).toFixed(0)}%). Monitor for correlation spikes during market stress periods.`,
      metric: "Correlation",
    });
  }

  // Sortino / performance quality
  if (metrics.sortino < 0) {
    recs.push({
      severity: "warning",
      message: `Negative Sortino ratio (${metrics.sortino.toFixed(2)}) — downside volatility exceeds returns. The current allocation is not compensating for the risk taken.`,
      metric: "Sortino",
    });
  }

  // If score is very good, affirm
  if (score.score <= 30 && recs.length === 0) {
    recs.push({
      severity: "info",
      message: "Portfolio risk profile is healthy. Current allocation balances growth exposure with adequate diversification.",
      metric: "Overall",
    });
  }

  return recs;
}

// ─── Binance Klines Fetcher ─────────────────────────────────────────────────

export async function fetchDailyReturns(
  assets: string[],
  days: number = 90
): Promise<DailyReturn[]> {
  const promises = assets
    .filter((a) => a.toUpperCase() !== "USDC") // USDC has ~0 volatility
    .map(async (asset) => {
      const symbol = `${asset.toUpperCase()}USDT`;
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${days}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance klines failed for ${symbol}`);
      const data = await res.json();
      return {
        asset: asset.toUpperCase(),
        candles: data.map((k: any) => ({
          date: new Date(k[0]).toISOString().slice(0, 10),
          close: parseFloat(k[4]),
        })),
      };
    });

  const results = await Promise.all(promises);

  // Compute daily log returns for each asset
  const dateMap = new Map<string, Record<string, number>>();

  for (const { asset, candles } of results) {
    for (let i = 1; i < candles.length; i++) {
      const date = candles[i].date;
      const logReturn = Math.log(candles[i].close / candles[i - 1].close);
      if (!dateMap.has(date)) dateMap.set(date, {});
      dateMap.get(date)![asset] = logReturn;
    }
  }

  // Convert to sorted array, fill USDC = 0 for all dates
  const sorted = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, returns]) => {
      returns.USDC = 0;
      return { date, returns };
    });

  return sorted;
}

export interface ClosedPosition {
  id: string;
  market: "perps" | "spot";
  asset: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  fee: number | null;
  regime: "bullish" | "bearish" | "chop";
  hour: number;
  date: string;
  closedAt: number;
}

export interface MainnetWalletSnapshot {
  source: "mainnet" | "demo";
  address: string;
  balances: Record<string, unknown>[];
  spotBalances: Record<string, unknown>[];
  openPositions: Record<string, unknown>[];
  openOrders: Record<string, unknown>[];
  closedPositions: ClosedPosition[];
  trades: Record<string, unknown>[];
  spotTrades: Record<string, unknown>[];
  fundingPayments: Record<string, unknown>[];
  fetchedAt: string;
  errors: string[];
}

export interface LedgerEvent {
  id: string;
  market: "spot" | "perps";
  type: "trade" | "closed_position" | "funding" | "open_order";
  timestamp: number;
  asset: string;
  source: string;
}

export interface DataCoverage {
  perpsClosedPositions: number;
  perpsExecutions: number;
  spotExecutions: number;
  matchedSpotLots: number;
  openOrders: number;
  sourceErrors: number;
  completeness: "complete" | "partial" | "unavailable";
  note: string;
}

export interface PerformancePattern {
  label: string;
  trades: number;
  netPnl: number;
  expectancy: number;
  winRate: number;
}

const SODEX_MAINNET_PERPS = "https://mainnet-gw.sodex.dev/api/v1/perps";
const SODEX_MAINNET_SPOT = "https://mainnet-gw.sodex.dev/api/v1/spot";

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return numberValue(record[key]);
  }
  return 0;
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key];
  }
  return "";
}

function recordsFromEnvelope(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (data && typeof data === "object") {
    const nested = (data as { list?: unknown; rows?: unknown; items?: unknown; balances?: unknown; positions?: unknown; orders?: unknown }).list
      ?? (data as { rows?: unknown }).rows
      ?? (data as { items?: unknown }).items
      ?? (data as { balances?: unknown }).balances
      ?? (data as { positions?: unknown }).positions
      ?? (data as { orders?: unknown }).orders;
    if (Array.isArray(nested)) return nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    return [data as Record<string, unknown>];
  }
  return [];
}

function normalizeAsset(value: string): string {
  const raw = value.toUpperCase().replace(/^V/, "").split(/[-_/]/)[0];
  return raw === "WETH" ? "ETH" : raw === "WBTC" || raw === "CBBTC" ? "BTC" : raw;
}

function normalizeTimestamp(value: unknown): number {
  const parsed = numberValue(value);
  if (!parsed) return Date.now();
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function mapClosedPosition(record: Record<string, unknown>, index: number): ClosedPosition {
  const entryPrice = firstNumber(record, ["avgEntryPrice", "entryPrice", "openPrice", "avgOpenPrice"]);
  const exitPrice = firstNumber(record, ["avgClosePrice", "closePrice", "exitPrice", "avgExitPrice"]);
  const pnl = firstNumber(record, ["realizedPnL", "realizedPnl", "pnl", "closedPnl"]);
  const timestamp = normalizeTimestamp(firstNumber(record, ["closedAt", "closeTime", "updatedAt", "createdAt", "time"]));
  const sideText = firstText(record, ["side", "positionSide", "direction"]).toUpperCase();
  const side: "BUY" | "SELL" = sideText === "SHORT" || sideText === "SELL" ? "SELL" : "BUY";
  const move = entryPrice > 0 && exitPrice > 0 ? (exitPrice - entryPrice) / entryPrice : 0;
  const regime: ClosedPosition["regime"] = move > 0.002 ? "bullish" : move < -0.002 ? "bearish" : "chop";

  return {
    id: firstText(record, ["id", "positionID", "positionId", "orderID", "orderId"]) || `${timestamp}-${index}`,
    market: "perps",
    asset: normalizeAsset(firstText(record, ["symbol", "asset", "coin"])),
    side,
    entryPrice,
    exitPrice,
    amount: firstNumber(record, ["size", "quantity", "qty", "closedSize"]),
    pnl,
    fee: record.fee === undefined && record.fees === undefined ? null : firstNumber(record, ["fee", "fees", "tradingFee"]),
    regime,
    hour: new Date(timestamp).getUTCHours(),
    date: new Date(timestamp).toISOString().slice(0, 10),
    closedAt: timestamp,
  };
}

/**
 * Converts spot executions into realized FIFO disposal lots only. An unmatched
 * sale is deliberately omitted: an incomplete history must never become an
 * invented cost basis or PnL figure.
 */
function mapSpotExecutionsToClosedLots(executions: Record<string, unknown>[]): ClosedPosition[] {
  type Lot = { amount: number; price: number; fee: number; timestamp: number };
  const inventories = new Map<string, Lot[]>();
  const result: ClosedPosition[] = [];
  const chronological = executions.map((record, index) => ({ record, index, timestamp: normalizeTimestamp(firstNumber(record, ["executedAt", "tradeTime", "createdAt", "updatedAt", "time", "timestamp"])) }))
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const { record, index, timestamp } of chronological) {
    const asset = normalizeAsset(firstText(record, ["symbol", "market", "pair", "instrument", "baseAsset", "baseCoin"]));
    const sideText = firstText(record, ["side", "direction", "orderSide"]).toUpperCase();
    const side: "BUY" | "SELL" = sideText === "SELL" ? "SELL" : "BUY";
    const amount = Math.abs(firstNumber(record, ["executedQty", "filledQty", "quantity", "qty", "size", "baseQuantity"]));
    const price = firstNumber(record, ["price", "avgPrice", "executionPrice", "fillPrice"]);
    const rawFee = firstNumber(record, ["fee", "fees", "tradingFee", "commission"]);
    const feeCoin = normalizeAsset(firstText(record, ["feeCoin", "feeAsset", "commissionAsset"]));
    // Express reported spot fees in the quote currency only when conversion is
    // unambiguous at the execution price. Unknown fee currencies are not used.
    const fee = feeCoin === asset ? rawFee * price : feeCoin === "USDC" || feeCoin === "USDT" || feeCoin === "USD" ? rawFee : 0;
    if (!asset || amount <= 0 || price <= 0) continue;
    const inventory = inventories.get(asset) || [];
    if (side === "BUY") {
      inventory.push({ amount, price, fee, timestamp });
      inventories.set(asset, inventory);
      continue;
    }
    let remaining = amount;
    while (remaining > 1e-12 && inventory.length > 0) {
      const opening = inventory[0];
      const matched = Math.min(remaining, opening.amount);
      const allocatedOpenFee = opening.fee * (matched / opening.amount);
      const allocatedCloseFee = fee * (matched / amount);
      const pnl = (price - opening.price) * matched - allocatedOpenFee - allocatedCloseFee;
      const move = (price - opening.price) / opening.price;
      result.push({
        id: firstText(record, ["id", "tradeId", "executionId", "orderId"]) + `-lot-${index}-${result.length}`,
        market: "spot", asset, side: "BUY", entryPrice: opening.price, exitPrice: price, amount: matched, pnl,
        fee: allocatedOpenFee + allocatedCloseFee,
        regime: move > 0.002 ? "bullish" : move < -0.002 ? "bearish" : "chop",
        hour: new Date(timestamp).getUTCHours(), date: new Date(timestamp).toISOString().slice(0, 10), closedAt: timestamp,
      });
      opening.amount -= matched;
      remaining -= matched;
      if (opening.amount <= 1e-12) inventory.shift();
    }
  }
  return result;
}

async function fetchMainnet(path: string, market: "perps" | "spot" = "perps"): Promise<unknown> {
  const response = await fetch(`${market === "spot" ? SODEX_MAINNET_SPOT : SODEX_MAINNET_PERPS}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SoDEX mainnet returned ${response.status} for ${path}`);
  const payload = await response.json();
  if (payload?.code !== undefined && payload.code !== 0) throw new Error(payload.error || `SoDEX mainnet rejected ${path}`);
  return payload;
}

/**
 * Reads public, mainnet-only SoDEX account data. No testnet, explorers, hash
 * seeding, or price/PnL estimation is used anywhere in this path.
 */
export async function fetchMainnetWalletSnapshot(address: string): Promise<MainnetWalletSnapshot> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Enter a valid EVM wallet address.");
  const encodedAddress = encodeURIComponent(address.toLowerCase());
  const endpoints = {
    state: `/accounts/${encodedAddress}/state`,
    balances: `/accounts/${encodedAddress}/balances`,
    positions: `/accounts/${encodedAddress}/positions`,
    history: `/accounts/${encodedAddress}/positions/history?limit=500`,
    trades: `/accounts/${encodedAddress}/trades?limit=1000`,
    fundings: `/accounts/${encodedAddress}/fundings?limit=1000`,
    spotState: `/accounts/${encodedAddress}/state`,
    spotBalances: `/accounts/${encodedAddress}/balances`,
    // SoDEX spot account history currently rejects a `limit` parameter.
    spotOrders: `/accounts/${encodedAddress}/orders/history`,
    spotTrades: `/accounts/${encodedAddress}/trades`,
  };
  // The edge gateway avoids browser CORS limits after deployment. Local development
  // retains the exact same public, mainnet-only read if that function is absent.
  const gateway = await supabase.functions.invoke("sodex-mainnet-account", { body: { address } }).catch(() => ({ data: null }));
  const gatewayPayload = gateway.data && typeof gateway.data === "object"
    ? (gateway.data as { data?: Record<string, unknown> }).data
    : undefined;
  const entries = gatewayPayload
    ? Object.entries({
        state: gatewayPayload.state,
        balances: gatewayPayload.balances,
        positions: gatewayPayload.positions,
        history: gatewayPayload.closedPositions,
        trades: gatewayPayload.trades,
        fundings: gatewayPayload.fundingPayments,
        spotState: gatewayPayload.spotState,
        spotBalances: gatewayPayload.spotBalances,
        spotOrders: gatewayPayload.spotOrders,
        spotTrades: gatewayPayload.spotTrades,
      }).map(([name, payload]) => ({ status: "fulfilled" as const, value: [name, payload] as const }))
    : await Promise.allSettled(Object.entries(endpoints).map(async ([name, path]) => [name, await fetchMainnet(path, name.startsWith("spot") ? "spot" : "perps")] as const));
  const payloads: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const entry of entries) {
    if (entry.status === "fulfilled") payloads[entry.value[0]] = entry.value[1];
    else errors.push(entry.reason instanceof Error ? entry.reason.message : "Mainnet request failed");
  }
  if (!payloads.history && !payloads.trades && !payloads.spotTrades && !payloads.state && !payloads.spotState) throw new Error(errors[0] || "Unable to reach the SoDEX mainnet account API.");

  const state = recordsFromEnvelope(payloads.state)[0] ?? {};
  const balances = recordsFromEnvelope(payloads.balances).length > 0
    ? recordsFromEnvelope(payloads.balances)
    : recordsFromEnvelope((state as { balances?: unknown }).balances ? { data: (state as { balances?: unknown }).balances } : null);
  const openPositions = recordsFromEnvelope(payloads.positions).length > 0
    ? recordsFromEnvelope(payloads.positions)
    : recordsFromEnvelope((state as { positions?: unknown }).positions ? { data: (state as { positions?: unknown }).positions } : null);
  const rawHistory = recordsFromEnvelope(payloads.history);
  const spotState = recordsFromEnvelope(payloads.spotState)[0] ?? {};
  const spotBalances = recordsFromEnvelope(payloads.spotBalances).length > 0
    ? recordsFromEnvelope(payloads.spotBalances)
    : recordsFromEnvelope((spotState as { balances?: unknown }).balances ? { data: (spotState as { balances?: unknown }).balances } : null);
  const spotTrades = recordsFromEnvelope(payloads.spotTrades);

  return {
    source: "mainnet",
    address: address.toLowerCase(),
    balances,
    spotBalances,
    openPositions,
    openOrders: [...recordsFromEnvelope(payloads.spotOrders)],
    closedPositions: [...rawHistory.map(mapClosedPosition).filter((position) => position.asset.length > 0), ...mapSpotExecutionsToClosedLots(spotTrades)],
    trades: recordsFromEnvelope(payloads.trades),
    spotTrades,
    fundingPayments: recordsFromEnvelope(payloads.fundings),
    fetchedAt: new Date().toISOString(),
    errors,
  };
}

/** Clearly labelled fixture data for product walkthroughs. Never used by live mode. */
export function createDemoWalletSnapshot(): MainnetWalletSnapshot {
  const now = Date.now();
  const makePosition = (index: number, asset: string, side: "BUY" | "SELL", pnl: number, entryPrice: number, exitPrice: number, amount: number): ClosedPosition => ({
    id: `demo-${index}`,
    market: "perps",
    asset,
    side,
    entryPrice,
    exitPrice,
    amount,
    pnl,
    fee: Math.abs(amount * entryPrice) * 0.0004,
    regime: exitPrice > entryPrice ? "bullish" : "bearish",
    hour: index % 2 === 0 ? 14 : 22,
    date: new Date(now - (6 - index) * 86_400_000).toISOString().slice(0, 10),
    closedAt: now - (6 - index) * 86_400_000,
  });
  return {
    source: "demo",
    address: "demo-profile",
    balances: [
      { asset: "BTC", amount: "0.18", usdValue: 11700 },
      { asset: "ETH", amount: "1.4", usdValue: 4900 },
      { asset: "USDC", amount: "3400", usdValue: 3400 },
    ],
    spotBalances: [],
    openPositions: [],
    openOrders: [],
    closedPositions: [
      makePosition(1, "BTC", "BUY", 180, 63000, 64000, 0.18),
      makePosition(2, "ETH", "BUY", -120, 3500, 3414, 1.4),
      makePosition(3, "BTC", "BUY", 210, 63500, 64667, 0.18),
      makePosition(4, "ETH", "SELL", -145, 3450, 3554, 1.4),
      makePosition(5, "BTC", "BUY", 165, 64000, 64917, 0.18),
      makePosition(6, "ETH", "SELL", 105, 3520, 3445, 1.4),
    ],
    trades: [],
    spotTrades: [],
    fundingPayments: [],
    fetchedAt: new Date().toISOString(),
    errors: [],
  };
}

/** A source-traceable, normalized account event view for UI and AI explanations. */
export function buildAccountLedger(snapshot: MainnetWalletSnapshot): LedgerEvent[] {
  const events: LedgerEvent[] = [
    ...snapshot.closedPositions.map((position) => ({ id: position.id, market: position.market, type: position.market === "spot" ? "trade" as const : "closed_position" as const, timestamp: position.closedAt, asset: position.asset, source: position.market === "spot" ? "spot/accounts/{address}/trades (FIFO matched)" : "perps/accounts/{address}/positions/history" })),
    ...snapshot.trades.map((trade, index) => ({ id: firstText(trade, ["tradeID", "tradeId", "id"]) || `perps-trade-${index}`, market: "perps" as const, type: "trade" as const, timestamp: normalizeTimestamp(firstNumber(trade, ["time", "createdAt", "updatedAt"])), asset: normalizeAsset(firstText(trade, ["symbol", "asset", "coin"])), source: "perps/accounts/{address}/trades" })),
    ...snapshot.spotTrades.map((trade, index) => ({ id: firstText(trade, ["tradeID", "tradeId", "id"]) || `spot-trade-${index}`, market: "spot" as const, type: "trade" as const, timestamp: normalizeTimestamp(firstNumber(trade, ["time", "createdAt", "updatedAt"])), asset: normalizeAsset(firstText(trade, ["symbol", "asset", "coin"])), source: "spot/accounts/{address}/trades" })),
    ...snapshot.openOrders.map((order, index) => ({ id: firstText(order, ["orderID", "orderId", "id"]) || `order-${index}`, market: "spot" as const, type: "open_order" as const, timestamp: normalizeTimestamp(firstNumber(order, ["createdAt", "time", "updatedAt"])), asset: normalizeAsset(firstText(order, ["symbol", "asset", "coin"])), source: "spot/accounts/{address}/orders/history" })),
  ];
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function getDataCoverage(snapshot: MainnetWalletSnapshot): DataCoverage {
  const matchedSpotLots = snapshot.closedPositions.filter((position) => position.market === "spot").length;
  const unavailable = snapshot.errors.length >= 3;
  const partial = snapshot.errors.length > 0 || snapshot.spotTrades.length >= 50;
  return {
    perpsClosedPositions: snapshot.closedPositions.filter((position) => position.market === "perps").length,
    perpsExecutions: snapshot.trades.length,
    spotExecutions: snapshot.spotTrades.length,
    matchedSpotLots,
    openOrders: snapshot.openOrders.length,
    sourceErrors: snapshot.errors.length,
    completeness: unavailable ? "unavailable" : partial ? "partial" : "complete",
    note: snapshot.spotTrades.length >= 50 ? "SoDEX returned 50 spot executions; additional historical pages may exist and lifetime results are not assumed." : partial ? "One or more account sources were unavailable; affected metrics are withheld where required." : "All configured mainnet account sources returned successfully for this refresh.",
  };
}

/** Converts only reported mainnet balances and positions into percentage weights. */
export function buildMainnetAllocation(snapshot: MainnetWalletSnapshot, prices: Record<string, number>): Record<string, number> {
  const values: Record<string, number> = {};
  const addValue = (asset: string, amount: number, reportedValue: number) => {
    const symbol = normalizeAsset(asset);
    const value = reportedValue > 0 ? reportedValue : amount * (prices[symbol] || (symbol === "USDC" || symbol === "USDT" ? 1 : 0));
    if (value > 0 && Number.isFinite(value)) values[symbol] = (values[symbol] || 0) + value;
  };
  for (const balance of [...snapshot.balances, ...snapshot.spotBalances]) {
    addValue(firstText(balance, ["coin", "asset", "symbol", "coinName"]), firstNumber(balance, ["available", "balance", "total", "amount", "equity"]), firstNumber(balance, ["usdValue", "valueUsd", "notionalUsd", "value"]));
  }
  for (const position of snapshot.openPositions) {
    const asset = firstText(position, ["symbol", "asset", "coin"]);
    const amount = Math.abs(firstNumber(position, ["size", "quantity", "positionSize"]));
    const mark = firstNumber(position, ["markPrice", "price", "entryPrice", "avgEntryPrice"]);
    addValue(asset, amount, firstNumber(position, ["notional", "positionValue", "notionalUsd"]) || amount * mark);
  }
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return {};
  return Object.fromEntries(Object.entries(values).map(([asset, value]) => [asset, (value / total) * 100]));
}

/** Uses SoDEX mainnet perpetual daily candles, never simulated or exchange-scanner data. */
export async function fetchMainnetDailyReturns(assets: string[], days = 90): Promise<DailyReturn[]> {
  const supported = [...new Set(assets.map(normalizeAsset).filter((asset) => asset && asset !== "USDC" && asset !== "USDT"))];
  const candleSets = await Promise.all(supported.map(async (asset) => {
    const payload = await fetchMainnet(`/markets/${encodeURIComponent(`${asset}-USD`)}/klines?interval=1d&limit=${Math.min(days, 1000)}`);
    const rawData = payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null;
    const rows = Array.isArray(rawData) ? rawData : [];
    const candles = rows.map((row) => {
      const record = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
      const time = Array.isArray(row) ? row[0] : firstNumber(record, ["openTime", "time", "timestamp", "t"]);
      const close = Array.isArray(row) ? numberValue(row[4]) : firstNumber(record, ["close", "closePrice", "c"]);
      return { time: normalizeTimestamp(time), close };
    }).filter((candle) => candle.close > 0).sort((a, b) => a.time - b.time);
    return { asset, candles };
  }));
  const byDate = new Map<string, Record<string, number>>();
  for (const { asset, candles } of candleSets) {
    for (let index = 1; index < candles.length; index += 1) {
      const date = new Date(candles[index].time).toISOString().slice(0, 10);
      const row = byDate.get(date) || {};
      row[asset] = Math.log(candles[index].close / candles[index - 1].close);
      byDate.set(date, row);
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, returns]) => ({ date, returns }));
}

export function findPerformancePatterns(trades: ClosedPosition[]): PerformancePattern[] {
  const groups = new Map<string, ClosedPosition[]>();
  for (const trade of trades) {
    const bucket = trade.hour >= 20 || trade.hour < 5 ? "UTC night" : "UTC day";
    const key = `${trade.asset} ${trade.side} · ${bucket}`;
    groups.set(key, [...(groups.get(key) || []), trade]);
  }
  return [...groups.entries()].map(([label, group]) => {
    const netPnl = group.reduce((sum, trade) => sum + trade.pnl, 0);
    return {
      label,
      trades: group.length,
      netPnl,
      expectancy: netPnl / group.length,
      winRate: (group.filter((trade) => trade.pnl > 0).length / group.length) * 100,
    };
  }).filter((pattern) => pattern.trades >= 2).sort((a, b) => a.expectancy - b.expectancy);
}
