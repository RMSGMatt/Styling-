/**
 * A decision brief: what the trigger does to this network if nothing is done, each response tested in the simulator
 * with its cost and act-by date, the recommendation, and what was ruled out.
 */
import React, { useEffect, useState } from "react";
import { decideBrief, fetchBrief, startBrief } from "./briefStore";
import { printBrief } from "./briefPrint";
import BriefCostSettings from "./BriefCostSettings";
import ScoutPanel from "./ScoutPanel";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const LINE = "rgba(148,163,184,0.18)";

const money = (v) => (v == null ? "n/a" : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => (iso && iso.length >= 10 ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : iso || "");
const pretty = (s) => String(s || "").replace(/_/g, " ");
const STATUS_NOTE = { does_not_help: "Does not help", not_tested: "Not tested", too_slow: "Too slow", not_applicable: "Not applicable", no_usage: "Cannot be sized" };

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function OptionRow({ o, recommended, onOpenRun }) {
  const [open, setOpen] = useState(false);
  const ok = o.status === "ok";
  return (
    <div style={{ border: `1px solid ${recommended ? "rgba(159,214,58,0.5)" : LINE}`, borderRadius: 10, padding: "10px 12px", background: recommended ? "rgba(159,214,58,0.06)" : "rgba(2,6,23,0.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
            {o.title}
            {recommended && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#0B0F13", background: LIME, borderRadius: 20, padding: "2px 7px" }}>RECOMMENDED</span>}
            {!ok && <span style={{ marginLeft: 8, fontSize: 11, color: "#FCD34D" }}>{STATUS_NOTE[o.status] || pretty(o.status)}</span>}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{o.what}</div>
          {!ok && o.note && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{o.note}</div>}
        </div>
        {ok && o.run_id && onOpenRun && (
          <button type="button" onClick={() => onOpenRun(o.run_id)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: LIME, background: "transparent", border: "1px solid rgba(159,214,58,0.35)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
            Open run
          </button>
        )}
      </div>
      {ok && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 8 }}>
            {[["Revenue protected", money(o.revenue_protected)], ...(o.margin_protected != null ? [["Margin protected", money(o.margin_protected)]] : []), ["Cost", money(o.cost)], ["Net", money(o.net)], ["Act by", day(o.act_by)],
              ["First shortage", o.first_shortage_date ? day(o.first_shortage_date) : "None"]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{v}</div>
              </div>
            ))}
          </div>
          {(o.lines || []).length > 0 && (
            <button type="button" onClick={() => setOpen((x) => !x)} style={{ marginTop: 8, fontSize: 11, color: MUTED, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
              {open ? "Hide cost detail ▲" : "Cost detail ▼"}
            </button>
          )}
          {open && (
            <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
              {o.lines.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", borderTop: i ? `1px solid ${LINE}` : 0 }}>
                  <span>{l.label}<span style={{ color: DIM }}> · {l.basis}{l.default ? " · FOR-C default" : ""}</span></span>
                  <span style={{ color: TEXT, whiteSpace: "nowrap" }}>{money(l.amount)}</span>
                </div>
              ))}
              {(o.missing_unit_costs || []).length > 0 && (
                <div style={{ marginTop: 4, color: "#FCD34D" }}>No unit cost in the inventory file for {o.missing_unit_costs.map(pretty).join(", ")}, so those lines are not priced.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DecisionPanel({ b, onSaved }) {
  const okOpts = (b.options || []).filter((o) => o.status === "ok");
  const [option, setOption] = useState(b.recommended || okOpts[0]?.key || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(!b.decision);
  const d = b.decision;

  const save = async (decision) => {
    setSaving(true); setErr("");
    try {
      const x = await decideBrief(b.id, decision, decision === "accepted" ? option : "", reason.trim());
      onSaved(x); setEditing(false); setReason("");
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const box = { marginTop: 18, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px", background: "rgba(2,6,23,0.45)" };
  if (d && !editing) {
    const title = (b.options || []).find((o) => o.key === d.option)?.title;
    return (
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", color: "#0B0F13", background: d.decision === "accepted" ? LIME : "#94A3B8" }}>
            {d.decision === "accepted" ? "ACCEPTED" : "DISMISSED"}
          </span>
          <span style={{ fontSize: 13, color: TEXT }}>{d.decision === "accepted" && title ? title : ""}</span>
          <span style={{ fontSize: 12, color: DIM }}>{day(d.at)}{d.by ? ` · ${d.by}` : ""}</span>
          <button type="button" onClick={() => setEditing(true)} style={{ marginLeft: "auto", fontSize: 11, color: MUTED, background: "transparent", border: 0, cursor: "pointer", textDecoration: "underline" }}>Change</button>
        </div>
        {d.reason && <div style={{ marginTop: 6, fontSize: 13, color: MUTED }}>{d.reason}</div>}
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Decision</div>
      {okOpts.length > 0 && (
        <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 8 }}>
          Response
          <select value={option} onChange={(e) => setOption(e.target.value)}
                  style={{ display: "block", marginTop: 4, width: "100%", background: "#0B1220", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
            {okOpts.map((o) => <option key={o.key} value={o.key}>{o.title}{o.key === b.recommended ? " (recommended)" : ""}</option>)}
          </select>
        </label>
      )}
      <label style={{ display: "block", fontSize: 12, color: MUTED }}>
        Note (optional)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Why, who owns it, PO number…"
                  style={{ display: "block", marginTop: 4, width: "100%", background: "#0B1220", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, resize: "vertical" }} />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        {okOpts.length > 0 && (
          <button type="button" disabled={saving} onClick={() => save("accepted")}
                  style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: LIME, color: "#0B0F13", border: 0 }}>Accept</button>
        )}
        <button type="button" disabled={saving} onClick={() => save("dismissed")}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", color: MUTED, border: `1px solid ${LINE}` }}>Dismiss</button>
        {d && <button type="button" onClick={() => setEditing(false)} style={{ fontSize: 12, color: DIM, background: "transparent", border: 0, cursor: "pointer" }}>Cancel</button>}
        <span style={{ fontSize: 11, color: DIM, marginLeft: "auto" }}>Recorded with your name and the time. Nothing is ordered or changed in your plan.</span>
      </div>
      {err && <div style={{ marginTop: 6, fontSize: 12, color: "#FCA5A5" }}>{err}</div>}
    </div>
  );
}

export default function BriefView({ briefId, onClose, onOpenRun }) {
  const [b, setB] = useState(null);
  const [err, setErr] = useState("");
  const [costs, setCosts] = useState(false);
  const [rerun, setRerun] = useState("");

  const runAgain = async () => {
    const t = (b && b.trigger) || {};
    setRerun("Starting…");
    const r = await startBrief({ scenario: t.scenario, commodity: t.commodity, label: t.label, params: t.params || {} });
    setRerun(r.ok ? "Started. The new brief appears in Decision briefs in about 2 minutes." : r.message);
  };

  useEffect(() => {
    let alive = true;
    let t = null;
    const load = async () => {
      try {
        const x = await fetchBrief(briefId);
        if (!alive) return;
        setB(x);
        if (x.status === "running") t = setTimeout(load, 8000);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    };
    load();
    return () => { alive = false; clearTimeout(t); };
  }, [briefId]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const text = (b && b.text) || {};
  const tr = (b && b.trigger) || {};
  const dn = (b && b.do_nothing) || null;
  const sc = (b && b.scope) || {};
  const options = (b && b.options) || [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,6,23,0.75)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 780, background: "#0B1220", border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 11, color: LIME, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Decision brief{tr.label ? ` · ${tr.label}` : ""}{b && b.auto ? " · automatic" : ""}
          </div>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {b && b.status === "done" && !rerun && (
              <button type="button" onClick={runAgain} title="Run the brief again with today's network and your current cost settings. Uses one manual brief."
                      style={{ fontSize: 12, fontWeight: 600, color: MUTED, background: "transparent", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                Run again
              </button>
            )}
            {b && b.status === "done" && (
              <button type="button" onClick={() => { if (!printBrief(b)) setErr("Allow pop-ups for this site to export the PDF."); }}
                      style={{ fontSize: 12, fontWeight: 600, color: LIME, background: "transparent", border: "1px solid rgba(159,214,58,0.35)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                Export PDF
              </button>
            )}
            <button type="button" onClick={onClose} style={{ background: "transparent", border: 0, color: MUTED, fontSize: 18, cursor: "pointer", lineHeight: 1 }} aria-label="Close">×</button>
          </span>
        </div>

        {err && <div style={{ marginTop: 12, color: "#FCA5A5", fontSize: 13 }}>{err}</div>}
        {rerun && <div style={{ marginTop: 8, color: rerun.startsWith("Started") || rerun.startsWith("Starting") ? "#86EFAC" : "#FCA5A5", fontSize: 12.5 }}>{rerun}</div>}
        {!b && !err && <div className="animate-pulse" style={{ marginTop: 12, color: MUTED, fontSize: 13 }}>Loading the brief…</div>}
        {b && b.status === "running" && (
          <div className="animate-pulse" style={{ marginTop: 12, color: MUTED, fontSize: 13 }}>Preparing{b.progress ? `: ${b.progress}` : ""}. This takes a few minutes; you can close this and come back.</div>
        )}
        {b && b.status === "error" && <div style={{ marginTop: 12, color: "#FCA5A5", fontSize: 13 }}>{b.message || "The brief did not finish."}</div>}

        {b && b.status === "done" && (
          <>
            <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{text.headline || b.headline}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: DIM }}>
              {day(b.created_at)}{b.simulations ? ` · ${b.simulations} simulations` : ""}{b.seconds ? ` · ${Math.round(b.seconds / 60) || 1} min` : ""}
            </div>

            {b.ai_off && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>
                Written straight from the computed figures: AI features are switched off for this account, so nothing was sent to the AI provider.
              </div>
            )}
            {b.write_error && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: "#FCD34D" }} title={b.write_error}>
                Written straight from the computed figures: the AI write-up step did not respond. The numbers are unaffected.
              </div>
            )}
            {text.situation && <Section title="Situation"><p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: 0 }}>{text.situation}</p></Section>}
            {dn && (
              <Section title="If nothing is done">
                {text.impact && <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: "0 0 8px" }}>{text.impact}</p>}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: MUTED }}>
                  <span>Revenue at risk <b style={{ color: TEXT }}>{money(dn.revenue_at_risk)}</b></span>
                  <span>First shortage <b style={{ color: TEXT }}>{dn.first_shortage_date ? `${day(dn.first_shortage_date)}${dn.first_shortage_part ? `, ${pretty(dn.first_shortage_part)}` : ""}${dn.first_shortage_at ? ` at ${pretty(dn.first_shortage_at)}` : ""}` : "None"}</b></span>
                  {dn.run_id && onOpenRun && (
                    <button type="button" onClick={() => onOpenRun(dn.run_id)} style={{ fontSize: 11, fontWeight: 600, color: LIME, background: "transparent", border: "1px solid rgba(159,214,58,0.35)", borderRadius: 8, padding: "2px 10px", cursor: "pointer" }}>Open run</button>
                  )}
                </div>
              </Section>
            )}
            {text.recommendation && <Section title="Recommendation"><p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: 0 }}>{text.recommendation}</p></Section>}
            {options.length > 0 && (
              <Section title="Responses tested">
                <div style={{ display: "grid", gap: 8 }}>
                  {options.map((o) => <OptionRow key={o.key} o={o} recommended={o.key === b.recommended} onOpenRun={onOpenRun} />)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: DIM }}>
                  {options.some((o) => o.margin_protected != null)
                    ? "Margin protected is revenue at risk avoided times your gross margin. Net is margin protected less the cost of the response."
                    : "Revenue protected is revenue at risk avoided, not margin. Net is revenue protected less the cost of the response."}
                </div>
              </Section>
            )}
            {(b.outcome === "action" || b.outcome === "no_payback" || b.decision) && <DecisionPanel b={b} onSaved={(x) => setB(x)} />}
            {(b.ruled_out || []).length > 0 && (
              <Section title="Ruled out">
                {b.ruled_out.map((r) => (
                  <div key={r.key} style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}><b style={{ color: TEXT, fontWeight: 600 }}>{r.title}.</b> {r.note}</div>
                ))}
              </Section>
            )}
            {(options.some((o) => o.key === "alternate_source") || (b.ruled_out || []).some((r) => String(r.key).startsWith("alternate_source"))) && (
              <Section title="Alternate suppliers">
                <ScoutPanel briefId={b.id} />
              </Section>
            )}
            {text.watch && <Section title="What would change this"><p style={{ fontSize: 14, color: TEXT, lineHeight: 1.6, margin: 0 }}>{text.watch}</p></Section>}
            {(b.assumptions || []).length > 0 && (
              <Section title="Assumptions">
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                  {b.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  {(sc.parts || []).length > 0 && <li>Parts in scope: {sc.parts.map(pretty).join(", ")}</li>}
                  {b.defaults_used && (
                    <li>Costs use FOR-C defaults until replaced with your own.{" "}
                      <button type="button" onClick={() => setCosts(true)} style={{ color: LIME, background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Set your costs</button>
                    </li>
                  )}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
      {costs && <BriefCostSettings onClose={() => setCosts(false)} />}
    </div>
  );
}
