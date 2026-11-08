// ─────────────────────────────────────────────────────────────────────────────
// SignalContributionWaterfall.jsx
// FOR-C v3 · Risk Intelligence
//
// Decomposes a layer's composite score (Forward Pressure or Current
// Conditions) into each signal's weighted contribution to the move since
// its last dated analyst review. Built 2026-09-30 after the rubber
// accuracy pass showed exactly the problem this solves: four signals
// moved by double digits in opposite directions, the composite barely
// budged, and the existing Trends chart (one line per commodity) had no
// way to show that. This shows it directly.
//
// Only signals carrying `previousValue` on their detail object (set when
// a signal is accuracy-reviewed, see signalSources.js) contribute a bar —
// everything else is grouped into a single "not yet reviewed" note so
// the chart never implies a signal was checked when it wasn't.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { SIGNAL_METADATA } from "./signalSources";

function buildSteps(breakdown, detailData, currentComposite) {
  const items = [];
  let reviewedCount = 0;
  const totalCount = Object.keys(breakdown).length;

  for (const [key, b] of Object.entries(breakdown)) {
    const detail = detailData?.[key];
    if (detail?.previousValue == null) continue;
    reviewedCount += 1;

    const previousContribution = detail.previousValue * b.weight;
    const deltaPoints = Math.round((b.contribution - previousContribution) * 100);
    if (deltaPoints === 0) continue; // confirmed-unchanged signals add no visible step

    items.push({
      key,
      label: SIGNAL_METADATA[key]?.label || key,
      deltaPoints,
      reviewedAt: detail.reviewedAt,
    });
  }

  // Biggest movers first — that's the point of the chart.
  items.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints));

  const currentPoints = Math.round(currentComposite * 100);
  const netDelta = items.reduce((sum, i) => sum + i.deltaPoints, 0);
  const baselinePoints = currentPoints - netDelta;

  let cumulative = baselinePoints;
  const steps = items.map((item) => {
    const start = cumulative;
    cumulative += item.deltaPoints;
    return { ...item, start, end: cumulative };
  });

  return { steps, baselinePoints, currentPoints, netDelta, reviewedCount, totalCount };
}

function WaterfallTrack({ start, end }) {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const worse = end > start;
  const color = worse ? "#A32D2D" : end < start ? "#3B6D11" : "#94A3B8";
  return (
    <div style={{ flex: 1, position: "relative", height: 10, background: "rgba(148,163,184,0.1)", borderRadius: 4 }}>
      <div
        style={{
          position: "absolute",
          left: `${lo}%`,
          width: `${Math.max(hi - lo, 0.5)}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
        }}
      />
    </div>
  );
}

export default function SignalContributionWaterfall({ breakdown, detailData, currentComposite, label }) {
  if (!breakdown) return null;
  const { steps, baselinePoints, currentPoints, netDelta, reviewedCount, totalCount } = buildSteps(breakdown, detailData, currentComposite);

  return (
    <div style={{
      background: "rgba(2,6,23,0.5)",
      border: "0.5px solid rgba(148,163,184,0.15)",
      borderRadius: 10,
      padding: "16px 18px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: "#E2E8F0" }}>{label}: what moved since last review</span>
        <span style={{ fontSize: 13, color: "#94A3B8" }}>
          {baselinePoints} → <strong style={{ color: "#E2E8F0" }}>{currentPoints}</strong>
          {" "}
          <span style={{ color: netDelta > 0 ? "#A32D2D" : netDelta < 0 ? "#3B6D11" : "#94A3B8" }}>
            ({netDelta > 0 ? "+" : ""}{netDelta} net)
          </span>
        </span>
      </div>

      {steps.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94A3B8", margin: "8px 0 0" }}>
          {reviewedCount > 0
            ? "All reviewed signals confirmed unchanged — no movement to show."
            : "No signals in this layer have been accuracy-reviewed yet."}
        </p>
      ) : (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#CBD5E1", width: 220, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.label}>
                {s.label}
              </span>
              <WaterfallTrack start={s.start} end={s.end} />
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                width: 48,
                textAlign: "right",
                flexShrink: 0,
                color: s.deltaPoints > 0 ? "#A32D2D" : "#3B6D11",
              }}>
                {s.deltaPoints > 0 ? "+" : ""}{s.deltaPoints}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8" }}>
        {reviewedCount} of {totalCount} signals in this layer carry review history
        {totalCount - reviewedCount > 0 ? ` · ${totalCount - reviewedCount} not yet reviewed` : ""}
      </div>
    </div>
  );
}
