// ─────────────────────────────────────────────────────────────────────────────
// RegimeIndexPanel.jsx
// FOR-C v3 · Current Market Regime — confirmation layer
// Classifies which disruption phase the market is in TODAY.
// Used to calibrate simulation starting conditions, NOT to predict future events.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import SignalCard from "./SignalCard";
import { getRiskBand } from "./riskScoreEngine";

// ── Regime classification card ────────────────────────────────────────────────
function RegimeCard({ regimeResult }) {
  const { multiplier, label, color, bg } = regimeResult.multiplier;
  const band = regimeResult.band;

  return (
    <div style={{
      background:   "#141B23",
      border:       `1.5px solid ${band.border}`,
      borderRadius: 12,
      padding:      "16px 20px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "#7A8A99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Current market regime
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color, lineHeight: 1, marginBottom: 6 }}>
            {regimeResult.multiplier.label}
          </div>
          <div style={{ fontSize: 11, color: "#C7D0D9" }}>
            Regime score: <strong style={{ color: band.color }}>{regimeResult.raw.toFixed(2)}</strong>
            <span style={{ marginLeft: 8, color: "#7A8A99" }}>· Applies {multiplier}× to forward score</span>
          </div>
        </div>

        <div style={{
          padding: "10px 16px",
          background: bg,
          borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color, marginBottom: 2 }}>Multiplier</div>
          <div style={{ fontSize: 24, fontWeight: 500, color }}>{multiplier}×</div>
        </div>
      </div>

      {/* Regime phase explainer */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: bg,
        borderRadius: 8,
        fontSize: 12,
        color,
        lineHeight: 1.6,
      }}>
        {regimeResult.multiplier.label === "Normal" && (
          "Market conditions are within historical norms. Simulation engine initialises from a baseline state."
        )}
        {regimeResult.multiplier.label === "Watch" && (
          "Two or more regime signals are elevated. The market is under measurable stress. Simulation engine initialises from a stressed baseline — not nominal."
        )}
        {regimeResult.multiplier.label === "Crisis" && (
          "Crisis regime confirmed. One or more signals at 90th percentile or three at 70th+. Simulation engine initialises from a disrupted baseline. Countermeasure planning should already be underway."
        )}
      </div>
    </div>
  );
}

// ── Simulation initialisation callout ────────────────────────────────────────
function SimulationBaselineCallout({ regimeResult }) {
  const { multiplier: { label, color, bg } } = regimeResult;

  const baselineMap = {
    Normal: {
      text: "Simulation will initialise from nominal supply conditions. Lead times, pricing, and inventory set to historical baseline.",
      icon: "✅",
    },
    Watch: {
      text: "Simulation will initialise from a stressed baseline: lead times extended by regime factor, spot prices elevated, distributor inventory at reduced levels.",
      icon: "⚠️",
    },
    Crisis: {
      text: "Simulation will initialise from a disrupted baseline: extended lead times, elevated spot premiums, constrained distributor inventory, and freight rate pressure already baked in.",
      icon: "🚨",
    },
  };

  const cfg = baselineMap[label] || baselineMap.Normal;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "12px 14px",
      background: "rgba(159,214,58,0.15)",
      border: "1px solid rgba(159,214,58,0.2)",
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "#9FD63A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Simulation baseline
        </div>
        <p style={{ fontSize: 12, color: "#C7D0D9", margin: 0, lineHeight: 1.6 }}>
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
          fontSize: 10,
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: 20,
          background: "#1A2129",
          color: "#C7D0D9",
          border: "0.5px solid #55606B",
        }}>
          Current conditions
        </span>
        <span style={{ fontSize: 11, color: "#7A8A99" }}>
          Confirmation signals · Describing the market today
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#C7D0D9", margin: 0, lineHeight: 1.6 }}>
        These signals confirm which disruption phase the market is currently in. They are <em>not</em> predictive — the shortage is already underway. Their role is to calibrate the simulation engine's starting state and amplify the forward risk score via the regime multiplier.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RegimeIndexPanel({ regimeSignals, scoreResult, detailData }) {
  if (!scoreResult) return null;

  const { regime } = scoreResult;

  // Sort by score descending
  const sortedSignals = Object.entries(regimeSignals).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <PanelHeader />

      <RegimeCard regimeResult={regime} />

      <SimulationBaselineCallout regimeResult={regime} />

      {/* Signal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedSignals.map(([key, value]) => (
          <SignalCard key={key} signalKey={key} value={value} detailData={detailData} />
        ))}
      </div>

      {/* Lag indicator warning */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: "#1A2129",
        borderRadius: 8,
        fontSize: 11,
        color: "#C7D0D9",
        lineHeight: 1.6,
      }}>
        <strong>Important:</strong> Elevated readings here mean disruption is already in progress. If your procurement team is only seeing these signals now, the response window has narrowed. Use the Forward Pressure panel to catch the next cycle earlier.
      </div>
    </div>
  );
}
