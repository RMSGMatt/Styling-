// ─────────────────────────────────────────────────────────────────────────────
// commodityRegistry.js
// FOR-C v3 · Commodity Registry
// Add new commodities here. riskScoreEngine and all panels stay unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export const COMMODITY_REGISTRY = [
  {
    key:      "semiconductors_mlcc",
    label:    "Semiconductors & MLCCs",
    icon:     "🔬",
    category: "Electronic Components",
    status:   "live",
    description: "Fab capacity, MLCC allocation, Taiwan Strait exposure, export controls",
  },
  {
    key:      "lithium_battery",
    label:    "Lithium & Battery Materials",
    icon:     "🔋",
    category: "EV Components",
    status:   "live", // Updated 2026-08-16 — was "beta" from before any live/analyst-reviewed work existed. Now has 2 genuinely live signals (battery_policy_pipeline, mining_production_guidance) plus 8 properly dated, sourced analyst-reviewed signals covering every remaining forward and regime signal — same mix as semiconductors_mlcc, just under a stale label.
    description: "Lithium carbonate, cobalt, NMC cathode materials, cell capacity",
  },
  {
    key:      "rare_earth_metals",
    label:    "Rare Earth Metals",
    icon:     "⛏️",
    category: "Raw Materials",
    status:   "live", // Updated 2026-08-18 — all 9 signals now resolved: 4 genuinely live (non_china_ree_capacity, china_ree_export_policy, defense_demand_signal, ev_wind_demand_divergence) plus 5 properly dated, sourced analyst-reviewed signals. Same coverage standard that moved lithium_battery from "beta" to "live" earlier.
    description: "Neodymium, dysprosium, lanthanum — magnet and motor supply risk",
  },
  {
    key:      "steel_aluminum",
    label:    "Steel & Aluminum",
    icon:     "🏗️",
    category: "Raw Materials",
    status:   "live", // Updated 2026-08-18 — all 10 signals now resolved: 3 genuinely live (domestic_capacity_expansion, section_232_tariff_pipeline, aluminum_capacity_signal) plus 7 properly dated, sourced analyst-reviewed signals. Same coverage standard as lithium_battery and rare_earth_metals.
    description: "Hot-rolled coil, automotive sheet, tariff and trade flow exposure",
  },
  {
    key:      "automotive_resins",
    label:    "Automotive Resins & Plastics",
    icon:     "🧪",
    category: "Chemicals",
    status:   "live", // Updated 2026-08-18 — all 10 signals now resolved: domestic_polymer_capacity is genuinely live (Celanese + Eastman, SEC XBRL), the other 9 are properly dated, sourced analyst-reviewed signals. Same coverage standard as the other four commodities.
    description: "Polypropylene, ABS, nylon — petrochemical feedstock and capacity risk",
  },
  {
    key:      "natural_rubber",
    label:    "Natural Rubber",
    icon:     "🌿",
    category: "Raw Materials",
    status:   "live", // Updated 2026-08-18 — all 10 signals now resolved: tire_manufacturer_demand is genuinely live (Goodyear, SEC XBRL, demand-side/non-inverted), the other 9 are properly dated, sourced analyst-reviewed signals. Same coverage standard as all five other commodities. Notably, the same real Middle East conflict (Hormuz Strait closure, Mar 2026) was independently confirmed as a driver in this commodity's synthetic_rubber_substitution and tsr20_spot_price signals, the same crisis already found across aluminum, petrochemical feedstock, and China polymer signals — a genuine cross-commodity pattern worth remembering.
    description: "Thai and Indonesian plantation output, weather and disease signals",
  },
];

export const STATUS_CONFIG = {
  live:         { label: "Live",         color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.4)" },
  beta:         { label: "Beta",         color: "#FBBF24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
  coming_soon:  { label: "Coming soon",  color: "#C7D0D9", bg: "#1A2129", border: "#55606B" },
};