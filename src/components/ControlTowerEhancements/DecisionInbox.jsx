/**
 * Control Tower: one list of everything waiting on the user. Decision briefs that need an accept or dismiss,
 * supply chains (or commodities) at the act or warning stage, and the worst network KPI with its simulate action.
 * Replaces the separate early warning strip, briefs card and recommended-action banner on the dashboard.
 */
import React, { useEffect, useState } from "react";
import { useBriefs } from "./briefs/briefStore";
import BriefView from "./briefs/BriefView";
import { STAGE, oneLine, commodityLine } from "./RiskIntelligence/EarlyWarning";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const ELECTRONICS = new Set(["semiconductors_mlcc"]);
const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const needsDecision = (b) => b.status === "done" && !b.decision && (b.outcome === "action" || b.outcome === "no_payback");

function Tag({ label, color }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0B0F13", background: color, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {label}
    </span>
  );
}

function Row({ tag, tagColor, title, sub, action, onClick }) {
  return (
    <button type="button" onClick={onClick}
            style={{ textAlign: "left", cursor: "pointer", background: "rgba(2,6,23,0.45)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
      <Tag label={tag} color={tagColor} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        {sub ? <span style={{ display: "block", fontSize: 11, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span> : null}
      </span>
      <span style={{ fontSize: 12, color: LIME, flexShrink: 0 }}>{action}</span>
    </button>
  );
}

/** Everything waiting on the user, fetched once and shared by the alert band and the decision list. */
export function useDecisionItems(apiBase, commodities = [], recommended = null) {
  const { briefs, loaded } = useBriefs();
  const [chains, setChains] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/api/chokepoints/signals`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((b) => { if (live) setChains(Array.isArray(b?.chains) ? b.chains : []); }).catch(() => live && setChains([]));
    return () => { live = false; };
  }, [apiBase]);
  const useCommodities = commodities.length > 0 && !commodities.some((c) => ELECTRONICS.has(c.key));
  const waiting = (loaded ? briefs : []).filter(needsDecision);
  const hotChains = useCommodities ? [] : (chains || []).filter((c) => c.stage_rank >= 2).sort((a, b) => b.stage_rank - a.stage_rank);
  const hotCommodities = useCommodities ? commodities.filter((c) => (c.score ?? 0) >= 55).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const total = waiting.length + hotChains.length + hotCommodities.length + (recommended ? 1 : 0);
  const ready = chains !== null && loaded;
  const act = hotChains.some((c) => c.stage === "act") || hotCommodities.some((c) => (c.score ?? 0) >= 75) || recommended?.status === "bad";
  return { waiting, hotChains, hotCommodities, total, ready, act };
}

/** The first thing on the dashboard: how urgent things are right now, one chip per item. */
export function AlertBand({ items, recommended, onOpenChain, onOpenCommodity, onReview }) {
  const { waiting, hotChains, hotCommodities, total, ready, act } = items;
  if (!ready) return null;
  const color = !total ? "#2EC4A6" : act ? "#F87171" : "#F4A742";
  const Chip = ({ label, tag, tagColor, onClick }) => (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(2,6,23,0.45)", border: `1px solid ${tagColor}88`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E8F2EC" }}>{label}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#111B21", background: tagColor, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase" }}>{tag}</span>
    </button>
  );
  return (
    <section className="mb-5 rounded-xl" data-testid="alert-band"
             style={{ background: total ? `${color}14` : "#111B21", border: `1px solid ${color}${total ? "99" : "55"}`, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ width: 10, height: 10, borderRadius: 10, background: color, boxShadow: total ? `0 0 10px ${color}` : "none", flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#E8F2EC" }}>
          {!total ? "All clear" : `${total} item${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} a decision`}
        </span>
        {!total && <span style={{ fontSize: 12.5, color: MUTED }}>No chain at Act or Warning, no brief waiting, no KPI in the red.</span>}
        {hotChains.map((c) => {
          const [label, tc] = STAGE[c.stage] || STAGE.none;
          return <Chip key={c.id} label={c.name} tag={label} tagColor={tc} onClick={() => onOpenChain(c.id)} />;
        })}
        {hotCommodities.map((c) => <Chip key={c.key} label={c.label} tag={`${c.level || "High"} ${c.score}`} tagColor={c.color || "#F4A742"} onClick={() => onOpenCommodity(c.key)} />)}
        {waiting.length > 0 && <Chip label={`${waiting.length} brief${waiting.length === 1 ? "" : "s"}`} tag="Decide" tagColor="#F4A742" onClick={onReview} />}
        {recommended && <Chip label={recommended.short} tag="KPI" tagColor={recommended.status === "bad" ? "#F87171" : "#F4A742"} onClick={onReview} />}
        {total > 0 && (
          <button type="button" onClick={onReview} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#0B0F13", background: LIME, border: 0, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
            Review
          </button>
        )}
      </div>
    </section>
  );
}

export default function DecisionInbox({ items, onOpenChain, onOpenCommodity, recommended, onOpenRun, onShowAllBriefs }) {
  const [open, setOpen] = useState(null);
  const { waiting, hotChains, hotCommodities, total, ready } = items;

  return (
    <section id="decision-inbox" className="rounded-xl h-full" style={{ background: "#111B21", border: `1px solid ${total ? "rgba(244,167,66,0.45)" : "#1f3a2e"}`, padding: 14 }} data-testid="decision-inbox">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F2EC" }}>Needs your decision</div>
        <div style={{ fontSize: 12.5, color: MUTED }}>{total ? `${total} item${total === 1 ? "" : "s"}` : ""}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
          <button type="button" onClick={() => onOpenChain(null)} style={{ background: "none", border: 0, color: MUTED, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Early Warning</button>
          {onShowAllBriefs && <button type="button" onClick={onShowAllBriefs} style={{ background: "none", border: 0, color: MUTED, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>All briefs</button>}
        </div>
      </div>
      {!total && (
        <div style={{ fontSize: 12.5, color: MUTED }}>
          {!ready ? "Checking…" : "Nothing needs a decision. FOR-C checks your network, commodities and the news every 4 hours."}
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {waiting.map((b) => {
          const tr = b.trigger || {};
          return <Row key={b.id} tag="Brief" tagColor="#F4A742" title={b.headline} sub={`${tr.label || String(tr.scenario || "").replace(/_/g, " ")}${b.auto ? " · started automatically" : ""}`} action="Decide" onClick={() => setOpen(b.id)} />;
        })}
        {hotChains.map((c) => {
          const [label, color] = STAGE[c.stage] || STAGE.none;
          return <Row key={c.id} tag={label} tagColor={color} title={`${c.name}: ${oneLine(c)}`} sub="Early warning" action="Open" onClick={() => onOpenChain(c.id)} />;
        })}
        {hotCommodities.map((c) => (
          <Row key={c.key} tag={c.level || "High"} tagColor={c.color || "#F4A742"} title={`${c.label}: ${commodityLine(c)}`} sub={`Commodity risk ${c.score}`} action="Open" onClick={() => onOpenCommodity(c.key)} />
        ))}
        {recommended && <Row tag="KPI" tagColor="#F87171" title={recommended.title} sub={recommended.sub} action="Simulate" onClick={recommended.onSimulate} />}
      </div>
      {open && <BriefView briefId={open} onClose={() => setOpen(null)} onOpenRun={onOpenRun ? (id) => { setOpen(null); onOpenRun(id); } : null} />}
    </section>
  );
}
