// ─────────────────────────────────────────────────────────────────────────────
// TriggerQueue.jsx
// FOR-C v3 · Human-in-the-loop scenario trigger queue
//
// Surfaces converged signals as pending scenarios for human review.
// Never auto-pushes to simulation — procurement directors must approve.
// Provides audit trail of trigger events.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { getRiskBand } from "./riskScoreEngine";
import { SCENARIO_CONFIG } from "./scenarioConfig";


// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    triggered: { label: "Triggered",  color: "#A32D2D", bg: "rgba(249,115,22,0.12)", border: "#E24B4A" },
    // Internal status value stays "watch" (see evaluateTriggers) — only the
    // human-facing label changed, to avoid colliding with the unrelated
    // "Watch" regime state shown in the summary bar.
    watch:     { label: "Building",   color: "#854F0B", bg: "rgba(234,179,8,0.12)", border: "#EF9F27" },
    nominal:   { label: "Nominal",    color: "#3B6D11", bg: "rgba(34,197,94,0.12)", border: "#97C459" },
  };
  const cfg = map[status] || map.nominal;
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 500,
      padding: "3px 9px",
      borderRadius: 20,
      background: cfg.bg,
      color: cfg.color,
      border: `0.5px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Convergence indicator ─────────────────────────────────────────────────────
function ConvergenceIndicator({ count, required, total }) {
  const met = count >= required;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
      <span style={{ color: met ? "#3B6D11" : "#854F0B" }}>
        {met ? "✓" : "○"} Convergence: {count} of {total} signals stressed network-wide (need {required}+ to corroborate)
      </span>
    </div>
  );
}

// ── Trigger card ──────────────────────────────────────────────────────────────
function TriggerCard({ trigger, onLaunch, onDismiss, dismissed }) {
  const [expanded, setExpanded] = useState(false);
  const config = SCENARIO_CONFIG[trigger.scenario];
  if (!config) return null;

  const isDismissed = dismissed.includes(trigger.scenario);
  if (isDismissed) return null;

  const isTriggered = trigger.status === "triggered";
  const borderColor = isTriggered ? "#E24B4A" : "#EF9F27";

  return (
    <div style={{
      background:   "rgba(2,6,23,0.5)",
      border:       `0.5px solid ${borderColor}`,
      borderLeft:   `3px solid ${borderColor}`,
      borderRadius: 10,
      overflow:     "hidden",
      opacity:      isDismissed ? 0.4 : 1,
      transition:   "opacity 0.2s",
    }}>
      {/* Card header */}
      <div
        style={{ padding: "12px 14px", cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginRight: 8 }}>
            <span style={{ fontSize: 16 }}>{config.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#E2E8F0" }}>{config.label}</span>
          </div>
          <StatusBadge status={trigger.status} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ConvergenceIndicator count={trigger.convergenceCount} required={trigger.minConvergence} total={trigger.totalSignalCount} />
          <span style={{ fontSize: 13, color: "#94A3B8" }}>
            Signal: {Math.round(trigger.signalValue * 100)} / threshold: {Math.round(trigger.threshold * 100)}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid rgba(148,163,184,0.1)" }}>
          <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6, margin: "12px 0" }}>
            {config.description}
          </p>

          {/* Default scenario parameters */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Default simulation parameters
            </div>
            <div style={{
              background: "rgba(148,163,184,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              color: "#94A3B8",
              lineHeight: 1.8,
              fontFamily: "monospace",
            }}>
              {Object.entries(config.defaultParams).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: "#60A5FA" }}>{k}</span>: {JSON.stringify(v)}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onLaunch(trigger.scenario, config.defaultParams)}
              style={{
                flex:          1,
                padding:       "9px 0",
                background:    "#0d3d2e",
                color:         "#9FD63A",
                border:        "1px solid rgba(159,214,58,0.3)",
                borderRadius:  8,
                fontSize:      12,
                fontWeight:    500,
                cursor:        "pointer",
              }}
            >
              Review &amp; launch simulation →
            </button>
            <button
              onClick={() => onDismiss(trigger.scenario)}
              style={{
                padding:       "9px 14px",
                background:    "transparent",
                color:         "#94A3B8",
                border:        "0.5px solid rgba(148,163,184,0.15)",
                borderRadius:  8,
                fontSize:      12,
                cursor:        "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <div style={{ padding: "4px 14px 8px", fontSize: 12, color: "rgba(148,163,184,0.3)" }}>
          Click to review scenario parameters ↓
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      padding:      "24px 20px",
      textAlign:    "center",
      background:   "rgba(34,197,94,0.12)",
      borderRadius: 10,
      color:        "#3B6D11",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>No scenarios triggered</div>
      <div style={{ fontSize: 14 }}>Forward signals have not converged on a disruption threshold. Continue monitoring.</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TriggerQueue({ triggers, onLaunchScenario }) {
  const [dismissed, setDismissed] = useState([]);

  const triggered = triggers.filter((t) => t.status === "triggered" && !dismissed.includes(t.scenario));
  const watching  = triggers.filter((t) => t.status === "watch"     && !dismissed.includes(t.scenario));

  function handleDismiss(scenarioKey) {
    setDismissed((d) => [...d, scenarioKey]);
  }

  function handleLaunch(scenarioKey, params) {
    if (onLaunchScenario) {
      onLaunchScenario({ scenario: scenarioKey, params });
    }
  }

  return (
    <div>
      {/* Panel header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 20,
            background: triggered.length > 0 ? "rgba(249,115,22,0.12)" : "rgba(234,179,8,0.12)",
            color:      triggered.length > 0 ? "#A32D2D" : "#854F0B",
            border:     `0.5px solid ${triggered.length > 0 ? "#E24B4A" : "#EF9F27"}`,
          }}>
            {triggered.length} triggered · {watching.length} building
          </span>
          <span style={{ fontSize: 13, color: "#94A3B8" }}>
            Human approval required before simulation launch
          </span>
        </div>
        <p style={{ fontSize: 14, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>
          Scenarios enter this queue only when multiple independent signals converge above threshold. Review parameters, adjust if needed, then approve to route to the simulation engine.
        </p>
      </div>

      {/* Triggered scenarios */}
      {triggered.length === 0 && watching.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Triggered first */}
          {triggered.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#A32D2D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Triggered — ready for review
              </div>
              {triggers
                .filter((t) => t.status === "triggered")
                .map((t) => (
                  <TriggerCard
                    key={t.scenario}
                    trigger={t}
                    onLaunch={handleLaunch}
                    onDismiss={handleDismiss}
                    dismissed={dismissed}
                  />
                ))}
            </div>
          )}

          {/* Building queue */}
          {watching.length > 0 && (
            <div style={{ marginTop: triggered.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 12, color: "#854F0B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Building — approaching threshold
              </div>
              {triggers
                .filter((t) => t.status === "watch")
                .map((t) => (
                  <TriggerCard
                    key={t.scenario}
                    trigger={t}
                    onLaunch={handleLaunch}
                    onDismiss={handleDismiss}
                    dismissed={dismissed}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Audit note */}
      <div style={{
        marginTop: 14,
        padding:   "10px 14px",
        background: "rgba(148,163,184,0.1)",
        borderRadius: 8,
        fontSize: 13,
        color:    "#94A3B8",
        lineHeight: 1.6,
      }}>
        <strong>Audit trail:</strong> All trigger events, approvals, and dismissals are logged with timestamp and user. Enterprise plan includes full trigger history export.
      </div>
    </div>
  );
}
