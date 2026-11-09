// ─────────────────────────────────────────────────────────────────────────────
// signalSources.js
// FOR-C v3 · Signal Source Registry
//
// Flip USE_MOCK_DATA to false when Flask endpoints are ready.
// Mock data shapes are identical to real API response shapes —
// backend wiring is a drop-in replacement.
// ─────────────────────────────────────────────────────────────────────────────

import { getApiBase } from "../../../config/apiBase";
import { fetchLiveSemiconductorForwardOverrides, fetchLiveLithiumForwardOverrides, fetchLiveSemiconductorRegimeOverrides, fetchLiveRareEarthForwardOverrides, fetchLiveSteelAluminumForwardOverrides, fetchLiveResinsForwardOverrides, fetchLiveRubberForwardOverrides } from "./liveSignals";

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
  capacity_allocation_mix_shift: 0.97, // Real, severe memory (DRAM/HBM) capacity reallocation to AI — see comment above for sourcing
  raw_material_supply_risk:      0.72, // Gallium/germanium suspension until Nov '26
  end_market_demand_divergence:  0.68, // Hyperscaler capex spiking vs flat auto production
  geopolitical_policy_pipeline:  0.71, // Taiwan #1 Beijing risk; Nov '26 expiry date-stamped
  equipment_order_book:          0.52, // ASML orders stable; not alarming but not expanding
};

export const MOCK_REGIME_SIGNALS = {
  spot_lead_times:       0.82, // High-cap MLCC >20wks; AEC-Q100 MCU 52+wks
  spot_prices:           0.65, // MLCC +10–20%; Taiyo Yuden +6–13% April '26
  distributor_inventory: 0.58, // Drawing down but not yet critically depleted
  freight_rates:         0.78, // Reframed 2026-08-16: real Drewry WCI data shows rates 2.5-3.5x the old $2,500/FEU baseline, near a 2026 peak — stopped short of maximum given genuine, credible uncertainty (Freight Right, Aug 3 2026) about whether this specific spike holds or partially corrects
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
    value: "Severe divergence",
    trend: "deteriorating",
    keyFact: "Samsung, SK Hynix, and Micron have reallocated DRAM capacity toward AI/HBM production — Everstream Analytics reports up to 70% of 2026 global memory output going to AI data centers. Named automotive OEMs (Honda, Yamaha) have directly cited production impact.",
    lastUpdated: "Aug 2026 (analyst review — memory chip evidence, not original MLCC scope)",
    dataPoint: "DRAM spot prices up ~700% YoY (Bloomberg, Jul 2026); Micron 2026 AI memory contracts sold out",
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
    value: "$6,244-$8,706/FEU (Drewry WCI, real 2026 peak)",
    trend: "elevated, genuinely uncertain near-term direction",
    keyFact: "REVISED 2026-08-16 — confirmed via Drewry World Container Index (Aug 13, 2026, most recent available): Shanghai-Los Angeles at $6,244/FEU, Shanghai-New York at $8,706/FEU, both up sharply week-over-week and described as a 2026 peak. That's roughly 2.5-3.5x the prior $2,500/FEU baseline this signal was tracking. Honest uncertainty worth flagging: separate analysis (Freight Right, Aug 3, 2026) argues this specific spike is partly driven by tariff-related frontloading and aggressive underlying discounting, expecting a correction toward the mid-$5,000s as published rates catch up to actual transacted prices. Real, current severity — but a genuinely contested near-term trajectory, not a stable new floor.",
    lastUpdated: "Analyst review, Aug 2026 — real Drewry WCI data, not a live feed (Freightos FBX's own data confirmed paid-only, free tier is chart/widget-only, not a machine-readable API)",
    dataPoint: "Drewry WCI, Aug 13 2026: Shanghai-LA $6,244/FEU (+6% WoW), Shanghai-NY $8,706/FEU (+10% WoW)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// fetchSignals
// Returns mock or live signal data depending on USE_MOCK_DATA flag.
// Real endpoints return identical shape: { signals: { key: 0–1 float }, meta: {} }
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_LITHIUM_FORWARD_SIGNALS = {
  cell_capacity_allocation_nlp:  0.79, // Updated 2026-09-30: GM/Ultium production actually RESTARTED Aug 13, 2026 (~1,400 workers back) after the 6-month pause — Ford/LGES, Stellantis/Samsung SDI, and Porsche/Cellforce still stand, but GM's reversal makes the cluster slightly less severe
  lithium_futures_curve:         0.58, // Updated 2026-09-30: REVERSED again — BMI's own Aug 11 2026 analysis describes the curve as in contango with a "shortage premium structure," not flat; the CATL Jianxiawo restart this signal leaned on for easing is reportedly delayed
  china_refinery_concentration:  0.80, // Reviewed 2026-09-30, unchanged: ex-China refining still lagging demand, Australia only ~20% of global refining by 2027
  mining_production_guidance:    0.52,
  ev_production_forecast_delta:  0.75, // Updated 2026-09-30: BloombergNEF confirms US EV sales down ~19% YTD — strengthens the "contracted capacity gets paused/renegotiated" thesis
  battery_policy_pipeline:       0.63, // Updated 2026-09-30: OBBBA kept 45X intact but added new FEOC material-sourcing thresholds (60% non-FEOC in 2026 -> 85% by 2030) — new compliance risk layered on an intact credit
};

export const MOCK_LITHIUM_REGIME_SIGNALS = {
  lithium_carbonate_spot: 0.40, // Updated 2026-09-30: modest upward revision — the CATL mine-restart delay cuts against the supply-side case for continued easing
  lithium_hydroxide_spot: 0.38, // Reviewed 2026-09-30, unchanged: no evidence of a widening or narrowing structural premium vs. carbonate
  cobalt_spot_price:      0.75, // Updated 2026-09-30: price momentum REVERSED — cobalt hydroxide fell from $26.00-26.25/lb (Apr 2026) to $22.00-23.00/lb (Aug 11 2026) on weak Chinese demand; ARECOMS signals no further quota cut for now
  cell_lead_times:        0.35, // Not re-verified 2026-09-30 — could not confirm or contradict the 13.8% YoY install-growth figure or the LGES 46-series backlog in a fresh search; holding score
};

export const MOCK_LITHIUM_SIGNAL_DETAIL = {
  cell_capacity_allocation_nlp: {
    value: "Partner instability easing slightly — GM/Ultium restarted",
    trend: "deteriorating, but less severe than prior review",
    keyFact: "UPDATED 2026-09-30 — GM/Ultium Cells production actually RESTARTED Aug 13, 2026 (roughly 1,400 workers recalled) after the 6-month pause that originally anchored this signal. The rest of the JV-instability cluster still stands: Ford's dissolved BlueOval SK JV and canceled $6.5B LGES supply deal, Stellantis's exit from its Canadian JV stake and Indiana Samsung SDI commitments, and Porsche's shuttered in-house cell subsidiary. GM's reversal is one real data point of recovery inside an otherwise-intact instability pattern, not a full resolution.",
    lastUpdated: "Analyst review, Sep 2026 — real earnings/press evidence, not a single live feed",
    dataPoint: "GM/Ultium Cells restarted Aug 13, 2026 (~1,400 workers) · Ford, Stellantis, Porsche pullbacks remain in effect",
    previousValue: 0.76,
    reviewedAt: "2026-09-30",
  },
  lithium_futures_curve: {
    value: "Back in contango — 'shortage premium' structure",
    trend: "tightening (reversed again from the prior flat-curve read)",
    keyFact: "UPDATED 2026-09-30 — the flat-curve/no-shortage framing from the prior review has itself reversed: Benchmark Minerals Intelligence's Aug 11, 2026 analysis describes the curve as back in contango with a 'shortage premium structure,' not flat. The CATL Jianxiawo mine restart that underpinned the prior easing call is reportedly delayed, removing one of the three supply-side restarts the flat read depended on. This signal has now flipped twice in under two months — treat the underlying mine-restart timeline as the thing to re-verify next, not the price level itself.",
    lastUpdated: "Analyst review, Sep 2026 — real BMI data, not a live feed (paid API access required for true live tracking)",
    dataPoint: "BMI Aug 11, 2026: curve in contango, 'shortage premium structure' · CATL Jianxiawo restart delayed (vs. previously assumed online)",
    previousValue: 0.61,
    reviewedAt: "2026-09-30",
  },
  china_refinery_concentration: {
    value: "Structural risk",
    trend: "stable risk",
    keyFact: "China processes approximately 65% of global lithium into battery-grade material. No alternative refining capacity at scale will come online before 2028. Any export restriction is a binary tail event with 18–24 month downstream consequences.",
    lastUpdated: "Analyst review, Aug 2026 — USGS Minerals data (source) only publishes annually, no reliable live feed exists",
    dataPoint: "Chinese refinery capacity: ~65% global share · Next meaningful alternative: 2028",
    previousValue: 0.8,
    reviewedAt: "2026-09-30",
  },
  mining_production_guidance: {
    value: "Stable / not expanding",
    trend: "flat",
    keyFact: "SQM (Chile) and Albemarle (US/Australia) both guiding flat-to-modest production growth for 2026. Low spot prices in 2024–2025 suppressed investment in new brine and spodumene capacity.",
    lastUpdated: "Q1 2026 20-F / 10-K",
    dataPoint: "SQM 2026 guidance: 180–200kt LCE · Albemarle: 'disciplined capital deployment'",
  },
  ev_production_forecast_delta: {
    value: "Demand undershoot confirmed, partner-commitment risk",
    trend: "deteriorating — now independently confirmed",
    keyFact: "UPDATED 2026-09-30 — BloombergNEF confirms the demand-undershoot thesis with hard numbers: US EV sales are down roughly 19% year-to-date. This strengthens, rather than changes, the mechanism identified in the prior review — already-contracted battery capacity gets paused, renegotiated, or canceled as partners react to softer-than-planned OEM demand, as already seen with Ford/LGES, GM/Ultium, and Stellantis/Samsung SDI. 'The factories were on time. The customers weren't' still holds, now with a specific magnitude attached.",
    lastUpdated: "Analyst review, Sep 2026 — real BloombergNEF data, not a single live feed",
    dataPoint: "BloombergNEF: US EV sales down ~19% YTD 2026 · Automakers continuing to consolidate around fewer, more trusted battery partners",
    previousValue: 0.67,
    reviewedAt: "2026-09-30",
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
    value: "$18,160/t (BMI, Aug 10 2026), modest upward revision",
    trend: "ticking back up — the easing from the prior review is losing ground",
    keyFact: "UPDATED 2026-09-30 — a modest upward revision from the prior easing read. The CATL Jianxiawo mine-restart delay (see lithium_futures_curve) removes part of the supply-side case that justified calling carbonate 'easing' last review — with one of the three restarts behind that call now in question, the price case for continued easing is weaker, not stronger.",
    lastUpdated: "Analyst review, Sep 2026 — real BMI/Trading Economics data, not a live feed (structured lithium pricing data is paid-only across every provider checked: LME, CME, Fastmarkets, BMI, Trading Economics)",
    dataPoint: "BMI carbonate spot: $18,160/t (Aug 10 2026) · CATL Jianxiawo restart delayed, weakening the supply-side case for continued easing",
    previousValue: 0.44,
    reviewedAt: "2026-09-30",
  },
  lithium_hydroxide_spot: {
    value: "$18,510/t (BMI, Aug 10 2026)",
    trend: "easing recently, still elevated vs. historical lows",
    keyFact: "REVISED 2026-08-16 — old mock value ($13.8/tonne) was similarly stale, off by roughly 1,300x. Real current figure: $18,510/t as of Aug 10, 2026 (BMI), a modest premium over carbonate ($350/t), not the 'widening premium, NMC under more pressure' narrative previously assumed — that framing isn't supported by the most recent real data, which shows both chemistries moving together with the broader market easing, not diverging.",
    lastUpdated: "Analyst review, Aug 2026 — real BMI data, not a live feed (same paid-access wall as lithium_carbonate_spot)",
    dataPoint: "BMI hydroxide spot: $18,510/t (Aug 10 2026) · Carbonate-hydroxide spread: ~$350/t, not a widening structural premium",
    previousValue: 0.51,
    reviewedAt: "2026-09-30",
  },
  cobalt_spot_price: {
    value: "~$22-23/lb (Aug 2026), down from ~$26/lb in April",
    trend: "momentum reversed — easing on weak Chinese demand",
    keyFact: "UPDATED 2026-09-30 — price momentum has REVERSED from the prior review: cobalt hydroxide fell from $26.00-26.25/lb in April 2026 to $22.00-23.00/lb as of Aug 11, 2026, driven by weak Chinese demand. The DRC's 2026-2027 quota regime (96,600t vs. ~204,000t actual 2024 production) remains the underlying structural constraint, but ARECOMS (the DRC's regulator) is signaling no further quota cut for now — the deliberate-scarcity mechanism is unchanged, but near-term price pressure has eased.",
    lastUpdated: "Analyst review, Sep 2026 — real multi-source data (Benchmark Minerals, S&P Global, industry reporting), not a live feed (LME cobalt data is paid-only, same as every other structured metals pricing source checked)",
    dataPoint: "Cobalt hydroxide: $26.00-26.25/lb (Apr 2026) -> $22.00-23.00/lb (Aug 11 2026) · DRC 2026-2027 quota unchanged at 96,600t; ARECOMS signals no further cut for now",
    previousValue: 0.38,
    reviewedAt: "2026-09-30",
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
  magnet_capacity_allocation:   0.55, // Real, moderate: DoD offtake on the 10X Facility is a revenue guarantee, not a literal lockout — commercial buyers retain access with DoD consent, but real structural uncertainty and the 2028 commissioning date keep this above neutral
  china_refining_concentration: 0.88, // Real, confirmed via IEA/S&P Global: China controls ~91% of global rare earth refining capacity — even more concentrated than lithium's equivalent signal (80)
  ev_wind_demand_divergence:    0.57, // Overridden by the real live fetch when it succeeds — matches the real-tested +37.0% YoY GE Vernova backlog growth
};

export const MOCK_RARE_EARTH_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — fetchRegimeSignals below reads
  // it directly from MOCK_REGIME_SIGNALS instead, same live data as the
  // semiconductor regime signal.
  ndpr_oxide_spot_price: 0.40, // Real, moderate: China domestic NdPr benchmark has fallen below the real $110/kg DoD-backed price floor (Aug 2026) — structurally tight but not acutely stressed right now
  heavy_ree_spot_price:  0.85, // Real, severe: confirmed 3.6-4.5x price divergence between China domestic and ex-China dysprosium/terbium (Aug 11 2026) — comparable severity to cobalt's DRC quota finding
  magnet_lead_times:     0.75, // Real capacity scarcity, not a specific lead-time figure: MP Materials' next major facility doesn't commission until 2028, combined US magnet capacity stays tiny relative to real EV/wind demand until then
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
    value: "DoD offtake structured as guarantee, not lockout",
    trend: "moderate, structurally uncertain",
    keyFact: "Confirmed 2026-08-16, real terms more nuanced than assumed: the DoD's '100% offtake' on MP Materials' new 10X Facility (7,000 MT/yr, commissioning 2028) doesn't mean defense physically takes all output — it's a revenue/EBITDA guarantee ($140M/yr minimum). MP Materials explicitly retains the option to sell to commercial buyers (EV, wind, industrial) with DoD's consent; profits above the $140M threshold split 50/50. Separately, the existing Independence facility expands from 1,000 to 3,000 MT/yr, funded partly by a real $32M Apple prepayment — not defense-committed at all.",
    lastUpdated: "Analyst review, Aug 2026 — real MP Materials/DoD disclosed terms, no reliable live feed exists",
    dataPoint: "10X Facility: 7,000 MT/yr, DoD revenue-guaranteed but commercial-accessible with consent · Independence: 1,000->3,000 MT/yr, Apple-funded, not DoD-committed",
  },
  china_refining_concentration: {
    value: "~91% China refining share",
    trend: "stable structural risk, active policy escalation on top",
    keyFact: "Confirmed 2026-08-16 across multiple independent sources (IEA, S&P Global): China controls approximately 91% of global rare earth refining and separation capacity — even more concentrated than lithium's ~65% refining equivalent. Real alternative capacity outside China totals under 40kt, spread across Malaysia, the US, Australia, Vietnam, Japan, UK, France, and Estonia. The IEA specifically identifies downstream magnet production as the tightest bottleneck of all — 'cumulative planned production of metals, alloys and finished magnets... only about one third of diversified mining capacity.' Compounding this structural concentration: the same active policy tension already confirmed for china_ree_export_policy (the Nov 10 2026 suspension deadline, China's direct blacklisting of MP Materials).",
    lastUpdated: "Analyst review, Aug 2026 — IEA Global Critical Minerals Outlook, S&P Global, no reliable live feed exists",
    dataPoint: "China rare earth refining/separation share: ~91% (IEA) · Non-China refining capacity: <40kt total, spread across 8 countries",
  },
  ev_wind_demand_divergence: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live GE Vernova fetch fails. Real, confirmed 2026-08-16: GE Vernova's total company order backlog reached $176.3B as of Q2 2026, up 37.0% from $128.7B the same quarter a year earlier — genuinely accelerating versus the full-year FY2024-to-FY2025 comparison (+26.2%). This is total company backlog (Power + Wind + Electrification combined), not isolated to the Wind segment specifically.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current backlog figures and YoY comparison",
  },
  ndpr_oxide_spot_price: {
    value: "$141.79/kg neodymium, $131.02/kg NdPr alloy (SMM, Sep 3 2026)",
    trend: "stable, structurally tight but not acute — score unchanged",
    keyFact: "Reviewed 2026-09-30, unchanged: refreshed SMM figures (neodymium metal $141.79/kg, NdPr alloy $131.02/kg as of Sep 3, 2026) show prices holding in roughly the same band as the prior review, still below the $110/kg DoD-backed price floor by a similar margin. Real structural tightness remains (magnets absorb ~90% of NdPr supply; direct-drive offshore wind alone needs ~600kg of NdFeB per MW), but the acute price pressure seen in heavy REEs still isn't present here.",
    lastUpdated: "Analyst review, Sep 2026 — real SMM/DoD contract data, no reliable live feed exists",
    dataPoint: "SMM neodymium metal: $141.79/kg · NdPr alloy: $131.02/kg (Sep 3 2026) · Real DoD-backed price floor: $110/kg",
    previousValue: 0.4,
    reviewedAt: "2026-09-30",
  },
  heavy_ree_spot_price: {
    value: "China domestic terbium $1,097.08/kg vs $1,557/kg FOB export (SMM, Sep 3 2026)",
    trend: "severe, two-tier market — score unchanged",
    keyFact: "Reviewed 2026-09-30, unchanged: refreshed SMM figures show China domestic terbium at $1,097.08/kg and FOB export pricing at $1,557/kg as of Sep 3, 2026, with domestic dysprosium at $239.12/kg — the two-tier domestic-vs-export structure the prior review flagged is still intact, if the specific spread has moved. Real DoD-backed floors exist ($575/kg dysprosium, $2,050/kg terbium, MP Materials/Serra Verde contracts) but sit below actual ex-China market prices — the floor isn't the binding constraint, scarcity is.",
    lastUpdated: "Analyst review, Sep 2026 — real SMM data, no reliable live feed exists",
    dataPoint: "SMM Sep 3 2026: China domestic terbium $1,097.08/kg · FOB export terbium $1,557/kg · China domestic dysprosium $239.12/kg",
    previousValue: 0.85,
    reviewedAt: "2026-09-30",
  },
  magnet_lead_times: {
    value: "No formal lead-time figure exists — real capacity data used instead",
    trend: "genuine capacity scarcity through 2028",
    keyFact: "Confirmed 2026-08-16: no source anywhere reports a specific NdFeB magnet lead-time figure — the ex-China industry is too early-stage for that kind of trade-press tracking, unlike MLCCs or battery cells. Real capacity data instead: MP Materials' Independence facility (Fort Worth) runs roughly 1,000-3,000 MT/year; their next major facility, the 10X plant, doesn't commission until 2028. Combined US magnet capacity won't reach 10,000 MT/year until then. The IEA separately identifies downstream magnet production as the tightest bottleneck in the entire rare earth supply chain.",
    lastUpdated: "Analyst review, Aug 2026 — real MP Materials/Lynas capacity disclosures, no reliable lead-time-specific feed exists",
    dataPoint: "MP Materials Independence: ~1,000-3,000 MT/yr · 10X Facility: commissioning 2028, +7,000 MT/yr · Combined US capacity target: 10,000 MT/yr by 2028",
  },
};

// ── Steel & Aluminum ──────────────────────────────────────────────────────────
// Built 2026-08-17. Full scaffolding built proactively before any
// individual signal — Rare Earth Metals needed a follow-up fix to become
// clickable, so this time the structure comes first. Nothing live yet.
export const MOCK_STEEL_ALUMINUM_FORWARD_SIGNALS = {
  section_232_tariff_pipeline:      0.66, // Overridden by the real live fetch when it succeeds — matches the real-tested count of 6 documents in a 90-day window
  domestic_capacity_expansion:      0.50, // Overridden by the real live fetch when it succeeds — matches the real-tested combined +3.0% YoY (Nucor +7.8%, Cleveland-Cliffs -19.3%)
  china_steel_overcapacity_dumping: 0.85, // Updated 2026-09-30: reviewed, slightly worse — overcapacity dynamics confirmed still active, no sign of resolution
  automotive_sheet_demand:          0.45, // Reviewed 2026-09-30, unchanged: US auto production still flat, no crisis signal
  scrap_eaf_dynamics:               0.55, // Updated 2026-09-30: AISI mill capacity utilization fell from 82.3% to 77.9% the week of Sept 19 — softer utilization eases some of the prime-grade tightness
  aluminum_capacity_signal:         0.50, // Overridden by the real live fetch when it succeeds
};

export const MOCK_STEEL_ALUMINUM_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — fetchRegimeSignals below reads
  // it directly from MOCK_REGIME_SIGNALS instead, same live data as the
  // semiconductor regime signal.
  hrc_spot_price:      0.72, // Real, current: HRC futures reversed sharply, climbing to $1,281-1,322/ton by late Sept 2026 — the highest level since March 2023 — up from $875/ton in Aug 2026, consistent with tightening supply and renewed tariff-driven cost-inflation risk
  aluminum_spot_price: 0.74, // Real, severe but easing slightly: LME aluminum at ~$3,267/ton (Sept 26 2026), down modestly from the $3,380/ton Aug 13 peak but still ~25-30% above normal range, tariffs + Middle East supply crisis still the dominant drivers
  import_penetration:  0.46, // Updated 2026-09-30: corrected — steel imports actually down 23.1% YoY in H1 2026, not the 30% previously cited; aluminum still ~60% import-dependent with no confirmed 2026 decline
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
    value: "Severe, OECD-confirmed structural overcapacity, slightly worse",
    trend: "worsening, active policy response globally",
    keyFact: "Updated 2026-09-30, modestly worse: the structural picture confirmed in August is unchanged in kind and, if anything, more entrenched — global excess steel capacity reaching 745 million tons by 2026 (OECD), Chinese steelmakers' record 131 million tonne export pace from 2025, and the EU's April 2026 quota/duty tightening all remain the active baseline, with no evidence of resolution surfacing this round. Honest OECD caveat still stands: existing AD/CVD trade measures are 'being actively circumvented,' so orders alone aren't resolving this.",
    lastUpdated: "Analyst review, Sep 2026 — real OECD data, no reliable live feed exists (Federal Register document-count tested and rejected as too high-volume/routine to be a useful instrument here)",
    dataPoint: "Global excess steel capacity: 745M tons by 2026 (OECD) · Chinese steel exports: 131M tonnes in 2025, +153% since 2020",
    previousValue: 0.84,
    reviewedAt: "2026-09-30",
  },
  automotive_sheet_demand: {
    value: "~10.2M units 2026, flat and stable",
    trend: "steady, no crisis signal",
    keyFact: "Confirmed 2026-08-17: US automotive production is holding flat at approximately 10.2 million units in 2026 — similar to 2025 — with modest growth to 10.5M expected in 2027 and 11M+ by 2028. Real Fastmarkets analysis explicitly ties this to steel demand: 'steady automotive production points to consistent steel demand which will contribute to supported steel flat product prices.' No structured live data source exists (fundamentally a market-forecast topic).",
    lastUpdated: "Analyst review, Aug 2026 — real Fastmarkets/AISI industry data, no reliable live feed exists",
    dataPoint: "US auto production: ~10.2M units (2026) -> 10.5M (2027 est.) -> 11M+ (2028 est.)",
    previousValue: 0.45,
    reviewedAt: "2026-09-30",
  },
  scrap_eaf_dynamics: {
    value: "Easing slightly — mill utilization down, prime-grade tightness softer",
    trend: "improving modestly from the prior review",
    keyFact: "Updated 2026-09-30: AISI mill capacity utilization fell from 82.3% to 77.9% the week of Sept 19, 2026 — a real pullback in mill activity that eases some of the structural tightness on prime grades like busheling flagged in the prior review. The underlying automotive-grade scrap tightness hasn't fully reversed, but softer mill utilization reduces near-term pressure on the specific grades that feed flat-rolled production.",
    lastUpdated: "Analyst review, Sep 2026 — real AISI capacity utilization data, no reliable live feed exists (structured scrap pricing is commercial/paid, same pattern as HRC)",
    dataPoint: "AISI mill capacity utilization: 82.3% -> 77.9% (week of Sept 19, 2026)",
    previousValue: 0.58,
    reviewedAt: "2026-09-30",
  },
  aluminum_capacity_signal: {
    value: "Live when the real fetch succeeds",
    trend: "see live data",
    keyFact: "This mock value only displays if the live fetch fails. Confirmed real (2026-08-17): both Alcoa (CIK 0001675149) and Century Aluminum (CIK 0000949157) are genuine US-domestic 10-K filers using the exact same PaymentsToAcquirePropertyPlantAndEquipment tag already proven for 9 other companies tonight. INVERTED scoring, same as domestic_capacity_expansion: growing capex means de-risking from import dependency — Section 232's original 2018 investigation found aluminum imports accounted for ~90% of certain primary aluminum products.",
    lastUpdated: "Live — see fetchedAt on the actual API response",
    dataPoint: "See the live fetch for real, current capex figures and the Alcoa/Century Aluminum split",
  },
  hrc_spot_price: {
    value: "$1,281-1,322/ton (late Sept 2026), highest since March 2023",
    trend: "escalating sharply, reversing the summer decline",
    keyFact: "Updated 2026-09-27: HRC prices reversed hard off the Aug 2026 low of $875/ton, climbing to $1,281-1,322/ton by late September — the highest level since March 2023. This reverses the oversupply-driven softening confirmed in August and re-tightens near-term cost-inflation risk, even as the structural overcapacity story (china_steel_overcapacity_dumping) remains unresolved. No free structured API exists for CME HRC futures (Metals-API, Commodities-API, CRU all paid), so this stays analyst-tracked.",
    lastUpdated: "Analyst review, Sept 2026 — real CME contract data, no reliable live feed exists",
    dataPoint: "HRC futures: $875/ton (Aug 2026) -> $1,281-1,322/ton (late Sept 2026) · highest since March 2023",
  },
  aluminum_spot_price: {
    value: "$3,267/ton (Sept 26 2026), easing modestly from Aug peak",
    trend: "still elevated, pulled back slightly off the Aug high",
    keyFact: "Updated 2026-09-27: LME aluminum has eased modestly to ~$3,267/ton (Sept 26), down from the $3,380/ton Aug 13 peak, but still running well above the 'normal' 2023-2024 range (capped below $2,500/ton). The two structural drivers confirmed in August remain in place: Section 232 tariffs at 50% directly lifting US premiums, and the US-Iran conflict's disruption of roughly 10% of global aluminum production, with a forecast 2026 global deficit of ~720,000 tonnes still unresolved. This looks like near-term volatility within a still-severe supply crisis, not a resolution of it.",
    lastUpdated: "Analyst review, Sept 2026 — real LME market data, no free structured API exists",
    dataPoint: "LME aluminum: $3,380/ton (Aug 13 2026 peak) -> $3,267/ton (Sept 26 2026) · Forecast 2026 global deficit: ~720,000 tonnes",
  },
  import_penetration: {
    value: "Real divergence: steel improving (corrected), aluminum still exposed",
    trend: "mixed — not a single story",
    keyFact: "CORRECTED 2026-09-30: the prior review's -30% steel import figure was too high — the real H1 2026 figure is steel imports down 23.1% year-over-year, still a genuine, meaningful de-risking trend credited to Section 232 tariffs, just smaller in magnitude than previously stated. Aluminum's exposure is unchanged: 60% of 2025 US aluminum consumption came from imports (vs. steel's much lower share), with no confirmed 2026 decline of comparable magnitude. Genuine live tracking remains possible via US Census Bureau/ITC data (Steel Import Monitor, Aluminum Import Monitor) pending a free registered API key.",
    lastUpdated: "Analyst review, Sep 2026 — real Census Bureau/ITC/Manufacturing Dive data, live build deferred pending API key registration",
    dataPoint: "Steel imports: -23.1% YoY (H1 2026, corrected from -30%) · Aluminum import share: ~60% of consumption (2025 baseline, no confirmed 2026 update)",
    previousValue: 0.48,
    reviewedAt: "2026-09-30",
  },
};

// ── Automotive Resins & Plastics ──────────────────────────────────────────────
// Built 2026-08-18. domestic_polymer_capacity is live; everything else is
// an explicit, labeled placeholder.
export const MOCK_RESINS_FORWARD_SIGNALS = {
  domestic_polymer_capacity:    0.50, // Overridden by the real live fetch when it succeeds
  petrochemical_feedstock_risk: 0.88, // Real, re-escalating: Brent crude back above $110/bbl by mid-Sept 2026, reversing the summer correction — same feedstock-to-relief transmission break confirmed in August, now compounding again
  automotive_resin_demand:      0.48, // Real, stable US production (~10.2M units 2026, same as automotive_sheet_demand) with a slight tilt up for structural plastics-content-per-vehicle growth (lightweighting, EVs)
  china_polymer_capacity:       0.86, // Real, severe: PP margins collapsed >95%, exports +54-122% YoY, global oversupply forecast tripling, real 2026 capacity additions continuing despite crisis (CIEL, Argus, ICIS)
  resin_allocation_squeeze:     0.30, // Updated 2026-09-30: nudged up from the oversupply read — the renewed feedstock cost shock and PP producer run cuts (see pp_resin_spot_price) start to tighten the allocation picture slightly, though oversupply fundamentals haven't fully reversed
  trade_policy_pipeline:        0.62, // Updated 2026-09-30: Section 122 (the 15%, 150-day stop-gap) expired July 24, 2026, replaced by a more durable Section 301-based tariff band around 12.5% — less acute legal uncertainty than the expiring stop-gap, though the underlying duty burden persists
};

export const MOCK_RESINS_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — reused directly from
  // MOCK_REGIME_SIGNALS, same real live/analyst-reviewed data.
  pp_resin_spot_price:    0.62, // Real, reversing: PP margins turned negative by mid-Sept 2026 as feedstock costs re-escalated faster than resin prices, producers announcing run cuts — buyer-favorable market from July has flipped
  abs_resin_spot_price:   0.48, // Updated 2026-09-30: REVERSED — ABS surged roughly 30% between July and September on margin-driven producer run cuts, undoing the March-June correction
  nylon_resin_spot_price: 0.55, // Weaker evidence, inferred from Celanese's real 21.1% capex pullback — no direct current pricing data found
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
    value: "Re-escalating: Brent above $110/bbl by mid-Sept 2026",
    trend: "worsening again, structurally broken relief transmission persists",
    keyFact: "Updated 2026-09-27: after the mid-year correction, Brent crude climbed back above $110/bbl by mid-September 2026, re-escalating feedstock costs across the polymer chain. This lands on top of the structurally broken cost-to-relief transmission already confirmed in August (Beroe, April 2026) — the same mechanism that produced the real 'Petrochemical Price Shock 2026: Why Costs Doubled in 30 Days' headline in April is repeating, with PP producers now announcing production cuts as margins turn negative (see pp_resin_spot_price).",
    lastUpdated: "Analyst review, Sept 2026 — real Brent crude and ICIS/ChemAnalyst data, EIA live build deferred pending free API key registration",
    dataPoint: "Brent crude: back above $110/bbl (mid-Sept 2026) · PP producer margins: negative, run cuts announced",
  },
  automotive_resin_demand: {
    value: "Stable production, growing plastics content per vehicle",
    trend: "steady, modest structural upside",
    keyFact: "Confirmed 2026-08-18: US vehicle production remains flat at approximately 10.2 million units in 2026 — the same real figure already confirmed for automotive_sheet_demand. Real, structural difference from steel: automotive plastics content per vehicle is growing due to lightweighting and EV adoption, which need more polymer components for battery housings and structural weight reduction. Honest caveat: this research relied mostly on generic, templated automotive plastics market-sizing reports rather than dated news events — meaningfully weaker evidence quality than most other signals tonight, which is why this stays close to automotive_sheet_demand's calm reading rather than a confident, sharply differentiated number.",
    lastUpdated: "Analyst review, Aug 2026 — same real AISI/Fastmarkets production data as automotive_sheet_demand, plus generic market research, no reliable live feed exists",
    dataPoint: "US auto production: ~10.2M units (2026, same as automotive_sheet_demand) · PP holds ~32-35% share of automotive plastics content, growing with lightweighting/EV trends",
  },
  china_polymer_capacity: {
    value: "Severe, worsening structural overcapacity",
    trend: "deteriorating, capacity additions continuing regardless",
    keyFact: "Confirmed 2026-08-18 across multiple independent sources (CIEL, Argus Media, ICIS): China's polypropylene exports surged 54% YoY through April 2026, polyethylene exports up 122%, while Chinese imports of both fell simultaneously — a genuine reversal from net importer toward net exporter. China's own PP production margins collapsed more than 95% between 2019-2021 and 2022-2024. Global PP oversupply is forecast at 21 million metric tons annually for 2020-2030, up threefold from 7 million tonnes in 2000-2019. Real, dated: 2026 alone brings 4.55M tonnes of new Chinese PP capacity and ~6.2M tonnes of new PE capacity, continuing to expand despite the already-severe glut. Connects to the same Middle East conflict already found driving aluminum_spot_price and petrochemical_feedstock_risk — Chinese exporters are explicitly filling the gap left by constrained Middle East supply.",
    lastUpdated: "Analyst review, Aug 2026 — real CIEL/Argus/ICIS data, no reliable live feed exists",
    dataPoint: "China PP exports: +54% YoY (Apr 2026) · PE exports: +122% YoY · China PP margins: -95%+ (2019-21 vs 2022-24) · Global PP oversupply forecast: 21M tonnes/yr (2020-30), up from 7M tonnes/yr (2000-19)",
  },
  resin_allocation_squeeze: {
    value: "Still no hard squeeze, but tightening slightly off the oversupply low",
    trend: "turning — producer run cuts starting to offset the Q2 oversupply",
    keyFact: "Updated 2026-09-30: the May 2026 oversupply picture (PP inventories +105.7M lbs to 1.97B lbs, 39 days of supply, 'this isn't a tight market') is the baseline, but it's starting to shift — the same feedstock cost shock and producer run cuts now confirmed in pp_resin_spot_price and petrochemical_feedstock_risk work against pure oversupply, nudging the allocation picture modestly tighter even though a genuine squeeze hasn't materialized.",
    lastUpdated: "Analyst review, Sep 2026 — real PlasticsToday/ACC/ICIS data, no reliable live feed exists",
    dataPoint: "PP inventories: +105.7M lbs to 1.97B lbs (May 2026 baseline) · Producer run cuts now underway (Sept 2026) as feedstock costs re-escalate",
    previousValue: 0.25,
    reviewedAt: "2026-09-30",
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
    value: "Margins turned negative, producer run cuts announced",
    trend: "reversing sharply, feedstock costs outrunning resin prices",
    keyFact: "Updated 2026-09-27: the 'buyer-favorable' market confirmed in August has flipped. As Brent crude re-escalated above $110/bbl by mid-September (see petrochemical_feedstock_risk), feedstock costs rose faster than PP contract prices, pushing producer margins negative and prompting run-cut announcements — the opposite dynamic from July's oversupply-driven decline. china_polymer_capacity's oversupply pressure hasn't gone away, but it's now colliding with a renewed cost shock rather than easing pricing.",
    lastUpdated: "Analyst review, Sept 2026 — real PlasticsToday/ChemOrbis/ICIS data, no reliable live feed exists",
    dataPoint: "PP producer margins: negative (mid-Sept 2026) · Feedstock (Brent): back above $110/bbl, re-escalating faster than resin contract prices",
  },
  abs_resin_spot_price: {
    value: "Surged ~30% July-September, reversing the Q2 correction",
    trend: "re-escalating sharply, margin-driven producer cuts",
    keyFact: "REVERSED 2026-09-30: the Q2 correction confirmed in the prior review (down 25-30% from the March high, 8,900-10,450 RMB/MT by late June) has itself reversed — ABS prices climbed roughly 30% between July and September 2026, driven by margin-driven producer run cuts rather than a demand recovery. This mirrors the same cost-margin squeeze now showing up in pp_resin_spot_price and petrochemical_feedstock_risk — producers cutting output to defend margins as feedstock costs re-escalate.",
    lastUpdated: "Analyst review, Sep 2026 — real ChemOrbis/ICIS Chinese domestic pricing data, no reliable live feed exists",
    dataPoint: "Chinese domestic ABS: down 25-30% by late June 2026, then up ~30% Jul-Sept 2026 on margin-driven producer run cuts",
    previousValue: 0.32,
    reviewedAt: "2026-09-30",
  },
  nylon_resin_spot_price: {
    value: "Better evidenced now — Celanese price increases confirm tightness",
    trend: "firming, now directly evidenced",
    keyFact: "Updated 2026-09-30: the softer Celanese-capex proxy from the prior review is now backed by more direct evidence — Celanese announced nylon price increases in March, April, and May 2026, a real, dated signal of firming pricing power rather than just an inferred capex-based proxy. Score held steady since the direction (firming, not easing) was already correctly inferred, but confidence in that read is now meaningfully higher.",
    lastUpdated: "Analyst review, Sep 2026 — real Celanese price-increase announcements (Mar/Apr/May 2026), no reliable live feed exists",
    dataPoint: "Celanese nylon price increases announced: Mar, Apr, May 2026 · Prior capex pullback (-21.1% YoY) still noted as context, no longer the sole evidence",
    previousValue: 0.55,
    reviewedAt: "2026-09-30",
  },
};

// ── Natural Rubber ─────────────────────────────────────────────────────────────
// Built 2026-08-18. tire_manufacturer_demand is live; everything else is
// an explicit, labeled placeholder.
export const MOCK_RUBBER_FORWARD_SIGNALS = {
  tire_manufacturer_demand:      0.50, // Overridden by the real live fetch when it succeeds
  thai_indonesian_output:        0.72, // Updated 2026-09-30: the modest recovery forecast didn't hold — Indonesia's exports actually fell 21% YoY against a forecast +0.8% gain, a real and meaningful miss on top of the already-confirmed structural decline
  leaf_disease_risk:             0.62, // Updated 2026-09-30: yield losses confirmed running as high as 30-35% in some affected areas — worse than the general pressure described in the prior review
  synthetic_rubber_substitution: 0.45, // Updated 2026-09-30: REVERSED — the Hormuz Strait reopened under an April 2026 ceasefire, resolving the original substitution driver, though NBR prices remain elevated and rising, now pulled up by the natural-rubber price spike itself rather than the Hormuz closure
  china_rubber_stockpiling:      0.70, // Updated 2026-09-30: Chinese natural rubber imports hit a 6-year low of 486kt in August, and Qingdao inventory fell a further 17.4kt the week of Sept 18 — buffer stock continuing to draw down more severely than the prior review captured
  weather_disruption_risk:       0.72, // Real, reversed: Thai rainfall turned disruptive by Sept 2026 (heavy monsoon flooding curbing tapping), compounding the Ivory Coast port congestion driver and the confirmed 254¢/kg price high
};

export const MOCK_RUBBER_REGIME_SIGNALS = {
  // freight_rates is NOT duplicated here — reused directly from
  // MOCK_REGIME_SIGNALS, same real live/analyst-reviewed data.
  rss3_spot_price:    0.80, // Real, severe reversal: TOCOM RSS3 hit 254¢/kg on Sept 25 2026, +46.74% YoY and the highest level since 2013 — a sharp break from the mid-range stability confirmed in August
  tsr20_spot_price:   0.82, // Real, elevated further: the same crude/substitution dynamics confirmed in July have intensified into September, tracking the broader rubber benchmark's move to a 13-year high
  tire_grade_premium: 0.75, // Inferred: both grades have moved sharply higher through Sept 2026, but TSR20 remains the more acutely pressured tire-preferred grade, so the premium is still assessed as widening
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
    value: "Recovery forecast missed — Indonesia exports fell 21% YoY",
    trend: "worse than expected, structural decline deepening",
    keyFact: "UPDATED 2026-09-30 — the modest recovery forecast from the prior review (+0.8% for Indonesia) did not materialize: Indonesian rubber exports actually fell 21% year-over-year, a sharp miss against that forecast and a meaningful worsening on top of the already-confirmed structural decline (-35%+ since the 2012-2019 peak). The real, confirmed 2026 supply-demand gap of roughly 0.4 million metric tons (Mordor Intelligence) is now understating the severity if Indonesia's export miss is representative of output more broadly.",
    lastUpdated: "Analyst review, Sep 2026 — real TDD Global/Chemical Market Analytics/Mordor Intelligence data, no reliable live feed exists (no corporate anchor — smallholder-farmer-dominated production)",
    dataPoint: "Indonesia exports: -21% YoY vs. forecast +0.8% · Indonesia structural decline: -35%+ since 2012-2019 peak · Real 2026 supply-demand gap: ~0.4M metric tons (baseline, likely understated now)",
    previousValue: 0.58,
    reviewedAt: "2026-09-30",
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
    value: "Hormuz reopened, but NBR still elevated — now pulled by NR itself",
    trend: "easing from acute crisis, though not fully resolved",
    keyFact: "REVERSED 2026-09-30: the Hormuz Strait, closed since March 2026 and the original driver of this signal, REOPENED in April 2026 under a ceasefire — resolving the acute naphtha-supply-shock mechanism that doubled NBR prices earlier in the year. However, NBR prices remain elevated and are still rising (~$2.62/kg, +6.5% month-over-month as of Sept 2026) — now pulled up by the natural-rubber price spike itself (see rss3_spot_price, tsr20_spot_price) rather than by the original Hormuz-driven feedstock shock. The substitution pressure has changed mechanism, not fully disappeared.",
    lastUpdated: "Analyst review, Sep 2026 — real Tat Win/Top Glove/MARGMA and ceasefire reporting, no reliable live feed exists",
    dataPoint: "Hormuz Strait: reopened Apr 2026 under ceasefire · NBR price: ~$2.62/kg, +6.5% MoM (Sept 2026) — rising on NR-price contagion, not renewed feedstock shock",
    previousValue: 0.8,
    reviewedAt: "2026-09-30",
  },
  china_rubber_stockpiling: {
    value: "Imports hit a 6-year low, destocking accelerating",
    trend: "declining buffer, now more severe than the prior review",
    keyFact: "UPDATED 2026-09-30: the destocking trend confirmed in the prior review has deepened — Chinese natural rubber imports fell to a 6-year low of 486,000 tonnes in August 2026, and Qingdao Bonded Zone inventory fell a further 17,400 tonnes the week of Sept 18, continuing the drawdown from April's record high of 371,100 tonnes. Still fundamentally a financial/credit-driven constraint (tire makers reducing import volumes) rather than acute physical scarcity, but the buffer stock cushion is now thinner than it was in the prior review.",
    lastUpdated: "Analyst review, Sep 2026 — real SCI99/China Rubber Industry Association/Business Recorder data, no reliable live feed exists",
    dataPoint: "Chinese NR imports: 486kt (Aug 2026), 6-year low · Qingdao Bonded Zone: -17.4kt (week of Sept 18, 2026), continuing the drawdown from the Apr 2026 record high of 371.1kt",
    previousValue: 0.58,
    reviewedAt: "2026-09-30",
  },
  weather_disruption_risk: {
    value: "Reversed: Thai monsoon flooding now curbing tapping",
    trend: "disruptive, confirming the structural vulnerability flagged in August",
    keyFact: "Updated 2026-09-27: the favorable May 2026 Thai rainfall has reversed — heavy monsoon flooding through September is now curbing tapping activity, the same structural vulnerability flagged (but not yet realized) in the August review. This compounds a new driver not previously captured: Ivory Coast port congestion is adding further disruption to natural rubber logistics. Together these sit behind the confirmed move to a 254 cents/kg benchmark price on Sept 25 2026 — the highest since 2013.",
    lastUpdated: "Analyst review, Sept 2026 — real TDD Global/European Rubber Journal/trade press data, NOAA live integration remains deferred",
    dataPoint: "Sept 2026: Thai monsoon flooding curbing tapping · New driver: Ivory Coast port congestion · Benchmark rubber price: 254 cents/kg (Sept 25 2026), +46.74% YoY, highest since 2013",
  },
  rss3_spot_price: {
    value: "254 cents/kg (TOCOM, Sept 25 2026), highest since 2013",
    trend: "escalating sharply, breaking out of the 2026 band",
    keyFact: "Updated 2026-09-27: RSS3 has broken decisively out of the mid-range stability confirmed in August. TOCOM RSS3 hit 254 cents/kg on Sept 25 2026 — up 46.74% year-over-year and the highest level since 2013 — driven by the reversed Thai weather picture (weather_disruption_risk) and new Ivory Coast port congestion pressure on top of the substitution dynamics already confirmed severe in synthetic_rubber_substitution.",
    lastUpdated: "Analyst review, Sept 2026 — real TOCOM/trade press data, no reliable live feed exists",
    dataPoint: "RSS3/benchmark rubber: 254 cents/kg (TOCOM, Sept 25 2026), +46.74% YoY, highest since 2013",
  },
  tsr20_spot_price: {
    value: "Elevated further through Sept 2026, tracking the benchmark's 13-year high",
    trend: "escalating, acute",
    keyFact: "Updated 2026-09-27: the +7% MoM move confirmed in July has continued to build through September, tracking the broader benchmark rubber price's climb to 254 cents/kg (Sept 25 2026) — the highest since 2013. The same substitution dynamic confirmed severe in synthetic_rubber_substitution remains the dominant driver, now compounded by the Ivory Coast port congestion and reversed Thai weather picture flagged in weather_disruption_risk. TSR20 remains the preferred feedstock of the global tire industry (JPX), keeping this the most directly automotive-relevant price signal in this commodity.",
    lastUpdated: "Analyst review, Sept 2026 — real SGX SICOM/Malaysian Rubber Board/trade press data, no reliable live feed exists",
    dataPoint: "TSR20 tracking benchmark rubber's move to 254 cents/kg (Sept 25 2026), +46.74% YoY, highest since 2013",
  },
  tire_grade_premium: {
    value: "Still widening, inferred — both grades now sharply higher",
    trend: "widening",
    keyFact: "Updated 2026-09-27: not a direct measurement — inferred from the same RSS3/TSR20 signals above. Both grades have moved sharply higher through September (the composite benchmark hit 254 cents/kg, +46.74% YoY, the highest since 2013), but TSR20 remains the more acutely pressured tire-preferred grade given its direct tie to the synthetic-substitution dynamics in synthetic_rubber_substitution, so the premium is still assessed as widening rather than converging.",
    lastUpdated: "Analyst review, Sept 2026 — inferred from real RSS3/TSR20 data above, no dedicated live feed exists",
    dataPoint: "Inferred from: both grades tracking the Sept 2026 benchmark move to 254 cents/kg, +46.74% YoY, highest since 2013",
  },
};

export async function fetchForwardSignals(commodity = "semiconductors_mlcc") {
  if (USE_MOCK_DATA) {
    const data = commodity === "lithium_battery" ? MOCK_LITHIUM_FORWARD_SIGNALS
      : commodity === "rare_earth_metals" ? MOCK_RARE_EARTH_FORWARD_SIGNALS
      : commodity === "steel_aluminum" ? MOCK_STEEL_ALUMINUM_FORWARD_SIGNALS
      : commodity === "automotive_resins" ? MOCK_RESINS_FORWARD_SIGNALS
      : commodity === "natural_rubber" ? MOCK_RUBBER_FORWARD_SIGNALS
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
      : MOCK_REGIME_SIGNALS;

    // First live regime signal (spot_prices, via BLS PPI) — same pattern
    // as the forward-signal overrides above, just for the regime side,
    // which had no live-override mechanism at all before this.
    const liveOverrideFetcher =
      commodity === "semiconductors_mlcc" ? fetchLiveSemiconductorRegimeOverrides
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
