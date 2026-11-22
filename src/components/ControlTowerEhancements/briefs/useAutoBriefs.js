/**
 * Automatic briefs: while the dashboard is open, start one brief per fired trigger per week, one at a time.
 * Automatic briefs do not count against the monthly allowance; the server also refuses repeats inside a week.
 */
import { useEffect } from "react";
import { SCENARIO_CONFIG } from "../RiskIntelligence/scenarioConfig";
import { BRIEF_COST_ONLY, isRecent, startBrief, useBriefs } from "./briefStore";

const KEY = "forc_auto_brief_tried";
const RETRY_MS = 30 * 60e3;

function readTried() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
function writeTried(v) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* fine without it */ }
}

export default function useAutoBriefs(triggers, enabled) {
  const { briefs, usage, loaded } = useBriefs();
  useEffect(() => {
    if (!enabled || !loaded || !usage || !(usage.limit > 0)) return;
    if (briefs.some((b) => b.status === "running")) return;
    const tried = readTried();
    const now = Date.now();
    const next = (triggers || []).find((t) => {
      if (t.status !== "triggered" || !SCENARIO_CONFIG[t.scenario] || BRIEF_COST_ONLY.has(t.scenario)) return false;
      if ((tried[t.scenario] || 0) > now - RETRY_MS) return false;
      const mine = briefs.filter((b) => (b.trigger || {}).scenario === t.scenario);
      if (mine.some((b) => b.status !== "error" && isRecent(b))) return false;
      // Failed today: leave it to a manual retry, unless a server restart (a deploy) cut it short.
      const cutShort = (b) => /restarted/i.test(b.message || "");
      if (mine.some((b) => b.status === "error" && isRecent(b, 1) && !cutShort(b))) return false;
      return true;
    });
    if (!next) return;
    tried[next.scenario] = now;
    writeTried(tried);
    const cfg = SCENARIO_CONFIG[next.scenario];
    startBrief({ scenario: next.scenario, commodity: next.commodity, label: cfg.label, params: cfg.defaultParams, auto: true });
  }, [enabled, loaded, usage, briefs, triggers]);
}
