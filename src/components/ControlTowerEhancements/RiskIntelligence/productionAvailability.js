// ─────────────────────────────────────────────────────────────────────────────
// productionAvailability.js
// FOR-C Risk Intelligence — Commodity production availability registry
//
// This is the gate that CorridorRiskPanel does NOT have: a country can score
// LOW risk and still be a nonsensical "best place to buy" if it doesn't
// actually produce the commodity. This registry answers "can you even buy
// this here?" before risk scoring ever runs.
//
// Tiering reflects REAL production share, not aspirational/announced capacity:
//   tier 1 = major global production hub (>10% global share or category-defining)
//   tier 2 = meaningful production presence (assembly, packaging, mid-tier fabs)
//   tier 3 = minimal/emerging production (pilot lines, small-scale, nearshoring bets)
// Countries absent from a commodity's list are NOT viable sourcing origins —
// they do not appear in "Best Place to Buy" results for that commodity at all.
// ─────────────────────────────────────────────────────────────────────────────

// Keyed by commodity_id to match COMMODITY_TYPES in CorridorRiskPanel.jsx
export const PRODUCTION_AVAILABILITY = {
  semiconductor: {
    tier1: ["TWN", "KOR"],                          // TSMC, Samsung — advanced node fabs
    tier2: ["JPN", "CHN", "USA"],                    // mature-node fabs, materials, packaging
    tier3: ["MYS", "VNM", "SGP", "DEU", "ISR"],      // assembly/test, specialty fabs, equipment
    note: "Advanced-node fabrication is concentrated in Taiwan and South Korea. Most other countries listed here participate in packaging, assembly/test, or mature-node production only.",
  },

  automotive: {
    tier1: ["DEU", "JPN", "USA", "KOR", "CHN"],
    tier2: ["MEX", "CAN", "IND", "THA", "POL", "CZE"],
    tier3: ["BRA", "TUR", "VNM", "IDN"],
    note: "Automotive component and sub-assembly manufacturing is broadly distributed across established OEM and Tier 1 manufacturing hubs.",
  },

  raw_materials: {
    tier1: ["AUS", "CHL", "CHN", "BRA"],             // lithium, rare earths, iron ore
    tier2: ["IDN", "ZAF", "CAN", "RUS"],
    tier3: ["ARG", "PHL", "VNM"],
    note: "Raw materials and mineral extraction follows geology, not manufacturing capacity — production is concentrated in resource-rich countries regardless of industrial base.",
  },

  food_ag: {
    tier1: ["USA", "BRA", "CHN", "IND"],
    tier2: ["ARG", "CAN", "AUS", "FRA", "UKR"],
    tier3: ["THA", "VNM", "MEX", "IDN"],
    note: "Agricultural production capacity reflects arable land, climate, and growing season — concentrated in major agricultural exporting nations.",
  },

  pharma: {
    tier1: ["CHN", "IND", "USA", "DEU"],             // API and bulk drug production
    tier2: ["IRL", "CHE", "JPN", "KOR"],
    tier3: ["ISR", "SGP", "BRA"],
    note: "Active pharmaceutical ingredient (API) production is heavily concentrated in China and India; finished dosage manufacturing is more distributed.",
  },
};

// Lookup: does this commodity have meaningful production in this country?
// Returns null if no production presence — caller should EXCLUDE this origin.
export function getProductionTier(commodityId, countryCode) {
  const registry = PRODUCTION_AVAILABILITY[commodityId];
  if (!registry) return null;

  if (registry.tier1.includes(countryCode)) return { tier: 1, label: "Major Producer", weight: 1.0 };
  if (registry.tier2.includes(countryCode)) return { tier: 2, label: "Established Producer", weight: 0.7 };
  if (registry.tier3.includes(countryCode)) return { tier: 3, label: "Emerging / Niche Producer", weight: 0.4 };
  return null; // no meaningful production — excluded from "Best Place to Buy"
}

// Filter a list of origins down to only those with real production presence
// for the given commodity. This is the function CorridorRiskPanel was missing.
export function filterViableOrigins(origins, commodityId) {
  return origins
    .map((origin) => {
      const tier = getProductionTier(commodityId, origin.code);
      return tier ? { ...origin, productionTier: tier } : null;
    })
    .filter(Boolean);
}

// Get the explanatory note for why a commodity's viable origin list looks the way it does
export function getAvailabilityNote(commodityId) {
  return PRODUCTION_AVAILABILITY[commodityId]?.note || "";
}

// For transparency in the UI: which origins were excluded and why
export function getExcludedOrigins(origins, commodityId) {
  const registry = PRODUCTION_AVAILABILITY[commodityId];
  if (!registry) return origins;
  const viableCodes = new Set([...registry.tier1, ...registry.tier2, ...registry.tier3]);
  return origins.filter((o) => !viableCodes.has(o.code));
}
