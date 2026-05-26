// ─────────────────────────────────────────────────────────────────────────────
// SignalCard.jsx
// FOR-C v3 · Atomic signal display card
// Used by both ForwardPressurePanel and RegimeIndexPanel
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { getRiskBand } from "./riskScoreEngine";
import { SIGNAL_METADATA } from "./signalSources";

// ── Layer badge config ────────────────────────────────────────────────────────
const LAYER_CONFIG = {
  forward: {
    label:  "Forward signal",
    color:  "#185FA5",
    bg:     "#E6F1FB",
    border: "#85B7EB",
  },
  regime: {
    label:  "Current conditions",
    color:  "#5F5E5A",
    bg:     "#F1EFE8",
    border: "#B4B2A9",
  },
};

// ── Trend indicator ───────────────────────────────────────────────────────────
function TrendPip({ trend }) {
  const map = {
    deteriorating:  { icon: "↑", color: "#A32D2D", label: "Deteriorating" },
    "stable risk":  { icon: "→", color: "#854F0B", label: "Stable (elevated)" },
    "stable elevated": { icon: "→", color: "#854F0B", label: "Stable (elevated)" },
    elevated:       { icon: "→", color: "#854F0B", label: "Elevated" },
    flat:           { icon: "→", color: "#5F5E5A", label: "Stable" },
    improving:      { icon: "↓", color: "#3B6D11", label: "Improving" },
  };
  const cfg = map[trend] || map.flat;
  return (
    <span
      style={{ color: cfg.color, fontSize: 11, fontWeight: 500 }}
      title={cfg.label}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, band }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "#E8E8E0",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            background: band.border,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: band.color,
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Main SignalCard component ─────────────────────────────────────────────────
export default function SignalCard({ signalKey, value, detailData }) {
  const [expanded, setExpanded] = useState(false);

  const meta   = SIGNAL_METADATA[signalKey];
  const detail = detailData?.[signalKey];
  const band   = getRiskBand(value);
  const layer  = LAYER_CONFIG[meta?.layer] || LAYER_CONFIG.regime;

  if (!meta) return null;

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      style={{
        background:   "#ffffff",
        border:       `0.5px solid ${expanded ? band.border : "#D3D1C7"}`,
        borderLeft:   `3px solid ${band.border}`,
        borderRadius: 10,
        padding:      "12px 14px",
        cursor:       "pointer",
        transition:   "border-color 0.2s",
        userSelect:   "none",
      }}
    >
      {/* ── Header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A", lineHeight: 1.3, marginBottom: 4 }}>
            {meta.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Layer badge */}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: 20,
              background: layer.bg,
              color: layer.color,
              border: `0.5px solid ${layer.border}`,
            }}>
              {layer.label}
            </span>
            {/* Horizon */}
            <span style={{ fontSize: 10, color: "#888780" }}>
              {meta.horizon}
            </span>
          </div>
        </div>

        {/* Risk badge */}
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          padding: "3px 9px",
          borderRadius: 20,
          background: band.bg,
          color: band.color,
          border: `0.5px solid ${band.border}`,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {band.label}
        </span>
      </div>

      {/* ── Score bar ── */}
      <ScoreBar value={value} band={band} />

      {/* ── Expanded detail ── */}
      {expanded && detail && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #E8E8E0" }}>
          {/* Current value + trend */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#5F5E5A" }}>
              Current: <strong style={{ color: "#2C2C2A" }}>{detail.value}</strong>
            </span>
            <TrendPip trend={detail.trend} />
          </div>

          {/* Key fact */}
          <p style={{ fontSize: 12, color: "#444441", lineHeight: 1.6, margin: "0 0 8px" }}>
            {detail.keyFact}
          </p>

          {/* Data point */}
          <div style={{
            fontSize: 11,
            padding: "6px 10px",
            borderRadius: 6,
            background: "#F1EFE8",
            color: "#5F5E5A",
            marginBottom: 8,
          }}>
            📊 {detail.dataPoint}
          </div>

          {/* Source + cadence */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888780" }}>
            <span>Source: {meta.source}</span>
            <span>{meta.cadence} · {meta.latency} latency</span>
          </div>

          {/* Explainer */}
          <div style={{
            marginTop: 8,
            fontSize: 11,
            color: "#5F5E5A",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}>
            {meta.explainer}
          </div>
        </div>
      )}

      {/* ── Expand hint ── */}
      {!expanded && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#B4B2A9", textAlign: "right" }}>
          Click to expand ↓
        </div>
      )}
    </div>
  );
}
