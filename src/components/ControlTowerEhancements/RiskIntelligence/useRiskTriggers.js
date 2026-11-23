// ─────────────────────────────────────────────────────────────────────────────
// useRiskTriggers.js
// FOR-C v3 · Shared hook for Risk Intelligence trigger polling
//
// Triggers come from the server engine (GET /api/risk/profile), polled every
// 15 minutes. Each trigger carries live_backed: true only when the signal that
// fired it is live data, not sample.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { loadCommodityProfiles } from "./commodityProfiles";

// With no network loaded, the default trackers.
const DEFAULT_KEYS = ["semiconductors_mlcc", "lithium_battery"];

const POLL_INTERVAL_MS = 15 * 60 * 1000;

// Returns { triggers }: non-nominal triggers across the commodities, each tagged
// with { commodity, source } ("mock" | "mixed"). commodityKeys: the commodities the
// loaded network's parts map to (a MedTech network sees tungsten and industrial
// gases, not semiconductors). With none, DEFAULT_KEYS.
export function useRiskTriggers(commodityKeys) {
  const [triggers, setTriggers] = useState([]);
  const keysSig = (commodityKeys || []).slice().sort().join(",");

  const load = useCallback(async () => {
    const keys = keysSig ? keysSig.split(",") : DEFAULT_KEYS;
    const prof = await loadCommodityProfiles(keys);
    if (!Object.keys(prof).length) return; // fetch failed: keep the last known state
    const merged = Object.values(prof).flatMap((p) => (p.triggers || []).map((t) => ({ ...t, commodity: p.key, source: p.source })));
    merged.sort((a, b) => (a.status === b.status ? 0 : a.status === "triggered" ? -1 : 1));
    setTriggers(merged);
  }, [keysSig]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { triggers };
}
