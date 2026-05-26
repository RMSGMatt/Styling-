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

  // ── LITHIUM FORWARD SIGNALS ────────────────────────────────────────────────

  cell_capacity_allocation_nlp: {
    label:     "Cell capacity allocation (OEM vs Tier 1)",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "CATL, LG Energy, Panasonic IR transcripts (NLP)",
    cadence:   "Quarterly",
    latency:   "24–48hrs post call",
    apiKey:    false,
    explainer: "When cell manufacturers commit capacity to priority OEMs under long-term agreements, Tier 1 battery pack assemblers lose allocation 6–12 months later.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/cell-allocation`,
  },

  lithium_futures_curve: {
    label:     "Lithium futures curve (contango slope)",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "LME / CME lithium hydroxide futures",
    cadence:   "Daily",
    latency:   "<24hrs",
    apiKey:    true,
    explainer: "Steepening contango on lithium forward contracts signals the market pricing in supply tightening ahead of current spot.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/futures-curve`,
  },

  china_refinery_concentration: {
    label:     "China refinery concentration risk",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "CNIA · MIIT · USGS Minerals",
    cadence:   "Quarterly",
    latency:   "~4 week lag",
    apiKey:    false,
    explainer: "China controls ~65% of global lithium refining. No alternative capacity at scale before 2028. Any export restriction is a binary tail event with 18–24 month downstream consequences.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/china-concentration`,
  },

  mining_production_guidance: {
    label:     "Mining production guidance (SQM / Albemarle)",
    layer:     "forward",
    horizon:   "6–9 months",
    source:    "SEC EDGAR 20-F / 10-K (SQM, Albemarle, Pilbara)",
    cadence:   "Quarterly",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "Mine output guidance leads refined material availability by 6–9 months including shipping and processing lag.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/mining-guidance`,
  },

  ev_production_forecast_delta: {
    label:     "EV demand vs cell capacity delta",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "IEA EV Outlook · LMC Automotive · Cell manufacturer guidance",
    cadence:   "Quarterly",
    latency:   "~2 week lag",
    apiKey:    false,
    explainer: "When EV production growth outpaces cell capacity expansion, allocation pressure falls on lower-priority customers first — typically Tier 1 suppliers to smaller OEMs.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/ev-delta`,
  },

  battery_policy_pipeline: {
    label:     "Battery policy pipeline (IRA / CRMA)",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "Federal Register RSS · EUR-Lex · DOE announcements",
    cadence:   "Real-time",
    latency:   "<1hr",
    apiKey:    false,
    explainer: "US IRA Section 45X credits and EU CRMA implementation create structural demand pulls for non-Chinese battery materials, competing for the same constrained supply pool.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/policy`,
  },

  // ── LITHIUM REGIME SIGNALS ─────────────────────────────────────────────────

  lithium_carbonate_spot: {
    label:     "Lithium carbonate spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "Shanghai Metals Market (SMM) · Trading Economics",
    cadence:   "Daily",
    latency:   "<24hrs",
    apiKey:    false,
    explainer: "Most liquid lithium price benchmark. Watch rate of change more than absolute level.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/carbonate-spot`,
  },

  lithium_hydroxide_spot: {
    label:     "Lithium hydroxide spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "Fastmarkets · SMM",
    cadence:   "Daily",
    latency:   "<24hrs",
    apiKey:    false,
    explainer: "Hydroxide premium over carbonate indicates NMC chemistry pressure specifically. Widening premium confirms automotive-grade cell tightening already underway.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/hydroxide-spot`,
  },

  cobalt_spot_price: {
    label:     "Cobalt spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "LME via Trading Economics",
    cadence:   "Daily",
    latency:   "<24hrs",
    apiKey:    false,
    explainer: "EV demand proxy for NMC chemistry. LFP adoption reducing cobalt dependency in mass-market segments but premium automotive packs remain cobalt-dependent.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/cobalt-spot`,
  },

  cell_lead_times: {
    label:     "Automotive cell lead times",
    layer:     "regime",
    horizon:   "Current",
    source:    "Industry reports · Supplier earnings · Distribution data",
    cadence:   "Monthly",
    latency:   "~3 week lag",
    apiKey:    false,
    explainer: "Current lead times for automotive-grade prismatic, pouch, and cylindrical cells. Extension beyond 12-week baseline confirms allocation tightening already underway.",
    endpoint:  `${API_BASE}/api/risk/signals/lithium/cell-lead-times`,
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

export const MOCK_LITHIUM_FORWARD_SIGNALS = {
  cell_capacity_allocation_nlp:  0.76,
  lithium_futures_curve:         0.61,
  china_refinery_concentration:  0.80,
  mining_production_guidance:    0.52,
  ev_production_forecast_delta:  0.67,
  battery_policy_pipeline:       0.58,
};

export const MOCK_LITHIUM_REGIME_SIGNALS = {
  lithium_carbonate_spot: 0.44,
  lithium_hydroxide_spot: 0.51,
  cobalt_spot_price:      0.38,
  cell_lead_times:        0.62,
};

export const MOCK_LITHIUM_SIGNAL_DETAIL = {
  cell_capacity_allocation_nlp: {
    value: "High divergence",
    trend: "deteriorating",
    keyFact: "CATL has committed >80% of 2026 prismatic cell capacity to BYD, Tesla, and VW under multi-year agreements. Tier 1 battery pack assemblers for smaller OEMs are competing for residual allocation.",
    lastUpdated: "Q1 2026 earnings",
    dataPoint: "CATL Q1 2026: 'Long-term supply agreements cover majority of 2026–2027 capacity'",
  },
  lithium_futures_curve: {
    value: "Contango steepening",
    trend: "deteriorating",
    keyFact: "LME lithium hydroxide forward curve steepening — 12-month contracts pricing in 18–22% premium over spot. Market is pricing supply tightening ahead of current spot levels.",
    lastUpdated: "May 2026",
    dataPoint: "LME Li(OH) spot: ~$12.4/tonne · 12mo forward: ~$15.1/tonne",
  },
  china_refinery_concentration: {
    value: "Structural risk",
    trend: "stable risk",
    keyFact: "China processes approximately 65% of global lithium into battery-grade material. No alternative refining capacity at scale will come online before 2028. Any export restriction is a binary tail event with 18–24 month downstream consequences.",
    lastUpdated: "Q1 2026",
    dataPoint: "Chinese refinery capacity: ~65% global share · Next meaningful alternative: 2028",
  },
  mining_production_guidance: {
    value: "Stable / not expanding",
    trend: "flat",
    keyFact: "SQM (Chile) and Albemarle (US/Australia) both guiding flat-to-modest production growth for 2026. Low spot prices in 2024–2025 suppressed investment in new brine and spodumene capacity.",
    lastUpdated: "Q1 2026 20-F / 10-K",
    dataPoint: "SQM 2026 guidance: 180–200kt LCE · Albemarle: 'disciplined capital deployment'",
  },
  ev_production_forecast_delta: {
    value: "Demand outpacing supply",
    trend: "deteriorating",
    keyFact: "Global EV production forecast to exceed 20M units in 2026. Cell manufacturers have not committed equivalent capacity expansion. The gap closes via allocation pressure on lower-priority customers.",
    lastUpdated: "IEA EV Outlook 2026",
    dataPoint: "EV demand: ~20M units 2026 · Cell capacity growth: ~14% YoY vs demand growth ~22% YoY",
  },
  battery_policy_pipeline: {
    value: "Accelerating",
    trend: "deteriorating",
    keyFact: "US IRA Section 45X manufacturing credits accelerating domestic cell demand. EU Critical Raw Materials Act implementation creating parallel demand surge for non-Chinese sourced material.",
    lastUpdated: "May 2026",
    dataPoint: "IRA 45X: $35/kWh credit for US-manufactured cells",
  },
  lithium_carbonate_spot: {
    value: "~$12.4/tonne",
    trend: "elevated",
    keyFact: "Lithium carbonate spot has recovered from 2024 lows of ~$9/tonne. Directionally rising but well below the 2022 peak of ~$80/tonne.",
    lastUpdated: "May 2026",
    dataPoint: "LCO spot: $12.4/tonne · 6mo change: +38% · vs 2022 peak: -85%",
  },
  lithium_hydroxide_spot: {
    value: "~$13.8/tonne",
    trend: "deteriorating",
    keyFact: "Hydroxide premium over carbonate widening — signals NMC chemistry under more pressure than LFP. Premium widening is a leading indicator of automotive-grade cell tightening.",
    lastUpdated: "May 2026",
    dataPoint: "Li(OH) spot: $13.8/tonne · Carbonate premium: +$1.4/tonne and widening",
  },
  cobalt_spot_price: {
    value: "~$25,400/tonne",
    trend: "flat",
    keyFact: "Cobalt relatively stable as LFP adoption reduces cobalt dependency in mass-market EVs. Premium NMC cells still cobalt-dependent.",
    lastUpdated: "May 2026",
    dataPoint: "LME cobalt: ~$25,400/tonne · 6mo change: +4%",
  },
  cell_lead_times: {
    value: "16–20 weeks (automotive prismatic)",
    trend: "deteriorating",
    keyFact: "Automotive-grade prismatic cell lead times extending from 12-week baseline to 16–20 weeks. Pouch cells at 20+ weeks. Cylindrical 4680 format allocated entirely to Tesla and strategic partners.",
    lastUpdated: "May 2026",
    dataPoint: "Prismatic automotive cell: 16–20wks · Pouch: 20+wks · Cylindrical 4680: allocated",
  },
};

export async function fetchForwardSignals(commodity = "semiconductors_mlcc") {
  if (USE_MOCK_DATA) {
    const data = commodity === "lithium_battery"
      ? MOCK_LITHIUM_FORWARD_SIGNALS
      : MOCK_FORWARD_SIGNALS;
    return { signals: data, source: "mock", fetchedAt: new Date().toISOString() };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/forward?commodity=${commodity}`);
  return res.json();
}

export async function fetchRegimeSignals(commodity = "semiconductors_mlcc") {
  if (USE_MOCK_DATA) {
    const data = commodity === "lithium_battery"
      ? MOCK_LITHIUM_REGIME_SIGNALS
      : MOCK_REGIME_SIGNALS;
    return { signals: data, source: "mock", fetchedAt: new Date().toISOString() };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/regime?commodity=${commodity}`);
  return res.json();
}
