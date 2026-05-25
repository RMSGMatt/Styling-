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
  live:         { label: "Live",         color: "#3B6D11", bg: "#EAF3DE", border: "#97C459" },
  beta:         { label: "Beta",         color: "#854F0B", bg: "#FAEEDA", border: "#EF9F27" },
  coming_soon:  { label: "Coming soon",  color: "#5F5E5A", bg: "#F1EFE8", border: "#B4B2A9" },
};