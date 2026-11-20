// ─────────────────────────────────────────────────────────────────────────────
// signalSources.js
// FOR-C v3 · Signal Source Registry
//
// Flip USE_MOCK_DATA to false when Flask endpoints are ready.
// Mock data shapes are identical to real API response shapes —
// backend wiring is a drop-in replacement.
// ─────────────────────────────────────────────────────────────────────────────

import { getApiBase } from "../../../config/apiBase";
import { fetchLiveSemiconductorForwardOverrides, fetchLiveLithiumForwardOverrides, fetchLiveSemiconductorRegimeOverrides, fetchLiveRareEarthForwardOverrides, fetchLiveSteelAluminumForwardOverrides, fetchLiveResinsForwardOverrides, fetchLiveRubberForwardOverrides, fetchLiveTungstenForwardOverrides, fetchLiveGasesForwardOverrides, fetchLiveGasesRegimeOverrides } from "./liveSignals";

export const USE_MOCK_DATA = true;

export const API_BASE = getApiBase();


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

  // ── RARE EARTH METALS — FORWARD SIGNALS ───────────────────────────────────
  // Built 2026-08-16. Only non_china_ree_capacity is live so far.

  non_china_ree_capacity: {
    label:     "Non-China REE capacity (MP Materials)",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "SEC XBRL — MP Materials Corp (NYSE: MP)",
    cadence:   "Quarterly",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "INVERTED from every other capex signal: rising MP Materials capex means more non-China rare-earth mining/processing/magnet capacity coming online — that's de-risking, not stress. Falling or flat capex means the West stays dependent on Chinese-concentrated supply.",
    endpoint:  `${API_BASE}/api/risk/signals/non-china-ree-capacity`,
  },

  china_ree_export_policy: {
    label:     "China REE export policy",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "Federal Register API (US regulatory response, not Chinese MOFCOM announcements directly)",
    cadence:   "Real-time",
    latency:   "<1hr",
    apiKey:    false,
    explainer: "Tracks real US Federal Register activity in response to Chinese rare-earth export policy — Commerce/BIS rules, Presidential Determinations, critical-minerals actions. Real, dated context: Beijing's Oct 2025 export controls are suspended until Nov 10, 2026; the IEA estimates full reinstatement could put $6.5T of downstream production at risk. China separately blacklisted MP Materials by name on June 22, 2026.",
    endpoint:  "Direct Federal Register API call, not backend-proxied (confirmed CORS-open)",
  },

  defense_demand_signal: {
    label:     "Defense demand (DoD relationship)",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "USASpending.gov (real DoD contracts) + Federal Register (DPA Title III activity)",
    cadence:   "Real-time",
    latency:   "<1hr",
    apiKey:    false,
    explainer: "INVERTED, same as non_china_ree_capacity: real, recent DoD engagement lowers this score (de-risking). Combines two real sources since neither alone tells the whole story — MP Materials' headline $400M DPA Title III equity investment deliberately exempts itself from normal contracting rules, so it won't appear in USASpending's contract search; that search instead captures real procurement contracts (a confirmed $10.99M NdPr/PrO oxide contract, July 2024). Federal Register separately catches DPA Title III-adjacent actions.",
    endpoint:  `${API_BASE}/api/risk/signals/defense-demand`,
  },

  magnet_capacity_allocation: {
    label:     "Magnet capacity allocation",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "MP Materials' own disclosed DoD offtake terms — no reliable live feed exists for customer-by-customer allocation data",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real terms are more nuanced than a simple defense-lockout story: the DoD's '100% offtake' on the new 10X Facility (7,000 MT/yr, commissioning 2028) is structured as a revenue/EBITDA guarantee, not a literal defense-only claim — MP Materials explicitly retains the option to sell to commercial buyers (EV, wind, industrial) with DoD's consent, with profit-sharing above a $140M EBITDA threshold. Real structural uncertainty remains: an unprecedented government-industry arrangement, and the added capacity doesn't arrive until 2028.",
    endpoint:  null,
  },

  china_refining_concentration: {
    label:     "China refining concentration",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "IEA Global Critical Minerals Outlook, S&P Global — no reliable live feed exists (same conclusion as lithium's equivalent signal)",
    cadence:   "Annual review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "China controls roughly 91% of global rare earth refining/separation capacity (IEA, confirmed via multiple independent sources) — even more concentrated than lithium's ~65% refining share. Real alternative capacity outside China totals under 40kt, spread across 8 countries; the IEA specifically flags downstream magnet production as the tightest bottleneck of all. A slow-moving structural reality, not something a live feed would meaningfully improve on.",
    endpoint:  null,
  },

  ev_wind_demand_divergence: {
    label:     "EV/wind demand divergence",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "SEC XBRL — GE Vernova Inc (NYSE: GEV), quarterly order backlog",
    cadence:   "Quarterly",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "NOT inverted, unlike this commodity's supply-side signals: growing wind-turbine backlog means more competition for the same limited magnet/rare-earth supply automotive customers also want — real demand pressure raises this score. Real, confirmed data: most recent quarter (Jun 2026) shows +37% YoY backlog growth, genuinely accelerating vs. the full-year comparison. Total company backlog (Power + Wind + Electrification combined), not Wind-segment-isolated — segment-level XBRL uses dimensional data not parsed here.",
    endpoint:  `${API_BASE}/api/risk/signals/ev-wind-demand-divergence`,
  },

  // ── RARE EARTH METALS — REGIME SIGNALS ────────────────────────────────────
  // freight_rates is REUSED directly from the semiconductor signal above,
  // not duplicated here — same key, same live data, same SIGNAL_METADATA
  // entry.

  ndpr_oxide_spot_price: {
    label:     "NdPr oxide spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "SMM (Shanghai Metals Market), real DoD-backed price floors — no reliable live feed exists, same paid-data wall as lithium/cobalt",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Relatively stable right now: China's domestic NdPr benchmark ($133.67/kg alloy, Aug 3 2026) has actually fallen below the real $110/kg DoD-backed price floor established under MP Materials' Pentagon contract — a notable shift from near-parity in July. Structural tightness remains real (magnets consume ~90% of NdPr supply, EV/wind demand both growing), but the acute price pressure seen in heavy REEs isn't present here right now.",
    endpoint:  null,
  },

  heavy_ree_spot_price: {
    label:     "Heavy REE spot price (Dy/Tb)",
    layer:     "regime",
    horizon:   "Current",
    source:    "SMM, S&P Global Platts, China Rare Earth Industry Association — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Severe, confirmed two-tier market: as of Aug 11 2026, terbium oxide trades at $990-999/kg domestically in China versus $3,625-4,500/kg reported outside China — a real 3.6-4.5x premium. Ex-China dysprosium and terbium prices have risen roughly 4-5x since China's April 2025 export controls; yttrium specifically surged ~140-fold. Real DoD-backed floors exist ($575/kg dysprosium, $2,050/kg terbium under MP Materials/Serra Verde contracts) but sit far below actual ex-China market prices.",
    endpoint:  null,
  },

  magnet_lead_times: {
    label:     "Magnet lead times",
    layer:     "regime",
    horizon:   "Current",
    source:    "No formal lead-time reporting exists for this nascent market — real capacity-ramp data used as a proxy instead",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "No specific 'X weeks' lead-time figure is reported anywhere for NdFeB magnets, unlike MLCCs or battery cells — the ex-China magnet manufacturing industry is too early-stage for that kind of trade-press tracking yet. Real capacity data used as a proxy instead: MP Materials' Independence facility runs roughly 1,000-3,000 MT/year; their next major facility (the 10X plant) doesn't even commission until 2028. Combined US magnet capacity won't reach 10,000 MT/year until then — genuinely scarce relative to real EV/wind demand.",
    endpoint:  null,
  },

  // ── STEEL & ALUMINUM — FORWARD SIGNALS ────────────────────────────────────
  // Built 2026-08-17. None live yet — full scaffolding built proactively
  // this time before any individual signal, given Rare Earth Metals
  // needed a follow-up fix to become clickable at all.

  section_232_tariff_pipeline: {
    label:     "Section 232 tariff policy pipeline",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "Federal Register API",
    cadence:   "Real-time",
    latency:   "<1hr",
    apiKey:    false,
    explainer: "Tracks real US Federal Register activity on Section 232 steel/aluminum tariffs. Query tuning, confirmed real: 'Section 232' + 'steel' alone returned 37 hits, mostly Foreign-Trade Zone boilerplate noise; adding 'derivative articles' — genuine Section 232 legal terminology — narrowed this to a clean 6, including a real June 2026 tariff-adjustment proclamation and an August 2026 public comment request.",
    endpoint:  "Direct Federal Register API call, not backend-proxied (confirmed CORS-open)",
  },

  domestic_capacity_expansion: {
    label:     "Domestic capacity expansion",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "SEC XBRL — Nucor + Cleveland-Cliffs, combined domestic steel capex",
    cadence:   "Annual",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "INVERTED, same convention as non_china_ree_capacity: growing domestic steel capacity means less import dependency — de-risking, lowers the score. Real, confirmed data (2026-08-17): combined FY2025 capex is roughly flat YoY (+3.0%), but that hides a real divergence — Nucor's own capex grew +7.8% while Cleveland-Cliffs' fell -19.3%, opposite directions from the two companies.",
    endpoint:  `${API_BASE}/api/risk/signals/domestic-capacity-expansion`,
  },

  china_steel_overcapacity_dumping: {
    label:     "China steel overcapacity / dumping",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "OECD Steel Outlook 2026, OECD Steel Committee — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Federal Register document-count was tested and rejected: China-steel AD/CVD activity is high-volume, routine regulatory business (dozens of individual product-specific proceedings running continuously), poorly suited to a count-based instrument — same conclusion as mining_production_guidance's known limitation, just more severe. Real severity instead confirmed via the OECD itself: global excess steel capacity will reach 745 million tons by 2026; Chinese exports hit a record 131 million tonnes in 2025, up 153% since 2020 and exceeding the EU's entire steel output that year.",
    endpoint:  null,
  },

  automotive_sheet_demand: {
    label:     "Automotive sheet demand",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "Fastmarkets/AISI industry analysis — no reliable live feed exists (fundamentally a market-forecast topic, not government/SEC data)",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Confirmed 2026-08-17, genuinely stable: US automotive production is holding flat at ~10.2M units in 2026 (similar to 2025), with modest growth to 10.5M expected in 2027. Real industry analysis explicitly notes steady production 'points to consistent steel demand which will contribute to supported steel flat product prices' — no crisis signal here, moderate and stable.",
    endpoint:  null,
  },

  scrap_eaf_dynamics: {
    label:     "Scrap / EAF feedstock dynamics",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "Recycling Today, ScrapMonster, AISI — no reliable live feed exists (structured scrap pricing is commercial/paid, same pattern as HRC)",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Confirmed 2026-08-17: US mills running healthy (81.3% capacity utilization, June 2026, AISI), overall scrap pricing mixed to stable. But a real, specific structural tightness exists for PRIME grades like busheling (the higher-quality scrap feeding automotive-grade flat-rolled production) — industrial scrap generation running below historical averages, busheling prices up 4.36% in Q2 2026, $412/MT as of Aug 3 2026. Moderate overall, with a real tilt toward tightness given this automotive-relevant grade specifically.",
    endpoint:  null,
  },

  aluminum_capacity_signal: {
    label:     "Aluminum capacity signal",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "SEC XBRL — Alcoa + Century Aluminum, combined domestic aluminum capex",
    cadence:   "Annual",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "INVERTED, same convention as domestic_capacity_expansion: growing US aluminum smelting investment means less import dependency — Section 232's original 2018 investigation found aluminum imports accounted for ~90% of certain primary aluminum products. Both Alcoa (CIK 0001675149) and Century Aluminum (CIK 0000949157) confirmed real, US-domestic 10-K filers using the exact same capex tag proven for 9 other companies tonight.",
    endpoint:  `${API_BASE}/api/risk/signals/aluminum-capacity-signal`,
  },

  // ── STEEL & ALUMINUM — REGIME SIGNALS ─────────────────────────────────────
  // freight_rates is REUSED directly from the semiconductor signal above,
  // not duplicated here.

  hrc_spot_price: {
    label:     "HRC spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "CME HRC futures (real market data via public quote pages), CRU index — no free structured API exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: HRC futures reversed sharply off the Aug 2026 low of $875/ton, climbing to $1,281-1,322/ton by late September — the highest level since March 2023. Every structured HRC pricing source (Metals-API, Commodities-API, CRU itself) still requires a paid subscription, so this stays analyst-tracked. The reversal re-tightens near-term cost-inflation risk even as the structural oversupply story confirmed in china_steel_overcapacity_dumping remains unresolved.",
    endpoint:  null,
  },

  aluminum_spot_price: {
    label:     "Aluminum spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "LME aluminum — no free structured API exists, same wall as every other LME-tracked metal",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: LME aluminum has eased modestly to ~$3,267/ton (Sept 26 2026) from the $3,380/ton Aug 13 peak, but remains well above the 'normal' 2023-2024 range (capped below $2,500/ton). Both structural drivers confirmed in August remain in place: Section 232 tariffs at 50% directly lifting US premiums, and the US-Iran conflict's disruption of ~10% of global aluminum production, with a forecast 2026 global deficit of ~720,000 tonnes still unresolved — near-term easing within a still-severe supply crisis, not a resolution of it.",
    endpoint:  null,
  },

  import_penetration: {
    label:     "Import penetration / trade flow",
    layer:     "regime",
    horizon:   "Current",
    source:    "Real Census Bureau/ITC data found via research — genuine live API requires a free registered key, deferred for now",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "A real, honest divergence between the two materials, not a single blended story: steel imports are down 30% in 2026 (real, confirmed, Section 232 tariffs 'working as intended' per the Steel Manufacturers Association; domestic production up ~5M tons since early 2025) — genuine de-risking. Aluminum's import dependency starts from a much higher baseline (60% of 2025 consumption vs. steel's 13%), with no confirmed 2026 decline of similar magnitude. One material genuinely improving, the other still structurally exposed.",
    endpoint:  null,
  },

  // ── AUTOMOTIVE RESINS & PLASTICS — FORWARD SIGNALS ────────────────────────
  // Built 2026-08-18. domestic_polymer_capacity is live; the rest are
  // explicit, labeled placeholders, built proactively before any
  // individual signal (same lesson from Rare Earth Metals).

  domestic_polymer_capacity: {
    label:     "Domestic polymer capacity",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "SEC XBRL — Celanese + Eastman Chemical, combined domestic polymer capex",
    cadence:   "Annual",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "INVERTED, same convention as domestic_capacity_expansion: growing US polymer/resin capacity investment means less import dependency — de-risking, lowers the score. Both Celanese (CIK 0001306830, acquired most of DuPont's automotive nylon business in a real 2022 $11B deal) and Eastman Chemical (CIK 0000915389) confirmed real, US-domestic 10-K filers using the exact same capex tag proven for 11 other companies this project. Trinseo (CIK 0001519061, real ABS producer) confirmed real and domestic but doesn't use the standard capex tag — honestly excluded rather than forced, same pattern as equipment_order_book.",
    endpoint:  `${API_BASE}/api/risk/signals/domestic-polymer-capacity`,
  },

  petrochemical_feedstock_risk: {
    label:     "Petrochemical feedstock risk",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "EIA (free government data, requires registered API key — deferred, same decision as import_penetration), plastics/chemicals trade press (ChemAnalyst, Beroe, ICIS)",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: after the mid-year correction, Brent crude climbed back above $110/bbl by mid-September 2026, re-escalating feedstock costs across the polymer chain. This repeats the same structurally broken cost-to-relief transmission confirmed in August — the mechanism behind the real 'Petrochemical Price Shock 2026: Why Costs Doubled in 30 Days' headline (April 2026) is recurring, with PP producers now announcing production cuts as margins turn negative (see pp_resin_spot_price).",
    endpoint:  null,
  },

  automotive_resin_demand: {
    label:     "Automotive resin demand",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "Same real AISI/Fastmarkets production data as automotive_sheet_demand, plus generic automotive plastics market research — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, stable: US vehicle production remains flat at ~10.2M units in 2026, the same figure confirmed for automotive_sheet_demand. One genuine structural difference from steel, though: automotive plastics content per vehicle is growing due to lightweighting and EV adoption (more polymer components for battery housings, structural weight reduction), a trend that doesn't apply the same way to steel. Honest caveat: most sources found here were generic, templated market-sizing reports rather than dated news events — weaker evidence quality than most other signals tonight, reflected in a more conservative score.",
    endpoint:  null,
  },

  china_polymer_capacity: {
    label:     "China polymer capacity",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "CIEL, Argus Media, ICIS — real, credible, independent industry sources, no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, severe, comparable to china_steel_overcapacity_dumping: China's PP exports surged 54% YoY through April 2026, PE exports up 122%, while imports fell simultaneously — a genuine reversal toward net exporter. China's PP production margins collapsed more than 95% (2019-2021 vs 2022-2024, CIEL). Global PP oversupply is forecast at 21M metric tons annually for 2020-2030, up threefold from 7M tonnes in 2000-2019 (ICIS). Real, dated 2026 capacity keeps expanding despite this: 4.55M tonnes of new PP capacity, ~6.2M tonnes of new PE, both starting in 2026. Connects to the same Middle East conflict already confirmed driving aluminum_spot_price and petrochemical_feedstock_risk — Chinese producers are explicitly filling the export gap left by constrained Middle East supply.",
    endpoint:  null,
  },

  resin_allocation_squeeze: {
    label:     "Resin allocation squeeze",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "PlasticsToday (ACC inventory/production/export data) — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, direct evidence of the opposite of a squeeze: a real, dated (Jul 2 2026) trade press headline, 'Q3 2026 Thermoplastics Market Favors Buyers,' confirmed with ACC data — PP inventories climbed 105.7M lbs to 1.97B lbs in May 2026 (39 days of supply, up nearly 5 days MoM), production up 4.3% even as domestic sales fell 6.7%/day, and export volume (the usual relief valve) collapsed 17.6%. The source states directly: 'this isn't a tight market.' Consistent with china_polymer_capacity's oversupply findings and both pp_resin_spot_price and abs_resin_spot_price's declines.",
    endpoint:  null,
  },

  trade_policy_pipeline: {
    label:     "Trade policy pipeline",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "Plastics Technology, plastics industry trade press, Federal Register (spot-checked, not live-tracked) — Federal Register document-count deliberately not used here",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Federal Register document-count was deliberately not tested here, based on a strong prior from china_steel_overcapacity_dumping: plastics/resin AD/CVD activity spans an even broader product category (PE, PP, ABS, nylon, PVC, PET all have their own ongoing proceedings) than steel did, likely producing the same high-volume, low-signal noise. Real severity confirmed directly instead: the Supreme Court invalidated most IEEPA-based emergency tariffs in Feb 2026, replaced by a Section 122 stop-gap (15%, capped at 150 days) — real, active legal uncertainty. Cumulative China duties on commodity polymers often exceed 47%. A real, current AD/CVD case (polyethylene retail bags from China, Aug 7 2026) carries a 77.57% cash deposit rate.",
    endpoint:  null,
  },

  // ── AUTOMOTIVE RESINS & PLASTICS — REGIME SIGNALS ─────────────────────────
  // freight_rates is REUSED directly from the semiconductor signal above,
  // not duplicated here.

  pp_resin_spot_price: {
    label:     "PP resin spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "PlasticsToday, ChemOrbis, IMARC — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: the 'buyer-favorable' market confirmed in July has reversed. As Brent crude re-escalated above $110/bbl by mid-September (see petrochemical_feedstock_risk), feedstock costs outran PP contract prices, pushing producer margins negative and prompting run-cut announcements. china_polymer_capacity's oversupply pressure hasn't disappeared, but it's now colliding with a renewed cost shock rather than easing prices further.",
    endpoint:  null,
  },

  abs_resin_spot_price: {
    label:     "ABS resin spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "ZiJunPlastics (real Chinese domestic pricing data) — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, current, well-quantified: Chinese domestic ABS prices fell 25-30% from their March 2026 high by late June 2026. Real, clean causal story confirmed directly: Q1 2026 saw a sharp geopolitical-premium spike (Middle East conflict, styrene/butadiene feedstock costs), followed by a genuine Q2 correction as that premium faded and seasonal demand softened. Same coherent pattern as PP: input-cost risk (petrochemical_feedstock_risk, still elevated) and current output pricing can genuinely diverge — oversupply is currently winning at the market-clearing price level.",
    endpoint:  null,
  },

  nylon_resin_spot_price: {
    label:     "Nylon resin spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "No direct current pricing data found — inferred from Celanese's own real capex trend, weaker evidence than PP/ABS",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Honest gap: unlike PP and ABS, no direct current nylon spot pricing data was found in this research pass. Used as a softer proxy instead: Celanese's own real capex fell 21.1% this year (confirmed in domestic_polymer_capacity) — Celanese owns the former DuPont Zytel automotive nylon business, so a real capex pullback there suggests some caution in that specific segment, though this is inferred, not directly evidenced the way PP and ABS are.",
    endpoint:  null,
  },

  // ── NATURAL RUBBER — FORWARD SIGNALS ──────────────────────────────────────
  // Built 2026-08-18. tire_manufacturer_demand is live; the rest are
  // explicit, labeled placeholders. Structurally different commodity —
  // agricultural, no large corporate producer anchor exists.

  tire_manufacturer_demand: {
    label:     "Tire manufacturer demand",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "SEC XBRL — Goodyear Tire & Rubber Co, real capex",
    cadence:   "Annual",
    latency:   "24–48hrs post filing",
    apiKey:    false,
    explainer: "Goodyear (CIK 0000042582, NYSE, decades of filing history) confirmed real, US-domestic 10-K filer using the exact same PaymentsToAcquirePropertyPlantAndEquipment tag proven for 11 other companies this project — the 12th confirmed reuse. A demand-side anchor, not a supply-side one, since no large corporate natural rubber producer exists to anchor a supply signal the way MP Materials or Celanese did.",
    endpoint:  `${API_BASE}/api/risk/signals/tire-manufacturer-demand`,
  },

  thai_indonesian_output: {
    label:     "Thai/Indonesian plantation output",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "TDD Global, Chemical Market Analytics — no corporate anchor exists (smallholder-farmer-dominated production), no reliable live feed",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, genuinely mixed picture across two timeframes: near-term 2026 forecasts show modest recovery (global production +2.2% YoY to 15.324M tons, Thailand +1.4%, Indonesia +0.8%), but the longer-term structural trend has been real decline — combined Thai/Indonesian output fell ~3% YoY in 2024, and Indonesia's production has fallen more than 35% since its 2012-2019 peak (from over 3M tons/yr), driven by prolonged low prices, reduced processing capacity, and tree disease. A real, confirmed 2026 supply-demand gap of ~0.4M metric tons exists (Mordor Intelligence).",
    endpoint:  null,
  },

  leaf_disease_risk: {
    label:     "Leaf disease risk",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "Market Research Thailand, real 2026 industry analysis — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, specific, named disease threat confirmed active in 2026: Lasiodiplodia theobromae leaf blight, explicitly cited as an active pressure in Thailand's northeastern plantation zones, contributing to a real, confirmed 2026 supply-demand gap (Mordor Intelligence estimates 0.4 million metric tons). Alongside limited replanting, weak smallholder productivity, and land-use shifts as compounding structural factors.",
    endpoint:  null,
  },

  synthetic_rubber_substitution: {
    label:     "Synthetic rubber substitution",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "Tat Win analysis, Top Glove/The Edge Malaysia, MARGMA — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, severe, and directly confirmed: the same March 2026 Hormuz Strait closure already found driving aluminum_spot_price and petrochemical_feedstock_risk cut off 70-80% of Asian petrochemical naphtha supply, causing NBR (synthetic rubber) latex prices to roughly double ($750 to $1,500/tonne). Real, confirmed substitution mechanism in action, not theoretical: 'the demand pull toward natural latex followed exactly as the history predicts.' Malaysia's glove manufacturers association (MARGMA) issued an urgent statement (Mar 26 2026) warning the NBR shortage was forcing factories below normal capacity. Expensive synthetic rubber pushes MORE demand onto natural rubber, representing real additional demand pressure, not a risk-free relief valve.",
    endpoint:  null,
  },

  china_rubber_stockpiling: {
    label:     "China rubber stockpiling",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "SCI99, China Rubber Industry Association, Business Recorder — real, current 2026 Qingdao commercial inventory data, no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Real, current, and more nuanced than a simple stockpiling narrative: Chinese commercial rubber inventories hit a record high of 371,100 tonnes in late April 2026, then began actively destocking — down to 341,900 tonnes by early July, with Qingdao Bonded Zone inventory specifically falling 19.02% in May alone. The stated real cause is credit-strapped tire makers reducing imports (a financial constraint), not acute physical scarcity — but the drawdown of a recently record-high buffer stock still matters for forward risk, since less shock-absorbing inventory now exists than a few months ago.",
    endpoint:  null,
  },

  weather_disruption_risk: {
    label:     "Weather disruption risk",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "TDD Global, European Rubber Journal, Khor Reports — real 2026 industry analysis; NOAA live integration tested and deferred (5 failed API attempts, real diagnostic dead end, not a data-availability problem)",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: the favorable May 2026 Thai rainfall has reversed — heavy monsoon flooding through September is now curbing tapping activity, realizing the structural vulnerability flagged (but not yet materialized) in the August review. This compounds with a new driver not previously captured: Ivory Coast port congestion adding further disruption to natural rubber logistics. Together these sit behind the confirmed move to a 254 cents/kg benchmark price on Sept 25 2026 — the highest since 2013.",
    endpoint:  null,
  },

  // ── NATURAL RUBBER — REGIME SIGNALS ───────────────────────────────────────
  // freight_rates is REUSED directly from the semiconductor signal above,
  // not duplicated here.

  rss3_spot_price: {
    label:     "RSS3 spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "TOCOM, SGX SICOM, World Bank — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: RSS3 has broken decisively out of the mid-range stability confirmed in August. TOCOM RSS3 hit 254 cents/kg on Sept 25 2026 — up 46.74% year-over-year and the highest level since 2013 — driven by the reversed Thai weather picture (weather_disruption_risk) and new Ivory Coast port congestion pressure, on top of the substitution dynamics already confirmed severe in synthetic_rubber_substitution.",
    endpoint:  null,
  },

  tsr20_spot_price: {
    label:     "TSR20 spot price",
    layer:     "regime",
    horizon:   "Current",
    source:    "SGX SICOM, Malaysian Rubber Board — no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: the +7% MoM move confirmed in July has continued to build, tracking the broader benchmark rubber price's climb to 254 cents/kg (Sept 25 2026) — the highest since 2013. The same substitution dynamic confirmed severe in synthetic_rubber_substitution remains the dominant driver, now compounded by the Ivory Coast port congestion and reversed Thai weather picture in weather_disruption_risk. TSR20 remains the preferred feedstock of the global tire industry (JPX), keeping this the most directly automotive-relevant price signal in this commodity.",
    endpoint:  null,
  },

  tire_grade_premium: {
    label:     "Tire-grade premium",
    layer:     "regime",
    horizon:   "Current",
    source:    "Inferred from the real RSS3/TSR20 divergence above — no dedicated live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Updated Sept 2026: not a direct measurement — inferred from the RSS3/TSR20 signals above. Both grades have moved sharply higher through September (the composite benchmark hit 254 cents/kg, +46.74% YoY, the highest since 2013), but TSR20 remains the more acutely pressured tire-preferred grade given its tie to the substitution dynamics in synthetic_rubber_substitution, so the premium is still assessed as widening rather than converging.",
    endpoint:  null,
  },

  // ── TUNGSTEN — FORWARD SIGNALS ─────────────────────────────────────────────
  // Built 2026-11-20. All analyst-reviewed. freight_rates is reused, not duplicated.

  china_tungsten_export_controls: {
    label:     "China tungsten export controls",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "MOFCOM announcements, China Customs via SMM; no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "China put APT and other tungsten products under export licensing in February 2025 and added a ban on dual-use tungsten exports to Japanese military end users in January 2026. Exports of smelted products and materials fell 14.4% year over year in January to May 2026, and SMM expects no near-term relaxation.",
    endpoint:  null,
  },

  china_mining_quota: {
    label:     "China mining quota",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "Ministry of Natural Resources quota notices, provincial allocations via SMM",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Tungsten is a protected strategic mineral with a two-batch annual mining quota. The first 2026 batch edged up nationally, but SMM judges actual output will hardly grow because compliant mines are near capacity and illegal and over-quota mining is being shut down. Guangdong's first batch fell 10.2%.",
    endpoint:  null,
  },

  non_china_supply_ramp: {
    label:     "Non-China supply ramp",
    layer:     "forward",
    horizon:   "12–24 months",
    source:    "Almonty Industries releases, Plansee announcements; scored as risk, so a faster ramp lowers it",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Relief is coming but slowly. Almonty began processing at Sangdong, South Korea in June 2026 at about 2,300 t/yr of concentrate, with phase two by 2027 doubling output to roughly 40% of demand outside China. Plansee plans about 12,000 t/yr of oxide capacity in Pennsylvania. Until those ramp, Western supply stays thin.",
    endpoint:  null,
  },

  dfars_compliance_deadline: {
    label:     "DFARS 2027 sourcing deadline",
    layer:     "forward",
    horizon:   "0–6 months",
    source:    "DFARS 252.225-7052, Federal Register, July 2026 executive order on defense supply chains",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "From January 1, 2027, tungsten for US defense work cannot be mined, refined or produced in China, Russia, North Korea or Iran, and waivers become much harder to get. That pulls compliant Western tungsten toward defense primes and leaves less for commercial and medical buyers sharing the same carbide supply chain.",
    endpoint:  null,
  },

  carbide_toolmaker_pricing: {
    label:     "Carbide toolmaker pricing",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "Kennametal and Sandvik earnings calls, Ceratizit via Cutting Tool Engineering",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Tool makers are passing tungsten costs straight through. Kennametal's fiscal 2026 outlook assumed about 16% from price and tariff surcharges, and it more than doubled inventory to $1.11 billion while making advance payments to secure raw material. Ceratizit points to insert increases of about 10% to 15%.",
    endpoint:  null,
  },

  china_concentrate_import_pull: {
    label:     "China concentrate import pull",
    layer:     "forward",
    horizon:   "6–12 months",
    source:    "China Customs via SMM",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "China now imports more raw tungsten than before and exports less value-added product. September 2026 concentrate imports were about 3,663 t, up 73% year over year, and China has been a net importer of tungsten metal through 2026. That competes directly with Western converters for concentrate from outside China.",
    endpoint:  null,
  },

  // ── TUNGSTEN — REGIME SIGNALS ──────────────────────────────────────────────

  western_apt_price: {
    label:     "Western APT price",
    layer:     "regime",
    horizon:   "Current",
    source:    "SMM European tungsten weekly; no reliable free live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Overseas APT is trading at historically extreme levels. SMM quoted $2,500 to $3,000/mtu (average $2,750) on November 12, 2026, with the top of the range edging lower week over week and long-term contracts still above $3,000/mtu.",
    endpoint:  null,
  },

  west_china_price_gap: {
    label:     "West vs China price gap",
    layer:     "regime",
    horizon:   "Current",
    source:    "Canadian Mining Journal report on Rotterdam vs China ex-works APT",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Rotterdam APT averaged $278/kg in October 2026 against $74/kg ex-works China, a ratio of 3.74 times. From September 2021 to June 2025 the ratio averaged 1.24. The market has split by compliance and processing capacity, so Western buyers pay a large premium for traceable tungsten.",
    endpoint:  null,
  },

  china_domestic_tungsten_price: {
    label:     "China domestic price",
    layer:     "regime",
    horizon:   "Current",
    source:    "SMM and long-term contract announcements by Chinese producers",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Chinese prices fell about 60% from their early-2026 peak by August, then turned up again. Long-term contract prices were raised for November, and SMM describes Chinese prices as rising steadily, which is pulling overseas ferrotungsten and scrap sentiment up with them.",
    endpoint:  null,
  },

  tungsten_scrap_market: {
    label:     "Tungsten scrap market",
    layer:     "regime",
    horizon:   "Current",
    source:    "SMM European tungsten weekly; US scrap allocation order",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Scrap is the West's main alternative feed, and it is being held at home. A US scrap allocation order from late August 2026 keeps tungsten scrap in the country for domestic and defense use. European scrap offers are steady at about EUR 70 to 85/kg, and sources say the Western bottleneck is conversion capacity, not scrap.",
    endpoint:  null,
  },

  // ── INDUSTRIAL GASES — built 2026-11-20, all analyst-reviewed; freight_rates reused ──

  helium_qatar_supply: {
    label:     "Qatar helium supply",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "gasworld, QatarEnergy statements, Wood Mackenzie; no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Qatar supplies about 30% of the world's helium as a by-product of LNG at Ras Laffan. Production stopped in March 2026 after Iranian strikes, and damage to two LNG trains cut Qatar's annual helium exports by about 14% for years. The Helium 2 plant partially restarted in June, but shipping limits and container availability still constrain exports.",
    endpoint:  null,
  },

  helium_export_restrictions: {
    label:     "Helium export restrictions",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "gasworld Helium Summit reporting; Russian and Chinese trade notices",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "The usual swing suppliers are holding helium at home. Russia requires special permission for helium exports outside the Eurasian Economic Union until the end of 2027, and China has a temporary helium export prohibition to preserve imported supply. That removes the relief valve that eased past shortages.",
    endpoint:  null,
  },

  asu_power_costs: {
    label:     "Air separation power costs",
    layer:     "forward",
    horizon:   "3–12 months",
    source:    "Linde, Reuters analysis of Energy Department data, S&P Global",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Electricity is the dominant cost of making argon, nitrogen and oxygen; Linde says energy can be 80% to 90% of an air separation unit's production cost. US industrial power prices rose 31% in Pennsylvania and 26% in Ohio in the year to December 2025, against 7% nationally, with data center load and higher gas prices since March 2026 adding pressure.",
    endpoint:  null,
  },

  argon_coproduct_supply: {
    label:     "Argon co-product supply",
    layer:     "forward",
    horizon:   "3–9 months",
    source:    "Industry market research published Nov 2026 (China ASU data); no reliable live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Argon is a trace gas recovered from air separation units built for oxygen and nitrogen, so producers cannot raise argon output on their own. When steel runs or refinery runs drop, argon supply drops with them. In China, ASU utilisation was 63.6% in mid-October 2026 and weekly liquid argon output was still falling.",
    endpoint:  null,
  },

  semiconductor_gas_demand: {
    label:     "Semiconductor gas demand",
    layer:     "forward",
    horizon:   "6–18 months",
    source:    "Linde Q3 2026 earnings call; industry analysis of argon use per wafer",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Chip fabs are the fastest-growing buyers of argon and helium, and advanced nodes use more gas per wafer. Linde is building electronics supply projects in the US, Korea and China. Fabs sign long contracts and pay up, which leaves less flexible volume for industrial and medical buyers.",
    endpoint:  null,
  },

  major_supplier_pricing: {
    label:     "Major supplier pricing",
    layer:     "forward",
    horizon:   "3–6 months",
    source:    "Linde Q3 2026 results; Air Products Q1 2026 results",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "The three majors control about 70% of industrial gas and are pushing price. Linde posted record Q3 2026 sales of $9.4 billion with 3% from price, and Air Products raised 2026 guidance citing helium price strength. Merchant customers on bulk and cylinder contracts absorb those increases first.",
    endpoint:  null,
  },

  helium_spot_price: {
    label:     "Helium price",
    layer:     "regime",
    horizon:   "Current",
    source:    "Caixin, EPRINC, Air Products commentary; no reliable free live feed exists",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Helium prices roughly doubled after the Strait of Hormuz closed in March 2026. Qatar's partial restart has eased the worst of it, but suppliers are still pricing customer by customer and no public benchmark shows a return to pre-crisis levels.",
    endpoint:  null,
  },

  argon_spot_price: {
    label:     "Argon price",
    layer:     "regime",
    horizon:   "Current",
    source:    "Industry market research published Nov 2026; Procurement Resource",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Argon has been the most volatile air gas in 2026. Chinese prices rose from about 720 yuan/t in early May to about 2,459 yuan/t by September 2, and East China reached about 3,057 yuan/t on October 20, up 49% in under two weeks. US CIF argon was about $762/t in April 2026.",
    endpoint:  null,
  },

  cryogenic_logistics: {
    label:     "Cryogenic logistics",
    layer:     "regime",
    horizon:   "Current",
    source:    "gasworld, Fortune/AP reporting on helium containers",
    cadence:   "Analyst review",
    latency:   "N/A — analyst-reviewed",
    apiKey:    false,
    explainer: "Liquid helium can only be held in an ISO container for about 35 to 48 days, so supply cannot be stockpiled and shipments depend on a limited fleet of cryogenic containers. Repositioning that fleet around closed routes is still holding back Qatari exports.",
    endpoint:  null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SIGNAL DATA
// Mirrors exact shape of real API responses.
// Values represent current real-world conditions as of May 2026.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_FORWARD_SIGNALS = {
  fab_capex_trajectory:          0.58, // TSMC Japan ramp positive but mature node capex flat
  // Updated 2026-08-15, analyst review — NOT live data. Original MLCC-
  // specific evidence (Murata/TDK/Samsung Electro-Mechanics) still
  // untestable (no reliable free source, confirmed via real
  // investigation). Score raised based on real, severe, multi-source
  // evidence of the SAME phenomenon in memory chips (DRAM/HBM) instead —
  // a genuine scope nuance, not the identical companies, but directly
  // on-point for what this signal measures: AI capacity reallocation
  // squeezing other customers. Confirmed via real research: Everstream
  // Analytics reports up to 70% of 2026 global memory output going to
  // AI data centers; Micron sold out 2026 AI memory contracts entirely
  // and can meet only ~2/3 of medium-term demand for some customers; SK
  // Hynix has warned the shortage may persist past 2030; DRAM spot
  // prices up ~700% YoY per a July 2026 Bloomberg report. Real,
  // named automotive executives (Honda, Yamaha) directly cited
  // production impact from this exact dynamic.
  capacity_allocation_mix_shift: 0.97, // Reviewed 2026-11-16, unchanged. Real, severe memory (DRAM/HBM) capacity reallocation to AI — see comment above for sourcing
  raw_material_supply_risk:      0.72, // Gallium/germanium suspension until Nov '26
  end_market_demand_divergence:  0.68, // Hyperscaler capex spiking vs flat auto production
  geopolitical_policy_pipeline:  0.71, // Taiwan #1 Beijing risk; Nov '26 expiry date-stamped
  equipment_order_book:          0.52, // ASML orders stable; not alarming but not expanding
};

export const MOCK_REGIME_SIGNALS = {
  spot_lead_times:       0.82, // High-cap MLCC >20wks; AEC-Q100 MCU 52+wks
  spot_prices:           0.65, // MLCC +10–20%; Taiyo Yuden +6–13% April '26
  distributor_inventory: 0.58, // Drawing down but not yet critically depleted
  freight_rates:         0.80, // Reviewed 2026-11-16: Drewry WCI early Nov ~$7,500 Shanghai-LA, above the Aug reading, easing week to week. Prior (2026-08-16): real Drewry WCI data shows rates 2.5-3.5x the old $2,500/FEU baseline, near a 2026 peak — stopped short of maximum given genuine, credible uncertainty (Freight Right, Aug 3 2026) about whether this specific spike holds or partially corrects
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SIGNAL DETAIL
// Contextual data rendered in SignalCard expanded view.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_SIGNAL_DETAIL = {
  fab_capex_trajectory: {
    value: "Expanding, leading edge only",
    trend: "rising (leading edge), flat (mature node)",
    keyFact: "TSMC reaffirmed 2026 capex at $60-64B on Oct 15, 2026 (raised in July from $52-56B) and said capex over the next three years will be significantly higher than the past three. The spend is 2nm and advanced packaging; mature-node (40-180nm) capacity used by automotive MCUs is not where the money is going.",
    lastUpdated: "Analyst review, Nov 2026 (TSMC Q3 2026 results)",
    dataPoint: "TSMC Q3 2026: revenue $46.7B (+41% YoY); 2026 capex $60-64B; 2026 growth guided to ~44%",
  },
  capacity_allocation_mix_shift: {
    value: "Severe divergence",
    trend: "deteriorating",
    keyFact: "Samsung, SK Hynix and Micron keep moving wafer capacity to HBM and AI server DRAM. SK Hynix is redirecting capacity toward custom memory built for Nvidia, and distributors report allocation risk on the legacy parts automotive still uses (LPDDR4, eMMC, DDR3). Arrow reported Q3 2026 component growth led by memory pricing.",
    lastUpdated: "Analyst review, Nov 2026 (memory evidence; original MLCC scope)",
    dataPoint: "Up to 70% of 2026 memory output to AI data centers (Everstream); legacy auto memory on allocation (Fusion Worldwide)",
  },
  raw_material_supply_risk: {
    value: "Elevated, dated trigger Nov 27",
    trend: "stable risk",
    keyFact: "China's pause on its US export ban for gallium, germanium and antimony expires Nov 27, 2026. MOFCOM's Nov 9 notice extended the pause on the wider October 2025 rare earth package to Jan 10, 2027, but did not cover gallium. Export licensing stays in force either way.",
    lastUpdated: "Analyst review, Nov 2026 (MOFCOM Nov 9 notice)",
    dataPoint: "Gallium/germanium/antimony pause expires Nov 27, 2026; no extension announced as of Nov 16",
  },
  end_market_demand_divergence: {
    value: "High divergence",
    trend: "deteriorating",
    keyFact: "AI demand keeps pulling foundry, memory and passive capacity: TSMC guides ~44% revenue growth for 2026 while auto production is roughly flat. Both compete for the same substrate, memory and high-capacitance MLCC supply.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "TSMC 2026 revenue growth ~44% (Oct 15 guidance) vs flat auto output",
  },
  geopolitical_policy_pipeline: {
    value: "Elevated",
    trend: "stable elevated",
    keyFact: "Beijing is sustaining gray-zone pressure without announced drills: Taiwan's defense ministry counted 49 PLA aircraft, six warships and six government vessels in 24 hours in early November around Taiwan's local elections. US-China trade policy runs on dated pauses (Nov 27 gallium, Jan 10 rare earths).",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "49 PLA aircraft in 24 hours (Taiwan MND, early Nov 2026); Nov 27 gallium pause expiry",
  },
  equipment_order_book: {
    value: "Strong (AI-led)",
    trend: "rising",
    keyFact: "ASML posted record Q3 2026 sales of EUR 11.7B at a 57.5% gross margin, shipped 17 EUV systems, and guides full-year sales to EUR 44-45B. The CEO says customers ask daily for more tools. Demand is concentrated in leading-edge logic and memory, not mature nodes.",
    lastUpdated: "Analyst review, Nov 2026 (ASML Q3 2026, Oct 14)",
    dataPoint: "ASML Q3 2026: EUR 11.7B sales, 17 EUV systems; FY2026 guide EUR 44-45B",
  },
  spot_lead_times: {
    value: "40-52 wks (select MCUs); 15-20 wks (high-cap MLCC)",
    trend: "deteriorating",
    keyFact: "Distributor surveys put select MCU and STMicroelectronics families at 40 to 52 weeks, with TI quotes stretching from 12-16 weeks toward six months. Standard MLCCs run 14-18 weeks; high-capacitance and high-voltage parts 15-20 weeks, and high-spec grades 5 to 10 months, with new capacity pushed into 2027.",
    lastUpdated: "Analyst review, Nov 2026 (Sourceability Q3, Fusion Worldwide Oct, ETNews via TrendForce)",
    dataPoint: "Select MCUs 40-52 wks; high-spec MLCC 5-10 months",
  },
  spot_prices: {
    value: "Broad MLCC price increases",
    trend: "deteriorating",
    keyFact: "Murata raised AI-server and high-end automotive MLCC prices 15-35% from Apr 1, 2026; Yageo raised some capacitor lines about 50% on Jul 1; Samsung Electro-Mechanics lifted its whole MLCC portfolio 30% from Aug 1; Taiyo Yuden's second increase took effect Sep 1. 1Q27 price talks open in November, with Japanese makers expected to follow.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "SEMCO +30% (Aug 1); Murata +15-35% (Apr 1); 1Q27 talks open Nov 2026",
  },
  distributor_inventory: {
    value: "Drawing down, backlog building",
    trend: "deteriorating",
    keyFact: "Avnet and Arrow both report book-to-bill above parity, with backlog growing as lead times extend. MLCC restocking is expected in November for Samsung Electro-Mechanics and December for Yageo, while one Murata product may not be replenished until January 2027.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Distributor book-to-bill above 1 (Avnet, Arrow, Nov 2026)",
  },
  freight_rates: {
    value: "~$7,500/FEU Shanghai-LA (Drewry WCI, early Nov 2026)",
    trend: "elevated, easing week to week",
    keyFact: "Drewry's WCI had Shanghai-Los Angeles at about $7,500 per 40ft and Shanghai-New York at about $9,300 in early November, roughly 3x the old $2,500 baseline and above the August reading. Rates eased slightly week to week. Watch two operational risks: LA/Long Beach terminal watchmen talks extended to Nov 20, and renewed attacks on shipping near the Strait of Hormuz.",
    lastUpdated: "Analyst review, Nov 2026 (Drewry WCI, not a live feed)",
    dataPoint: "Drewry WCI early Nov 2026: Shanghai-LA ~$7,539/FEU (flat), Shanghai-NY ~$9,303/FEU (-3% WoW)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// fetchSignals
// Returns mock or live signal data depending on USE_MOCK_DATA flag.
// Real endpoints return identical shape: { signals: { key: 0–1 float }, meta: {} }
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_LITHIUM_FORWARD_SIGNALS = {
  cell_capacity_allocation_nlp:  0.78, // Reviewed 2026-11-16: GM-LGES adding LFP lines at Spring Hill for late 2027; GM still booking EV realignment charges ($238M in Q3)
  lithium_futures_curve:         0.50, // Reviewed 2026-11-16: China carbonate futures soft in November on rising production and slower cathode scheduling
  china_refinery_concentration:  0.80, // Reviewed 2026-11-16: unchanged; no material shift in ex-China refining
  mining_production_guidance:    0.52,
  ev_production_forecast_delta:  0.75, // Reviewed 2026-11-16: US Q3 EV sales -38.6% YoY; share 6.5%, up from 5.8% in Q2
  battery_policy_pipeline:       0.63, // Updated 2026-09-30: OBBBA kept 45X intact but added new FEOC material-sourcing thresholds (60% non-FEOC in 2026 -> 85% by 2030) — new compliance risk layered on an intact credit
};

export const MOCK_LITHIUM_REGIME_SIGNALS = {
  lithium_carbonate_spot: 0.35, // Reviewed 2026-11-16: China carbonate below CNY 95,000/t, near a one-year low
  lithium_hydroxide_spot: 0.35, // Reviewed 2026-11-16: tracking carbonate lower
  cobalt_spot_price:      0.68, // Reviewed 2026-11-16: hydroxide price fell to ~$14.6/lb in October, but DRC quotas hold through 2027 and Glencore output -52%
  cell_lead_times:        0.35, // Not re-verified 2026-09-30 — could not confirm or contradict the 13.8% YoY install-growth figure or the LGES 46-series backlog in a fresh search; holding score
};

export const MOCK_LITHIUM_SIGNAL_DETAIL = {
  cell_capacity_allocation_nlp: {
    value: "Partner instability persists, slow re-tooling",
    trend: "stable, deteriorating at the margin",
    keyFact: "GM and LG Energy Solution plan lower-cost LFP lines at their Spring Hill, Tennessee JV from late 2027, while GM booked $238M of EV realignment charges in Q3 2026 and Ultium equity income was insignificant. Ford, Stellantis and Porsche pullbacks from prior reviews remain in effect. Capacity is being re-pointed, not expanded, so Tier 1 pack assemblers stay behind OEMs in allocation.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "GM Q3 2026: $238M EV realignment charges; Spring Hill LFP lines from late 2027",
    previousValue: 0.79,
    reviewedAt: "2026-11-16",
  },
  lithium_futures_curve: {
    value: "Softening, rangebound",
    trend: "easing",
    keyFact: "Chinese lithium carbonate futures traded soft through mid-November 2026: carbonate production scheduling rose while cathode scheduling slowed, and restart rumors weighed on prices. The shortage-premium structure flagged in September has faded for now.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Mysteel, Nov 9-11 2026: carbonate output rising, cathode scheduling slowing",
    previousValue: 0.58,
    reviewedAt: "2026-11-16",
  },
  china_refinery_concentration: {
    value: "Structural risk",
    trend: "stable risk",
    keyFact: "China still processes roughly 65% of global lithium into battery-grade chemicals, and no alternative refining capacity at scale arrives before 2028. Nothing in Q3-Q4 2026 changes that; it remains a binary policy risk rather than a price story.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China ~65% of battery-grade refining; next meaningful alternative 2028",
    previousValue: 0.8,
    reviewedAt: "2026-11-16",
  },
  mining_production_guidance: {
    value: "Stable / not expanding",
    trend: "flat",
    keyFact: "SQM (Chile) and Albemarle (US/Australia) both guiding flat-to-modest production growth for 2026. Low spot prices in 2024–2025 suppressed investment in new brine and spodumene capacity.",
    lastUpdated: "Q1 2026 20-F / 10-K",
    dataPoint: "SQM 2026 guidance: 180–200kt LCE · Albemarle: 'disciplined capital deployment'",
  },
  ev_production_forecast_delta: {
    value: "Demand reset, stabilizing at a lower level",
    trend: "deteriorating, early signs of a floor",
    keyFact: "US EV sales fell 38.6% year over year in Q3 2026 against the pre-credit-expiry rush, but share rose to 6.5% from 5.8% in Q2. Legacy OEMs took the hit (GM EVs -61.7%, Ford -80%) while Tesla held 54% of the market. Contracted cell capacity for legacy OEM programs keeps getting paused or renegotiated.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Q3 2026 US EV sales -38.6% YoY; share 6.5% (Cox/KBB)",
    previousValue: 0.75,
    reviewedAt: "2026-11-16",
  },
  battery_policy_pipeline: {
    value: "45X credit intact, new FEOC sourcing thresholds layered on",
    trend: "deteriorating — compliance risk added to an intact credit",
    keyFact: "UPDATED 2026-09-30 — the One Big Beautiful Bill Act (OBBBA) kept the Section 45X manufacturing credit intact, but added new Foreign Entity of Concern (FEOC) material-sourcing thresholds: cells must source at least 60% non-FEOC (i.e., non-Chinese-linked) critical minerals content starting in 2026, stepping up to 85% by 2030. Given China's dominance in lithium refining and cathode material, this converts a straightforward manufacturing subsidy into a compliance and supply-chain-documentation risk layered on top of the existing credit.",
    lastUpdated: "Analyst review, Sep 2026 — real legislative text (OBBBA), not a live feed",
    dataPoint: "IRA 45X: $35/kWh credit for US-manufactured cells, intact · New OBBBA FEOC threshold: 60% non-FEOC content (2026) rising to 85% (2030)",
    previousValue: 0.58,
    reviewedAt: "2026-09-30",
  },
  lithium_carbonate_spot: {
    value: "Near one-year low",
    trend: "easing",
    keyFact: "China lithium carbonate fell below CNY 95,000 per tonne in November 2026, the lowest in nearly a year, on softer demand and improving supply. Short rebounds have not held.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China Li2CO3 < CNY 95,000/t (Nov 2026)",
    previousValue: 0.4,
    reviewedAt: "2026-11-16",
  },
  lithium_hydroxide_spot: {
    value: "Easing with carbonate",
    trend: "easing",
    keyFact: "Hydroxide continues to track carbonate. With carbonate near a one-year low in November 2026 and no sign of a widening hydroxide premium, price risk is low; the exposure is concentration, not cost.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Tracks China carbonate (< CNY 95,000/t, Nov 2026)",
    previousValue: 0.38,
    reviewedAt: "2026-11-16",
  },
  cobalt_spot_price: {
    value: "Prices easing, supply capped",
    trend: "mixed: price down, supply structurally tight",
    keyFact: "Cobalt hydroxide prices slid from $22-23/lb in August to about $14.6/lb by October 1, 2026 on weak demand and the LFP shift. Supply is still capped: the DRC keeps its 87,000 t/yr export quota through 2027, and Glencore's cobalt output fell 52% in the first nine months as quotas pushed it to leave metal in solution.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Hydroxide ~$14.6/lb (Oct 1 2026); DRC quota 87,000 t/yr through 2027",
    previousValue: 0.75,
    reviewedAt: "2026-11-16",
  },
  cell_lead_times: {
    value: "Easing overall, tight in specific formats",
    trend: "improving broadly, with a real exception",
    keyFact: "REVISED 2026-08-16 — real evidence points toward genuine industry-wide easing, not the deteriorating trend previously assumed: 2026 EV battery installations grew just 13.8% YoY in the first four months, down sharply from a 30% surge in 2025 — explicitly described as 'structural moderation.' Confirmed via the same real events already driving other lithium signals: GM pausing Ultium production, Ford canceling its LGES deal, LGES's own 'stop building new capacity' guidance — all consistent with softening demand easing lead times generally. Honest exception, not a uniform picture: LG Energy Solution specifically reports a backlog exceeding 300 GWh for its 46-series large-format cylindrical cells — a real, specific format still running tight even as the broader market eases.",
    lastUpdated: "Analyst review, Aug 2026 — no reliable free live source exists (CATL, LG Energy Solution, and Panasonic all confirmed to have no SEC reporting obligation: LGES has no US listing of any kind, CATL has no US ADR, Panasonic voluntarily terminated its SEC reporting via Form 15F in 2016)",
    dataPoint: "EV battery installation growth: 30% (2025) -> 13.8% YoY (Jan-Apr 2026) · LGES 46-series backlog: 300+ GWh (real exception to the broader easing trend)",
    previousValue: 0.62,
    reviewedAt: "2026-09-30",
  },
};

// ── Rare Earth Metals ────────────────────────────────────────────────────────
// Built 2026-08-16. Only non_china_ree_capacity has a real live source
// (MP Materials, SEC XBRL). Everything else below is a reasoned,
// explicitly-labeled placeholder — MODERATE (0.5) rather than an
// arbitrary specific number, since these genuinely haven't been
// researched yet and a fake-precise value would be more misleading than
// an honest "haven't looked" placeholder. No LIVE or ANALYST EST. badge
// will show for these — that's correct, not a bug, until each one gets
// properly built or reviewed the same way every other signal in this
// codebase was tonight.
export const MOCK_RARE_EARTH_FORWARD_SIGNALS = {
  non_china_ree_capacity:       0.55, // Overridden by the real live fetch when it succeeds — this mock value only shows if that fetch fails
  china_ree_export_policy:      0.42, // Overridden by the real live fetch when it succeeds — matches the real-tested count of 2 documents in a 90-day window
  defense_demand_signal:        0.51, // Overridden by the real live fetch when it succeeds — matches the real-tested USASpending score (24.5 months since last confirmed contract)
  magnet_capacity_allocation:   0.62, // Reviewed 2026-11-16: MP's 10X plant is fully contracted and RFQs exceed its capacity
  china_refining_concentration: 0.88, // Reviewed 2026-11-16: unchanged; MOFCOM Nov 9 pause extension keeps licensing in force
  ev_wind_demand_divergence:    0.57, // Overridden by the real live fetch when it succeeds — matches the real-tested +37.0% YoY GE Vernova backlog growth
};

export const MOCK_RARE_EARTH_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — fetchRegimeSignals below reads
  // it directly from MOCK_REGIME_SIGNALS instead, same live data as the
  // semiconductor regime signal.
  ndpr_oxide_spot_price: 0.38, // Reviewed 2026-11-16: NdPr easing in China; ex-China NdPr roughly balanced near $110/kg
  heavy_ree_spot_price:  0.88, // Reviewed 2026-11-16: ex-China dysprosium now ~16x China price (BMI, Q3)
  magnet_lead_times:     0.75, // Reviewed 2026-11-16: unchanged; GM shipments start Q4, 10X not until late 2028
};

export const MOCK_RARE_EARTH_SIGNAL_DETAIL = {
  non_china_ree_capacity: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live MP Materials fetch fails. Confirmed real (2026-08-16): FY2025 capex was $172.4M, down 7.5% from FY2024's $186.4M — but real Q2 2026 earnings show capex of $230.3M in a single quarter, with full-year 2026 guidance of $500-600M, driven by the DoD's $400M equity investment and the new 10X magnetics facility. The annual XBRL data lags this real acceleration.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See /api/risk/signals/non-china-ree-capacity for real, current figures",
  },
  china_ree_export_policy: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live Federal Register fetch fails. UPDATED 2026-09-30: the Nov 10, 2026 suspension deadline tracked in the prior review has been EXTENDED to Jan 10, 2027, following a Trump-Xi summit at the White House on Sep 24, 2026. This doesn't mean the policy risk resolved — China separately launched a broader round of export controls in September that cut rare earth exports roughly 31% month-over-month, and its June 22, 2026 blacklisting of MP Materials (this platform's own live signal anchor company) and USA Rare Earths remains in effect. Real US regulatory response found via Federal Register: a Presidential Determination invoking the Defense Production Act for critical minerals/rare-earth magnet recovery, published Aug 4, 2026.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current Federal Register match count and most recent document · Truce extended to Jan 10, 2027 (Sep 24, 2026 summit); Sep export controls cut REE exports ~31% MoM",
    previousValue: 0.42,
    reviewedAt: "2026-09-30",
  },
  defense_demand_signal: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if both live sources fail. Real, confirmed 2026-08-16: MP Materials' subsidiary (MP Mine Operations LLC) has a real, dated $10.99M DoD contract for neodymium/praseodymium oxide (July 2024) plus an earlier $2.36M lanthanum storage contract (2023) — real procurement, not the headline deal. The $400M equity investment (~15% DoD stake, 7% PIK dividend, price floors, 10-year magnet offtake) flows through DPA Title III Section 303 — deliberately exempt from normal contracting, confirmed via MP's own SEC filings, so it won't show up as a 'contract' here.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current contract recency and Federal Register match data",
  },
  magnet_capacity_allocation: {
    value: "Ex-China capacity spoken for",
    trend: "tightening",
    keyFact: "MP Materials says its 10X magnet plant, commissioning late 2028, is already fully contracted and customer RFQs exceed its capacity. GM qualification is done and paid magnet shipments start in Q4 2026, building slowly. Commercial buyers without a contract should expect to wait.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "MP Q3 2026: 10X fully contracted; GM magnet shipments begin Q4 2026",
    previousValue: 0.55,
    reviewedAt: "2026-11-16",
  },
  china_refining_concentration: {
    value: "Structural risk",
    trend: "stable risk",
    keyFact: "China still controls about 90% of rare earth refining and over 90% of the 250,000 t/yr NdFeB magnet market. MOFCOM's Nov 9 notice paused the wider October 2025 package to January 10, 2027, but April 2025 licensing on seven elements stays in force.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China ~90% of refining; pause on Oct 2025 package to Jan 10, 2027",
    previousValue: 0.88,
    reviewedAt: "2026-11-16",
  },
  ev_wind_demand_divergence: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live GE Vernova fetch fails. Real, confirmed 2026-08-16: GE Vernova's total company order backlog reached $176.3B as of Q2 2026, up 37.0% from $128.7B the same quarter a year earlier — genuinely accelerating versus the full-year FY2024-to-FY2025 comparison (+26.2%). This is total company backlog (Power + Wind + Electrification combined), not isolated to the Wind segment specifically.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current backlog figures and YoY comparison",
  },
  ndpr_oxide_spot_price: {
    value: "Easing",
    trend: "easing",
    keyFact: "NdPr oxide prices declined in China into early November 2026, and SMM describes a Pr-Nd price decline underway. Outside China, Platts had NdPr at $110/kg CIF North America in August, with the market seen as roughly balanced.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Platts NdPr $110/kg CIF N. America (Aug); China NdPr down (Nov 3)",
    previousValue: 0.4,
    reviewedAt: "2026-11-16",
  },
  heavy_ree_spot_price: {
    value: "Extreme ex-China premium",
    trend: "deteriorating",
    keyFact: "Heavy rare earth prices outside China kept rising: BMI puts CIF Europe dysprosium oxide at about 16.3 times the China DDP price at the end of Q3 2026, up from 6.8 times in Q2, averaging about $3,500/kg in September. Western buyers face premiums of up to 10x domestic Chinese rates.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Dy oxide CIF Europe ~$3,500/kg (Sep); ~16x China price (BMI Q3 2026)",
    previousValue: 0.85,
    reviewedAt: "2026-11-16",
  },
  magnet_lead_times: {
    value: "Capacity scarcity",
    trend: "stable tight",
    keyFact: "No new ex-China magnet capacity of scale lands soon: MP's Independence plant starts paid GM shipments in Q4 2026 at modest volumes, and 10X commissions in late 2028. MP's heavy rare earth (Dy/Tb) production also starts in Q4 2026.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "MP Independence: GM shipments Q4 2026; 10X commissioning late 2028",
    previousValue: 0.75,
    reviewedAt: "2026-11-16",
  },
};

// ── Steel & Aluminum ──────────────────────────────────────────────────────────
// Built 2026-08-17. Full scaffolding built proactively before any
// individual signal — Rare Earth Metals needed a follow-up fix to become
// clickable, so this time the structure comes first. Nothing live yet.
export const MOCK_STEEL_ALUMINUM_FORWARD_SIGNALS = {
  section_232_tariff_pipeline:      0.66, // Overridden by the real live fetch when it succeeds — matches the real-tested count of 6 documents in a 90-day window
  domestic_capacity_expansion:      0.50, // Overridden by the real live fetch when it succeeds — matches the real-tested combined +3.0% YoY (Nucor +7.8%, Cleveland-Cliffs -19.3%)
  china_steel_overcapacity_dumping: 0.85, // Reviewed 2026-11-16: unchanged; China HRC export ~$485/t FOB vs US $1,300+
  automotive_sheet_demand:          0.45, // Reviewed 2026-11-16: unchanged; US auto output flat
  scrap_eaf_dynamics:               0.55, // Reviewed 2026-11-16: AISI utilization 77.0% (wk to Nov 7), down from 88.9% the week before
  aluminum_capacity_signal:         0.50, // Overridden by the real live fetch when it succeeds
};

export const MOCK_STEEL_ALUMINUM_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — fetchRegimeSignals below reads
  // it directly from MOCK_REGIME_SIGNALS instead, same live data as the
  // semiconductor regime signal.
  hrc_spot_price:      0.80, // Reviewed 2026-11-16: US HRC $1,340-1,400/st (Nov 6); Nucor raised CSP 17 weeks running
  aluminum_spot_price: 0.70, // Reviewed 2026-11-16: LME cash ~$3,160/t (Nov 5), off the September highs
  import_penetration:  0.50, // Reviewed 2026-11-16: flat-rolled imports rising again into Q4
};

export const MOCK_STEEL_ALUMINUM_SIGNAL_DETAIL = {
  section_232_tariff_pipeline: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live Federal Register fetch fails. Real context confirmed 2026-08-17: Section 232 steel/aluminum tariff policy has been genuinely active — a real proclamation on June 1, 2026 further adjusted tariff regimes on aluminum, steel, and copper (effective June 8, 2026 through Dec 31, 2027), and Commerce opened a real public comment period on August 6, 2026 for additional derivative product coverage.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current Federal Register match count and most recent document",
  },
  domestic_capacity_expansion: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live fetch fails. Real, confirmed 2026-08-17: combined Nucor + Cleveland-Cliffs FY2025 capex is roughly flat YoY overall (+3.0%), but that blends two very different real stories — Nucor's own capex grew +7.8% ($3.17B to $3.42B), while Cleveland-Cliffs' fell -19.3% ($695M to $561M). Nucor (scrap/EAF-based) is investing more; Cleveland-Cliffs (more vertically integrated, blast-furnace-oriented) pulled back meaningfully.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current capex figures and the Nucor/Cleveland-Cliffs split",
  },
  china_steel_overcapacity_dumping: {
    value: "Severe price gap",
    trend: "stable severe",
    keyFact: "China HRC export offers were about $485/t FOB in mid-November 2026, against US domestic HRC above $1,300 per short ton. That gap keeps trade-defense pressure high in the US and EU.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China HRC export $485/t FOB (Nov 11, Mysteel)",
    previousValue: 0.85,
    reviewedAt: "2026-11-16",
  },
  automotive_sheet_demand: {
    value: "Stable",
    trend: "flat",
    keyFact: "US light vehicle production remains roughly flat for 2026. Sheet demand isn't the problem; price is.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "US auto output ~flat 2026",
    previousValue: 0.45,
    reviewedAt: "2026-11-16",
  },
  scrap_eaf_dynamics: {
    value: "Volatile utilization",
    trend: "mixed",
    keyFact: "US raw steel capacity utilization swung from 88.9% in the week to Oct 31 to 77.0% in the week to Nov 7, 2026 (AISI), with year-to-date utilization at 79.5% and output up about 6%. Scrap and EAF economics stay supportive of the high HRC price.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "AISI utilization 77.0% (wk to Nov 7 2026); YTD 79.5%",
    previousValue: 0.55,
    reviewedAt: "2026-11-16",
  },
  aluminum_capacity_signal: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live fetch fails. Confirmed real (2026-08-17): both Alcoa (CIK 0001675149) and Century Aluminum (CIK 0000949157) are genuine US-domestic 10-K filers using the exact same PaymentsToAcquirePropertyPlantAndEquipment tag already proven for 9 other companies tonight. INVERTED scoring, same as domestic_capacity_expansion: growing capex means de-risking from import dependency — Section 232's original 2018 investigation found aluminum imports accounted for ~90% of certain primary aluminum products.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current capex figures and the Alcoa/Century Aluminum split",
  },
  hrc_spot_price: {
    value: "Multi-year high",
    trend: "deteriorating",
    keyFact: "US hot-rolled coil reached $1,340-1,400 per short ton on November 6, 2026 (Kallanish), up about 52% year over year, after a shortage of spot flat-rolled offers in October. Nucor has raised its consumer spot price 17 weeks in a row, to $1,295/st on Nov 9, with lead times of three to five weeks.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "US HRC $1,340-1,400/st (Nov 6, Kallanish); Nucor CSP $1,295/st",
    previousValue: 0.72,
    reviewedAt: "2026-11-16",
  },
  aluminum_spot_price: {
    value: "Elevated, off the peak",
    trend: "easing slightly",
    keyFact: "LME aluminium cash was about $3,160/t on November 5, 2026 and three-month about $3,064/t, below the $3,267-3,310 levels of September. China's aluminium exports rose to 5.91 Mt in the first ten months. US buyers still pay the tariff-driven Midwest premium on top.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "LME cash $3,160/t (Nov 5 2026); 3M $3,064/t (Nov 6)",
    previousValue: 0.74,
    reviewedAt: "2026-11-16",
  },
  import_penetration: {
    value: "Rising from a low base",
    trend: "tightening",
    keyFact: "After H1 2026 steel imports fell 23% year over year, flat-rolled imports posted big gains in the autumn as US prices pulled in offshore supply. The import gap is widening again alongside the domestic price.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "US flat steel imports rising (SteelOrbis, Oct 2026)",
    previousValue: 0.46,
    reviewedAt: "2026-11-16",
  },
};

// ── Automotive Resins & Plastics ──────────────────────────────────────────────
// Built 2026-08-18. domestic_polymer_capacity is live; everything else is
// an explicit, labeled placeholder.
export const MOCK_RESINS_FORWARD_SIGNALS = {
  domestic_polymer_capacity:    0.50, // Overridden by the real live fetch when it succeeds
  petrochemical_feedstock_risk: 0.72, // Reviewed 2026-11-16: Brent fell to ~$92.6 (Nov 9), lowest since late August, as Gulf exports recover
  automotive_resin_demand:      0.48, // Reviewed 2026-11-16: unchanged; flat auto output
  china_polymer_capacity:       0.86, // Reviewed 2026-11-16: unchanged; global oversupply persists
  resin_allocation_squeeze:     0.25, // Reviewed 2026-11-16: buyer's market into 2027 contracts
  trade_policy_pipeline:        0.62, // Updated 2026-09-30: Section 122 (the 15%, 150-day stop-gap) expired July 24, 2026, replaced by a more durable Section 301-based tariff band around 12.5% — less acute legal uncertainty than the expiring stop-gap, though the underlying duty burden persists
};

export const MOCK_RESINS_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — reused directly from
  // MOCK_REGIME_SIGNALS, same real live/analyst-reviewed data.
  pp_resin_spot_price:    0.45, // Reviewed 2026-11-16: North American PP flat-to-down for Nov-Dec; Europe at 2020 lows
  abs_resin_spot_price:   0.52, // Reviewed 2026-11-16: European standard thermoplastics still rising in November on styrene and butadiene costs
  nylon_resin_spot_price: 0.58, // Reviewed 2026-11-16: nylon 6/66 pricing trending up into Q4
};

export const MOCK_RESINS_SIGNAL_DETAIL = {
  domestic_polymer_capacity: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live fetch fails. Confirmed real (2026-08-18): both Celanese (CIK 0001306830) and Eastman Chemical (CIK 0000915389) are genuine US-domestic 10-K filers using the exact same PaymentsToAcquirePropertyPlantAndEquipment tag proven for 11 other companies this project. INVERTED scoring, same as domestic_capacity_expansion: growing capex means de-risking from import dependency. Trinseo confirmed real and domestic too, but doesn't use the standard capex tag — honestly excluded, not forced.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current capex figures and the Celanese/Eastman split",
  },
  petrochemical_feedstock_risk: {
    value: "Elevated but easing",
    trend: "easing",
    keyFact: "Brent dropped to $92.57/bbl on November 9, 2026, its lowest since late August, after a 16% weekly fall as Gulf exports recovered and Iran peace prospects improved. EIA still sees Brent near $100 for the rest of 2026, easing to $77 by late 2027. Shipping attacks near Hormuz keep the risk from fading fully.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Brent $92.57/bbl (Nov 9 2026); EIA ~$100 for rest of 2026",
    previousValue: 0.88,
    reviewedAt: "2026-11-16",
  },
  automotive_resin_demand: {
    value: "Stable",
    trend: "flat",
    keyFact: "US auto production is roughly flat for 2026, so resin demand from automotive is steady. Processors head into 2027 contract talks in a buyer's market.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "US auto output ~flat 2026",
    previousValue: 0.48,
    reviewedAt: "2026-11-16",
  },
  china_polymer_capacity: {
    value: "Severe oversupply",
    trend: "stable severe",
    keyFact: "Chinese polymer capacity additions keep global PP and PE in surplus; European PP and PE hit their lowest prices since 2020 for most grades heading into November 2026. Oversupply is a margin risk for producers, not a supply risk for buyers.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "EU PP/PE at lowest since 2020 (ChemOrbis, Nov 2026)",
    previousValue: 0.86,
    reviewedAt: "2026-11-16",
  },
  resin_allocation_squeeze: {
    value: "No allocation pressure",
    trend: "easing",
    keyFact: "Plenty of resin supply and supplier competition make this a buyer's market heading into 2027 contract negotiations. No allocation pressure on volume resins.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Buyer's market into 2027 talks (Resin Technology Inc.)",
    previousValue: 0.3,
    reviewedAt: "2026-11-16",
  },
  trade_policy_pipeline: {
    value: "Legal uncertainty resolved into a durable (if lower) tariff band",
    trend: "settling — less acute, duty burden persists",
    keyFact: "UPDATED 2026-09-30: the Section 122 stop-gap tariff (15%, capped at 150 days) that created genuine legal uncertainty in the prior review EXPIRED July 24, 2026. It has been replaced by a more durable tariff structure built on Section 301, landing around a 12.5% band — lower than the expiring stop-gap and resolving some of the uncertainty, though cumulative duties on Chinese commodity polymers remain elevated. The Aug 7, 2026 AD/CVD case on polyethylene retail bags (77.57% cash deposit rate) and the EU's July 2026 duty elimination on US-origin plastics both remain in effect.",
    lastUpdated: "Analyst review, Sep 2026 — real Plastics Technology/trade press data, Federal Register document-count deliberately not used (same high-volume noise problem expected as china_steel_overcapacity_dumping)",
    dataPoint: "Section 122 stop-gap (15%, 150-day cap): expired Jul 24, 2026 · Replacement Section 301-based band: ~12.5% · AD case cash deposit rate: 77.57% (PE retail bags, Aug 2026)",
    previousValue: 0.72,
    reviewedAt: "2026-09-30",
  },
  pp_resin_spot_price: {
    value: "Flat-to-down",
    trend: "easing",
    keyFact: "Resin Technology consultants expect North American PP prices flat to down for the rest of 2026, with plenty of supply and supplier competition. Europe's PP is at its lowest since 2020.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "PP flat-to-down Nov-Dec 2026 (Plastics Technology)",
    previousValue: 0.62,
    reviewedAt: "2026-11-16",
  },
  abs_resin_spot_price: {
    value: "Firming on feedstock costs",
    trend: "tightening slightly",
    keyFact: "European standard thermoplastic quotations, including ABS, kept rising in November 2026 as styrene, benzene and butadiene contract prices rose. High prices are deterring processors from waiting for December discounts.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "PIE Nov 13 2026: standard thermoplastics quotations continue to rise",
    previousValue: 0.48,
    reviewedAt: "2026-11-16",
  },
  nylon_resin_spot_price: {
    value: "Firming",
    trend: "tightening slightly",
    keyFact: "Plastics Technology's October 2026 outlook flagged upward pricing for nylon 6/66 while volume resins stayed flat-to-down. Celanese's capex pullback limits new engineering resin capacity.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Nylon 6/66 prices up (Plastics Technology, Oct 2026)",
    previousValue: 0.55,
    reviewedAt: "2026-11-16",
  },
};

// ── Natural Rubber ─────────────────────────────────────────────────────────────
// Built 2026-08-18. tire_manufacturer_demand is live; everything else is
// an explicit, labeled placeholder.
export const MOCK_RUBBER_FORWARD_SIGNALS = {
  tire_manufacturer_demand:      0.50, // Overridden by the real live fetch when it succeeds
  thai_indonesian_output:        0.72, // Reviewed 2026-11-16: Thai exports -10% YoY Jan-Aug
  leaf_disease_risk:             0.62, // Updated 2026-09-30: yield losses confirmed running as high as 30-35% in some affected areas — worse than the general pressure described in the prior review
  synthetic_rubber_substitution: 0.40, // Reviewed 2026-11-16: crude's November fall cheapens synthetic rubber, easing NR pressure
  china_rubber_stockpiling:      0.72, // Reviewed 2026-11-16: China September imports 588 kt, -20.8% YoY
  weather_disruption_risk:       0.70, // Reviewed 2026-11-16: Thai flooding through mid-October; El Nino a Q4 variable
};

export const MOCK_RUBBER_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — reused directly from
  // MOCK_REGIME_SIGNALS, same real live/analyst-reviewed data.
  rss3_spot_price:    0.78, // Reviewed 2026-11-16: pulled back from multi-year highs in mid-October
  tsr20_spot_price:   0.78, // Reviewed 2026-11-16: easing with RSS3 from October highs
  tire_grade_premium: 0.75, // Reviewed 2026-11-16: unchanged
};

export const MOCK_RUBBER_SIGNAL_DETAIL = {
  tire_manufacturer_demand: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live fetch fails. Confirmed real (2026-08-18): Goodyear Tire & Rubber Co (CIK 0000042582) is a genuine US-domestic 10-K filer using the exact same PaymentsToAcquirePropertyPlantAndEquipment tag proven for 11 other companies this project. A demand-side anchor, not supply-side — no large corporate natural rubber producer exists to anchor a supply signal.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current Goodyear capex figures",
  },
  thai_indonesian_output: {
    value: "Constrained",
    trend: "stable tight",
    keyFact: "Thailand's natural rubber exports fell 10% year over year to 1.62 Mt in the first eight months of 2026, and Indonesian exports remain weak. Supply recovery has not materialized.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Thai NR exports 1.62 Mt Jan-Aug 2026 (-10% YoY)",
    previousValue: 0.72,
    reviewedAt: "2026-11-16",
  },
  leaf_disease_risk: {
    value: "Active disease pressure, confirmed yield losses up to 30-35%",
    trend: "worsening — more severe than the prior general assessment",
    keyFact: "UPDATED 2026-09-30: beyond the general disease pressure confirmed in the prior review (Lasiodiplodia theobromae leaf blight in Thailand's northeastern zones), yield losses in some affected areas are now confirmed running as high as 30-35% — a specific, severe magnitude that wasn't quantified before. This compounds the real, confirmed 2026 supply-demand gap already estimated at roughly 0.4 million metric tons (Mordor Intelligence).",
    lastUpdated: "Analyst review, Sep 2026 — real Market Research Thailand/Mordor Intelligence/Expert Market Research data, no reliable live feed exists",
    dataPoint: "Confirmed active disease: Lasiodiplodia theobromae leaf blight (Thailand NE zones) · Yield losses in affected areas: up to 30-35% · Real 2026 supply-demand gap: ~0.4M metric tons (Mordor Intelligence)",
    previousValue: 0.58,
    reviewedAt: "2026-09-30",
  },
  synthetic_rubber_substitution: {
    value: "More substitution room",
    trend: "easing",
    keyFact: "With Brent down to about $93 in early November 2026, butadiene-based synthetic rubber gets relatively cheaper, giving tire makers more room to substitute away from tight natural rubber.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Brent ~$93/bbl (Nov 9 2026)",
    previousValue: 0.45,
    reviewedAt: "2026-11-16",
  },
  china_rubber_stockpiling: {
    value: "Imports falling",
    trend: "tightening",
    keyFact: "China's natural rubber imports fell 20.8% year over year to 588,000 t in September 2026, after a six-year low for August. Qingdao spot pulled back from multi-year highs in mid-October on weak tire demand, but stocks are being drawn rather than built.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China Sep 2026 NR imports 588 kt (-20.8% YoY)",
    previousValue: 0.7,
    reviewedAt: "2026-11-16",
  },
  weather_disruption_risk: {
    value: "Elevated",
    trend: "stable elevated",
    keyFact: "Heavy rain and flooding in Thailand disrupted tapping and some auto parts suppliers into mid-October 2026, and analysts flag El Nino as a key Q4 variable for Southeast Asian output.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Thai flooding into mid-Oct 2026; El Nino watch for Q4",
    previousValue: 0.72,
    reviewedAt: "2026-11-16",
  },
  rss3_spot_price: {
    value: "High, off the peak",
    trend: "easing slightly",
    keyFact: "Natural rubber hit multi-year highs in early October 2026 (SMR 20 at its highest since 2012 on Oct 12) before Qingdao spot fell CNY 450-600/t on Oct 15 on weak Chinese tire demand. Thai smoked sheet steadied near THB 90.50/kg. Prices remain far above a year ago.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "SMR 20 highest since 2012 (Oct 12 2026); Thai RSS ~THB 90.50/kg (Oct 14)",
    previousValue: 0.8,
    reviewedAt: "2026-11-16",
  },
  tsr20_spot_price: {
    value: "High, off the peak",
    trend: "easing slightly",
    keyFact: "Block rubber grades used by tire compounders followed the market off its October 2026 multi-year highs, but supply stays tight with Thai exports down 10% and Chinese imports falling.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Off Oct 2026 multi-year highs; Thai exports -10% YoY",
    previousValue: 0.82,
    reviewedAt: "2026-11-16",
  },
  tire_grade_premium: {
    value: "Persistent premium",
    trend: "stable",
    keyFact: "Both grades eased from October highs together, so the tire-grade premium is roughly unchanged. TSR20 remains the more acutely pressured grade for tire makers.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Premium roughly unchanged (Oct-Nov 2026)",
    previousValue: 0.75,
    reviewedAt: "2026-11-16",
  },
};

// ── Tungsten & Carbide ─────────────────────────────────────────────────────────
// Built 2026-11-20. Every signal is a dated, sourced analyst review.
export const MOCK_TUNGSTEN_FORWARD_SIGNALS = {
  china_tungsten_export_controls: 0.85, // Reviewed 2026-11-20: Feb 2025 licensing plus Jan 2026 Japan dual-use ban; exports -14.4% YoY Jan-May 2026
  china_mining_quota:             0.70, // Reviewed 2026-11-20: first 2026 batch edged up but output flat; Guangdong -10.2%
  non_china_supply_ramp:          0.60, // Reviewed 2026-11-20: Sangdong processing since Jun 2026, phase two 2027
  dfars_compliance_deadline:      0.85, // Reviewed 2026-11-20: DFARS mine-level restriction and waiver limits from Jan 1 2027
  carbide_toolmaker_pricing:      0.75, // Reviewed 2026-11-20: Kennametal ~16% price and surcharges; Ceratizit inserts +10-15%
  china_concentrate_import_pull:  0.65, // Reviewed 2026-11-20: Sep 2026 concentrate imports 3,663 t, +73% YoY
};

export const MOCK_TUNGSTEN_REGIME_SIGNALS = {
  // freight_rates is reused from MOCK_REGIME_SIGNALS, not duplicated.
  western_apt_price:             0.90, // Reviewed 2026-11-20: overseas APT $2,500-3,000/mtu (Nov 12 2026)
  west_china_price_gap:          0.92, // Reviewed 2026-11-20: Rotterdam 3.74x China ex-works (Oct 2026) vs 1.24x historic
  china_domestic_tungsten_price: 0.62, // Reviewed 2026-11-20: ~60% off early-2026 peak, rising again in November
  tungsten_scrap_market:         0.65, // Reviewed 2026-11-20: EU scrap steady; US scrap allocation order since late Aug 2026
};

export const MOCK_TUNGSTEN_SIGNAL_DETAIL = {
  china_tungsten_export_controls: {
    value: "Tight, no relaxation expected",
    trend: "stable tight",
    keyFact: "Export licensing on APT and other tungsten products since February 2025, plus a January 2026 ban on dual-use exports to Japanese military end users. Exports of smelted products and materials fell 14.4% YoY in January to May 2026.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China tungsten product exports -14.4% YoY (Jan-May 2026)",
    previousValue: 0.85,
    reviewedAt: "2026-11-20",
  },
  china_mining_quota: {
    value: "Flat output despite a small quota rise",
    trend: "stable tight",
    keyFact: "The first 2026 quota batch edged up, but compliant mines are near capacity and illegal mining is being closed, so SMM expects actual concentrate output to hardly grow. Guangdong's first batch was 2,110 t, down 10.2%.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Guangdong first-batch quota 2,110 t (-10.2%)",
    previousValue: 0.70,
    reviewedAt: "2026-11-20",
  },
  non_china_supply_ramp: {
    value: "Ramping, not yet enough",
    trend: "improving slowly",
    keyFact: "Almonty's Sangdong mine began processing in June 2026 at about 2,300 t/yr of concentrate. Phase two by 2027 targets about 4,600 t/yr, roughly 40% of demand outside China.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Sangdong ~2,300 t/yr now, ~4,600 t/yr by 2027",
    previousValue: 0.60,
    reviewedAt: "2026-11-20",
  },
  dfars_compliance_deadline: {
    value: "Six weeks out",
    trend: "tightening",
    keyFact: "From January 1, 2027, DFARS 252.225-7052 covers tungsten mined or produced in China, Russia, North Korea or Iran, and a July 2026 executive order limits waivers. Compliant supply will be pulled toward defense programs.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Effective January 1, 2027",
    previousValue: 0.85,
    reviewedAt: "2026-11-20",
  },
  carbide_toolmaker_pricing: {
    value: "Full pass-through",
    trend: "elevated",
    keyFact: "Kennametal's fiscal 2026 outlook assumed about 16% from net price and tariff surcharges, and its inventory more than doubled to $1.11 billion as it prepaid suppliers to secure tungsten. Ceratizit cites insert increases of about 10% to 15%.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Kennametal inventory $1.11B (FY2026), ~16% price and surcharges",
    previousValue: 0.75,
    reviewedAt: "2026-11-20",
  },
  china_concentrate_import_pull: {
    value: "China buying abroad",
    trend: "rising",
    keyFact: "China imported about 3,663 t of tungsten concentrate in September 2026, up 73% YoY, and has been a net importer of tungsten metal through 2026, competing with Western converters for ex-China concentrate.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Sep 2026 concentrate imports 3,663 t (+73% YoY)",
    previousValue: 0.65,
    reviewedAt: "2026-11-20",
  },
  western_apt_price: {
    value: "Historically extreme",
    trend: "high, edging lower",
    keyFact: "Overseas APT was quoted at $2,500 to $3,000/mtu (average $2,750) on November 12, 2026. The top of the range moved lower week over week; long-term contracts remain above $3,000/mtu.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Overseas APT $2,750/mtu average (Nov 12 2026)",
    previousValue: 0.90,
    reviewedAt: "2026-11-20",
  },
  west_china_price_gap: {
    value: "3.7x China",
    trend: "widened",
    keyFact: "Rotterdam APT averaged $278/kg in October 2026 against $74/kg ex-works China, 3.74 times. The September 2021 to June 2025 average was 1.24 times.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Rotterdam $278/kg vs China $74/kg (Oct 2026)",
    previousValue: 0.92,
    reviewedAt: "2026-11-20",
  },
  china_domestic_tungsten_price: {
    value: "Off the peak, rising again",
    trend: "rising",
    keyFact: "Chinese prices were about 60% below their early-2026 peak in August, then turned up. November long-term contract prices were raised and SMM reports Chinese prices rising steadily.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "APT RMB 610,000/t in Aug 2026, ~60% below peak",
    previousValue: 0.62,
    reviewedAt: "2026-11-20",
  },
  tungsten_scrap_market: {
    value: "Held at home",
    trend: "stable tight",
    keyFact: "A US scrap allocation order since late August 2026 keeps tungsten scrap in the country for domestic and defense use. European scrap offers are steady at about EUR 70 to 85/kg; Indian carbide scrap is $90 to 110/kg.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "EU scrap EUR 70-85/kg (Nov 12 2026)",
    previousValue: 0.65,
    reviewedAt: "2026-11-20",
  },
};

// ── Industrial Gases (Argon, Helium) ───────────────────────────────────────────
// Built 2026-11-20. Every signal is a dated, sourced analyst review.
export const MOCK_GASES_FORWARD_SIGNALS = {
  helium_qatar_supply: 0.75, // Reviewed 2026-11-20
  helium_export_restrictions: 0.75, // Reviewed 2026-11-20
  asu_power_costs: 0.70, // Reviewed 2026-11-20
  argon_coproduct_supply: 0.65, // Reviewed 2026-11-20
  semiconductor_gas_demand: 0.70, // Reviewed 2026-11-20
  major_supplier_pricing: 0.65, // Reviewed 2026-11-20
};

export const MOCK_GASES_REGIME_SIGNALS = {
  // freight_rates is reused from MOCK_REGIME_SIGNALS, not duplicated.
  helium_spot_price: 0.72, // Reviewed 2026-11-20
  argon_spot_price: 0.78, // Reviewed 2026-11-20
  cryogenic_logistics: 0.65, // Reviewed 2026-11-20
};

export const MOCK_GASES_SIGNAL_DETAIL = {
  helium_qatar_supply: {
    value: "Partially restarted, exports constrained",
    trend: "improving slowly",
    keyFact: "Ras Laffan halted in March 2026; strike damage cut Qatar's helium exports about 14% for years. Helium 2 partially restarted in June 2026, but exports remain limited by Strait of Hormuz shipping and cryogenic container availability.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Qatar ~30% of world helium; exports -14% structural",
    previousValue: 0.75,
    reviewedAt: "2026-11-20",
  },
  helium_export_restrictions: {
    value: "Swing suppliers closed",
    trend: "stable tight",
    keyFact: "Russia restricts helium exports outside the Eurasian Economic Union through end-2027, and China has a temporary helium export ban, so neither can offset lost Qatari volumes for Western buyers.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Russia export permits required through 2027",
    previousValue: 0.75,
    reviewedAt: "2026-11-20",
  },
  asu_power_costs: {
    value: "Rising",
    trend: "rising",
    keyFact: "Energy is up to 80-90% of air separation production cost (Linde). Industrial electricity rose 31% in Pennsylvania and 26% in Ohio in the year to December 2025 as data centers added load.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "PA industrial power +31%, OH +26% (year to Dec 2025)",
    previousValue: 0.70,
    reviewedAt: "2026-11-20",
  },
  argon_coproduct_supply: {
    value: "Tied to steel and refining",
    trend: "tightening",
    keyFact: "Argon output follows oxygen and nitrogen demand from steel and refining. China ASU utilisation was 63.6% on October 15, 2026, with weekly liquid argon output down 1.4%.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "China ASU utilisation 63.6% (Oct 15 2026)",
    previousValue: 0.65,
    reviewedAt: "2026-11-20",
  },
  semiconductor_gas_demand: {
    value: "Growing",
    trend: "rising",
    keyFact: "Advanced chip processes use more argon per wafer, and Linde cites electronics projects in the US, Korea and China. Fabs secure supply under long contracts first.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Linde electronics projects in US, Korea, China (Q3 2026)",
    previousValue: 0.70,
    reviewedAt: "2026-11-20",
  },
  major_supplier_pricing: {
    value: "Price-led",
    trend: "stable elevated",
    keyFact: "Linde Q3 2026 sales were a record $9.404 billion, with 3% underlying growth from pricing. Air Products raised 2026 guidance citing helium price strength.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Linde Q3 2026: +3% price, record $9.4B sales",
    previousValue: 0.65,
    reviewedAt: "2026-11-20",
  },
  helium_spot_price: {
    value: "Elevated",
    trend: "high, easing slightly",
    keyFact: "Global helium prices roughly doubled after March 2026 (Caixin, EPRINC). A partial Qatari restart since June has eased the peak, but pricing remains elevated and customer-specific.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Prices ~2x pre-crisis after March 2026",
    previousValue: 0.72,
    reviewedAt: "2026-11-20",
  },
  argon_spot_price: {
    value: "Sharply higher",
    trend: "volatile, rising",
    keyFact: "China argon rose from ~720 yuan/t (early May 2026) to ~2,459 yuan/t (Sep 2), and East China hit ~3,057 yuan/t on Oct 20, +49% since Oct 8.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "East China argon ~3,057 yuan/t (Oct 20 2026)",
    previousValue: 0.78,
    reviewedAt: "2026-11-20",
  },
  cryogenic_logistics: {
    value: "Constrained",
    trend: "stable tight",
    keyFact: "Liquid helium holds about 35-48 days in a cryogenic container, and container availability is still constraining Qatari exports after the partial restart.",
    lastUpdated: "Analyst review, Nov 2026",
    dataPoint: "Helium hold time 35-48 days per container",
    previousValue: 0.65,
    reviewedAt: "2026-11-20",
  },
};

export async function fetchForwardSignals(commodity = "semiconductors_mlcc") {
  if (USE_MOCK_DATA) {
    const data = commodity === "lithium_battery" ? MOCK_LITHIUM_FORWARD_SIGNALS
      : commodity === "rare_earth_metals" ? MOCK_RARE_EARTH_FORWARD_SIGNALS
      : commodity === "steel_aluminum" ? MOCK_STEEL_ALUMINUM_FORWARD_SIGNALS
      : commodity === "automotive_resins" ? MOCK_RESINS_FORWARD_SIGNALS
      : commodity === "natural_rubber" ? MOCK_RUBBER_FORWARD_SIGNALS
      : commodity === "tungsten" ? MOCK_TUNGSTEN_FORWARD_SIGNALS
      : commodity === "industrial_gases" ? MOCK_GASES_FORWARD_SIGNALS
      : MOCK_FORWARD_SIGNALS;

    // A handful of signals across commodity groups have a real, live
    // data source (Federal Register for raw_material_supply_risk and
    // battery_policy_pipeline; GDELT for geopolitical_policy_pipeline is
    // built but disabled — see liveSignals.js; SEC XBRL for
    // non_china_ree_capacity). Everything else stays mock. Failures here
    // fall back to the mock value for that signal silently — a
    // live-fetch problem should never break the page or make a signal
    // disappear, it should just look like mock data.
    const liveOverrideFetcher =
      commodity === "semiconductors_mlcc" ? fetchLiveSemiconductorForwardOverrides
      : commodity === "lithium_battery" ? fetchLiveLithiumForwardOverrides
      : commodity === "rare_earth_metals" ? fetchLiveRareEarthForwardOverrides
      : commodity === "steel_aluminum" ? fetchLiveSteelAluminumForwardOverrides
      : commodity === "automotive_resins" ? fetchLiveResinsForwardOverrides
      : commodity === "natural_rubber" ? fetchLiveRubberForwardOverrides
      : commodity === "tungsten" ? fetchLiveTungstenForwardOverrides
      : commodity === "industrial_gases" ? fetchLiveGasesForwardOverrides
      : null;

    let liveKeys = [];
    let signals = data;
    if (liveOverrideFetcher) {
      try {
        const overrides = await liveOverrideFetcher();
        liveKeys = Object.keys(overrides);
        if (liveKeys.length > 0) {
          signals = { ...data };
          liveKeys.forEach((key) => {
            signals[key] = overrides[key].score;
          });
        }
      } catch (e) {
        // The override fetchers already catch per-signal internally, so
        // this is a genuine unexpected failure (e.g. the import itself).
        // Fall back to fully mock rather than let it break signal loading
        // for the whole commodity.
        console.warn("⚠️ Live signal overrides failed unexpectedly, using mock for all:", e);
      }
    }

    return {
      signals,
      source: liveKeys.length > 0 ? "mixed" : "mock",
      liveKeys, // which specific signal keys are live right now, if any — UI uses this for per-signal LIVE badges
      fetchedAt: new Date().toISOString(),
    };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/forward?commodity=${commodity}`);
  return res.json();
}

export async function fetchRegimeSignals(commodity = "semiconductors_mlcc") {
  if (USE_MOCK_DATA) {
    const data = commodity === "lithium_battery" ? MOCK_LITHIUM_REGIME_SIGNALS
      // freight_rates is REUSED directly from the semiconductor regime
      // mock, not duplicated — same real transpacific freight market,
      // same analyst-reviewed value and badge.
      : commodity === "rare_earth_metals" ? { ...MOCK_RARE_EARTH_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : commodity === "steel_aluminum" ? { ...MOCK_STEEL_ALUMINUM_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : commodity === "automotive_resins" ? { ...MOCK_RESINS_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : commodity === "natural_rubber" ? { ...MOCK_RUBBER_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : commodity === "tungsten" ? { ...MOCK_TUNGSTEN_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : commodity === "industrial_gases" ? { ...MOCK_GASES_REGIME_SIGNALS, freight_rates: MOCK_REGIME_SIGNALS.freight_rates }
      : MOCK_REGIME_SIGNALS;

    // First live regime signal (spot_prices, via BLS PPI) — same pattern
    // as the forward-signal overrides above, just for the regime side,
    // which had no live-override mechanism at all before this.
    const liveOverrideFetcher =
      commodity === "semiconductors_mlcc" ? fetchLiveSemiconductorRegimeOverrides
      : commodity === "industrial_gases" ? fetchLiveGasesRegimeOverrides
      : null; // no lithium, rare-earth, steel/aluminum, resins, or rubber regime live signals yet

    let liveKeys = [];
    let signals = data;
    if (liveOverrideFetcher) {
      try {
        const overrides = await liveOverrideFetcher();
        liveKeys = Object.keys(overrides);
        if (liveKeys.length > 0) {
          signals = { ...data };
          liveKeys.forEach((key) => {
            signals[key] = overrides[key].score;
          });
        }
      } catch (e) {
        console.warn("⚠️ Live regime signal overrides failed unexpectedly, using mock for all:", e);
      }
    }

    return {
      signals,
      source: liveKeys.length > 0 ? "mixed" : "mock",
      liveKeys,
      fetchedAt: new Date().toISOString(),
    };
  }
  const res = await fetch(`${API_BASE}/api/risk/signals/regime?commodity=${commodity}`);
  return res.json();
}
