// ─────────────────────────────────────────────────────────────────────────────
// liveSignals.js
// FOR-C v3 · Real, live data sources for select signals across both
// Semiconductors & MLCC and Lithium & Battery Materials commodity groups.
//
// CONFIDENCE VARIES BY SOURCE — noted per-function below, not uniform:
//   Federal Register (raw_material_supply_risk, battery_policy_pipeline):
//     fully tested end-to-end in a real browser, confirmed working.
//   GDELT (geopolitical_policy_pipeline): confirmed CORS-blocked as a
//     direct browser call; routed through a backend proxy instead, but
//     that upstream GDELT call itself has been unreliable in real testing
//     (persistent 429s) — infrastructure confirmed correct, GDELT's own
//     reliability is not.
//   FRED (end_market_demand_divergence): backend-proxied (key + CORS both
//     required it), confirmed working end-to-end.
//   SEC EDGAR full-text search (mining_production_guidance): domain
//     confirmed reachable and CORS-open via research, request/response
//     shape corroborated by multiple independent sources with a live
//     worked example — meaningfully more confidence than GDELT/FRED had
//     going in, but still not verified end-to-end in an actual browser by
//     Claude. Verify the LIVE badge the same way as everything else here.
//
// SCORING IS A V1 HEURISTIC, NOT A CALIBRATED MODEL. Document-count-backed
// signals (Federal Register, SEC EDGAR) measure "is regulatory/disclosure
// activity increasing," not "how severe is the current standing
// condition" — a long-standing situation with no new paperwork this
// quarter will score as quiet even if the underlying risk hasn't changed.
// Treat scores as directional, not precise, until there's enough history
// to calibrate against.
// ─────────────────────────────────────────────────────────────────────────────

const FEDERAL_REGISTER_BASE = "https://www.federalregister.gov/api/v1/documents.json";
// SEC EDGAR full-text search (https://efts.sec.gov/LATEST/search-index) is
// no longer called directly from here — see fetchMiningProductionGuidanceLive
// below for why. The URL lives in the backend route now.
const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000"; // same convention as signalSources.js

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Saturating curve: 0 matches still gets a moderate baseline (absence of
// NEW documents doesn't mean absence of an existing restriction already in
// effect — the known Nov 2026 gallium/germanium suspension is a standing
// condition, not something that shows up as fresh document volume every
// day), then climbs with more recent regulatory activity, capped at 1.0.
function scoreFromCount(count, { base = 0.3, perUnit = 0.06, cap = 1.0 } = {}) {
  return Math.min(cap, base + count * perUnit);
}

// ── raw_material_supply_risk — Federal Register ────────────────────────────
// Real public API, no key required. Docs: federalregister.gov/developers/api/v1
export async function fetchRawMaterialSupplyRiskLive() {
  const params = new URLSearchParams({
    "conditions[term]": "gallium germanium semiconductor export control",
    "conditions[publication_date][gte]": daysAgoISO(90),
    per_page: "40",
    order: "newest",
  });

  const res = await fetch(`${FEDERAL_REGISTER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const data = await res.json();

  const count = Number(data?.count ?? data?.results?.length ?? 0);
  const score = scoreFromCount(count);

  return {
    score,
    meta: {
      source: "Federal Register API",
      matchCount: count,
      windowDays: 90,
      mostRecent: data?.results?.[0]?.title || null,
      mostRecentDate: data?.results?.[0]?.publication_date || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ── battery_policy_pipeline — Federal Register (lithium_battery) ──────────
// Same proven pattern as raw_material_supply_risk above — just different
// search terms. SIGNAL_METADATA also lists EUR-Lex and DOE announcements as
// sources for this signal; only the Federal Register portion is built here,
// matching the effort level of what's already confirmed working rather than
// reaching for two more integrations in the same pass.
export async function fetchBatteryPolicyPipelineLive() {
  // Fixed 2026-08-16 — confirmed via real testing that the old
  // space-separated query was matching almost anything mentioning any
  // one of "tariff"/"mineral"/"export" (a Brazil ethanol notice, a
  // 60-country forced-labor tariff notice, a generic regulatory agenda
  // — none of them about lithium batteries at all), while missing a
  // real, current, highly relevant document (BIS restricting "black
  // mass"/lithium-ion battery scrap exports, published Aug 6 2026).
  // Quoted phrases instead of loose words found that real document
  // precisely, with zero noise.
  const params = new URLSearchParams({
    "conditions[term]": '"lithium-ion battery" "export control"',
    "conditions[publication_date][gte]": daysAgoISO(90),
    per_page: "40",
    order: "newest",
  });

  const res = await fetch(`${FEDERAL_REGISTER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const data = await res.json();

  const count = Number(data?.count ?? data?.results?.length ?? 0);
  const score = scoreFromCount(count);

  return {
    score,
    meta: {
      source: "Federal Register API",
      matchCount: count,
      windowDays: 90,
      mostRecent: data?.results?.[0]?.title || null,
      mostRecentDate: data?.results?.[0]?.publication_date || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ── mining_production_guidance — SEC EDGAR full-text search, via backend proxy ──
// CONFIRMED BROKEN as a direct browser call (tested in a real browser,
// 2026-08-12): efts.sec.gov sends no Access-Control-Allow-Origin header,
// despite multiple independent research sources indicating CORS was open.
// That research was wrong, or SEC's policy changed since — either way, the
// browser's actual behavior is what matters, and it's blocked. Same fix as
// geopolitical_policy_pipeline: route through the backend proxy at
// /api/risk/signals/mining-guidance, which does the SEC EDGAR fetch
// server-side and returns the already-scored result.
export async function fetchMiningProductionGuidanceLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/mining-guidance`);
  if (!res.ok) throw new Error(`Mining guidance signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// ── geopolitical_policy_pipeline — GDELT, via backend proxy ─────────────────
// GDELT's DOC 2.0 API sends no Access-Control-Allow-Origin header, so a
// direct browser call was confirmed impossible (see git history — this
// function used to hit GDELT directly and was disabled after that
// confirmation). The backend now proxies it at
// /api/risk/signals/geopolitical (server-to-server, no CORS applies) and
// already does the scoring/response-shaping — this function just calls
// that route and passes the result straight through, no reprocessing needed.
export async function fetchGeopoliticalPolicyPipelineLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/geopolitical`);
  if (!res.ok) throw new Error(`Geopolitical signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// ── end_market_demand_divergence — FRED, via backend proxy ──────────────────
// FRED requires a registered API key (never exposed client-side) and,
// separately, confirmed via research to send no CORS headers regardless of
// key — so this was never going to be a frontend-only integration. Backend
// proxies it at /api/risk/signals/economic-divergence.
// NOTE: this route intentionally returns a clean "not configured" response
// (score: null) until FRED_SERIES_ID is set to a real, deliberately-chosen
// series on the backend — see the TODO on that route. Until then this
// function will throw here and the signal falls back to mock, same as any
// other live-fetch failure.
export async function fetchEndMarketDemandDivergenceLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/economic-divergence`);
  if (!res.ok) throw new Error(`Economic divergence signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// ── Combined fetch ──────────────────────────────────────────────────────────
// Each signal is independently try/caught — one failing (bad CORS, rate
// limit, network blip, backend down) must not take the others down or
// break the page. Returns only the signals that actually succeeded;
// callers should treat missing keys as "fall back to mock" rather than an
// error state.
export async function fetchLiveSemiconductorForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchRawMaterialSupplyRiskLive();
    overrides.raw_material_supply_risk = result;
  } catch (e) {
    console.warn("⚠️ Live raw_material_supply_risk fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchGeopoliticalPolicyPipelineLive();
    overrides.geopolitical_policy_pipeline = result;
  } catch (e) {
    console.warn("⚠️ Live geopolitical_policy_pipeline fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchEndMarketDemandDivergenceLive();
    overrides.end_market_demand_divergence = result;
  } catch (e) {
    // Expected to fail until FRED_SERIES_ID is set to a real value on the
    // backend — that's a deliberate "not configured" response, not a bug.
    console.warn("⚠️ Live end_market_demand_divergence fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchEquipmentOrderBookLive();
    overrides.equipment_order_book = result;
  } catch (e) {
    console.warn("⚠️ Live equipment_order_book fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchFabCapexTrajectoryLive();
    overrides.fab_capex_trajectory = result;
  } catch (e) {
    console.warn("⚠️ Live fab_capex_trajectory fetch failed, falling back to mock:", e);
  }

  return overrides;
}

export async function fetchEquipmentOrderBookLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/equipment-order-book`);
  if (!res.ok) throw new Error(`Equipment order book signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchFabCapexTrajectoryLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/fab-capex-trajectory`);
  if (!res.ok) throw new Error(`Fab capex trajectory signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// Same pattern, lithium_battery commodity group.
export async function fetchLiveLithiumForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchBatteryPolicyPipelineLive();
    overrides.battery_policy_pipeline = result;
  } catch (e) {
    console.warn("⚠️ Live battery_policy_pipeline fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchMiningProductionGuidanceLive();
    overrides.mining_production_guidance = result;
  } catch (e) {
    console.warn("⚠️ Live mining_production_guidance fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── spot_prices — BLS Producer Price Index, via backend proxy ──────────────
// First live REGIME signal (all prior live work was forward signals only).
// Same architectural decision as the forward signals above: given tonight's
// track record — Federal Register worked as a direct browser call, but
// GDELT, FRED, AND SEC EDGAR all turned out CORS-blocked despite research
// suggesting otherwise for the latter two — this goes straight to a
// backend proxy rather than gambling on another failed direct-call attempt.
//
// Real, honest limitation: BLS's semiconductor manufacturing PPI (series
// PCU334413334413) is an industry-wide producer price trend, NOT literal
// DRAM/MLCC spot pricing the way DRAMeXchange/TrendForce would give. It's
// a genuine, free, live proxy for price-direction pressure in the sector —
// same kind of tradeoff as FRED's industrial-production series standing in
// for "end-market demand," not a 1:1 replacement for what spot_prices was
// originally meant to measure.
export async function fetchSpotPricesLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/spot-prices`);
  if (!res.ok) throw new Error(`Spot prices signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchDistributorInventoryLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/distributor-inventory`);
  if (!res.ok) throw new Error(`Distributor inventory signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchSpotLeadTimesLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/lead-times`);
  if (!res.ok) throw new Error(`Lead times signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchLiveSemiconductorRegimeOverrides() {
  const overrides = {};

  try {
    const result = await fetchSpotPricesLive();
    overrides.spot_prices = result;
  } catch (e) {
    console.warn("⚠️ Live spot_prices fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchDistributorInventoryLive();
    overrides.distributor_inventory = result;
  } catch (e) {
    console.warn("⚠️ Live distributor_inventory fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchSpotLeadTimesLive();
    overrides.spot_lead_times = result;
  } catch (e) {
    console.warn("⚠️ Live spot_lead_times fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── Rare Earth Metals — MP Materials capex, via SEC XBRL ───────────────────
// Confirmed real and verified 2026-08-16: MP Materials Corp (NYSE: MP,
// CIK 0001801368) is a genuine US-domestic 10-K filer, exact same
// PaymentsToAcquirePropertyPlantAndEquipment tag already proven for
// Amazon/Microsoft/Alphabet and TSMC/GlobalFoundries. INVERTED scoring —
// see the backend route's own docstring for why growth here means
// de-risking, not stress, the opposite convention from every other
// capex signal.
export async function fetchNonChinaReeCapacityLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/non-china-ree-capacity`);
  if (!res.ok) throw new Error(`Non-China REE capacity signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchLiveRareEarthForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchNonChinaReeCapacityLive();
    overrides.non_china_ree_capacity = result;
  } catch (e) {
    console.warn("⚠️ Live non_china_ree_capacity fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchChinaReeExportPolicyLive();
    overrides.china_ree_export_policy = result;
  } catch (e) {
    console.warn("⚠️ Live china_ree_export_policy fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchDefenseDemandSignalLive();
    overrides.defense_demand_signal = result;
  } catch (e) {
    console.warn("⚠️ Live defense_demand_signal fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchEvWindDemandDivergenceLive();
    overrides.ev_wind_demand_divergence = result;
  } catch (e) {
    console.warn("⚠️ Live ev_wind_demand_divergence fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── ev_wind_demand_divergence — GE Vernova real order backlog, via SEC XBRL ──
// Built 2026-08-16. NOT inverted, unlike non_china_ree_capacity and
// defense_demand_signal — this tracks DEMAND (growing wind turbine
// backlog = more competition for the same magnet supply automotive
// customers want = real pressure, raises the score), not supply coming
// online. Real confirmed data: most recent quarter (Jun 30 2026) shows
// +37.0% YoY, genuinely accelerating vs the full-year +26.2% comparison.
export async function fetchEvWindDemandDivergenceLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/ev-wind-demand-divergence`);
  if (!res.ok) throw new Error(`EV/wind demand divergence signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// ── defense_demand_signal — USASpending (backend) + Federal Register ───────
// Built 2026-08-16. Two real sources combined because neither alone
// captures the full picture: MP Materials' headline $400M DoD equity
// investment flows through DPA Title III Section 303 authority, which
// deliberately exempts itself from normal contracting — it will never
// show up in USASpending's contract search. What that search DOES
// capture: real, confirmed procurement contracts (e.g., a real $10.99M
// NdPr oxide contract, July 2024). Federal Register sometimes captures
// DPA Title III / equity-adjacent actions instead (a real Presidential
// Determination was found Aug 4 2026). INVERTED scoring throughout, same
// convention as non_china_ree_capacity: more confirmed activity in
// EITHER channel means de-risking, lowers the score — combined via MIN
// (whichever channel shows the strongest evidence of an active
// relationship wins), not averaged, so a quiet channel doesn't dilute
// real signal from the other one.
export async function fetchDefenseDemandFederalRegisterLive() {
  const params = new URLSearchParams({
    "conditions[term]": '"MP Materials" "Defense Production Act"',
    "conditions[publication_date][gte]": daysAgoISO(180),
    per_page: "40",
    order: "newest",
  });

  const res = await fetch(`${FEDERAL_REGISTER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const data = await res.json();
  const count = Number(data?.count ?? data?.results?.length ?? 0);

  // INVERTED from scoreFromCount's usual direction: more documents means
  // more confirmed activity, which LOWERS the score here.
  const score = count > 0 ? Math.max(0.2, 0.5 - count * 0.1) : 0.5;

  return {
    score,
    meta: {
      source: "Federal Register API (DPA Title III / MP Materials specific)",
      matchCount: count,
      windowDays: 180,
      mostRecent: data?.results?.[0]?.title || null,
      mostRecentDate: data?.results?.[0]?.publication_date || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function fetchDefenseDemandUsaSpendingLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/defense-demand`);
  if (!res.ok) throw new Error(`Defense demand signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchDefenseDemandSignalLive() {
  const [usaSpendingResult, federalRegisterResult] = await Promise.allSettled([
    fetchDefenseDemandUsaSpendingLive(),
    fetchDefenseDemandFederalRegisterLive(),
  ]);

  const usaSpending = usaSpendingResult.status === "fulfilled" ? usaSpendingResult.value : null;
  const federalRegister = federalRegisterResult.status === "fulfilled" ? federalRegisterResult.value : null;

  if (!usaSpending && !federalRegister) {
    throw new Error("Both defense demand sources failed");
  }
  if (!usaSpending) return federalRegister;
  if (!federalRegister) return usaSpending;

  // Take whichever shows the strongest real evidence of an active
  // relationship — the LOWER score, under this signal's inverted
  // convention.
  const winner = usaSpending.score <= federalRegister.score ? usaSpending : federalRegister;
  return {
    score: winner.score,
    meta: {
      ...winner.meta,
      combinedFrom: "usaSpending + federalRegister, lower score wins (inverted convention)",
      usaSpendingScore: usaSpending.score,
      federalRegisterScore: federalRegister.score,
    },
  };
}

// ── china_ree_export_policy — Federal Register, real US regulatory response ──
// Built 2026-08-16. Federal Register won't contain Chinese MOFCOM
// announcements directly (it's a US publication) — this tracks the US
// regulatory RESPONSE (BIS rules, Presidential Determinations, Commerce
// Department actions), same real distinction already established for
// raw_material_supply_risk. Query tuning, confirmed via real testing:
// "export control" alone returned ZERO hits — too narrow, real US rare
// earth policy language doesn't consistently use that exact phrase.
// Bare "rare earth" alone returned 11 hits, mostly noise (a Brazil
// tariff schedule and an EPA chemical rule both incidentally mention
// rare earth compounds without being genuinely about REE policy at
// all). "rare earth" + "critical minerals" landed at a clean 2 hits,
// including a genuinely significant document: a real Presidential
// Determination invoking the Defense Production Act specifically for
// critical minerals/rare-earth magnet recovery, published Aug 4 2026.
export async function fetchChinaReeExportPolicyLive() {
  const params = new URLSearchParams({
    "conditions[term]": '"rare earth" "critical minerals"',
    "conditions[publication_date][gte]": daysAgoISO(90),
    per_page: "40",
    order: "newest",
  });

  const res = await fetch(`${FEDERAL_REGISTER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const data = await res.json();

  const count = Number(data?.count ?? data?.results?.length ?? 0);
  const score = scoreFromCount(count);

  return {
    score,
    meta: {
      source: "Federal Register API",
      matchCount: count,
      windowDays: 90,
      mostRecent: data?.results?.[0]?.title || null,
      mostRecentDate: data?.results?.[0]?.publication_date || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ── Steel & Aluminum — domestic_capacity_expansion, Nucor + Cleveland-Cliffs ─
// Built 2026-08-17. Backend route was built and tested via curl earlier,
// but never wired to the frontend — confirmed real gap, caught because
// the live score (0.5) happened to round to the exact same value as the
// mock placeholder (also 0.5), so nothing looked visibly broken. Fixed
// now, same pattern as every other live signal.
export async function fetchDomesticCapacityExpansionLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/domestic-capacity-expansion`);
  if (!res.ok) throw new Error(`Domestic capacity expansion signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

// ── section_232_tariff_pipeline — Federal Register, real US tariff policy ───
// Built 2026-08-17. Query tuning, confirmed via real testing: "Section
// 232" + "steel" alone returned 37 hits, mostly noise (dozens of routine
// Foreign-Trade Zone production notices for unrelated products that just
// reference steel/aluminum duty treatment as boilerplate). Adding
// "derivative articles" — genuine Section 232 legal terminology used in
// the real, substantive actions but not in FTZ boilerplate — narrowed
// this to a clean 6 hits, including real, current actions: a June 2026
// tariff-adjustment proclamation and an August 2026 public comment
// request on additional derivative products.
export async function fetchSection232TariffPipelineLive() {
  const params = new URLSearchParams({
    "conditions[term]": '"Section 232" "derivative articles"',
    "conditions[publication_date][gte]": daysAgoISO(90),
    per_page: "40",
    order: "newest",
  });

  const res = await fetch(`${FEDERAL_REGISTER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
  const data = await res.json();

  const count = Number(data?.count ?? data?.results?.length ?? 0);
  const score = scoreFromCount(count);

  return {
    score,
    meta: {
      source: "Federal Register API",
      matchCount: count,
      windowDays: 90,
      mostRecent: data?.results?.[0]?.title || null,
      mostRecentDate: data?.results?.[0]?.publication_date || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ── aluminum_capacity_signal — Alcoa + Century Aluminum, via SEC XBRL ──────
// Built 2026-08-17. INVERTED, same convention as domestic_capacity_expansion.
export async function fetchAluminumCapacitySignalLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/aluminum-capacity-signal`);
  if (!res.ok) throw new Error(`Aluminum capacity signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchLiveSteelAluminumForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchDomesticCapacityExpansionLive();
    overrides.domestic_capacity_expansion = result;
  } catch (e) {
    console.warn("⚠️ Live domestic_capacity_expansion fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchSection232TariffPipelineLive();
    overrides.section_232_tariff_pipeline = result;
  } catch (e) {
    console.warn("⚠️ Live section_232_tariff_pipeline fetch failed, falling back to mock:", e);
  }

  try {
    const result = await fetchAluminumCapacitySignalLive();
    overrides.aluminum_capacity_signal = result;
  } catch (e) {
    console.warn("⚠️ Live aluminum_capacity_signal fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── Automotive Resins & Plastics — domestic_polymer_capacity, via SEC XBRL ──
// Built 2026-08-18. Celanese + Eastman Chemical, same proven capex tag as
// 11 other companies this project. INVERTED, same convention as
// domestic_capacity_expansion.
export async function fetchDomesticPolymerCapacityLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/domestic-polymer-capacity`);
  if (!res.ok) throw new Error(`Domestic polymer capacity signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchLiveResinsForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchDomesticPolymerCapacityLive();
    overrides.domestic_polymer_capacity = result;
  } catch (e) {
    console.warn("⚠️ Live domestic_polymer_capacity fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── Natural Rubber — tire_manufacturer_demand, via SEC XBRL ─────────────────
// Built 2026-08-18. Goodyear Tire & Rubber Co, same proven capex tag as
// 11 other companies this project — the 12th confirmed reuse. A
// demand-side anchor, not supply-side, since no large corporate natural
// rubber producer exists (production is smallholder-farmer-dominated
// across Thailand, Indonesia, Vietnam, and Malaysia).
export async function fetchTireManufacturerDemandLive() {
  const res = await fetch(`${API_BASE}/api/risk/signals/tire-manufacturer-demand`);
  if (!res.ok) throw new Error(`Tire manufacturer demand signal proxy HTTP ${res.status}`);
  const data = await res.json();
  if (data?.score == null) throw new Error(data?.meta?.error || "Backend returned no score");
  return data;
}

export async function fetchLiveRubberForwardOverrides() {
  const overrides = {};

  try {
    const result = await fetchTireManufacturerDemandLive();
    overrides.tire_manufacturer_demand = result;
  } catch (e) {
    console.warn("⚠️ Live tire_manufacturer_demand fetch failed, falling back to mock:", e);
  }

  return overrides;
}

// ── Signals with a live source, per commodity ──────────────────────────────
// Keep in sync with the fetchLive*Overrides functions above. Used to flag
// snapshots where a live signal failed and silently fell back to its mock
// value, so fetch noise can be told apart from real movement in history.
export const LIVE_SOURCE_KEYS = {
  semiconductors_mlcc: [
    "raw_material_supply_risk", "geopolitical_policy_pipeline", "end_market_demand_divergence",
    "equipment_order_book", "fab_capex_trajectory",
    "spot_prices", "distributor_inventory", "spot_lead_times",
  ],
  lithium_battery:   ["battery_policy_pipeline", "mining_production_guidance"],
  rare_earth_metals: ["non_china_ree_capacity", "china_ree_export_policy", "defense_demand_signal", "ev_wind_demand_divergence"],
  steel_aluminum:    ["domestic_capacity_expansion", "section_232_tariff_pipeline", "aluminum_capacity_signal"],
  automotive_resins: ["domestic_polymer_capacity"],
  natural_rubber:    ["tire_manufacturer_demand"],
};

// Builds the raw_signals payload saved with each daily snapshot.
export function buildSnapshotRawSignals(commodityKey, fwd, reg, profile) {
  const liveKeys = [...(fwd.liveKeys || []), ...(reg.liveKeys || [])];
  const fallbackKeys = (LIVE_SOURCE_KEYS[commodityKey] || []).filter((k) => !liveKeys.includes(k));
  return {
    forward: fwd.signals,
    regime: reg.signals,
    current_composite: profile.riskScore.current.score,
    future_composite: profile.riskScore.future.score,
    grid_cell: profile.riskScore.gridCell,
    live_keys: liveKeys,
    fallback_keys: fallbackKeys, // had a live source but used mock on this load
  };
}
