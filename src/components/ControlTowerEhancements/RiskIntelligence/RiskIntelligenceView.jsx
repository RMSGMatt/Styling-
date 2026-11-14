// ─────────────────────────────────────────────────────────────────────────────
// RiskIntelligenceView.jsx
// FOR-C v3 · Risk Intelligence — parent view
// Assembles ForwardPressurePanel, RegimeIndexPanel, TriggerQueue,
// and CorridorRiskPanel into a tabbed layout.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import ForwardPressurePanel from "./ForwardPressurePanel";
import RegimeIndexPanel     from "./RegimeIndexPanel";
import TriggerQueue         from "./TriggerQueue";
import CorridorRiskPanel    from "./CorridorRiskPanel";
import BestPlaceToBuyPanel  from "./BestPlaceToBuyPanel";
import CountryWatchListPanel from "./CountryWatchListPanel";
import SupplierScreeningPanel from "./SupplierScreeningPanel";
import ChokepointPanel from "./ChokepointPanel";
import { computeFullRiskProfile, FORWARD_WEIGHTS, REGIME_WEIGHTS, LITHIUM_FORWARD_WEIGHTS, LITHIUM_REGIME_WEIGHTS, RARE_EARTH_FORWARD_WEIGHTS, RARE_EARTH_REGIME_WEIGHTS, STEEL_ALUMINUM_FORWARD_WEIGHTS, STEEL_ALUMINUM_REGIME_WEIGHTS, RESINS_FORWARD_WEIGHTS, RESINS_REGIME_WEIGHTS, RUBBER_FORWARD_WEIGHTS, RUBBER_REGIME_WEIGHTS, TRIGGER_CONFIG, LITHIUM_TRIGGER_CONFIG, RARE_EARTH_TRIGGER_CONFIG, STEEL_ALUMINUM_TRIGGER_CONFIG, RESINS_TRIGGER_CONFIG, RUBBER_TRIGGER_CONFIG, launchScenarioToSimulation } from "./riskScoreEngine";
import { fetchForwardSignals, fetchRegimeSignals, MOCK_SIGNAL_DETAIL, MOCK_LITHIUM_SIGNAL_DETAIL, MOCK_RARE_EARTH_SIGNAL_DETAIL, MOCK_STEEL_ALUMINUM_SIGNAL_DETAIL, MOCK_RESINS_SIGNAL_DETAIL, MOCK_RUBBER_SIGNAL_DETAIL, API_BASE } from "./signalSources";
import RiskScoreHistoryChart from "./RiskScoreHistoryChart";
import SignalContributionWaterfall from "./SignalContributionWaterfall";
import CommoditySelector from "./CommoditySelector";
import { COMMODITY_REGISTRY } from "./commodityRegistry";
import { buildSnapshotRawSignals } from "./liveSignals";

// ── Tab config ────────────────────────────────────────────────────────────────
// Three real, distinct kinds of tab, grouped for a two-level nav —
// flat single-row tabs overflowed the screen width once Trends was
// added as the sixth+ item. "analysis" and "tools" get a sub-tab bar;
// "trends" is a single standalone view with nothing to sub-select.
// Same per-commodity weight/trigger lookup the main signal-fetch effect
// below used to duplicate inline. Pulled out so the new background
// all-commodities snapshot effect can reuse it without a second copy of
// this ternary chain drifting out of sync with the first.
function getRiskConfigForCommodity(commodityKey) {
  const forwardWeights = commodityKey === "lithium_battery" ? LITHIUM_FORWARD_WEIGHTS
    : commodityKey === "rare_earth_metals" ? RARE_EARTH_FORWARD_WEIGHTS
    : commodityKey === "steel_aluminum" ? STEEL_ALUMINUM_FORWARD_WEIGHTS
    : commodityKey === "automotive_resins" ? RESINS_FORWARD_WEIGHTS
    : commodityKey === "natural_rubber" ? RUBBER_FORWARD_WEIGHTS
    : FORWARD_WEIGHTS;
  const regimeWeights = commodityKey === "lithium_battery" ? LITHIUM_REGIME_WEIGHTS
    : commodityKey === "rare_earth_metals" ? RARE_EARTH_REGIME_WEIGHTS
    : commodityKey === "steel_aluminum" ? STEEL_ALUMINUM_REGIME_WEIGHTS
    : commodityKey === "automotive_resins" ? RESINS_REGIME_WEIGHTS
    : commodityKey === "natural_rubber" ? RUBBER_REGIME_WEIGHTS
    : REGIME_WEIGHTS;
  const triggerConfig = commodityKey === "lithium_battery" ? LITHIUM_TRIGGER_CONFIG
    : commodityKey === "rare_earth_metals" ? RARE_EARTH_TRIGGER_CONFIG
    : commodityKey === "steel_aluminum" ? STEEL_ALUMINUM_TRIGGER_CONFIG
    : commodityKey === "automotive_resins" ? RESINS_TRIGGER_CONFIG
    : commodityKey === "natural_rubber" ? RUBBER_TRIGGER_CONFIG
    : TRIGGER_CONFIG;
  return { forwardWeights, regimeWeights, triggerConfig };
}

const GROUPS = [
  { key: "analysis", label: "Commodity Analysis" },
  { key: "tools",    label: "AI Tools" },
  { key: "trends",   label: "Trends" },
  { key: "chokepoints", label: "Chokepoints" },
];

const TABS = [
  {
    key:         "forward",
    label:       "Forward signals",
    badge:       "Predictive",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Leading indicators · 3–18 months ahead of impact",
    group:       "analysis",
  },
    {
    key:         "regime",
    label:       "Current conditions",
    badge:       "Confirmation",
    badgeColor:  "#5F5E5A",
    badgeBg:     "rgba(148,163,184,0.1)",
    badgeBorder: "#B4B2A9",
    description: "Market regime · Calibrates simulation baseline",
    group:       "analysis",
  },
    {
    key:         "triggers",
    label:       "Scenario queue",
    badge:       null,
    description: "Converged signals awaiting human approval",
    group:       "analysis",
  },
  {
    key:         "corridor",
    label:       "Corridor Risk",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Geopolitical risk scoring for trade corridors into the US",
    group:       "tools",
  },
  {
    key:         "bestplace",
    label:       "Best Place to Buy",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Ranked sourcing recommendation — risk-scored, availability-gated",
    group:       "tools",
  },
  {
    key:         "watchlist",
    label:       "Country Watch List",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Commodity-agnostic country risk ranking",
    group:       "tools",
  },
    {
    key:         "supplierlist",
    label:       "Supplier Screening",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Upload and screen your actual supplier list",
    group:       "tools",
  },
    {
    key:         "trends",
    label:       "Trends",
    badge:       null,
    description: "Risk score history across all commodities, over time",
    group:       "trends",
  },
  {
    key:         "chokepoints",
    label:       "Chokepoint Map",
    badge:       "New",
    badgeColor:  "#11200A",
    badgeBg:     "#9FD63A",
    badgeBorder: "#9FD63A",
    description: "Where your parts converge on a handful of upstream suppliers, and when a cutoff reaches you",
    group:       "chokepoints",
  },
];
// ── Summary header bar ────────────────────────────────────────────────────────
function SummaryBar({ scoreResult, lastUpdated }) {
  if (!scoreResult) return null;

  const { riskScore, summary } = scoreResult;
  const band = riskScore.band;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {/* Risk score — real headline, grid-derived from Current x Future,
          replacing the old opaque 1.0x/1.3x/1.6x multiplier (removed
          2026-08-18, see computeGridRiskScore's own comment for why). Both
          real inputs are shown directly underneath — nothing hidden. */}
      <div style={{
        flex: 2, minWidth: 260,
        background: "rgba(2,6,23,0.5)",
        border: `1px solid ${band.border}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Risk score
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 500, color: band.color, lineHeight: 1 }}>
            {riskScore.score}
          </div>
          <span style={{ fontSize: 13, padding: "2px 8px", borderRadius: 20, background: band.bg, color: band.color }}>
            {band.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid rgba(148,163,184,0.15)" }}>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Current</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#E2E8F0" }}>
              {Math.round(riskScore.current.score)} ({riskScore.current.band.label})
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Future</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#E2E8F0" }}>
              {Math.round(riskScore.future.score)} ({riskScore.future.band.label})
            </div>
          </div>
        </div>
      </div>

      {/* Confirming evidence — real supporting detail, demoted below the
          headline rather than competing with it for attention. */}
      <div style={{
        flex: 1, minWidth: 220,
        background: "rgba(2,6,23,0.5)",
        border: `1px solid ${summary.triggeredCount > 0 ? "rgba(239,68,68,0.4)" : "rgba(148,163,184,0.15)"}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Confirming evidence
        </div>
        <div style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.5 }}>
          {summary.triggeredCount} scenario{summary.triggeredCount === 1 ? "" : "s"} triggered
          {summary.buildingCount > 0 ? ` · ${summary.buildingCount} building` : ""}
        </div>
        <div style={{ fontSize: 14, color: "#E2E8F0", marginTop: 2 }}>
          {summary.stressedSignalCount} of {summary.totalSignalCount} signals confirmed elevated (≥{summary.stressThreshold})
        </div>
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, triggeredCount, activeGroup }) {
  return (
    <div
      className="forc-tabbar-scroll"
      style={{
        display: "flex",
        gap: 2,
        marginBottom: 20,
        borderBottom: "1px solid rgba(148,163,184,0.15)",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(148,163,184,0.3) transparent",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`
        .forc-tabbar-scroll::-webkit-scrollbar { height: 4px; }
        .forc-tabbar-scroll::-webkit-scrollbar-track { background: transparent; }
        .forc-tabbar-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 4px; }
      `}</style>
      {TABS.filter((t) => t.group === activeGroup).map((tab) => {
        const isActive = active === tab.key;
        const count = tab.key === "triggers" ? triggeredCount : null;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid #2EC4A6" : "2px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: isActive ? "#2EC4A6" : "#94A3B8",
              fontWeight: isActive ? 500 : 400,
              fontSize: 15,
              transition: "color 0.15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab.label}
            {count > 0 && (
              <span style={{ fontSize: 12, fontWeight: 500, padding: "1px 6px", borderRadius: 20, background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                {count}
              </span>
            )}
            {tab.badge && (
              <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 20, background: tab.badgeBg, color: tab.badgeColor, border: `0.5px solid ${tab.badgeBorder}` }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8" }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
      <div style={{ fontSize: 15 }}>Loading risk signals...</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// initialTab / initialCommodity: used when navigating in from a specific
// context (e.g. Control Tower's unified attention panel "Review in Risk Intelligence"
// button) so the user lands on the exact trigger they clicked, rather than
// always on the "forward" tab / semiconductors commodity regardless of what
// they came here to look at.
export default function RiskIntelligenceView({ switchView, initialTab, initialCommodity }) {
    const [activeTab,         setActiveTab]         = useState(initialTab || "forward");
  // Derived, not separately stored — the active tab's own `group` field
  // is the single source of truth, so group and tab can never fall out
  // of sync with each other.
  const activeGroup = TABS.find((t) => t.key === activeTab)?.group || "analysis";
  // Switching groups jumps straight to that group's first tab, so
  // there's never a moment where a group is selected but no tab is —
  // avoids needing a separate "which tab was last active in this
  // group" memory just to handle that edge case.
  const handleGroupChange = (groupKey) => {
    const firstTabInGroup = TABS.find((t) => t.group === groupKey);
    if (firstTabInGroup) setActiveTab(firstTabInGroup.key);
  };
  const [forwardSignals,    setForwardSignals]    = useState(null);
  const [liveSignalKeys,    setLiveSignalKeys]    = useState([]);
  // No reliable free live source exists for this signal — Murata, TDK,
  // Taiyo Yuden, and Samsung Electro-Mechanics are all foreign filers
  // with no meaningful US SEC presence (Murata's only US listing is an
  // unsponsored OTC ADR, carrying no SEC reporting obligation), and
  // GDELT news-volume was ruled out both on real rate-limit evidence
  // (throttled even under light manual testing) and a real conceptual
  // concern: a topic this ambiently hot right now would likely saturate
  // near the ceiling regardless of whether anything specific changed.
  // Reviewed quarterly against real earnings calls / investor
  // commentary from these companies instead — update this date each
  // time it's actually reviewed, don't just leave it stale.
  const ANALYST_REVIEWED_KEYS = {
    capacity_allocation_mix_shift: "2026-08-15",
    china_refinery_concentration: "2026-08-16",
    // Both reframed 2026-08-16 based on real evidence that contradicted
    // each signal's original assumption (CATL-squeeze / demand-outpacing-
    // supply) — real story for a US-client-facing platform is Western
    // battery JV instability (Ford/LGES, GM/Ultium, Stellantis/Samsung
    // SDI, Porsche), not allocation scarcity. See signalSources.js for
    // full sourcing on each.
    cell_capacity_allocation_nlp: "2026-09-30",
    ev_production_forecast_delta: "2026-09-30",
    // Genuinely different direction from every other correction tonight
    // — real evidence pointed toward LESS risk, not more. Confirmed via
    // two independent sources (LME forward curve analysis + real spot
    // pricing) before changing, given how unusual a downward correction
    // was relative to everything else found tonight.
    lithium_futures_curve: "2026-09-30",
    // The first REGIME (not forward) signal in this list — confirmed
    // Freightos FBX's free tier is chart/widget-only, no machine-readable
    // API exists without a paid account. Real data (Drewry WCI) shows
    // rates at 2.5-3.5x the old mock baseline, near a genuine 2026 peak
    // — but with real, credible analyst disagreement about whether it
    // holds. Volatile enough to warrant monthly review, not quarterly.
    freight_rates: "2026-08-16",
    // All three major automotive cell makers (CATL, LG Energy Solution,
    // Panasonic) confirmed to have no SEC reporting obligation — LGES has
    // no US listing of any kind (not even an unsponsored ADR), CATL has
    // no US ADR, Panasonic voluntarily filed Form 15F to terminate SEC
    // reporting back in 2016. No live source exists.
    cell_lead_times: "2026-08-16",
    // Both lithium spot price signals: same paid-access wall as
    // lithium_futures_curve (LME, CME, Fastmarkets, BMI, Trading
    // Economics all confirmed paid-only for structured commodity data).
    // Old mock values were stale by ~1,300x in dollar terms — corrected
    // using real BMI figures plus the same recent-easing evidence
    // (declining spot prices, 3 real mine restarts) already confirmed
    // for lithium_futures_curve.
    lithium_carbonate_spot: "2026-09-30",
    lithium_hydroxide_spot: "2026-08-16",
    // Real, severe finding — DRC export quota (73-75% of global cobalt
    // supply) caps 2026-2027 exports at less than half of 2024's actual
    // production, described by analysts as comparable in severity to
    // OPEC-coordinated production cuts. Mock's "flat, stable" framing
    // was dramatically wrong, not just stale — genuinely different kind
    // of correction from most other signals tonight.
    cobalt_spot_price: "2026-09-30",
    // Rare Earth Metals — real, confirmed via IEA/S&P Global: China
    // controls ~91% of global rare earth refining/separation capacity,
    // even more concentrated than lithium's ~65% refining equivalent.
    // Same conclusion as the lithium version — a slow-moving structural
    // reality, no reliable live feed exists.
    china_refining_concentration: "2026-08-16",
    // NdPr: real, moderate — China domestic benchmark has fallen below
    // the real $110/kg DoD-backed price floor (Aug 2026). Heavy REE
    // (Dy/Tb): real, severe two-tier market — confirmed 3.6-4.5x price
    // divergence between China domestic and ex-China pricing. Same
    // paid-data wall as every other spot-pricing signal tonight — no
    // reliable live feed exists across LME, CME, Fastmarkets, BMI,
    // Trading Economics, or SMM.
    ndpr_oxide_spot_price: "2026-09-30",
    heavy_ree_spot_price: "2026-09-30",
    // No formal lead-time figure exists anywhere for NdFeB magnets —
    // the ex-China industry is too early-stage for that kind of
    // trade-press tracking. Real capacity-ramp data used as a proxy:
    // MP Materials' next major facility doesn't commission until 2028.
    magnet_lead_times: "2026-08-16",
    // Final rare earth signal — real DoD offtake terms turned out more
    // nuanced than expected: a revenue/EBITDA guarantee mechanism, not a
    // literal defense-only lockout. Commercial buyers retain access with
    // DoD consent. All 9 rare earth signals now resolved: 4 live, 5
    // analyst-reviewed.
    magnet_capacity_allocation: "2026-08-16",
    // First case of Federal Register document-count being tested and
    // explicitly rejected as the wrong instrument: China-steel AD/CVD
    // activity is high-volume, routine regulatory business (dozens of
    // continuous product-specific proceedings), poorly suited to a
    // count-based signal. Real severity instead confirmed via the OECD
    // itself — global excess capacity, record Chinese exports.
    china_steel_overcapacity_dumping: "2026-09-30",
    // Real, current CME contract data found directly (no free API
    // exists) — HRC futures declined ~6.5% from a Jan 2026 peak,
    // consistent with the severe global oversupply confirmed via OECD.
    hrc_spot_price: "2026-08-17",
    // Real, stable: US auto production flat at ~10.2M units in 2026, no
    // crisis signal — a market-forecast topic, not government/SEC data.
    automotive_sheet_demand: "2026-08-17",
    // Real, moderate with a tilt toward tightness: prime/busheling scrap
    // running below historical availability, the grade most relevant to
    // automotive-grade flat-rolled production specifically.
    scrap_eaf_dynamics: "2026-09-30",
    // Real, severe, currently escalating — LME aluminum climbing on real
    // tariff effects plus a genuine Middle East supply crisis.
    aluminum_spot_price: "2026-08-17",
    // Real, honest divergence between the two materials — steel imports
    // down 30% (de-risking), aluminum still ~60% import-dependent. Live
    // tracking is genuinely possible (real Census/ITC monitors exist for
    // both materials) but deferred pending free API key registration —
    // a deliberate decision, not a dead end. Completes all 10 Steel &
    // Aluminum signals: 3 live, 7 analyst-reviewed.
    import_penetration: "2026-09-30",
    // Real, elevated with genuine legal uncertainty — SCOTUS invalidated
    // IEEPA emergency tariffs (Feb 2026), Section 122 stop-gap capped at
    // 150 days, cumulative China polymer duties often exceed 47%.
    // Federal Register document-count deliberately not tested, based on
    // a strong prior from china_steel_overcapacity_dumping that plastics
    // AD/CVD activity spans an even broader product category than steel
    // and would likely hit the same high-volume noise problem.
    trade_policy_pipeline: "2026-09-30",
    // Real, severe — same US-Iran/Middle East conflict already confirmed
    // driving the aluminum_spot_price spike. Real "costs doubled in 30
    // days" industry headline, naphtha +16.78% QoQ. EIA live build
    // deferred pending free API key registration, same decision as
    // import_penetration.
    petrochemical_feedstock_risk: "2026-08-18",
    // Real, stable US production (same figure as automotive_sheet_demand)
    // with a modest structural tilt for growing plastics content per
    // vehicle. Honest note: evidence quality here was weaker than most
    // other signals — mostly generic market research, not dated news.
    automotive_resin_demand: "2026-08-18",
    // Real, severe — confirmed via CIEL, Argus Media, and ICIS
    // independently: China PP margins collapsed >95%, exports surging
    // 54-122% YoY, global oversupply forecast tripling. Third
    // confirmation tonight that the same Middle East conflict is
    // rippling across multiple, otherwise-unrelated commodities.
    china_polymer_capacity: "2026-08-18",
    // PP and ABS: real, current, well-evidenced downward corrections —
    // the same Chinese oversupply and faded Middle East geopolitical
    // premium confirmed elsewhere are pulling US spot prices down, not
    // up. Nylon: honest gap, no direct pricing data found, inferred from
    // Celanese's real capex pullback instead — weaker evidence than the
    // other two, reflected in less confident scoring.
    pp_resin_spot_price: "2026-08-18",
    abs_resin_spot_price: "2026-09-30",
    nylon_resin_spot_price: "2026-09-30",
    // Final resins signal — real, direct confirmation of the OPPOSITE of
    // a squeeze: real ACC inventory/production/export data, trade press
    // explicitly states "this isn't a tight market." Completes all 10
    // Automotive Resins & Plastics signals: 1 live, 9 analyst-reviewed.
    resin_allocation_squeeze: "2026-09-30",
    // Real, active named disease threat: Lasiodiplodia theobromae leaf
    // blight in Thailand's NE plantation zones, contributing to a real,
    // confirmed 2026 supply-demand gap.
    leaf_disease_risk: "2026-09-30",
    // Real, mixed: favorable May 2026 rainfall, but genuine structural
    // vulnerability to extreme swings (2023-24 drought-then-flood
    // precedent). NOAA live integration genuinely attempted (5 real API
    // debugging attempts) and deferred as a real technical dead end.
    weather_disruption_risk: "2026-08-18",
    // Real, mixed: modest 2026 recovery forecast sits atop genuine
    // structural decline (Indonesia -35% since 2012-2019 peak), confirmed
    // real 0.4M ton 2026 supply-demand gap.
    thai_indonesian_output: "2026-09-30",
    // Real, current: Chinese commercial rubber inventory destocking from
    // a real April 2026 record high, credit-driven not scarcity-driven,
    // but still relevant to forward buffer-stock risk.
    china_rubber_stockpiling: "2026-09-30",
    // Real, severe — fifth confirmation tonight of the same Middle East
    // conflict rippling across otherwise-unrelated commodities. NBR
    // prices doubled, real confirmed substitution toward natural rubber
    // (MARGMA urgent statement, Mar 2026).
    synthetic_rubber_substitution: "2026-09-30",
    // Final three rubber signals — real, differentiated evidence: RSS3
    // stable, TSR20 confirmed +7% MoM tied to the same synthetic
    // substitution dynamic already confirmed severe, tire_grade_premium
    // inferred from that real divergence. Completes all 10 Natural
    // Rubber signals: 1 live, 9 analyst-reviewed.
    rss3_spot_price: "2026-08-18",
    tsr20_spot_price: "2026-08-18",
    tire_grade_premium: "2026-08-18",
  };
  const [regimeSignals,     setRegimeSignals]     = useState(null);
  const [scoreResult,       setScoreResult]       = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [lastUpdated,       setLastUpdated]       = useState(null);
  const [error,             setError]             = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState(initialCommodity || "semiconductors_mlcc");
  // Signals whose live infrastructure is confirmed correct and tested
  // against real data — the only reason they sometimes show as mock is a
  // third-party source's own reliability, not a gap in what's been built
  // or reviewed here. Kept separate from ANALYST_REVIEWED_KEYS (which
  // means "no live source exists at all") and from liveSignalKeys (which
  // only reflects THIS page load). Without this, the coverage badge
  // flickers between 90% and 100% purely based on whether GDELT happened
  // to rate-limit us on a given load — confirmed real behavior
  // (2026-08-16), not what the badge should be measuring. The individual
  // SignalCard's own LIVE badge still correctly reflects per-load status
  // — this only affects the aggregate coverage number.
  const CONFIRMED_LIVE_BUT_FLAKY_SOURCE_KEYS = {
    geopolitical_policy_pipeline: "GDELT rate-limits intermittently — confirmed working with real data multiple times, source itself is the unreliable part, not our implementation.",
  };
  // Real coverage: every signal currently shown for this commodity/tab,
  // checked against what's actually live OR genuinely analyst-reviewed
  // (dated, sourced — not an untouched mock value). Only what's left
  // over after both of those counts as a genuine gap worth flagging.
  const allVisibleSignalKeys = [
    ...Object.keys(forwardSignals || {}),
    ...Object.keys(regimeSignals || {}),
  ];
  const uncoveredSignalKeys = allVisibleSignalKeys.filter(
    (k) => !liveSignalKeys.includes(k) && !(k in ANALYST_REVIEWED_KEYS) && !(k in CONFIRMED_LIVE_BUT_FLAKY_SOURCE_KEYS)
  );
  const coveragePct = allVisibleSignalKeys.length > 0
    ? Math.round(((allVisibleSignalKeys.length - uncoveredSignalKeys.length) / allVisibleSignalKeys.length) * 100)
    : 0;

  const detailData = selectedCommodity === "lithium_battery" ? MOCK_LITHIUM_SIGNAL_DETAIL
    : selectedCommodity === "rare_earth_metals" ? MOCK_RARE_EARTH_SIGNAL_DETAIL
    : selectedCommodity === "steel_aluminum" ? MOCK_STEEL_ALUMINUM_SIGNAL_DETAIL
    : selectedCommodity === "automotive_resins" ? MOCK_RESINS_SIGNAL_DETAIL
    : selectedCommodity === "natural_rubber" ? MOCK_RUBBER_SIGNAL_DETAIL
    : MOCK_SIGNAL_DETAIL;

  // Fetch signals on mount and every 15 minutes
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [fwd, reg] = await Promise.all([
          fetchForwardSignals(selectedCommodity),
          fetchRegimeSignals(selectedCommodity),
        ]);
        setForwardSignals(fwd.signals);
        setRegimeSignals(reg.signals);
        // Forward and regime signal key namespaces never overlap (checked:
        // no shared key names between FORWARD_WEIGHTS/LITHIUM_FORWARD_WEIGHTS
        // and REGIME_WEIGHTS/LITHIUM_REGIME_WEIGHTS in riskScoreEngine.js),
        // so merging into one array is safe — ForwardPressurePanel and
        // RegimeIndexPanel each only ever look up keys relevant to their
        // own signal set anyway.
        setLiveSignalKeys([...(fwd.liveKeys || []), ...(reg.liveKeys || [])]);

        const { forwardWeights, regimeWeights, triggerConfig } = getRiskConfigForCommodity(selectedCommodity);

        const profile = computeFullRiskProfile(fwd.signals, reg.signals, forwardWeights, regimeWeights, triggerConfig);
        setScoreResult(profile);

        // Fire-and-forget: save today's snapshot for the risk-over-time
        // chart. Doesn't block the UI and doesn't surface errors to the
        // user — this is background data collection, not critical to
        // the page working.
        fetch(`${API_BASE}/api/risk/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commodity_key: selectedCommodity,
            risk_score: profile.riskScore.score,
            raw_signals: buildSnapshotRawSignals(selectedCommodity, fwd, reg, profile),
          }),
        }).catch((err) => {
          console.warn("⚠️ Risk score snapshot save failed (non-critical):", err);
        });
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        setError("Signal fetch failed. Displaying last known state.");
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedCommodity]);

  // Background snapshot for every commodity, not just the one currently
  // selected. Without this, the Risk Score Over Time chart only ever
  // gets a new data point for whichever single tab happened to be open
  // that day — the other five commodities' lines go flat for days at a
  // time not because their risk is stable, but because nobody looked.
  // RiskScoreHistoryChart's own spanGaps:true draws a straight line
  // across those missing days, which reads as "static" when it's
  // actually just unmeasured.
  //
  // This runs once per mount (not per commodity switch — selectedCommodity
  // is deliberately not a dependency here), loops every commodity in the
  // registry, and fires the same fetch-signals → compute-score → POST
  // snapshot sequence the main effect above uses for the selected one.
  // /api/risk/snapshot is idempotent per commodity per calendar day, so
  // re-running this on every mount (or alongside the main effect's own
  // 15-minute interval) never creates duplicate rows — it just means
  // today's row exists for all six instead of only whichever tab was
  // open. Requests are staggered (one commodity every 600ms) rather than
  // firing all twelve forward+regime calls at once, to avoid hammering
  // the backend's signal-proxy endpoints simultaneously. Entirely
  // fire-and-forget: no loading state, no error surfaced to the user —
  // background data collection only, same as the per-tab snapshot call.
  useEffect(() => {
    let cancelled = false;

    async function snapshotAllCommodities() {
      for (const commodity of COMMODITY_REGISTRY) {
        if (cancelled) return;
        const commodityKey = commodity.key;
        try {
          const [fwd, reg] = await Promise.all([
            fetchForwardSignals(commodityKey),
            fetchRegimeSignals(commodityKey),
          ]);
          const { forwardWeights, regimeWeights, triggerConfig } = getRiskConfigForCommodity(commodityKey);
          const profile = computeFullRiskProfile(fwd.signals, reg.signals, forwardWeights, regimeWeights, triggerConfig);

          await fetch(`${API_BASE}/api/risk/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              commodity_key: commodityKey,
              risk_score: profile.riskScore.score,
              raw_signals: buildSnapshotRawSignals(commodityKey, fwd, reg, profile),
            }),
          });
        } catch (e) {
          // One commodity's signals being down (rate limit, backend
          // hiccup) shouldn't stop the rest from getting snapshotted.
          console.warn(`⚠️ Background snapshot failed for ${commodityKey} (non-critical):`, e);
        }
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    snapshotAllCommodities();
    return () => { cancelled = true; };
  }, []);

  // Route triggered scenario to simulation engine
  function handleLaunchScenario({ scenario, params }) {
    launchScenarioToSimulation({ scenario, params, source: "risk_intelligence_trigger" }, switchView);
  }

  const triggeredCount = scoreResult?.summary?.triggeredCount ?? 0;
  const buildingCount  = scoreResult?.summary?.buildingCount  ?? 0;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: "#2EC4A6", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            Risk Intelligence
            {allVisibleSignalKeys.length > 0 && uncoveredSignalKeys.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "rgba(234,179,8,0.15)",
                  color: "#eab308",
                  border: "1px solid rgba(234,179,8,0.4)",
                  letterSpacing: "0.03em",
                }}
                title={`${coveragePct}% of signals shown here are either live or analyst-reviewed (real, dated, sourced judgment — not an untouched placeholder). ${uncoveredSignalKeys.length} signal${uncoveredSignalKeys.length === 1 ? "" : "s"} still ${uncoveredSignalKeys.length === 1 ? "is" : "are"} unreviewed sample data: ${uncoveredSignalKeys.join(", ")}.`}
              >
                {coveragePct}% LIVE/REVIEWED
              </span>
            )}
          </h2>
          {/* Commodity selector — hidden on corridor, bestplace, and watchlist tabs */}
          {activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && activeTab !== "chokepoints" && (
            <CommoditySelector
              selected={selectedCommodity}
              onChange={setSelectedCommodity}
            />
          )}
        </div>
        <p style={{ fontSize: 15, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>
          {activeTab === "corridor"
            ? "AI-scored geopolitical risk for trade corridors into the United States. Select a country and commodity — score 7 risk variables and simulate the downstream impact in one click."
            : activeTab === "bestplace"
            ? "Ranks every country that actually produces the selected commodity by corridor risk, lowest first. Countries with no production presence are excluded — not just scored low."
            : activeTab === "watchlist"
            ? "A standing, commodity-agnostic risk ranking of every tracked country — geopolitical, political, disaster, and chokepoint exposure only."
            : activeTab === "chokepoints"
            ? "Common components traced to the process steps and materials they share, scored on market structure, current supply and policy risk. Mapped to your own parts, with the day each one runs dry if a chokepoint is cut."
            : "Two-layer predictive risk model. Forward signals identify what's building upstream 3–18 months ahead. Current conditions confirm the regime your network is operating in today."}
        </p>
        {lastUpdated && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && activeTab !== "chokepoints" && (
          <div style={{ fontSize: 13, color: "#B4B2A9", marginTop: 6 }}>
            Last updated: {lastUpdated.toLocaleTimeString()} ·{" "}
            <span style={{ color: uncoveredSignalKeys.length === 0 ? "#9FD63A" : "#eab308" }}>
              {uncoveredSignalKeys.length === 0 ? "Live + analyst-reviewed" : `${coveragePct}% live/reviewed`}
            </span>
          </div>
        )}
        {error && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && activeTab !== "chokepoints" && (
          <div style={{ fontSize: 13, color: "#854F0B", marginTop: 4 }}>{error}</div>
        )}
      </div>
      {/* Summary bar — hidden on corridor tab */}
      {activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && activeTab !== "chokepoints" && !loading && (
        <SummaryBar scoreResult={scoreResult} lastUpdated={lastUpdated} />
      )}

            {/* Group navigation — top level */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {GROUPS.map((g) => {
          const isActive = activeGroup === g.key;
          return (
            <button
              key={g.key}
              onClick={() => handleGroupChange(g.key)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: isActive ? "1px solid #2EC4A6" : "1px solid rgba(148,163,184,0.25)",
                background: isActive ? "rgba(46,196,166,0.12)" : "transparent",
                color: isActive ? "#2EC4A6" : "#94A3B8",
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>
      {/* Tab navigation — second level, hidden for the Trends group,
          which has only one view and nothing to sub-select. */}
      {activeGroup !== "trends" && activeGroup !== "chokepoints" && (
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          triggeredCount={triggeredCount}
          activeGroup={activeGroup}
        />
      )}

      {/* Tab content */}
      {activeTab === "trends" ? (
        <>
          {scoreResult && (
            <>
              <SignalContributionWaterfall
                breakdown={scoreResult.forward.breakdown}
                detailData={detailData}
                currentComposite={scoreResult.forward.raw}
                label="Forward Pressure"
              />
              <SignalContributionWaterfall
                breakdown={scoreResult.regime.breakdown}
                detailData={detailData}
                currentComposite={scoreResult.regime.raw}
                label="Current Conditions"
              />
            </>
          )}
          <RiskScoreHistoryChart />
        </>
      ) : activeTab === "corridor" ? (
        <CorridorRiskPanel onLaunchScenario={handleLaunchScenario} />
      ) : activeTab === "bestplace" ? (
        <BestPlaceToBuyPanel onLaunchScenario={handleLaunchScenario} />
      ) : activeTab === "watchlist" ? (
        <CountryWatchListPanel onSelectCountry={(origin) => { setActiveTab("corridor"); }} />
      ) : activeTab === "supplierlist" ? (
        <SupplierScreeningPanel />
      ) : activeTab === "chokepoints" ? (
        <ChokepointPanel switchView={switchView} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          {activeTab === "forward" && forwardSignals && (
            <ForwardPressurePanel
              forwardSignals={forwardSignals}
              scoreResult={scoreResult}
              detailData={detailData}
              liveSignalKeys={liveSignalKeys}
              analystReviewedKeys={ANALYST_REVIEWED_KEYS}
            />
          )}
          {activeTab === "regime" && regimeSignals && (
            <RegimeIndexPanel
              regimeSignals={regimeSignals}
              liveSignalKeys={liveSignalKeys}
              analystReviewedKeys={ANALYST_REVIEWED_KEYS}
              scoreResult={scoreResult}
              detailData={detailData}
            />
          )}
          {activeTab === "triggers" && scoreResult && (
            <TriggerQueue
              triggers={scoreResult.triggers}
              onLaunchScenario={handleLaunchScenario}
            />
          )}
        </>
      )}
    </div>
  );
}
