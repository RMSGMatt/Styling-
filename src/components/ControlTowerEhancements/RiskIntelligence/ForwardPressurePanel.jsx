// ─────────────────────────────────────────────────────────────────────────────
// ForwardPressurePanel.jsx
// FOR-C v3 · Forward Pressure Index — predictive layer
// Signals 3–18 months ahead of downstream impact
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import SignalCard from "./SignalCard";
import { getRiskBand } from "./riskScoreEngine";

// ── Composite score gauge ─────────────────────────────────────────────────────
function ForwardScoreGauge({ score, band, amplified, regimeMultiplier }) {
  const pct = Math.round(amplified * 100);
  const rawBand = getRiskBand(score);

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
            Forward pressure index
          </div>
          <div style={{ fontSize: 40, fontWeight: 500, color: band.color, lineHeight: 1 }}>
            {pct}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 20,
              background: band.bg,
              color: band.color,
              border: `0.5px solid ${band.border}`,
            }}>
              {band.label}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#7A8A99", marginBottom: 4 }}>Regime multiplier</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: regimeMultiplier.color }}>
            {regimeMultiplier.multiplier}×
          </div>
          <div style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 20,
            background: regimeMultiplier.bg,
            color: regimeMultiplier.color,
            marginTop: 4,
            display: "inline-block",
          }}>
            {regimeMultiplier.label}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          width: "100%",
          height: 6,
          background: "#1A2129",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: band.border,
            borderRadius: 3,
            transition: "width 0.8s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#55606B" }}>
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Raw vs amplified */}
      <div style={{ marginTop: 10, fontSize: 11, color: "#7A8A99" }}>
        Raw score: {Math.round(score * 100)} × {regimeMultiplier.multiplier} regime multiplier = {pct} amplified
      </div>

      {/* Causal explanation */}
      <p style={{ marginTop: 10, fontSize: 12, color: "#C7D0D9", lineHeight: 1.6 }}>
        Your leading indicators are elevated on their own ({Math.round(score * 100)}, {rawBand.label}). Because the broader market is currently in a stressed regime ({regimeMultiplier.label}), we treat emerging risk as more urgent right now — pushing this to {pct} ({band.label}).
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: rawBand.bg, color: rawBand.color }}>
          Your leading indicators: {rawBand.label}
        </span>
        <span
          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: regimeMultiplier.bg, color: regimeMultiplier.color, cursor: "help" }}
          title="Regimes amplify the forward score because the same disruption signal matters more when conditions are already tight — there's less slack to absorb it."
        >
          Market regime: {regimeMultiplier.label}
        </span>
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
          background: "rgba(91,155,213,0.12)",
          color: "#7DB8F0",
          border: "0.5px solid rgba(91,155,213,0.4)",
        }}>
          Forward signals
        </span>
        <span style={{ fontSize: 11, color: "#7A8A99" }}>
          Leading indicators · 3–18 months ahead of impact
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#C7D0D9", margin: 0, lineHeight: 1.6 }}>
        These signals sit upstream of any observable shortage. A movement here today means your Tier 1 or Tier 2 customers feel it in 3–18 months. Act on these before confirmation signals fire.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ForwardPressurePanel({ forwardSignals, scoreResult, detailData }) {
  if (!scoreResult) return null;

  const { forward, regime } = scoreResult;
  const band = forward.band;

  // Sort signals by score descending so highest risk is always first
  const sortedSignals = Object.entries(forwardSignals).sort(([, a], [, b]) => b - a);

  // Count signals by risk band
  const critical  = sortedSignals.filter(([, v]) => v > 0.80).length;
  const high      = sortedSignals.filter(([, v]) => v > 0.60 && v <= 0.80).length;
  const elevated  = sortedSignals.filter(([, v]) => v > 0.35 && v <= 0.60).length;
  const nominal   = sortedSignals.filter(([, v]) => v <= 0.35).length;

  return (
    <div>
      <PanelHeader />

      {/* Gauge */}
      <ForwardScoreGauge
        score={forward.raw}
        amplified={forward.amplified}
        band={band}
        regimeMultiplier={regime.multiplier}
      />

      {/* Signal summary strip */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 14,
        flexWrap: "wrap",
      }}>
        {[
          { label: "Critical", count: critical,  color: "#F87171", bg: "rgba(239,68,68,0.12)" },
          { label: "High",     count: high,      color: "#F87171", bg: "rgba(239,68,68,0.12)" },
          { label: "Moderate", count: elevated,  color: "#FBBF24", bg: "rgba(245,158,11,0.12)" },
          { label: "Low",      count: nominal,   color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 20,
            background: bg,
            color,
            fontWeight: 500,
          }}>
            {count} {label}
          </div>
        ))}
      </div>

      {/* Signal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedSignals.map(([key, value]) => (
          <SignalCard key={key} signalKey={key} value={value} detailData={detailData} />
        ))}
      </div>

      {/* Methodology note */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: "#1A2129",
        borderRadius: 8,
        fontSize: 11,
        color: "#C7D0D9",
        lineHeight: 1.6,
      }}>
        <strong>Methodology:</strong> Forward score is a weighted composite of six independent leading indicators, amplified by the current market regime multiplier. Trigger queue fires only on signal convergence — a minimum of two signals above threshold — to avoid false positives from single-signal noise.
      </div>
    </div>
  );
}
