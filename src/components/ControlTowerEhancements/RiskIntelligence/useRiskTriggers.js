// ─────────────────────────────────────────────────────────────────────────────
// useRiskTriggers.js
// FOR-C v3 · Shared hook for Risk Intelligence trigger polling
//
// Extracted from what was TriggerBanner.jsx so the merged trigger list can be
// consumed by Control Tower's unified attention panel without duplicating the
// fetch/merge logic. Polls both commodity groups on the same 15-minute
// cadence RiskIntelligenceView itself uses (same underlying signals, no
// reason to poll tighter here).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
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

// Known commodity groups this hook checks. Each has its own weights/trigger
// config in riskScoreEngine.js. A third commodity group added there in the
// future needs a matching entry here too — not auto-discovered.
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

const POLL_INTERVAL_MS = 15 * 60 * 1000;

// Returns { triggers } — merged, non-nominal triggers across both commodity
// groups, each tagged with { commodity, source } ("mock" | "live" | null).
export function useRiskTriggers() {
  const [triggers, setTriggers] = useState([]);

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
      merged.sort((a, b) => (a.status === b.status ? 0 : a.status === "triggered" ? -1 : 1));
      setTriggers(merged);
    } catch (e) {
      // Fail quiet — this is a supplementary surface, not the primary Risk
      // Intelligence view. A fetch failure here shouldn't put anything
      // misleading in front of the user; triggers just stay at their last
      // known state until the next poll succeeds.
      console.error("❌ useRiskTriggers signal fetch failed:", e);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { triggers };
}
