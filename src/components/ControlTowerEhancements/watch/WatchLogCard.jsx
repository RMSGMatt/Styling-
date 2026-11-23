/**
 * Watch log: news and hazards FOR-C detected near the account's sites, naming its suppliers, or in its commodities.
 * Shows published entries only (during the shadow run, entries appear after FOR-C reviews them).
 */
import React, { useEffect, useState } from "react";
import { useBriefs } from "../briefs/briefStore";
import { fetchWatch, LEVEL_LABEL, IMPACT_LABEL, shortDate, outageText } from "./watchApi";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const LEVEL_COLOR = { direct: "#F87171", supplier: "#F4A742", commodity: "#94A3B8" };
const POLL_MS = 15 * 60 * 1000;

export default function WatchLogCard({ compact = false }) {
  const { usage, loaded } = useBriefs();
  const [entries, setEntries] = useState(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => fetchWatch().then((e) => live && setEntries(e)).catch(() => live && setEntries((x) => x || []));
    load();
    const t = setInterval(load, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, []);

  if (!loaded || !usage || !(usage.limit > 0) || entries === null) return null; // agents plans only
  const shown = all ? entries : entries.slice(0, compact ? 3 : 5);
  const direct = entries.filter((e) => e.level !== "commodity").length;

  return (
    <section className="mb-6 rounded-xl" style={{ background: "#111B21", border: "1px solid #1f3a2e", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F2EC" }}>Watch log</div>
        <div style={{ fontSize: 12.5, color: MUTED }}>
          {entries.length ? `${entries.length} detected · ${direct} at your sites or suppliers` : ""}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: DIM }}>News and hazards checked every 4 hours</div>
      </div>
      {!entries.length && (
        <div style={{ fontSize: 12.5, color: MUTED }}>
          FOR-C watches hazard alerts and supply chain news for events near your sites, naming your suppliers, or in the commodities your parts use. Nothing found yet.
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {shown.map((e) => {
          const j = e.judge || {};
          const esc = e.escalation;
          return (
            <div key={e.id} style={{ background: "#0B1419", border: "1px solid #1c2c33", borderRadius: 10, padding: "9px 11px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: LEVEL_COLOR[e.level] || MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {LEVEL_LABEL[e.level] || e.level}
                </span>
                {e.link ? (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, color: TEXT, fontWeight: 600, textDecoration: "none" }}>{e.title}</a>
                ) : (
                  <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 600 }}>{e.title}</span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: DIM }}>{e.source} · {shortDate(e.event_date || e.created_at)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{e.why}</div>
              {j.reviewed ? (
                <div style={{ fontSize: 12.5, color: TEXT, marginTop: 3 }}>
                  <span style={{ color: LIME, fontWeight: 600 }}>{IMPACT_LABEL[j.impact] || j.impact}</span>
                  {j.confidence ? <span style={{ color: DIM }}> · {j.confidence} confidence</span> : null}
                  {j.reason ? <span> · {j.reason}</span> : null}
                </div>
              ) : j.note ? (
                <div style={{ fontSize: 12, color: DIM, marginTop: 3 }}>{j.note}</div>
              ) : null}
              {esc && esc.mode === "live" && (
                <div style={{ fontSize: 12, color: "#F4A742", marginTop: 3 }}>
                  {esc.queued ? "Decision brief started" : "Decision brief already run this week"}: {esc.trigger?.label}, {outageText(esc.trigger)}
                </div>
              )}
              <div style={{ fontSize: 11, color: DIM, marginTop: 3 }}>Detected by FOR-C</div>
            </div>
          );
        })}
      </div>
      {entries.length > shown.length || all ? (
        <button type="button" onClick={() => setAll((x) => !x)} style={{ marginTop: 8, fontSize: 12, color: LIME, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          {all ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      ) : null}
    </section>
  );
}
