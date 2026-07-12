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

// ── Scenario display config ───────────────────────────────────────────────────
const SCENARIO_CONFIG = {
  MLCC_lead_time_extension: {
    label:       "MLCC lead time extension",
    description: "High-capacitance MLCC lead times exceeding 20 weeks. AI server demand cannibalising automotive allocation. Simulate impact on component-dependent production schedules.",
    icon:        "🔋",
    defaultParams: {
      lead_time_multiplier:  2.1,
      affected_components:   ["High-cap MLCC 1206", "High-cap MLCC 1210", "Automotive-grade MLCC"],
      duration_weeks:        20,
      supply_reduction_pct:  0.35,
    },
  },
  automotive_MCU_allocation: {
    label:       "Automotive MCU allocation constraint",
    description: "AEC-Q100 qualified 32-bit MCUs at 52+ week lead times. Mature node (40–180nm) foundry sold out through 2026. Simulate allocation tightening on MCU-dependent assemblies.",
    icon:        "🖥️",
    defaultParams: {
      lead_time_multiplier:  3.2,
      affected_components:   ["32-bit AEC-Q100 MCU", "Power MOSFET", "SiC MOSFET"],
      duration_weeks:        26,
      supply_reduction_pct:  0.45,
    },
  },
  export_control_discrete_semis: {
    label:       "Export control — discrete semiconductors",
    description: "Gallium & germanium export suspension until Nov 27, 2026. Nexperia supply chain partially restored but structurally fragile. Simulate impact on discrete component availability.",
    icon:        "🚫",
    defaultParams: {
      lead_time_multiplier:  1.8,
      affected_components:   ["Gallium-based ICs", "Germanium discretes", "Nexperia transistors/diodes"],
      duration_weeks:        26,
      supply_reduction_pct:  0.30,
      expiry_date:           "2026-11-27",
    },
  },
  taiwan_strait_crisis: {
    label:       "Taiwan Strait supply disruption",
    description: "Elevated baseline tension with #1 Beijing risk classification for 2026. Not a current active event but structural risk warrants scenario readiness. Simulate TSMC / Taiwan fab disruption.",
    icon:        "🌊",
    defaultParams: {
      lead_time_multiplier:  4.0,
      affected_components:   ["TSMC-sourced chips", "Taiwan fab output", "Advanced packaging"],
      duration_weeks:        52,
      supply_reduction_pct:  0.70,
      affected_region:       "Taiwan",
    },
  },
  freight_rate_shock: {
    label:       "Freight rate shock",
    description: "Transpacific rates ~$700/FEU above pre-Hormuz-crisis baseline. Middle East energy situation adding structural floor. Simulate freight cost escalation and modal shift pressure.",
    icon:        "🚢",
    defaultParams: {
      cost_multiplier:       1.4,
      modal_shift_to_air:    true,
      affected_routes:       ["Asia–US West Coast (FBX01)", "Asia–US East Coast (FBX03)"],
      duration_weeks:        12,
    },
  },
  AI_capacity_allocation_squeeze: {
    label:       "AI-driven capacity allocation squeeze",
    description: "Murata, TDK, Samsung Electro-Mechanics committing high-cap MLCC capacity to AI/hyperscaler customers under multi-year agreements. Automotive buyers left competing for residual allocation.",
    icon:        "🤖",
    defaultParams: {
      lead_time_multiplier:  2.4,
      affected_components:   ["High-cap MLCC", "Advanced packaging substrates"],
      duration_weeks:        32,
      supply_reduction_pct:  0.40,
      constrained_through:   "mid-2027",
    },
  },

  // ── Lithium & Battery scenarios ───────────────────────────────────────────
  cell_allocation_squeeze: {
    label:       "Cell capacity allocation squeeze",
    description: "CATL and LG Energy Solution committing >80% of 2026 prismatic cell capacity to priority OEMs. Tier 1 battery pack assemblers competing for residual allocation. Simulate impact on battery-dependent production schedules.",
    icon:        "🔋",
    defaultParams: {
      lead_time_multiplier:  1.8,
      affected_components:   ["Automotive prismatic cells", "Pouch cells", "NMC cathode packs"],
      duration_weeks:        24,
      supply_reduction_pct:  0.40,
    },
  },
  lithium_price_spike: {
    label:       "Lithium spot price spike",
    description: "Lithium carbonate and hydroxide prices recovering from 2024 lows with contango steepening. Simulate cost escalation impact on battery pack pricing and margin exposure.",
    icon:        "📈",
    defaultParams: {
      cost_multiplier:       1.35,
      affected_components:   ["Li carbonate", "Li hydroxide", "NMC cathode material"],
      duration_weeks:        16,
    },
  },
  china_refinery_restriction: {
    label:       "China lithium refinery restriction",
    description: "China controls ~65% of global lithium refining. Any export restriction or policy shift is a binary tail event. Simulate supply reduction across refined lithium and cathode material inputs.",
    icon:        "🚫",
    defaultParams: {
      lead_time_multiplier:  4.0,
      affected_components:   ["Battery-grade lithium", "NMC cathode", "LFP cathode"],
      duration_weeks:        52,
      supply_reduction_pct:  0.60,
      affected_region:       "China",
    },
  },
  ev_demand_cell_gap: {
    label:       "EV demand vs cell capacity gap",
    description: "Global EV production forecast outpacing cell capacity commitments by ~8% YoY. Allocation pressure falls on Tier 1 suppliers to smaller OEMs first. Simulate progressive allocation tightening.",
    icon:        "⚡",
    defaultParams: {
      lead_time_multiplier:  2.2,
      affected_components:   ["Prismatic cells", "Module assemblies", "BMS components"],
      duration_weeks:        32,
      supply_reduction_pct:  0.30,
    },
  },
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    triggered: { label: "Triggered",  color: "#F87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)" },
    watch:     { label: "Watch",      color: "#FBBF24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
    nominal:   { label: "Nominal",    color: "#4ADE80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.4)" },
  };
  const cfg = map[status] || map.nominal;
  return (
    <span style={{
      fontSize: 10,
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
function ConvergenceIndicator({ count, required }) {
  const met = count >= required;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
      <span style={{ color: met ? "#4ADE80" : "#FBBF24" }}>
        {met ? "✓" : "○"} Convergence: {count}/{required} signals stressed
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
  const borderColor = isTriggered ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)";

  return (
    <div style={{
      background:   "#141B23",
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
            <span style={{ fontSize: 13, fontWeight: 500, color: "#F1F5F9" }}>{config.label}</span>
          </div>
          <StatusBadge status={trigger.status} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ConvergenceIndicator count={trigger.convergenceCount} required={trigger.minConvergence} />
          <span style={{ fontSize: 11, color: "#7A8A99" }}>
            Signal: {trigger.signalValue.toFixed(2)} / threshold: {trigger.threshold.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid #1A2129" }}>
          <p style={{ fontSize: 12, color: "#C7D0D9", lineHeight: 1.6, margin: "12px 0" }}>
            {config.description}
          </p>

          {/* Default scenario parameters */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#7A8A99", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Default simulation parameters
            </div>
            <div style={{
              background: "#1A2129",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 11,
              color: "#C7D0D9",
              lineHeight: 1.8,
              fontFamily: "monospace",
            }}>
              {Object.entries(config.defaultParams).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: "#7DB8F0" }}>{k}</span>: {JSON.stringify(v)}
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
                background:    "rgba(159,214,58,0.15)",
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
                color:         "#7A8A99",
                border:        "0.5px solid #1E2733",
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
        <div style={{ padding: "4px 14px 8px", fontSize: 10, color: "#55606B" }}>
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
      background:   "rgba(74,222,128,0.1)",
      borderRadius: 10,
      color:        "#4ADE80",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>No scenarios triggered</div>
      <div style={{ fontSize: 12 }}>Forward signals have not converged on a disruption threshold. Continue monitoring.</div>
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
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 20,
            background: triggered.length > 0 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
            color:      triggered.length > 0 ? "#F87171" : "#FBBF24",
            border:     `0.5px solid ${triggered.length > 0 ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
          }}>
            {triggered.length} triggered · {watching.length} watch
          </span>
          <span style={{ fontSize: 11, color: "#7A8A99" }}>
            Human approval required before simulation launch
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#C7D0D9", margin: 0, lineHeight: 1.6 }}>
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
              <div style={{ fontSize: 10, color: "#F87171", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
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

          {/* Watch queue */}
          {watching.length > 0 && (
            <div style={{ marginTop: triggered.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 10, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Watch — approaching threshold
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
        background: "#1A2129",
        borderRadius: 8,
        fontSize: 11,
        color:    "#C7D0D9",
        lineHeight: 1.6,
      }}>
        <strong>Audit trail:</strong> All trigger events, approvals, and dismissals are logged with timestamp and user. Enterprise plan includes full trigger history export.
      </div>
    </div>
  );
}
