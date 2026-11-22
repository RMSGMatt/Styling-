/**
 * The brief control on a trigger: Generate brief, then Preparing (with the step it is on), then Open brief.
 */
import React, { useState } from "react";
import { BRIEF_COST_ONLY, isRecent, latestBriefFor, startBrief, useBriefs } from "./briefStore";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";

const btn = (extra) => ({
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  background: "rgba(159,214,58,0.12)", color: LIME, border: "1px solid rgba(159,214,58,0.4)", ...extra,
});

export default function BriefButton({ scenario, commodity, config, onOpen, compact = false }) {
  const { briefs, usage, loaded } = useBriefs();
  const [msg, setMsg] = useState("");
  const [starting, setStarting] = useState(false);
  if (!config || BRIEF_COST_ONLY.has(scenario) || !loaded) return null;
  if (usage && !(usage.limit > 0)) {
    return compact ? null : <span style={{ fontSize: 11, color: MUTED }}>Decision briefs: Pro and Enterprise</span>;
  }

  const b = latestBriefFor(briefs, scenario);
  const stop = (e) => e && e.stopPropagation();

  const generate = async (e) => {
    stop(e);
    setMsg("");
    setStarting(true);
    const r = await startBrief({ scenario, commodity, label: config.label, params: config.defaultParams });
    setStarting(false);
    if (!r.ok) setMsg(r.message);
  };

  let control;
  if (starting || (b && b.status === "running")) {
    control = (
      <span style={btn({ cursor: "default", color: MUTED, borderColor: "rgba(148,163,184,0.3)", background: "transparent" })} title="A brief takes a few minutes. You can keep working.">
        <span className="animate-pulse">Preparing brief{b && b.progress ? `: ${b.progress}` : ""}</span>
      </span>
    );
  } else if (b && b.status === "done" && isRecent(b)) {
    control = (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button type="button" style={btn()} onClick={(e) => { stop(e); onOpen && onOpen(b.id); }} title={b.headline || ""}>
          Open brief{b.auto ? " (auto)" : ""}{b.decision ? ` · ${b.decision.decision}` : ""}
        </button>
        {!compact && (
          <button type="button" onClick={generate} title="Run the brief again with today's network and your current cost settings. Uses one manual brief."
                  style={btn({ background: "transparent", color: MUTED, borderColor: "rgba(148,163,184,0.3)" })}>
            Run again
          </button>
        )}
      </span>
    );
  } else {
    control = (
      <button type="button" style={btn()} onClick={generate} title={b && b.status === "error" ? b.message || "" : "Simulates doing nothing and each response, then writes a one-page brief."}>
        {b && b.status === "error" ? "Retry brief" : "Generate brief"}
      </button>
    );
  }

  const remaining = usage ? Math.max(0, usage.limit - usage.used) : null;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: compact ? "flex-end" : "flex-start", gap: 3 }} onClick={stop}>
      {control}
      {msg && <span style={{ fontSize: 11, color: "#FCA5A5", maxWidth: 260 }}>{msg}</span>}
      {!compact && !msg && remaining != null && !(b && (b.status === "running" || (b.status === "done" && isRecent(b)))) && (
        <span style={{ fontSize: 11, color: MUTED }}>{remaining} of {usage.limit} manual briefs left this month</span>
      )}
    </span>
  );
}
