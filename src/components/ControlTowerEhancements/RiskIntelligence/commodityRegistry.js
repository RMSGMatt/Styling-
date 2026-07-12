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
    status:   "beta",
    description: "Lithium carbonate, cobalt, NMC cathode materials, cell capacity",
  },
  {
    key:      "rare_earth_metals",
    label:    "Rare Earth Metals",
    icon:     "⛏️",
    category: "Raw Materials",
    status:   "coming_soon",
    description: "Neodymium, dysprosium, lanthanum — magnet and motor supply risk",
  },
  {
    key:      "steel_aluminum",
    label:    "Steel & Aluminum",
    icon:     "🏗️",
    category: "Raw Materials",
    status:   "coming_soon",
    description: "Hot-rolled coil, automotive sheet, tariff and trade flow exposure",
  },
  {
    key:      "automotive_resins",
    label:    "Automotive Resins & Plastics",
    icon:     "🧪",
    category: "Chemicals",
    status:   "coming_soon",
    description: "Polypropylene, ABS, nylon — petrochemical feedstock and capacity risk",
  },
  {
    key:      "natural_rubber",
    label:    "Natural Rubber",
    icon:     "🌿",
    category: "Raw Materials",
    status:   "coming_soon",
    description: "Thai and Indonesian plantation output, weather and disease signals",
  },
];

export const STATUS_CONFIG = {
  live:         { label: "Live",         color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.4)" },
  beta:         { label: "Beta",         color: "#FBBF24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
  coming_soon:  { label: "Coming soon",  color: "#C7D0D9", bg: "#1A2129", border: "#55606B" },
};