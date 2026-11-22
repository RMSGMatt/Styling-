/**
 * Decision briefs on the Control Tower: the recent briefs, where each stands (preparing, ready, accepted, dismissed),
 * and the month's manual allowance.
 */
import React, { useState } from "react";
import { useBriefs } from "./briefStore";
import BriefView from "./BriefView";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => (iso && iso.length >= 10 ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : "");
const pretty = (s) => String(s || "").replace(/_/g, " ");

function badge(b) {
  if (b.status === "running") return ["Preparing", MUTED, "transparent"];
  if (b.status === "error") return ["Failed", "#FCA5A5", "transparent"];
  if (b.decision?.decision === "accepted") return ["Accepted", "#0B0F13", LIME];
  if (b.decision?.decision === "dismissed") return ["Dismissed", "#0B0F13", "#94A3B8"];
  return ["Needs decision", "#0B0F13", "#F4A742"];
}

export default function BriefsCard({ onOpenRun }) {
  const { briefs, usage, loaded } = useBriefs();
  const [open, setOpen] = useState(null);
  const [all, setAll] = useState(false);
  if (!loaded || !usage || !(usage.limit > 0) || !briefs.length) return null;
  const shown = all ? briefs : briefs.slice(0, 5);
  const pending = briefs.filter((b) => b.status === "done" && !b.decision).length;

  return (
    <section className="mb-6 rounded-xl" style={{ background: "#111B21", border: "1px solid #1f3a2e", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F2EC" }}>Decision briefs</div>
        <div style={{ fontSize: 12.5, color: MUTED }}>{pending ? `${pending} waiting for a decision` : "All briefs decided"}</div>
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: DIM }}>{usage.used} of {usage.limit} manual briefs this month · automatic briefs are free</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {shown.map((b) => {
          const [label, color, bg] = badge(b);
          const tr = b.trigger || {};
          return (
            <button key={b.id} type="button" onClick={() => b.status !== "running" && setOpen(b.id)}
                    style={{ textAlign: "left", cursor: b.status === "running" ? "default" : "pointer", background: "rgba(2,6,23,0.45)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, border: bg === "transparent" ? `1px solid ${color}66` : 0, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {b.status === "running" ? `${tr.label || pretty(tr.scenario)}: ${b.progress || "starting"}` : b.status === "error" ? `${tr.label || pretty(tr.scenario)}: ${b.message || "did not finish"}` : b.headline}
                </span>
                <span style={{ display: "block", fontSize: 11, color: DIM }}>{tr.label || pretty(tr.scenario)} · {day(b.created_at)}{b.auto ? " · automatic" : ""}</span>
              </span>
              {b.status === "done" && <span style={{ fontSize: 12, color: LIME, flexShrink: 0 }}>Open</span>}
            </button>
          );
        })}
      </div>
      {briefs.length > 5 && (
        <button type="button" onClick={() => setAll((x) => !x)} style={{ marginTop: 8, fontSize: 12, color: MUTED, background: "transparent", border: 0, cursor: "pointer" }}>
          {all ? "Show fewer" : `Show all ${briefs.length}`}
        </button>
      )}
      {open && <BriefView briefId={open} onClose={() => setOpen(null)} onOpenRun={onOpenRun ? (id) => { setOpen(null); onOpenRun(id); } : null} />}
    </section>
  );
}
