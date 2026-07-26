// ─────────────────────────────────────────────────────────────────────────────
// riskScoreEngine.js
// FOR-C v3 · Predictive Risk Analytics Engine
//
// Two distinct scoring layers:
//   FORWARD  — leading indicators 3–18 months ahead of impact
//   REGIME   — current market conditions (initialises simulation baseline)
//
// Never mix these into a single composite without explicit labelling.
// ─────────────────────────────────────────────────────────────────────────────

// ── Forward pressure signal weights (must sum to 1.0) ────────────────────────
export const FORWARD_WEIGHTS = {
  fab_capex_trajectory:          0.22, // ASML orders, TSMC/Samsung capex guidance
  capacity_allocation_mix_shift: 0.20, // Earnings NLP: AI vs auto allocation
  raw_material_supply_risk:      0.18, // Export controls on inputs (gallium, neon, BaTiO3)
  end_market_demand_divergence:  0.15, // Hyperscaler capex vs auto production delta
  geopolitical_policy_pipeline:  0.15, // Known expiry dates, legislative pipeline
  equipment_order_book:          0.10, // ASML quarterly order data
};

// ── Regime signal weights (must sum to 1.0) ──────────────────────────────────
export const REGIME_WEIGHTS = {
  spot_lead_times:        0.30, // MLCC / MCU current lead time index
  spot_prices:            0.25, // MLCC / discrete semi spot price movement
  distributor_inventory:  0.25, // Distributor stock drawdown rate
  freight_rates:          0.20, // FBX01 transpacific rate vs 24mo baseline
};

// ── Regime multiplier thresholds ─────────────────────────────────────────────
// Applied to the forward score to amplify during confirmed stress periods.
export const REGIME_MULTIPLIERS = {
  NORMAL: { label: "Normal",       multiplier: 1.0,  color: "#3B6D11", bg: "#EAF3DE" },
  WATCH:  { label: "Watch",        multiplier: 1.3,  color: "#854F0B", bg: "#FAEEDA" },
  CRISIS: { label: "Crisis",       multiplier: 1.6,  color: "#A32D2D", bg: "#FCEBEB" },
};

// ── Risk score bands ──────────────────────────────────────────────────────────
// Thresholds stay expressed as 0-1 fractions internally (0.35/0.60/0.80),
// matching every existing caller of getRiskBand() -- including SignalCard.jsx
// and TriggerQueue.jsx, which pass raw individual signal values, not the
// display-scaled composite score. Only the label text and colors change here,
// standardizing on the same LOW/MODERATE/HIGH/CRITICAL vocabulary and color
// palette already used by CorridorRiskPanel/BestPlaceToBuyPanel/
// CountryWatchListPanel/SupplierScreeningPanel, so the same severity reads
// the same way everywhere on the platform. Displaying the underlying score
// as 0-100 instead of 0-1 is a separate, purely cosmetic change made at each
// display call site via formatScorePercent() below -- the band classification
// itself is unaffected by that formatting choice.
export const RISK_BANDS = [
  { max: 0.35, label: "LOW",      color: "#22c55e", bg: "#EAF3DE", border: "#22c55e" },
  { max: 0.60, label: "MODERATE", color: "#eab308", bg: "#FAEEDA", border: "#eab308" },
  { max: 0.80, label: "HIGH",     color: "#f97316", bg: "#FCEBEB", border: "#f97316" },
  { max: 1.00, label: "CRITICAL", color: "#ef4444", bg: "#F7C1C1", border: "#ef4444" },
];

// ── Score display formatting ─────────────────────────────────────────────────
// All internal scoring stays 0-1; this is the single, shared conversion used
// at every UI call site that shows a score to a person, so "0.72" never
// appears anywhere on the platform -- only "72", consistently.
export function formatScorePercent(score0to1) {
  return Math.round(Math.min(1, Math.max(0, score0to1)) * 100);
}

// ── Shared 0-100-scale band lookup ───────────────────────────────────────────
// For panels that work natively in 0-100 (AI-scored corridor/country/supplier
// risk, not the 0-1 signal-composite math above). Same canonical thresholds
// as RISK_BANDS (35/60/80), same color palette -- single source of truth for
// CorridorRiskPanel, BestPlaceToBuyPanel, CountryWatchListPanel, and
// SupplierScreeningPanel, which previously each maintained an identical,
// independently-editable local copy of this exact logic.
export function riskColor100(score) {
  if (score === null || score === undefined) return "#B4B2A9";
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 35) return "#eab308";
  return "#22c55e";
}

export function riskLabel100(score) {
  if (score === null || score === undefined) return "N/A";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
}

// ── Trigger thresholds ────────────────────────────────────────────────────────
// Scenarios enter the TriggerQueue when these are breached.
// Requires signal CONVERGENCE — minimum signals above threshold before firing.
export const TRIGGER_CONFIG = {
  MLCC_lead_time_extension:          { threshold: 0.60, signal: "spot_lead_times",              minConvergence: 2 },
  automotive_MCU_allocation:         { threshold: 0.60, signal: "capacity_allocation_mix_shift", minConvergence: 2 },
  export_control_discrete_semis:     { threshold: 0.60, signal: "raw_material_supply_risk",      minConvergence: 2 },
  taiwan_strait_crisis:              { threshold: 0.85, signal: "geopolitical_policy_pipeline",  minConvergence: 3 },
  freight_rate_shock:                { threshold: 0.75, signal: "freight_rates",                 minConvergence: 2 },
  AI_capacity_allocation_squeeze:    { threshold: 0.65, signal: "capacity_allocation_mix_shift", minConvergence: 2 },
};

// ─────────────────────────────────────────────────────────────────────────────
// normalizeSignal
// Converts a raw signal value to 0–1 using min/max bounds defined per signal.
// Falls back to direct value if already normalised.
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeSignal(signalKey, rawValue, bounds) {
  if (!bounds || bounds.min === undefined || bounds.max === undefined) {
    // Assume already normalized 0–1
    return Math.min(1, Math.max(0, rawValue));
  }
  const { min, max } = bounds;
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (rawValue - min) / (max - min)));
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreLayer
// Computes a weighted composite score for a given set of signals + weights.
// signals: { signalKey: normalizedValue (0–1) }
// weights: { signalKey: weight }
// Returns: { composite: float, breakdown: { signalKey: contribution } }
// ─────────────────────────────────────────────────────────────────────────────
export function scoreLayer(signals, weights) {
  let composite = 0;
  const breakdown = {};

  for (const [key, weight] of Object.entries(weights)) {
    const value = signals[key] ?? 0;
    const contribution = value * weight;
    breakdown[key] = {
      raw: value,
      weight,
      contribution,
    };
    composite += contribution;
  }

  return {
    composite: Math.min(1, Math.max(0, composite)),
    breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// deriveRegimeMultiplier
// Classifies the current market regime based on how many regime signals
// exceed the stress threshold.
// ─────────────────────────────────────────────────────────────────────────────
export function deriveRegimeMultiplier(regimeSignals) {
  const values = Object.values(regimeSignals);
  const above90 = values.filter((v) => v >= 0.90).length;
  const above70 = values.filter((v) => v >= 0.70).length;
  const above60 = values.filter((v) => v >= 0.60).length;

  if (above90 >= 1 || above70 >= 3) return REGIME_MULTIPLIERS.CRISIS;
  if (above60 >= 2)                  return REGIME_MULTIPLIERS.WATCH;
  return REGIME_MULTIPLIERS.NORMAL;
}

// ─────────────────────────────────────────────────────────────────────────────
// getRiskBand
// Maps a composite score to its display band.
// ─────────────────────────────────────────────────────────────────────────────
export function getRiskBand(score) {
  return RISK_BANDS.find((b) => score <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateTriggers
// Checks all trigger rules against current forward + regime signals.
// Returns triggered scenarios for the TriggerQueue.
// Enforces convergence — a single signal above threshold is a hypothesis,
// multiple independent signals converging is a prediction.
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateTriggers(forwardSignals, regimeSignals, forwardScore, triggerConfig = TRIGGER_CONFIG) {
  const allSignals = { ...forwardSignals, ...regimeSignals };
  const stressedCount = Object.values(allSignals).filter((v) => v >= 0.60).length;
  const results = [];

  for (const [scenarioKey, config] of Object.entries(triggerConfig)) {
    const signalValue = allSignals[config.signal] ?? 0;
    const breached = signalValue >= config.threshold;
    const converged = stressedCount >= config.minConvergence;

    results.push({
      scenario: scenarioKey,
      status: breached && converged ? "triggered" : breached ? "watch" : "nominal",
      signalValue,
      threshold: config.threshold,
      signal: config.signal,
      convergenceCount: stressedCount,
      minConvergence: config.minConvergence,
      forwardScore,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFullRiskProfile
// Main entry point. Takes raw signal objects and returns a complete
// risk profile for rendering in RiskIntelligenceView.
// ─────────────────────────────────────────────────────────────────────────────
export function computeFullRiskProfile(forwardSignals, regimeSignals, forwardWeights = FORWARD_WEIGHTS, regimeWeights = REGIME_WEIGHTS, triggerConfig = TRIGGER_CONFIG) {
  const forward = scoreLayer(forwardSignals, forwardWeights);
  const regime  = scoreLayer(regimeSignals,  regimeWeights);

  const regimeMultiplier = deriveRegimeMultiplier(regimeSignals);

  // Forward score is amplified by regime multiplier, capped at 1.0
  const amplifiedForward = Math.min(
    1,
    forward.composite * regimeMultiplier.multiplier
  );

  const forwardBand = getRiskBand(amplifiedForward);
  const regimeBand  = getRiskBand(regime.composite);

  const triggers = evaluateTriggers(forwardSignals, regimeSignals, amplifiedForward, triggerConfig);

  const triggeredCount = triggers.filter((t) => t.status === "triggered").length;
  const watchCount     = triggers.filter((t) => t.status === "watch").length;

  return {
    forward: {
      raw: forward.composite,
      amplified: amplifiedForward,
      band: forwardBand,
      breakdown: forward.breakdown,
    },
    regime: {
      raw: regime.composite,
      band: regimeBand,
      breakdown: regime.breakdown,
      multiplier: regimeMultiplier,
    },
    triggers,
    summary: {
      triggeredCount,
      watchCount,
      stressedSignalCount: Object.values({ ...forwardSignals, ...regimeSignals })
        .filter((v) => v >= 0.60).length,
      totalSignalCount:
        Object.keys(forwardSignals).length + Object.keys(regimeSignals).length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ── Lithium & Battery signal weights ─────────────────────────────────────────

export const LITHIUM_FORWARD_WEIGHTS = {
  cell_capacity_allocation_nlp:  0.22,
  lithium_futures_curve:         0.20,
  china_refinery_concentration:  0.18,
  mining_production_guidance:    0.15,
  ev_production_forecast_delta:  0.13,
  battery_policy_pipeline:       0.12,
};

export const LITHIUM_REGIME_WEIGHTS = {
  lithium_carbonate_spot: 0.35,
  lithium_hydroxide_spot: 0.25,
  cobalt_spot_price:      0.20,
  cell_lead_times:        0.20,
};

export const LITHIUM_TRIGGER_CONFIG = {
  cell_allocation_squeeze: {
    threshold: 0.65,
    signal: "cell_capacity_allocation_nlp",
    minConvergence: 2,
  },
  lithium_price_spike: {
    threshold: 0.70,
    signal: "lithium_carbonate_spot",
    minConvergence: 2,
  },
  china_refinery_restriction: {
    threshold: 0.85,
    signal: "china_refinery_concentration",
    minConvergence: 3,
  },
  ev_demand_cell_gap: {
    threshold: 0.65,
    signal: "ev_production_forecast_delta",
    minConvergence: 2,
  },
};
