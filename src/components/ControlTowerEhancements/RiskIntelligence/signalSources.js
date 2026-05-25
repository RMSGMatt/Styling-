// ─────────────────────────────────────────────────────────────────────────────
// signalSources.js
// FOR-C v3 · Signal Source Registry
//
// Flip USE_MOCK_DATA to false when Flask endpoints are ready.
// Mock data shapes are identical to real API response shapes —
// backend wiring is a drop-in replacement.
// ─────────────────────────────────────────────────────────────────────────────

export const USE_MOCK_DATA = true;

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL METADATA REGISTRY
// Used by SignalCard to render source, cadence, latency, and explainer text.
// ─────────────────────────────────────────────────────────────────────────────
export const SIGNAL_METADATA = {

  // ── FORWARD SIGNALS ────────────────────────────────────────────────────────

  fab_capex_trajectory: {
    label:       "Fab capex trajectory",
    layer:       "forward",
    horizon:     "12–24 months",
    source:      "SEC EDGAR (TSMC 20-F, ASML earnings)",
    cadence:     "Quarterly",
    latency:     "24–48hrs post filing",
    apiKey:      false,
    explainer:   "Capex cuts today mean less wafer capacity in 18–24 months. ASML equipment orders lead fab output by 12–18 months.",
    endpoint:    `${API_BASE}/api/risk/signals/fab-capex`,
  },

  capacity_allocation_mix_shift: {
    label:       "Capacity allocation shift (AI vs auto)",
    layer:       "forward",
    horizon:     "6–12 months",
    source:      "Supplier earnings transcripts (NLP)",
    cadence:     "Quarterly",
    latency:     "24–48hrs post call",
    apiKey:      false,
    explainer:   "When Murata, TDK, or Samsung commit capacity to AI/hyperscaler customers under long-term agreements, automotive allocation shrinks 6–12 months later.",
    endpoint:    `${API_BASE}/api/risk/signals/allocation-shift`,
  },

  raw_material_supply_risk: {
    label:       "Raw material & input risk",
    layer:       "forward",
    horizon:     "3–9 months",
    source:      "Federal Register RSS · METI · USGS Minerals",
    cadence:     "Real-time",
    latency:     "<1hr",
    apiKey:      false,
    explainer:   "Export controls on gallium, germanium, neon, and barium titanate (MLCC ceramic powder) flow through to fab yield and output within 3–6 months.",
    endpoint:    `${API_BASE}/api/risk/signals/raw-material`,
  },

  end_market_demand_divergence: {
    label:       "End-market demand divergence",
    layer:       "forward",
    horizon:     "3–6 months",
    source:      "SEC EDGAR 10-Q (hyperscaler capex) · FRED IPMVCD",
    cadence:     "Quarterly / Monthly",
    latency:     "24–48hrs post filing",
    apiKey:      false,
    explainer:   "Hyperscaler capex spikes signal MLCC/advanced packaging demand acceleration 1–2 quarters ahead, competing directly with automotive for the same fab capacity.",
    endpoint:    `${API_BASE}/api/risk/signals/demand-divergence`,
  },

  geopolitical_policy_pipeline: {
    label:       "Geopolitical policy pipeline",
    layer:       "forward",
    horizon:     "1–18 months",
    source:      "GDELT · Federal Register · Congress.gov · ACLED",
    cadence:     "Real-time (GDELT 15min)",
    latency:     "<15min",
    apiKey:      false,
    explainer:   "Policy infrastructure — export control frameworks, entity list changes, bilateral tech agreements — precedes actual supply disruptions by months. Nov 2026 gallium suspension expiry is a date-stamped forward risk.",
    endpoint:    `${API_BASE}/api/risk/signals/geopolitical`,
  },

  equipment_order_book: {
    label:       "Semiconductor equipment orders",
    layer:       "forward",
    horizon:     "9–18 months",
    source:      "ASML quarterly IR · Lam Research · Applied Materials",
    cadence:     "Quarterly",
    latency:     "24–48hrs post release",
    apiKey:      false,
    explainer:   "Lithography equipment order drops signal fab capacity pullback — more predictive than SEMI billings because orders precede wafer starts by 9–18 months.",
    endpoint:    `${API_BASE}/api/risk/signals/equipment-orders`,
  },

  // ── REGIME SIGNALS ─────────────────────────────────────────────────────────

  spot_lead_times: {
    label:       "Component lead times",
    layer:       "regime",
    horizon:     "Current",
    source:      "Susquehanna · Distributor data · Industry reports",
    cadence:     "Monthly",
    latency:     "~3 week lag",
    apiKey:      false,
    explainer:   "Current MLCC and MCU lead times. Confirms disruption phase already underway — used to calibrate simulation starting conditions, not to predict future disruptions.",
    endpoint:    `${API_BASE}/api/risk/signals/lead-times`,
  },

  spot_prices: {
    label:       "Component spot prices",
    layer:       "regime",
    horizon:     "Current",
    source:      "DRAMeXchange · TrendForce · Distributor spot data",
    cadence:     "Weekly",
    latency:     "Weekly",
    apiKey:      false,
    explainer:   "MLCC and discrete semi spot price movement vs contract baseline. Price spikes confirm a shortage is already materialising.",
    endpoint:    `${API_BASE}/api/risk/signals/spot-prices`,
  },

  distributor_inventory: {
    label:       "Distributor inventory levels",
    layer:       "regime",
    horizon:     "Current",
    source:      "Digi-Key · Mouser · Arrow (scraped stock counts)",
    cadence:     "Daily (scraped)",
    latency:     "~24hrs",
    apiKey:      false,
    explainer:   "Inventory drawdown at major distributors is one of the clearest early confirmations a shortage is accelerating. Watched across key MLCC and MCU part numbers.",
    endpoint:    `${API_BASE}/api/risk/signals/distributor-inventory`,
  },

  freight_rates: {
    label:       "Transpacific freight rates",
    layer:       "regime",
    horizon:     "Current",
    source:      "Freightos Baltic Index FBX01",
    cadence:     "Weekly (free) / Daily (paid)",
    latency:     "Weekly",
    apiKey:      false,
    explainer:   "Asia–US West Coast container rates vs 24-month baseline. Rate direction and Middle East situation can lead spot shortages by 4–8 weeks as modal shift pressure builds.",
    endpoint:    `${API_BASE}/api/risk/signals/freight`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SIGNAL DATA
// Mirrors exact shape of real API responses.
// Values represent current real-world conditions as of May 2026.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_FORWARD_SIGNALS = {
  fab_capex_trajectory:          0.58, // TSMC Japan ramp positive but mature node capex flat
  capacity_allocation_mix_shift: 0.79, // Murata/Samsung locking AI multi-year agreements
  raw_material_supply_risk:      0.72, // Gallium/germanium suspension until Nov '26
  end_market_demand_divergence:  0.68, // Hyperscaler capex spiking vs flat auto production
  geopolitical_policy_pipeline:  0.71, // Taiwan #1 Beijing risk; Nov '26 expiry date-stamped
  equipment_order_book:          0.52, // ASML orders stable; not alarming but not expanding
};

export const MOCK_REGIME_SIGNALS = {
  spot_lead_times:       0.82, // High-cap MLCC >20wks; AEC-Q100 MCU 52+wks
  spot_prices:           0.65, // MLCC +10–20%; Taiyo Yuden +6–13% April '26
  distributor_inventory: 0.58, // Drawing down but not yet critically depleted
  freight_rates:         0.48, // FBX01 ~$2,500/FEU; elevated ~$700 above pre-crisis
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SIGNAL DETAIL
// Contextual data rendered in SignalCard expanded view.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_SIGNAL_DETAIL = {
  fab_capex_trajectory: {
    value: "Stable / cautious",
    trend: "flat",
    keyFact: "TSMC Kumamoto Phase 2 confirmed. Mature node (40–180nm) capex not expanding — sold out through 2026 but no new capacity arriving before late 2026.",
    lastUpdated: "Q1 2026 earnings",
    dataPoint: "TSMC capex guidance: $38–42B for 2026",
  },
  capacity_allocation_mix_shift: {
    value: "High divergence",
    trend: "deteriorating",
    keyFact: "Murata, TDK, Samsung Electro-Mechanics all prioritising high-cap MLCCs for AI/data centre under multi-year agreements. Automotive buyers competing for residual allocation.",
    lastUpdated: "May 2026",
    dataPoint: "Taiyo Yuden raised auto MLCC prices 6–13% April 2026",
  },
  raw_material_supply_risk: {
    value: "Elevated",
    trend: "stable risk",
    keyFact: "China gallium & germanium export suspension in place until Nov 27, 2026. BaTiO3 ceramic powder supply stable but single-source dependent.",
    lastUpdated: "Nov 2025 (Trump-Xi agreement)",
    dataPoint: "Suspension expiry: Nov 27, 2026 — known date-stamped risk",
  },
  end_market_demand_divergence: {
    value: "High divergence",
    trend: "deteriorating",
    keyFact: "AWS, Azure, Google capex collectively up ~35% YoY. Auto production (FRED IPMVCD) flat. Both sectors competing for 40–180nm mature node capacity.",
    lastUpdated: "Q1 2026 10-Q filings",
    dataPoint: "Hyperscaler capex: $220B+ projected 2026",
  },
  geopolitical_policy_pipeline: {
    value: "Elevated",
    trend: "stable elevated",
    keyFact: "Tsinghua CISS ranked Taiwan Strait #1 Beijing external risk for 2026. US midterm election uncertainty a compounding factor. No active military exercises.",
    lastUpdated: "March 2026",
    dataPoint: "Nov 2026 gallium suspension expiry is a known binary risk event",
  },
  equipment_order_book: {
    value: "Stable",
    trend: "flat",
    keyFact: "ASML order book healthy for EUV (AI-driven). DUV (mature node) orders not expanding — consistent with no new mature node capacity investment.",
    lastUpdated: "Q1 2026 ASML earnings",
    dataPoint: "ASML net bookings: €7.1B Q1 2026 (EUV dominant)",
  },
  spot_lead_times: {
    value: "20+ weeks (high-cap MLCC)",
    trend: "deteriorating",
    keyFact: "AEC-Q100 32-bit MCUs at 52+ weeks in several families. High-cap MLCCs (1206/1210 case sizes) >20 weeks. Automotive-grade SiC MOSFETs critically constrained.",
    lastUpdated: "May 2026",
    dataPoint: "MLCC lead times: 10–14wks (standard) / 20+wks (high-cap auto)",
  },
  spot_prices: {
    value: "+10–20% vs contract",
    trend: "deteriorating",
    keyFact: "Taiyo Yuden raised low-capacitance auto MLCC prices 6–13% in April 2026. Yageo announced 15–20% increases on resistors. Broader MLCC price rebound expected.",
    lastUpdated: "May 2026",
    dataPoint: "MLCC spot premiums: 10–20% above contract pricing",
  },
  distributor_inventory: {
    value: "Drawing down",
    trend: "deteriorating",
    keyFact: "Distribution safety stock providing a temporary buffer but Tier-1 OEMs consuming available inventory. Smaller players facing increasing competition for remaining allocations.",
    lastUpdated: "May 2026",
    dataPoint: "Inventory-to-sales ratios near historical norms but directionally worsening",
  },
  freight_rates: {
    value: "$2,500/FEU (FBX01)",
    trend: "elevated",
    keyFact: "Transpacific West Coast rates ~$700/FEU above pre-Hormuz-crisis baseline. Middle East energy situation adding structural floor. Front-loading behaviour emerging.",
    lastUpdated: "April 2026",
    dataPoint: "FBX01: ~$2,500/FEU vs ~$1,800/FEU pre-crisis baseline",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// fetchSignals
// Returns mock or live signal data depending on USE_MOCK_DATA flag.
// Real endpoints return identical shape: { signals: { key: 0–1 float }, meta: {} }
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchForwardSignals() {
  if (USE_MOCK_DATA) {
    return { signals: MOCK_FORWARD_SIGNALS, source: "mock", fetchedAt: new Date().toISOString() };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/forward`);
  return res.json();
}

export async function fetchRegimeSignals() {
  if (USE_MOCK_DATA) {
    return { signals: MOCK_REGIME_SIGNALS, source: "mock", fetchedAt: new Date().toISOString() };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/regime`);
  return res.json();
}
