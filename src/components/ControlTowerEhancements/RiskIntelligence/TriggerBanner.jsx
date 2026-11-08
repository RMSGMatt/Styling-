// ─────────────────────────────────────────────────────────────────────────────
// TriggerBanner.jsx
// FOR-C v3 · Control Tower surfacing for Risk Intelligence's trigger engine
//
// evaluateTriggers() (riskScoreEngine.js) and TriggerQueue.jsx already do the
// real work here — multi-signal convergence detection, pre-populated
// simulation parameters, human-approval-gated launch. That engine is sound.
// The gap this component closes is visibility: a "Triggered" scenario is
// invisible today unless a user happens to open Risk Intelligence -> the
// right commodity tab. This surfaces it on Control Tower, where every
// session actually starts, without touching the underlying engine at all.
//
// Deliberately does NOT duplicate TriggerQueue's full expand/param/launch UI.
// Clicking through here takes the user to Risk Intelligence to review and
// launch there — preserving the "procurement directors must approve" design
// intent already built into TriggerQueue, rather than encouraging a launch
// straight from a compact banner glance.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import { fetchForwardSignals, fetchRegimeSignals } from "./signalSources";
import {
  computeFullRiskProfile,
  FORWARD_WEIGHTS,
  REGIME_WEIGHTS,
  TRIGGER_CONFIG,
  LITHIUM_FORWARD_WEIGHTS,
  LITHIUM_REGIME_WEIGHTS,
  LITHIUM_TRIGGER_CONFIG,
} from "./riskScoreEngine";
import { SCENARIO_CONFIG } from "./scenarioConfig";

// Known commodity groups this banner checks. Each has its own weights/trigger
// config in riskScoreEngine.js. If a third commodity group is added there in
// the future, it needs a matching entry here too — not auto-discovered.
const COMMODITY_GROUPS = [
  {
    key: "semiconductors_mlcc",
    forwardWeights: FORWARD_WEIGHTS,
    regimeWeights: REGIME_WEIGHTS,
    triggerConfig: TRIGGER_CONFIG,
  },
  {
    key: "lithium_battery",
    forwardWeights: LITHIUM_FORWARD_WEIGHTS,
    regimeWeights: LITHIUM_REGIME_WEIGHTS,
    triggerConfig: LITHIUM_TRIGGER_CONFIG,
  },
];

const POLL_INTERVAL_MS = 15 * 60 * 1000; // matches RiskIntelligenceView's cadence — same underlying signals, no reason to poll tighter here

export default function TriggerBanner({ onOpenRiskIntelligence }) {
  const [triggers, setTriggers] = useState([]); // merged, non-nominal, across both commodity groups
  const [dismissed, setDismissed] = useState([]);
  // Collapsed by default — with both commodity groups active this can easily
  // be 5-6 full cards, which would push the map (the actual point of this
  // page) below the fold. Summary row always visible; full list on demand.
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const results = await Promise.all(
        COMMODITY_GROUPS.map(async (group) => {
          const [fwd, reg] = await Promise.all([
            fetchForwardSignals(group.key),
            fetchRegimeSignals(group.key),
          ]);
          const profile = computeFullRiskProfile(
            fwd.signals,
            reg.signals,
            group.forwardWeights,
            group.regimeWeights,
            group.triggerConfig
          );
          return {
            commodity: group.key,
            source: fwd.source === "mock" || reg.source === "mock" ? "mock" : fwd.source || reg.source || null,
            triggers: profile.triggers.filter((t) => t.status !== "nominal"),
          };
        })
      );

      const merged = results.flatMap((r) =>
        r.triggers.map((t) => ({ ...t, commodity: r.commodity, source: r.source }))
      );
      // Triggered before Building, otherwise stable on whatever order the
      // commodity groups were checked in.
      merged.sort((a, b) => (a.status === b.status ? 0 : a.status === "triggered" ? -1 : 1));

      setTriggers(merged);
    } catch (e) {
      // Fail quiet — this is a supplementary surface, not the primary Risk
      // Intelligence view. A fetch failure here shouldn't put anything
      // misleading in front of the user; it just means the banner stays
      // empty until the next poll succeeds.
      console.error("❌ TriggerBanner signal fetch failed:", e);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const visible = triggers.filter((t) => !dismissed.includes(`${t.commodity}:${t.scenario}`));
  if (visible.length === 0) return null;

  const triggeredCount = visible.filter((t) => t.status === "triggered").length;
  const buildingCount = visible.filter((t) => t.status === "watch").length;
  const anyMock = visible.some((t) => t.source === "mock");
  const headerAccent = triggeredCount > 0 ? "#f97316" : "#eab308";

  return (
    <div className="mb-3">
      {/* Summary row — always visible, cheap on vertical space regardless of
          how many triggers are active. This is the primary state; the full
          card list below is opt-in via the toggle. */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
        style={{
          background: triggeredCount > 0 ? "rgba(249,115,22,0.10)" : "rgba(234,179,8,0.10)",
          border: `1px solid ${headerAccent}66`,
          cursor: "pointer",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: headerAccent, color: "#0B0F13", letterSpacing: "0.04em" }}
          >
            {triggeredCount > 0 ? "TRIGGERED" : "BUILDING"}
          </span>
          {anyMock && (
            <span
              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "transparent", color: "#eab308", border: "1px solid rgba(234,179,8,0.5)" }}
            >
              SAMPLE
            </span>
          )}
          <span className="text-sm font-semibold truncate" style={{ color: "#F1F5F9" }}>
            {triggeredCount > 0 && buildingCount > 0
              ? `${triggeredCount} triggered · ${buildingCount} building — supply signals need review`
              : triggeredCount > 0
              ? `${triggeredCount} triggered scenario${triggeredCount > 1 ? "s" : ""} awaiting review`
              : `${buildingCount} scenario${buildingCount > 1 ? "s" : ""} approaching threshold`}
          </span>
        </div>
        <span className="shrink-0 text-xs" style={{ color: "#94A3B8" }}>
          {expanded ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {/* Full card list — only takes space once the user asks for it */}
      {expanded && (
        <div className="flex flex-col gap-2 mt-2">
          {visible.map((t) => {
            const config = SCENARIO_CONFIG[t.scenario];
            if (!config) return null;
            const isTriggered = t.status === "triggered";
            const accent = isTriggered ? "#f97316" : "#eab308"; // matches existing HIGH/MODERATE band colors from riskScoreEngine
            const dismissKey = `${t.commodity}:${t.scenario}`;

            return (
              <div
                key={dismissKey}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
                style={{
                  background: isTriggered ? "rgba(249,115,22,0.10)" : "rgba(234,179,8,0.10)",
                  border: `1px solid ${accent}66`,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: accent, color: "#0B0F13", letterSpacing: "0.04em" }}
                  >
                    {isTriggered ? "TRIGGERED" : "BUILDING"}
                  </span>
                  {t.source === "mock" && (
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "transparent", color: "#eab308", border: "1px solid rgba(234,179,8,0.5)" }}
                      title="This scenario is derived from sample signals, not a live feed."
                    >
                      SAMPLE
                    </span>
                  )}
                  <span className="text-sm font-semibold truncate" style={{ color: "#F1F5F9" }}>
                    {config.icon} {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenRiskIntelligence && onOpenRiskIntelligence({ commodity: t.commodity })}
                    className="text-xs font-semibold px-3 py-1 rounded-lg"
                    style={{ background: "rgba(159,214,58,0.15)", color: "#9FD63A", border: "1px solid rgba(159,214,58,0.4)" }}
                    title="Review signal detail and launch parameters in Risk Intelligence"
                  >
                    Review in Risk Intelligence →
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissed((d) => [...d, dismissKey]);
                    }}
                    style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
