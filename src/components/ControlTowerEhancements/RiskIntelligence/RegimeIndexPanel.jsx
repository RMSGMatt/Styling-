// ─────────────────────────────────────────────────────────────────────────────
// RegimeIndexPanel.jsx
// FOR-C v3 · Current Market Regime — confirmation layer
// Classifies which disruption phase the market is in TODAY.
// Used to calibrate simulation starting conditions, NOT to predict future events.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import SignalCard from "./SignalCard";

// ── Regime classification card ────────────────────────────────────────────────
// currentInfo is riskScore.current from computeGridRiskScore — the same
// Current axis shown on the top-level Risk Score card, kept consistent
// rather than reusing the older, differently-thresholded getRiskBand bands.
function RegimeCard({ regimeResult, currentInfo }) {
  const band = regimeResult.band;
  const label = currentInfo.band.label;

  const phaseText = {
    Low:      "Market conditions are within historical norms. Simulation engine initialises from a baseline state.",
    Moderate: "Conditions are mildly elevated but within normal operating range. Simulation engine initialises from a near-baseline state.",
    Elevated: "The market is under measurable, confirmed stress. Simulation engine initialises from a stressed baseline — not nominal.",
    High:     "Multiple regime signals are running high. Simulation engine initialises from a significantly stressed baseline.",
    Critical: "Current conditions are severely stressed. Simulation engine initialises from a disrupted baseline. Countermeasure planning should already be underway.",
  }[label];

  return (
    <div style={{
      background:   "#141B23",
      border:       `1.5px solid ${band.border}`,
      borderRadius: 12,
      padding:      "16px 20px",
      marginBottom: 16,
    }}>
      <div>
        <div style={{ fontSize: 13, color: "#7A8A99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Current market regime
        </div>
        <div style={{ fontSize: 28, fontWeight: 500, color: band.color, lineHeight: 1, marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#C7D0D9" }}>
          Regime score: <strong style={{ color: band.color }}>{Math.round(regimeResult.raw * 100)}</strong>
          <span style={{ marginLeft: 8, color: "#7A8A99" }}>· This is the "Current" input to the combined Risk Score at the top of the page</span>
        </div>
      </div>

      {/* Regime phase explainer */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: band.bg,
        borderRadius: 8,
        fontSize: 14,
        color: band.color,
        lineHeight: 1.6,
      }}>
        {phaseText}
      </div>
    </div>
  );
}

// ── Simulation initialisation callout ────────────────────────────────────────
function SimulationBaselineCallout({ currentInfo }) {
  const label = currentInfo.band.label;

  const baselineMap = {
    Low: {
      text: "Simulation will initialise from nominal supply conditions. Lead times, pricing, and inventory set to historical baseline.",
      icon: "✅",
    },
    Moderate: {
      text: "Simulation will initialise from a near-baseline state, with minor adjustments to lead times and pricing.",
      icon: "✅",
    },
    Elevated: {
      text: "Simulation will initialise from a stressed baseline: lead times extended, spot prices elevated, distributor inventory at reduced levels.",
      icon: "⚠️",
    },
    High: {
      text: "Simulation will initialise from a significantly stressed baseline: meaningfully extended lead times and elevated spot premiums baked in.",
      icon: "⚠️",
    },
    Critical: {
      text: "Simulation will initialise from a disrupted baseline: extended lead times, elevated spot premiums, constrained distributor inventory, and freight rate pressure already baked in.",
      icon: "🚨",
    },
  };

  const cfg = baselineMap[label] || baselineMap.Low;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "12px 14px",
      background: "rgba(159,214,58,0.08)",
      border: "1px solid rgba(159,214,58,0.2)",
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
      <div>
        <div style={{ fontSize: 12, color: "#9FD63A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Simulation baseline
        </div>
        <p style={{ fontSize: 14, color: "#CBD5E1", margin: 0, lineHeight: 1.6 }}>
          {cfg.text}
        </p>
      </div>
    </div>
  );
}

// ── Panel header ──────────────────────────────────────────────────────────────
function PanelHeader() {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: 20,
          background: "rgba(148,163,184,0.1)",
          color: "#94A3B8",
          border: "0.5px solid rgba(148,163,184,0.3)",
        }}>
          Current conditions
        </span>
        <span style={{ fontSize: 13, color: "#7A8A99" }}>
          Confirmation signals · Describing the market today
        </span>
      </div>
      <p style={{ fontSize: 14, color: "#C7D0D9", margin: 0, lineHeight: 1.6 }}>
        These signals confirm which disruption phase the market is currently in. They are <em>not</em> predictive — the shortage is already underway. Their role is to calibrate the simulation engine's starting state and serve as the "Current" input to the combined Risk Score (see the top of the page).
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RegimeIndexPanel({ regimeSignals, scoreResult, detailData, liveSignalKeys = [], analystReviewedKeys = {} }) {
  if (!scoreResult) return null;

  const { regime, riskScore } = scoreResult;

  // Sort by score descending
  const sortedSignals = Object.entries(regimeSignals).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <PanelHeader />

      <RegimeCard regimeResult={regime} currentInfo={riskScore.current} />

      <SimulationBaselineCallout currentInfo={riskScore.current} />

      {/* Signal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedSignals.map(([key, value]) => (
          <SignalCard
            key={key}
            signalKey={key}
            value={value}
            detailData={detailData}
            isLive={liveSignalKeys.includes(key)}
            isAnalystReviewed={key in analystReviewedKeys}
            lastAnalystReview={analystReviewedKeys[key]}
          />
        ))}
      </div>

      {/* Lag indicator warning */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: "#1A2129",
        borderRadius: 8,
        fontSize: 13,
        color: "#C7D0D9",
        lineHeight: 1.6,
      }}>
        <strong>Important:</strong> Elevated readings here mean disruption is already in progress. If your procurement team is only seeing these signals now, the response window has narrowed. Use the Forward Pressure panel to catch the next cycle earlier.
      </div>
    </div>
  );
}
