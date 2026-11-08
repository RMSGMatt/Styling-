// Loads the Risk Intelligence score for any commodity tracker, so other views (Control Tower) can show it next to parts.
import { fetchForwardSignals, fetchRegimeSignals } from "./signalSources";
import {
  computeFullRiskProfile, riskColor100, riskLabel100,
  FORWARD_WEIGHTS, REGIME_WEIGHTS, TRIGGER_CONFIG,
  LITHIUM_FORWARD_WEIGHTS, LITHIUM_REGIME_WEIGHTS, LITHIUM_TRIGGER_CONFIG,
  RARE_EARTH_FORWARD_WEIGHTS, RARE_EARTH_REGIME_WEIGHTS, RARE_EARTH_TRIGGER_CONFIG,
  STEEL_ALUMINUM_FORWARD_WEIGHTS, STEEL_ALUMINUM_REGIME_WEIGHTS, STEEL_ALUMINUM_TRIGGER_CONFIG,
  RESINS_FORWARD_WEIGHTS, RESINS_REGIME_WEIGHTS, RESINS_TRIGGER_CONFIG,
  RUBBER_FORWARD_WEIGHTS, RUBBER_REGIME_WEIGHTS, RUBBER_TRIGGER_CONFIG,
} from "./riskScoreEngine";

const CONFIG = {
  semiconductors_mlcc: [FORWARD_WEIGHTS, REGIME_WEIGHTS, TRIGGER_CONFIG],
  lithium_battery: [LITHIUM_FORWARD_WEIGHTS, LITHIUM_REGIME_WEIGHTS, LITHIUM_TRIGGER_CONFIG],
  rare_earth_metals: [RARE_EARTH_FORWARD_WEIGHTS, RARE_EARTH_REGIME_WEIGHTS, RARE_EARTH_TRIGGER_CONFIG],
  steel_aluminum: [STEEL_ALUMINUM_FORWARD_WEIGHTS, STEEL_ALUMINUM_REGIME_WEIGHTS, STEEL_ALUMINUM_TRIGGER_CONFIG],
  automotive_resins: [RESINS_FORWARD_WEIGHTS, RESINS_REGIME_WEIGHTS, RESINS_TRIGGER_CONFIG],
  natural_rubber: [RUBBER_FORWARD_WEIGHTS, RUBBER_REGIME_WEIGHTS, RUBBER_TRIGGER_CONFIG],
};

// -> { score, label, color, source: "mock" | other, triggers: [non-nominal] } or null if the commodity can't be scored
export async function loadCommodityProfile(key) {
  const cfg = CONFIG[key];
  if (!cfg) return null;
  const [fwd, reg] = await Promise.all([fetchForwardSignals(key), fetchRegimeSignals(key)]);
  const p = computeFullRiskProfile(fwd.signals, reg.signals, cfg[0], cfg[1], cfg[2]);
  const score = Math.round(p.riskScore.score);
  return {
    key, score, label: riskLabel100(score), color: riskColor100(score),
    source: fwd.source === "mock" || reg.source === "mock" ? "mock" : (fwd.source || reg.source || null),
    triggers: (p.triggers || []).filter((t) => t.status !== "nominal"),
  };
}

export async function loadCommodityProfiles(keys) {
  const out = {};
  await Promise.all([...new Set(keys)].map(async (k) => {
    try { const r = await loadCommodityProfile(k); if (r) out[k] = r; } catch { /* leave unscored */ }
  }));
  return out;
}
