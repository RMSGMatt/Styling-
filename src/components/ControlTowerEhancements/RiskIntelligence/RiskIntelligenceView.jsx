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
import { computeFullRiskProfile, FORWARD_WEIGHTS, REGIME_WEIGHTS, LITHIUM_FORWARD_WEIGHTS, LITHIUM_REGIME_WEIGHTS, TRIGGER_CONFIG, LITHIUM_TRIGGER_CONFIG, formatScorePercent, getRiskBand, launchScenarioToSimulation } from "./riskScoreEngine";
import { fetchForwardSignals, fetchRegimeSignals, MOCK_SIGNAL_DETAIL, MOCK_LITHIUM_SIGNAL_DETAIL } from "./signalSources";
import CommoditySelector from "./CommoditySelector";
import { COMMODITY_REGISTRY } from "./commodityRegistry";

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  {
    key:         "forward",
    label:       "Forward signals",
    badge:       "Predictive",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Leading indicators · 3–18 months ahead of impact",
  },
  {
    key:         "regime",
    label:       "Current conditions",
    badge:       "Confirmation",
    badgeColor:  "#5F5E5A",
    badgeBg:     "rgba(148,163,184,0.1)",
    badgeBorder: "#B4B2A9",
    description: "Market regime · Calibrates simulation baseline",
  },
  {
    key:         "triggers",
    label:       "Scenario queue",
    badge:       null,
    description: "Converged signals awaiting human approval",
  },
  {
    key:         "corridor",
    label:       "Corridor Risk",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Geopolitical risk scoring for trade corridors into the US",
  },
  {
    key:         "bestplace",
    label:       "Best Place to Buy",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Ranked sourcing recommendation — risk-scored, availability-gated",
  },
  {
    key:         "watchlist",
    label:       "Country Watch List",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Commodity-agnostic country risk ranking",
  },
  {
    key:         "supplierlist",
    label:       "Supplier Screening",
    badge:       "AI",
    badgeColor:  "#185FA5",
    badgeBg:     "#E6F1FB",
    badgeBorder: "#85B7EB",
    description: "Upload and screen your actual supplier list",
  },
];

// ── Summary header bar ────────────────────────────────────────────────────────
function SummaryBar({ scoreResult, lastUpdated }) {
  if (!scoreResult) return null;

  const { forward, regime, summary } = scoreResult;
  const fBand = forward.band;
  const rBand = regime.band;
  // Band for the pre-amplification score, so the KPI card can show whether
  // today's number is high because of the underlying signals or because of
  // the regime multiplier riding on top of them — see forward score card below.
  const rawFBand = getRiskBand(forward.raw);

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {/* Forward score */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "rgba(2,6,23,0.5)",
        border: `1px solid ${fBand.border}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Forward pressure
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: fBand.color, lineHeight: 1 }}>
          {formatScorePercent(forward.amplified)}
        </div>
        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: fBand.bg, color: fBand.color, display: "inline-block", marginTop: 4 }}>
          {fBand.label}
        </span>
        <div style={{ display: "flex", gap: 12, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid rgba(148,163,184,0.15)" }}>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Your leading indicators</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: rawFBand.color }}>{rawFBand.label}</div>
          </div>
          <div title="Regimes amplify the forward score because the same disruption signal matters more when conditions are already tight — there's less slack to absorb it.">
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Market regime <i className="ti ti-info-circle" style={{ fontSize: 12 }} aria-hidden="true"></i></div>
            <div style={{ fontSize: 14, fontWeight: 500, color: regime.multiplier.color }}>{regime.multiplier.label}</div>
          </div>
        </div>
      </div>

      {/* Regime */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "rgba(2,6,23,0.5)",
        border: `1px solid ${rBand.border}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Market regime
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: regime.multiplier.color, lineHeight: 1.2 }}>
          {regime.multiplier.label}
        </div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          {regime.multiplier.multiplier}× multiplier applied
        </div>
      </div>

      {/* Trigger summary */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "rgba(2,6,23,0.5)",
        border: `1px solid ${summary.triggeredCount > 0 ? "rgba(239,68,68,0.4)" : "rgba(148,163,184,0.15)"}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Scenario queue
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: summary.triggeredCount > 0 ? "#A32D2D" : "#3B6D11", lineHeight: 1 }}>
          {summary.triggeredCount}
        </div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          triggered · {summary.buildingCount} building
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
          Triggered requires multiple signals to converge
        </div>
      </div>

      {/* Signal coverage */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "rgba(2,6,23,0.5)",
        border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Signal coverage
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: "#E2E8F0", lineHeight: 1 }}>
          {summary.stressedSignalCount}
          <span style={{ fontSize: 14, color: "#94A3B8" }}>/{summary.totalSignalCount}</span>
        </div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          above {summary.stressThreshold} stress threshold
        </div>
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, triggeredCount }) {
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
      {TABS.map((tab) => {
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
// context (e.g. Control Tower's TriggerBanner "Review in Risk Intelligence"
// button) so the user lands on the exact trigger they clicked, rather than
// always on the "forward" tab / semiconductors commodity regardless of what
// they came here to look at.
export default function RiskIntelligenceView({ switchView, initialTab, initialCommodity }) {
  const [activeTab,         setActiveTab]         = useState(initialTab || "forward");
  const [forwardSignals,    setForwardSignals]    = useState(null);
  const [regimeSignals,     setRegimeSignals]     = useState(null);
  const [scoreResult,       setScoreResult]       = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [lastUpdated,       setLastUpdated]       = useState(null);
  const [error,             setError]             = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState(initialCommodity || "semiconductors_mlcc");
  // "mock" | "live" | null — surfaced in the header so nobody mistakes sample
  // signals for live intelligence. fwd/reg both report `source`; if they ever
  // disagree, mock takes precedence for the disclosure (better to over-warn).
  const [dataSource, setDataSource] = useState(null);

  const detailData = selectedCommodity === "lithium_battery"
    ? MOCK_LITHIUM_SIGNAL_DETAIL
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
        setDataSource(fwd.source === "mock" || reg.source === "mock" ? "mock" : (fwd.source || reg.source || null));

        const forwardWeights = selectedCommodity === "lithium_battery" ? LITHIUM_FORWARD_WEIGHTS : FORWARD_WEIGHTS;
        const regimeWeights  = selectedCommodity === "lithium_battery" ? LITHIUM_REGIME_WEIGHTS  : REGIME_WEIGHTS;
        const triggerConfig  = selectedCommodity === "lithium_battery" ? LITHIUM_TRIGGER_CONFIG  : TRIGGER_CONFIG;

        const profile = computeFullRiskProfile(fwd.signals, reg.signals, forwardWeights, regimeWeights, triggerConfig);
        setScoreResult(profile);
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
            {dataSource === "mock" && (
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
                title="Signals shown here are sample data, not a live feed. Triggered/Building states reflect demo scenarios, not real-time intelligence."
              >
                SAMPLE INTELLIGENCE
              </span>
            )}
          </h2>
          {/* Commodity selector — hidden on corridor, bestplace, and watchlist tabs */}
          {activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
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
            : "Two-layer predictive risk model. Forward signals identify what's building upstream 3–18 months ahead. Current conditions confirm the regime your network is operating in today."}
        </p>
        {lastUpdated && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
          <div style={{ fontSize: 13, color: "#B4B2A9", marginTop: 6 }}>
            Last updated: {lastUpdated.toLocaleTimeString()} ·{" "}
            <span style={{ color: "#9FD63A" }}>Live</span>
          </div>
        )}
        {error && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
          <div style={{ fontSize: 13, color: "#854F0B", marginTop: 4 }}>{error}</div>
        )}
      </div>

      {/* Summary bar — hidden on corridor tab */}
      {activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && !loading && (
        <SummaryBar scoreResult={scoreResult} lastUpdated={lastUpdated} />
      )}

      {/* Tab navigation */}
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        triggeredCount={triggeredCount}
      />

      {/* Tab content */}
      {activeTab === "corridor" ? (
        <CorridorRiskPanel onLaunchScenario={handleLaunchScenario} />
      ) : activeTab === "bestplace" ? (
        <BestPlaceToBuyPanel onLaunchScenario={handleLaunchScenario} />
      ) : activeTab === "watchlist" ? (
        <CountryWatchListPanel onSelectCountry={(origin) => { setActiveTab("corridor"); }} />
      ) : activeTab === "supplierlist" ? (
        <SupplierScreeningPanel />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          {activeTab === "forward" && forwardSignals && (
            <ForwardPressurePanel
              forwardSignals={forwardSignals}
              scoreResult={scoreResult}
              detailData={detailData}
            />
          )}
          {activeTab === "regime" && regimeSignals && (
            <RegimeIndexPanel
              regimeSignals={regimeSignals}
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
