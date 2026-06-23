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
import { computeFullRiskProfile, FORWARD_WEIGHTS, REGIME_WEIGHTS, LITHIUM_FORWARD_WEIGHTS, LITHIUM_REGIME_WEIGHTS, TRIGGER_CONFIG, LITHIUM_TRIGGER_CONFIG } from "./riskScoreEngine";
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
    badgeBg:     "#F1EFE8",
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

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {/* Forward score */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "#ffffff",
        border: `1.5px solid ${fBand.border}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Forward pressure
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: fBand.color, lineHeight: 1 }}>
          {forward.amplified.toFixed(2)}
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: fBand.bg, color: fBand.color, display: "inline-block", marginTop: 4 }}>
          {fBand.label}
        </span>
      </div>

      {/* Regime */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "#ffffff",
        border: `0.5px solid ${rBand.border}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Market regime
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: regime.multiplier.color, lineHeight: 1.2 }}>
          {regime.multiplier.label}
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>
          {regime.multiplier.multiplier}× multiplier applied
        </div>
      </div>

      {/* Trigger summary */}
      <div style={{
        flex: 1, minWidth: 160,
        background: summary.triggeredCount > 0 ? "#FCEBEB" : "#F1EFE8",
        border: `0.5px solid ${summary.triggeredCount > 0 ? "#E24B4A" : "#D3D1C7"}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Scenario queue
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: summary.triggeredCount > 0 ? "#A32D2D" : "#3B6D11", lineHeight: 1 }}>
          {summary.triggeredCount}
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>
          triggered · {summary.watchCount} watch
        </div>
      </div>

      {/* Signal coverage */}
      <div style={{
        flex: 1, minWidth: 160,
        background: "#ffffff",
        border: "0.5px solid #D3D1C7",
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        <div style={{ fontSize: 10, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Signal coverage
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: "#2C2C2A", lineHeight: 1 }}>
          {summary.stressedSignalCount}
          <span style={{ fontSize: 14, color: "#888780" }}>/{summary.totalSignalCount}</span>
        </div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>
          signals above stress threshold
        </div>
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, triggeredCount }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "0.5px solid #D3D1C7" }}>
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
              borderBottom: isActive ? "2px solid #1D625B" : "2px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: isActive ? "#1D625B" : "#888780",
              fontWeight: isActive ? 500 : 400,
              fontSize: 13,
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
            {count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 20, background: "#FCEBEB", color: "#A32D2D" }}>
                {count}
              </span>
            )}
            {tab.badge && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: tab.badgeBg, color: tab.badgeColor, border: `0.5px solid ${tab.badgeBorder}` }}>
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
    <div style={{ padding: "40px 0", textAlign: "center", color: "#888780" }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>⟳</div>
      <div style={{ fontSize: 13 }}>Loading risk signals...</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RiskIntelligenceView({ switchView }) {
  const [activeTab,         setActiveTab]         = useState("forward");
  const [forwardSignals,    setForwardSignals]    = useState(null);
  const [regimeSignals,     setRegimeSignals]     = useState(null);
  const [scoreResult,       setScoreResult]       = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [lastUpdated,       setLastUpdated]       = useState(null);
  const [error,             setError]             = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState("semiconductors_mlcc");

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
    try {
      const scenarioPayload = { name: scenario, ...params, source: "risk_intelligence_trigger" };
      localStorage.setItem("currentScenario",     JSON.stringify(scenarioPayload));
      localStorage.setItem("currentScenarioName", scenario);
      // Also set the format that SimulationDashboard reads
      localStorage.setItem("currentScenarioJSON", JSON.stringify(scenarioPayload));
    } catch {}
    if (switchView) switchView("simulation");
  }

  const triggeredCount = scoreResult?.summary?.triggeredCount ?? 0;
  const watchCount     = scoreResult?.summary?.watchCount     ?? 0;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 500, color: "#1D625B", margin: 0 }}>
            Risk Intelligence
          </h2>
          {/* Commodity selector — hidden on corridor, bestplace, and watchlist tabs */}
          {activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
            <CommoditySelector
              selected={selectedCommodity}
              onChange={setSelectedCommodity}
            />
          )}
        </div>
        <p style={{ fontSize: 13, color: "#888780", margin: 0, lineHeight: 1.6 }}>
          {activeTab === "corridor"
            ? "AI-scored geopolitical risk for trade corridors into the United States. Select a country and commodity — score 7 risk variables and simulate the downstream impact in one click."
            : activeTab === "bestplace"
            ? "Ranks every country that actually produces the selected commodity by corridor risk, lowest first. Countries with no production presence are excluded — not just scored low."
            : activeTab === "watchlist"
            ? "A standing, commodity-agnostic risk ranking of every tracked country — geopolitical, political, disaster, and chokepoint exposure only."
            : "Two-layer predictive risk model. Forward signals identify what's building upstream 3–18 months ahead. Current conditions confirm the regime your network is operating in today."}
        </p>
        {lastUpdated && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
          <div style={{ fontSize: 11, color: "#B4B2A9", marginTop: 6 }}>
            Last updated: {lastUpdated.toLocaleTimeString()} ·{" "}
            <span style={{ color: "#9FD63A" }}>Live</span>
          </div>
        )}
        {error && activeTab !== "corridor" && activeTab !== "bestplace" && activeTab !== "watchlist" && activeTab !== "supplierlist" && (
          <div style={{ fontSize: 11, color: "#854F0B", marginTop: 4 }}>{error}</div>
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
