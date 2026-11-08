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

// ── Risk grid: Current (Regime) × Future (Forward) ───────────────────────────
// Replaces the old REGIME_MULTIPLIERS mechanism (1.0×/1.3×/1.6×), removed
// 2026-08-18 after real user feedback: an opaque multiplier doesn't map to
// any real-world intuition, and worse, it's symmetric — it couldn't tell
// "stressed now, easing ahead" apart from "calm now, building ahead," even
// though those are genuinely different situations calling for different
// responses (the second one is the actual early-warning case this whole
// platform exists to catch). This grid is authored, not computed — every
// cell is a plain number someone chose, nothing hidden, same principle as
// a standard Likelihood x Consequence risk matrix. Asymmetric by design:
// a given move toward higher Future adds more than the same move toward
// higher Current, confirmed against real test cases (40 current / 90
// future scores meaningfully higher than 90 current / 40 future, even
// though both are the same distance from the calm corner).
export const RISK_BANDS_5 = [
  { label: "Low",       min: 0,  max: 20  },
  { label: "Moderate",  min: 20, max: 40  },
  { label: "Elevated",  min: 40, max: 60  },
  { label: "High",      min: 60, max: 80  },
  { label: "Critical",  min: 80, max: 100 },
];

// Rows = Current band index (0-4), columns = Future band index (0-4).
export const RISK_GRID = [
  [5,  15, 35, 55, 75],   // Current: Low
  [10, 20, 40, 60, 80],   // Current: Moderate
  [25, 35, 50, 70, 88],   // Current: Elevated
  [45, 55, 68, 85, 95],   // Current: High
  [60, 70, 80, 92, 100],  // Current: Critical
];

// score is 0-100
export function getBandIndex5(score) {
  const pct = Math.max(0, Math.min(100, score));
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  if (pct >= 20) return 1;
  return 0;
}

// Cell centers on the 0-100 axis: band i is centered at 10 + 20*i.
const GRID_CENTERS = [10, 30, 50, 70, 90];

// Position of a 0-100 score between two neighboring cell centers:
// returns [lowerIndex, t] where t in [0,1] is the fraction toward the next
// center. Scores below 10 or above 90 clamp to the outer cells.
function gridPosition(score100) {
  const x = Math.max(GRID_CENTERS[0], Math.min(GRID_CENTERS[4], score100));
  const i = Math.min(3, Math.floor((x - GRID_CENTERS[0]) / 20));
  return [i, (x - GRID_CENTERS[i]) / 20];
}

// Bilinear interpolation across RISK_GRID. Every authored cell value is
// still exact at its cell center, and the asymmetry is preserved; scores
// between centers blend the four surrounding cells instead of snapping.
// Changed 2026-10-19: snapping to cells hid real movement (a composite
// could move 61 -> 79 with no score change, then jump 7-17 points across
// a band edge on a 1-point move). Four commodities produced a single
// value for six straight weeks as a result.
export function interpolateGridScore(currentScore100, futureScore100) {
  const [ci, ct] = gridPosition(currentScore100);
  const [fi, ft] = gridPosition(futureScore100);
  const g = RISK_GRID;
  const top    = g[ci][fi]     * (1 - ft) + g[ci][fi + 1]     * ft;
  const bottom = g[ci + 1][fi] * (1 - ft) + g[ci + 1][fi + 1] * ft;
  return top * (1 - ct) + bottom * ct;
}

// currentScore100 and futureScore100 are both 0-100. Returns the
// interpolated risk score plus the two real inputs and their bands, so the
// UI can always show its work rather than presenting one opaque number.
// `gridCell` is the authored value of the cell the inputs fall in (the old
// snapped score), kept for reference and comparison.
export function computeGridRiskScore(currentScore100, futureScore100) {
  const currentBandIdx = getBandIndex5(currentScore100);
  const futureBandIdx  = getBandIndex5(futureScore100);
  const score = Math.round(interpolateGridScore(currentScore100, futureScore100));

  return {
    score,
    gridCell: RISK_GRID[currentBandIdx][futureBandIdx],
    band: getRiskBand(score / 100),
    current: { score: currentScore100, band: RISK_BANDS_5[currentBandIdx] },
    future:  { score: futureScore100,  band: RISK_BANDS_5[futureBandIdx] },
  };
}

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

// ── Signal stress threshold ──────────────────────────────────────────────────
// Single source of truth for "is this signal stressed" across evaluateTriggers()
// and computeFullRiskProfile()'s signal coverage count. Also displayed directly
// in the Signal Coverage KPI card so the threshold is never a hidden number.
export const SIGNAL_STRESS_THRESHOLD = 0.60;

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
  const stressedCount = Object.values(allSignals).filter((v) => v >= SIGNAL_STRESS_THRESHOLD).length;
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
      // Total tracked signals network-wide, so the UI can make clear that
      // convergenceCount is a network-wide corroboration count, not a count
      // of signals specific to this scenario.
      totalSignalCount: Object.keys(allSignals).length,
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

  // Current (Regime) x Future (Forward) risk grid — replaces the old
  // 1.0x/1.3x/1.6x multiplier mechanism. See computeGridRiskScore's own
  // comment block for why: the multiplier was opaque and, worse,
  // symmetric — it couldn't distinguish "stressed now, easing ahead"
  // from "calm now, building ahead," even though those call for
  // genuinely different responses.
  const gridResult = computeGridRiskScore(regime.composite * 100, forward.composite * 100);
  const riskScoreFraction = gridResult.score / 100;

  const forwardBand = getRiskBand(forward.composite);
  const regimeBand  = getRiskBand(regime.composite);

  const triggers = evaluateTriggers(forwardSignals, regimeSignals, riskScoreFraction, triggerConfig);

  const triggeredCount = triggers.filter((t) => t.status === "triggered").length;
  // "building" here is the display term for scenarios where a signal has
  // breached its own threshold but convergence hasn't been met yet. Internally
  // the trigger's `status` field still uses "watch" as its enum value (see
  // evaluateTriggers) — only the human-facing label changed originally to
  // avoid colliding with the old "Watch" regime state; kept as-is since the
  // enum value itself isn't user-facing.
  const buildingCount = triggers.filter((t) => t.status === "watch").length;

  return {
    forward: {
      raw: forward.composite,
      band: forwardBand,
      breakdown: forward.breakdown,
    },
    regime: {
      raw: regime.composite,
      band: regimeBand,
      breakdown: regime.breakdown,
    },
    riskScore: gridResult,
    triggers,
    summary: {
      triggeredCount,
      buildingCount,
      stressedSignalCount: Object.values({ ...forwardSignals, ...regimeSignals })
        .filter((v) => v >= SIGNAL_STRESS_THRESHOLD).length,
      totalSignalCount:
        Object.keys(forwardSignals).length + Object.keys(regimeSignals).length,
      stressThreshold: Math.round(SIGNAL_STRESS_THRESHOLD * 100),
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

// ── Rare Earth Metals signal weights ─────────────────────────────────────────
// Built 2026-08-16 — only non_china_ree_capacity is genuinely live so far
// (MP Materials capex via SEC XBRL, real and verified). The other five
// forward signals and three of four regime signals are reasoned
// placeholders, not yet researched — see MOCK_RARE_EARTH_SIGNAL_DETAIL
// for the explicit "not yet reviewed" labeling on each. freight_rates is
// REUSED directly from the semiconductor regime signal, not duplicated.

export const RARE_EARTH_FORWARD_WEIGHTS = {
  non_china_ree_capacity:        0.22, // LIVE — MP Materials capex, SEC XBRL, inverted scoring (growth = de-risking)
  china_ree_export_policy:       0.20, // Not yet built — same Federal Register technique as raw_material_supply_risk
  defense_demand_signal:         0.15, // Not yet built — anchored on MP Materials' real, disclosed DoD relationship
  magnet_capacity_allocation:    0.15, // Not yet built — mirrors capacity_allocation_mix_shift's structure
  china_refining_concentration:  0.15, // Not yet built — mirrors china_refinery_concentration's structure
  ev_wind_demand_divergence:     0.13, // Not yet built — mirrors ev_production_forecast_delta's structure
};

export const RARE_EARTH_REGIME_WEIGHTS = {
  freight_rates:          0.20, // REUSED directly from semiconductor regime signal — same key, same live data, not duplicated
  ndpr_oxide_spot_price:  0.30, // Not yet built — likely same paid-data wall as lithium spot pricing (LME/Fastmarkets/Argus)
  heavy_ree_spot_price:   0.25, // Not yet built — Dy/Tb, the most China-concentrated of all REEs
  magnet_lead_times:      0.25, // Not yet built — likely no SEC-filer source, same pattern as automotive cell_lead_times
};

export const RARE_EARTH_TRIGGER_CONFIG = {
  non_china_capacity_stall: {
    threshold: 0.70,
    signal: "non_china_ree_capacity",
    minConvergence: 2,
  },
  china_export_restriction: {
    threshold: 0.75,
    signal: "china_ree_export_policy",
    minConvergence: 2,
  },
  china_refining_dominance_shock: {
    threshold: 0.85,
    signal: "china_refining_concentration",
    minConvergence: 3,
  },
};

// ── Steel & Aluminum signal weights ──────────────────────────────────────────
// Built 2026-08-17. Two confirmed strong anchor companies — Nucor Corp
// (CIK 0000073309, Delaware, decades of filing history, "the nation's
// largest recycler," EAF-focused) and Cleveland-Cliffs Inc (CIK
// 0000764065, Ohio, vertically integrated from iron ore through finished
// steel) — a stronger starting position than rare earth had (GE Vernova
// only had 2 years of filing history). freight_rates is REUSED directly,
// not duplicated.

export const STEEL_ALUMINUM_FORWARD_WEIGHTS = {
  section_232_tariff_pipeline:     0.20, // Not yet built — planned: Federal Register, same technique as raw_material_supply_risk
  domestic_capacity_expansion:     0.20, // Not yet built — planned: Nucor + Cleveland-Cliffs capex, SEC XBRL, likely inverted (growth = de-risking, same convention as non_china_ree_capacity)
  china_steel_overcapacity_dumping: 0.18, // Not yet built — planned: Federal Register, AD/CVD determinations
  automotive_sheet_demand:         0.15, // Not yet built
  scrap_eaf_dynamics:              0.14, // Not yet built
  aluminum_capacity_signal:        0.13, // Not yet built — Alcoa/Century Aluminum
};

export const STEEL_ALUMINUM_REGIME_WEIGHTS = {
  freight_rates:       0.20, // REUSED directly from semiconductor regime signal — same key, same live data, not duplicated
  hrc_spot_price:      0.30, // Not yet built — worth checking CME's real HRC futures data, a genuine exchange-traded contract unlike lithium/rare earth
  aluminum_spot_price: 0.25, // Not yet built — LME aluminum, likely the same paid-data wall as everything else
  import_penetration:  0.25, // Not yet built — US Census Bureau foreign trade data, genuinely new territory, likely free
};

export const STEEL_ALUMINUM_TRIGGER_CONFIG = {
  tariff_escalation: {
    threshold: 0.75,
    signal: "section_232_tariff_pipeline",
    minConvergence: 2,
  },
  domestic_capacity_stall: {
    threshold: 0.70,
    signal: "domestic_capacity_expansion",
    minConvergence: 2,
  },
  china_dumping_surge: {
    threshold: 0.80,
    signal: "china_steel_overcapacity_dumping",
    minConvergence: 2,
  },
};

// ── Automotive Resins & Plastics signal weights ──────────────────────────────
// Built 2026-08-18. Three confirmed real anchor companies — Celanese Corp
// (CIK 0001306830, NYSE: CE, acquired most of DuPont's automotive nylon
// business — Zytel — in a real 2022 $11B deal), Eastman Chemical (CIK
// 0000915389, NYSE: EMN, confirmed decades of filing history), and
// Trinseo (CIK 0001519061, NYSE: TSE, real ABS/PC-ABS producer) — though
// Trinseo's real XBRL data confirmed NOT to use the standard capex tag
// (only balance-sheet PP&E figures, no PaymentsToAcquirePropertyPlantAndEquipment),
// so domestic_polymer_capacity uses Celanese + Eastman only, same honest
// scoping pattern as equipment_order_book (Lam Research only) earlier.
// freight_rates is REUSED directly, not duplicated.

export const RESINS_FORWARD_WEIGHTS = {
  domestic_polymer_capacity:    0.20, // LIVE — Celanese + Eastman capex, SEC XBRL, inverted scoring (growth = de-risking)
  petrochemical_feedstock_risk: 0.18, // Not yet built
  automotive_resin_demand:      0.16, // Not yet built
  china_polymer_capacity:       0.16, // Not yet built
  resin_allocation_squeeze:     0.15, // Not yet built
  trade_policy_pipeline:        0.15, // Not yet built
};

export const RESINS_REGIME_WEIGHTS = {
  freight_rates:        0.20, // REUSED directly from semiconductor regime signal
  pp_resin_spot_price:  0.28, // Not yet built
  abs_resin_spot_price: 0.26, // Not yet built
  nylon_resin_spot_price: 0.26, // Not yet built
};

export const RESINS_TRIGGER_CONFIG = {
  domestic_polymer_capacity_stall: {
    threshold: 0.70,
    signal: "domestic_polymer_capacity",
    minConvergence: 2,
  },
  feedstock_shock: {
    threshold: 0.75,
    signal: "petrochemical_feedstock_risk",
    minConvergence: 2,
  },
};

// ── Natural Rubber signal weights ────────────────────────────────────────────
// Built 2026-08-18. Structurally different from every other commodity in
// this project: an agricultural product, produced primarily by
// smallholder farmers across Thailand, Indonesia, Vietnam, and Malaysia
// — no large, US-listed producer exists to anchor a capex signal the way
// MP Materials, Celanese, or Nucor did. Goodyear Tire & Rubber Co (CIK
// 0000042582, NYSE, decades of filing history, confirmed real us-gaap
// PaymentsToAcquirePropertyPlantAndEquipment tag — the 12th company this
// project to use it) anchors tire_manufacturer_demand instead, a
// demand-side proxy rather than a supply-side one. freight_rates is
// REUSED directly, not duplicated.

export const RUBBER_FORWARD_WEIGHTS = {
  tire_manufacturer_demand:      0.20, // LIVE — Goodyear capex, SEC XBRL
  thai_indonesian_output:        0.18, // Not yet built — no corporate anchor exists, likely analyst-estimate
  leaf_disease_risk:             0.17, // Not yet built
  synthetic_rubber_substitution: 0.15, // Not yet built
  china_rubber_stockpiling:      0.15, // Not yet built
  weather_disruption_risk:       0.15, // Not yet built — worth checking NOAA (real, free US government weather data) before assuming analyst-estimate
};

export const RUBBER_REGIME_WEIGHTS = {
  freight_rates:       0.20, // REUSED directly from semiconductor regime signal
  rss3_spot_price:     0.30, // Not yet built — Ribbed Smoked Sheet, the standard natural rubber benchmark
  tsr20_spot_price:    0.28, // Not yet built — Technically Specified Rubber, the other major grade
  tire_grade_premium:  0.22, // Not yet built
};

export const RUBBER_TRIGGER_CONFIG = {
  tire_demand_stall: {
    threshold: 0.70,
    signal: "tire_manufacturer_demand",
    minConvergence: 2,
  },
  disease_outbreak: {
    threshold: 0.75,
    signal: "leaf_disease_risk",
    minConvergence: 2,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// launchScenarioToSimulation
// Routes a triggered scenario to the simulation engine via localStorage —
// SimulationDashboard reads "currentScenarioJSON" on mount. Shared so every
// surface that can launch a scenario (Risk Intelligence's TriggerQueue, the
// Control Tower trigger banner) uses one code path instead of each keeping
// its own copy of these localStorage key names.
// ─────────────────────────────────────────────────────────────────────────────
export function launchScenarioToSimulation({ scenario, params, source = "risk_intelligence_trigger" }, switchView) {
  try {
    const scenarioPayload = { name: scenario, ...params, source };
    localStorage.setItem("currentScenario", JSON.stringify(scenarioPayload));
    localStorage.setItem("currentScenarioName", scenario);
    // Also set the format that SimulationDashboard reads
    localStorage.setItem("currentScenarioJSON", JSON.stringify(scenarioPayload));
  } catch {}
  if (switchView) switchView("simulation");
}
