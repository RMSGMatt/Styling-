/**
 * Signals: early warning that a shortage is moving down a supply chain toward the user's parts.
 * Each chain (MCU, memory, power, PCB) has tiers that tighten in order: material, process, component, your POs.
 * A chain escalates only when adjacent tiers agree, and each card dates when component lead times should move.
 */
import React, { useEffect, useState } from "react";

const LIME = "#9FD63A", MUTED = "#94A3B8", DIM = "#64748B", LINE = "rgba(148,163,184,0.18)", INK = "#E8F2EC";
const PANEL = { background: "rgba(2,6,23,0.45)", border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 };
const STAGE = {
  act: { label: "Act", color: "#F87171" },
  warning: { label: "Warning", color: "#F4A742" },
  watch: { label: "Watch", color: "#E8D44D" },
  none: { label: "Quiet", color: "#64748B" },
};
const STATE = {
  surge: { label: "Surge", color: "#F87171" },
  tightening: { label: "Tightening", color: "#F4A742" },
  stable: { label: "Stable", color: "#4ADE80" },
  easing: { label: "Easing", color: "#2EC4A6" },
  no_data: { label: "No data yet", color: "#475569" },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const month = (iso) => { if (!iso) return ""; const [y, m] = iso.slice(0, 7).split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

function StageBadge({ stage }) {
  const s = STAGE[stage] || STAGE.none;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111B21", background: s.color, borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>;
}

function TierStrip({ tiers }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
      {tiers.map((t, i) => {
        const s = STATE[t.state] || STATE.no_data;
        return (
          <div key={t.tier} style={{ position: "relative", border: `1px solid ${s.color}66`, borderRadius: 8, padding: "8px 10px", background: `${s.color}14` }}>
            <div style={{ fontSize: 11.5, color: DIM, textTransform: "uppercase", letterSpacing: ".05em" }}>{i + 1}. {t.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
              {t.tier === "pos" && t.fresh ? `${t.agree} of ${t.fresh} supplier parts drifting${t.start ? ` since ${fmt(t.start)}` : ""}`
                : t.start ? `since ${fmt(t.start)}` : t.note ? t.note : t.fresh ? `${t.agree} of ${t.fresh} signals tightening` : "no live signals"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function History({ history }) {
  if (!history?.length) return null;
  const w = 100 / history.length;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11.5, color: DIM, marginBottom: 4 }}>Stage over the last 12 months</div>
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ width: "100%", height: 12, display: "block" }} role="img" aria-label="Stage by week over the last year">
        {history.map((h, i) => <rect key={h.date} x={i * w} y="0" width={w + 0.05} height="6" fill={(STAGE[h.stage] || STAGE.none).color} opacity={h.stage === "none" ? 0.35 : 0.9} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DIM, marginTop: 2 }}>
        <span>{month(history[0].date)}</span><span>{month(history[history.length - 1].date)}</span>
      </div>
    </div>
  );
}

function Evidence({ tiers }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tiers.map((t) => ({ ...t, lines: t.lines.filter((ln) => ln.status !== "no_data") }))  // indicators with no reading yet stay off the card
        .filter((t) => t.tier !== "pos" || t.lines.length || t.note).map((t) => (
        <div key={t.tier}>
          <div style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>{t.label} <span style={{ color: (STATE[t.state] || STATE.no_data).color, fontWeight: 600 }}>· {(STATE[t.state] || STATE.no_data).label}</span></div>
          {t.lines.length === 0 ? <div style={{ fontSize: 12.5, color: DIM }}>{t.tier === "pos" && t.note ? t.note : "No signals on this tier yet."}</div> : (
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, display: "grid", gap: 3 }}>
              {t.lines.map((ln, i) => (
                <li key={`${ln.signal}-${i}`} style={{ fontSize: 12.5, color: ln.tightening || (ln.score ?? 0) >= 1 ? INK : MUTED }}>
                  {ln.kind === "po" ? (
                    <><b style={{ color: (STATE[ln.state] || STATE.stable).color, fontWeight: 600 }}>{ln.name}</b>: {ln.note}</>
                  ) : ln.kind === "event" ? (
                    <>{fmt(ln.date)}: {ln.note}{ln.until && <span style={{ color: DIM }}> (held through {month(ln.until)})</span>}</>
                  ) : ln.status === "no_data" ? (
                    <>{ln.name}: <span style={{ color: DIM }}>not loaded yet</span></>
                  ) : (
                    <>{ln.name}: {ln.value}{ln.unit ? ` ${ln.unit}` : ""} ({month(ln.date)}){ln.status === "stale" && <span style={{ color: "#F4A742" }}> · stale, needs a fresh reading</span>}
                      {ln.change_3m != null && ln.status === "ok" && <span style={{ color: DIM }}> · {ln.change_3m > 0 ? "+" : ""}{ln.change_3m} in 3 months</span>}</>
                  )}
                  {ln.url && <> <a href={ln.url} target="_blank" rel="noopener noreferrer" style={{ color: LIME, fontSize: 11.5 }}>source</a></>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ForYou({ card, personalized, switchView }) {
  const you = card.you;
  if (!personalized || !you) {
    return <div style={{ fontSize: 13, color: MUTED }}>Load your network data in the Control Tower to see which of your parts sit in this chain's path and whether cover lasts past the window.{switchView && <> <button type="button" onClick={() => switchView("dashboard")} style={linkBtn}>Open Control Tower</button></>}</div>;
  }
  if (!you.parts.length) return <div style={{ fontSize: 13, color: MUTED }}>None of your mapped parts fall in this chain ({card.categories.join(", ")}). Check Part mapping if that looks wrong.</div>;
  return (
    <div style={{ fontSize: 13, color: MUTED, display: "grid", gap: 6 }}>
      <div><b style={{ color: INK }}>{you.parts.length}</b> of your parts at <b style={{ color: INK }}>{you.sites.length}</b> site{you.sites.length === 1 ? "" : "s"} sit in this chain.
        {you.min_days_cover != null && <> Thinnest cover <b style={{ color: you.cover_short ? "#F87171" : INK }}>{you.min_days_cover} days</b>{you.cover_runs_out && <>, running out {fmt(you.cover_runs_out)}</>}.</>}
        {you.cover_short != null && (card.window?.status === "ahead"
          ? <> {you.cover_short ? "That is before the window closes." : "That lasts past the window."}</>
          : <> {you.cover_short ? "Under 13 weeks, so a re-order at stretched lead times may not land in time." : "Enough to ride out a stretched re-order."}</>)}
      </div>
      {(card.own_orders || []).filter((o) => o.padded).map((o) => (
        <div key={o.sku} style={{ color: "#F4A742" }}>Your open POs for {o.sku} cover {Math.round(o.open_days)} days of use against a {Math.round(o.lead_days)}-day lead time. If lead times ease, that is excess stock; consider firming dates instead of adding orders.</div>
      ))}
      {you.worst?.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><th style={th}>Part</th><th style={th}>Sites</th><th style={th}>Thinnest cover (days)</th></tr></thead>
          <tbody>{you.worst.map((p) => <tr key={p.sku}><td style={td}>{p.sku}</td><td style={td}>{p.sites.join(", ")}</td><td style={{ ...td, color: p.min_days_cover != null && p.min_days_cover < 91 ? "#F87171" : MUTED }}>{p.min_days_cover ?? "n/a"}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

export default function SignalsView({ apiBase, authHeader, selected, onSelect, onCut, switchView, knownIds }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/api/chokepoints/signals`, { headers: authHeader() });
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(body.chains)) throw new Error(body.msg || "Could not load signals.");
        if (live) setRes(body);
      } catch (e) { if (live) setErr(e.message || "Could not load signals."); }
    })();
    return () => { live = false; };
  }, [apiBase, authHeader, tick]);

  if (err) return <div style={{ ...PANEL, color: "#F87171" }}>{err}</div>;
  if (!res) return <div style={{ ...PANEL, color: MUTED }}>Loading signals…</div>;
  const card = res.chains.find((c) => c.id === selected) || res.chains[0];
  const cutIds = (card?.chokepoints || []).filter((id) => !knownIds || knownIds.has(id));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: DIM }}>
        Upstream signals for automotive electronics. A chain escalates only when adjacent tiers agree; each card dates when component lead times should move. Signals reviewed {fmt(res.updated)}.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
        {res.chains.map((c) => (
          <button key={c.id} type="button" onClick={() => onSelect(c.id)}
                  style={{ ...PANEL, padding: "10px 12px", textAlign: "left", cursor: "pointer", border: `1px solid ${c.id === card.id ? LIME : LINE}`, display: "grid", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{c.name}</span><StageBadge stage={c.stage} /></div>
            <div style={{ fontSize: 12, color: MUTED }}>{c.window_text || "No dated window"}</div>
          </button>
        ))}
      </div>

      {card && (
        <div style={PANEL}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <StageBadge stage={card.stage} />
            <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>{card.headline}</div>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
            {card.confirm.tiers} of 3 upstream tiers tightening
            {card.since && card.stage !== "none" && (card.act_on_cover
              ? <> · {STAGE[card.chain_stage]?.label || "Warning"} since {fmt(card.since)} · <b style={{ color: STAGE.act.color }}>Act on your cover today</b></>
              : <> · {STAGE[card.stage].label} since {fmt(card.since)}</>)}
          </div>
          {card.window_text && <div style={{ fontSize: 14, color: card.window?.status === "overdue" ? "#F4A742" : INK, marginTop: 6, fontWeight: 600 }}>{card.window_text}{card.window?.lag_weeks && <span style={{ fontWeight: 400, color: DIM }}> ({card.window.lag_weeks[0]} to {card.window.lag_weeks[1]} weeks after the {card.window.anchor} tier moved)</span>}</div>}
          <TierStrip tiers={card.tiers} />
          <History history={card.history} />

          <Section title="What we see"><Evidence tiers={card.tiers} /></Section>

          {card.label && (
            <Section title="Real constraint or panic ordering?">
              <div style={{ fontSize: 13, color: MUTED }}><b style={{ color: INK }}>{card.label.label}</b> · hoarding signal {card.label.hoarding}. {card.label.upstream_tight ? "Upstream tiers are tight, so the constraint looks real." : "Upstream tiers are steady, so part of the rise may be customers padding orders."}{card.label.note && <span style={{ color: DIM }}> {card.label.note}</span>}</div>
              {(card.label.lines?.length > 0 || card.label.own?.length > 0) && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 3 }}>
                  {card.label.lines.map((ln, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: MUTED }}>
                      <span style={{ color: ln.points === "panic" ? "#F4A742" : "#4ADE80", fontWeight: 600 }}>{ln.points === "panic" ? "Padding" : "Real demand"}</span>: {ln.date ? `${fmt(ln.date)}: ` : ""}{ln.note}
                      {ln.url && <> <a href={ln.url} target="_blank" rel="noopener noreferrer" style={{ color: LIME, fontSize: 11.5 }}>source</a></>}
                    </li>
                  ))}
                  {card.label.own.map((o) => (
                    <li key={o.sku} style={{ fontSize: 12.5, color: MUTED }}>
                      <span style={{ color: o.padded ? "#F4A742" : "#4ADE80", fontWeight: 600 }}>Your orders</span>: {o.text}{o.padded ? ", more than the lead time needs" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section title="What it means for you"><ForYou card={card} personalized={res.personalized} switchView={switchView} /></Section>

          {res.personalized && card.you?.parts?.length > 0 && (
            <Section title="Your part numbers at distributors">
              <PartQuotes key={card.id} skus={card.you.parts} apiBase={apiBase} authHeader={authHeader} />
            </Section>
          )}

          <Section title="What would change this call">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3 }}>{card.change.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: MUTED }}>{x}</li>)}</ul>
          </Section>

          <Section title="Options">
            <Options key={card.id} card={card} apiBase={apiBase} authHeader={authHeader} cutIds={cutIds} onCut={onCut} personalized={res.personalized} />
          </Section>
        </div>
      )}

      <DriftTable drift={res.po_drift} />
      {res.personalized && res.pool && <PoolPanel pool={res.pool} apiBase={apiBase} authHeader={authHeader} onChange={reload} />}
    </div>
  );
}

const FAMILY = { mcu: "MCUs and processors", mem: "Memory", pwr: "Power semiconductors", pcb: "PCBs", pas: "Passives", con: "Connectors" };

function PoolPanel({ pool, apiBase, authHeader, onChange }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await fetch(`${apiBase}/api/chokepoints/signals/pool`, {
        method: "PUT", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ opt_in: !pool.opt_in }),
      });
      onChange();
    } finally { setBusy(false); }
  };
  return (
    <div style={PANEL}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>FOR-C lead-time index</div>
        <div style={{ fontSize: 12.5, color: DIM }}>PO drift pooled across companies, by part family</div>
        <button type="button" onClick={toggle} disabled={busy}
                style={{ ...actBtn, marginLeft: "auto", padding: "5px 12px", ...(pool.opt_in ? { background: "transparent", color: LIME, border: `1px solid ${LIME}` } : {}) }}>
          {busy ? "Saving…" : pool.opt_in ? "Stop contributing" : "Contribute and see the index"}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>
        {pool.opt_in
          ? "You are contributing. "
          : "Off. "}
        Each company shares one summary per part family: the median change in quoted lead time and average lateness. No part numbers, suppliers, prices or quantities.
        A family is published only when {pool.min_contributors} or more companies contribute, and only as medians across companies. Stopping removes your data at once.
      </div>
      {pool.families.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
          <thead><tr><th style={th}>Part family</th><th style={th}>Companies</th><th style={th}>Quoted lead time, 6 weeks</th><th style={th}>Lines due, days late</th></tr></thead>
          <tbody>
            {pool.families.map((f) => (
              <tr key={f.family}>
                <td style={td}>{FAMILY[f.family] || f.family}</td>
                <td style={td}>{f.contributors}{f.status === "building" && <span style={{ color: DIM }}> (needs {f.needed} more)</span>}</td>
                <td style={td}>{f.status === "published" && f.lt_change != null ? `${f.lt_change > 0 ? "+" : ""}${Math.round(f.lt_change * 100)}%` : <span style={{ color: DIM }}>not yet published</span>}</td>
                <td style={td}>{f.status === "published" && f.late_days != null ? f.late_days : <span style={{ color: DIM }}>not yet published</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DriftTable({ drift }) {
  const [all, setAll] = useState(false);
  if (!drift?.pairs?.length) return null;
  const moving = drift.pairs.filter((p) => p.state === "surge" || p.state === "tightening");
  const rows = all ? drift.pairs : moving;
  return (
    <div style={PANEL}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Your suppliers: PO drift</div>
        <div style={{ fontSize: 12.5, color: DIM }}>
          {moving.length} of {drift.pairs.length} supplier parts drifting · last 6 weeks against the 12 before · POs through {fmt(drift.as_of)}
        </div>
        <button type="button" onClick={() => setAll(!all)} style={{ ...linkBtn, fontSize: 12.5, marginLeft: "auto" }}>{all ? "Show drifting only" : "Show all"}</button>
      </div>
      {rows.length === 0 ? <div style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>No supplier part is drifting on your POs.</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
          <thead><tr><th style={th}>Supplier</th><th style={th}>Part</th><th style={th}>State</th><th style={th}>What moved</th><th style={th}>POs</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const hits = p.metrics.filter((m) => m.state === "tightening" || m.state === "surge");
              const s = STATE[p.state] || { label: "Too few POs", color: DIM };
              return (
                <tr key={`${p.supplier}|${p.sku}`}>
                  <td style={td}>{p.supplier}</td><td style={td}>{p.sku}</td>
                  <td style={{ ...td, color: s.color, fontWeight: 600 }}>{p.state === "thin" ? "Too few POs" : s.label}</td>
                  <td style={td}>{(hits.length ? hits : p.metrics.slice(0, 1)).map((m) => m.text).join("; ")}</td>
                  <td style={td}>{p.lines}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11.5, color: DIM, marginTop: 8 }}>Push-outs need two uploads of the same open POs; they appear after your next refresh.</div>
    </div>
  );
}

const money = (v) => (v == null ? null : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);

function Options({ card, apiBase, authHeader, cutIds, onCut, personalized }) {
  const [opt, setOpt] = useState(card.options || null);
  const [knob, setKnob] = useState(() => ({
    // Blank means "use each part's stretch from live quotes" when quotes are available.
    stretch_weeks: ["quotes", "mixed"].includes(card.options?.assumptions?.stretch_source) ? "" : (card.options?.assumptions?.stretch_weeks ?? 12),
    premium_pct: card.options?.assumptions?.premium_pct ?? 5,
    spot_multiple: card.options?.assumptions?.spot_multiple ?? 3,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setOpt(card.options || null); }, [card.id, card.options]);

  const rerun = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase}/api/chokepoints/signals/options`, {
        method: "POST", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ chain: card.id, ...knob, stretch_weeks: knob.stretch_weeks === "" ? null : knob.stretch_weeks }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((body.errors || [])[0] || "Could not recalculate.");
      setOpt(body);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const cutBtn = cutIds.length > 0 && (
    <button type="button" style={{ ...actBtn, background: "transparent", color: LIME, border: `1px solid ${LIME}` }} onClick={() => onCut(cutIds)}>
      Cut {card.name} chokepoints in the simulator
    </button>
  );
  if (!personalized) return <div style={{ fontSize: 12.5, color: MUTED }}>Load your network to see options scored on your parts, cover and revenue.</div>;
  if (card.stage === "none") return <div style={{ fontSize: 12.5, color: MUTED }}>No options needed while the chain is quiet.</div>;
  if (card.stage === "watch") {
    return <div style={{ fontSize: 12.5, color: MUTED, display: "grid", gap: 8 }}>Options appear if the chain reaches Warning, when two adjacent tiers agree. One tier tightening alone is too early to act on.<div>{cutBtn}</div></div>;
  }
  if (!opt || opt.status !== "ok") {
    return <div style={{ fontSize: 12.5, color: MUTED, display: "grid", gap: 8 }}>{opt?.note || "No options to score for this chain."}<div>{cutBtn}</div></div>;
  }
  const a = opt.assumptions, b = opt.baseline;
  const field = (key, label, min, max, step, unit, placeholder) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED }}>
      {label}
      <input type="number" min={min} max={max} step={step} value={knob[key]} placeholder={placeholder}
             onChange={(e) => setKnob({ ...knob, [key]: e.target.value })}
             style={{ width: 64, background: "rgba(2,6,23,0.6)", color: INK, border: `1px solid ${LINE}`, borderRadius: 6, padding: "3px 6px" }} />
      {unit}
    </label>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, color: MUTED }}>
        If you hold: <b style={{ color: b.line_down_days > 0 ? "#F87171" : INK }}>{b.line_down_days} line-down days</b> across {b.sites_short} site{b.sites_short === 1 ? "" : "s"}
        {b.revenue_at_risk != null && <>, <b style={{ color: INK }}>{money(b.revenue_at_risk)}</b> of revenue at risk{b.revenue_basis === "site" && <span style={{ color: DIM }}> (whole-site revenue, an upper bound; add a BOM to narrow it)</span>}</>}
        {b.first_short && <>, first part short {fmt(b.first_short)}</>}.
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {field("stretch_weeks", "Lead times stretch by", 1, 52, 1, "weeks", a.stretch_by_sku?.length ? "auto" : "12")}
        {field("premium_pct", "Reservation premium", 0, 50, 1, "%")}
        {field("spot_multiple", "Broker price", 1, 10, 0.5, "x")}
        <button type="button" style={{ ...actBtn, padding: "5px 12px" }} onClick={rerun} disabled={busy}>{busy ? "Scoring…" : "Recalculate"}</button>
        {err && <span style={{ fontSize: 12.5, color: "#F87171" }}>{err}</span>}
      </div>
      {a.stretch_source === "override" ? (
        <div style={{ fontSize: 12, color: DIM }}>Using your {a.stretch_weeks}-week stretch for every part. Clear the box and recalculate to use live quotes.</div>
      ) : a.stretch_by_sku?.length > 0 ? (
        <div style={{ fontSize: 12, color: MUTED }}>
          Stretch from live distributor quotes, against your {a.stretch_by_sku.every((x) => x.usual_source === "plan") ? "planned lead times" : a.stretch_by_sku.every((x) => x.usual_source === "pos") ? "recent POs" : "planned lead times or recent POs"}: {a.stretch_by_sku.map((x, i) => (
            <span key={x.sku}>{i > 0 && "; "}<b style={{ color: INK }}>{x.sku}</b> {x.weeks} wks ({x.quoted_weeks} quoted vs {x.usual_weeks} {x.usual_source === "plan" ? "planned" : "usual"})</span>
          ))}.{a.unquoted?.length > 0 && <> No quote for {a.unquoted.join(", ")}: {a.stretch_weeks} weeks assumed.</>}
        </div>
      ) : null}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr><th style={th}>#</th><th style={th}>Option</th><th style={th}>Line-down days</th><th style={th}>Revenue at risk</th><th style={th}>Cost</th><th style={th}>Watch out</th></tr></thead>
        <tbody>
          {opt.options.map((o, i) => {
            // An option that changes nothing in this window reads as background, not as a warning.
            const noEffect = o.key !== "hold" && o.line_down_days != null && !(o.days_avoided > 0);
            return (
            <tr key={o.key} style={{ opacity: o.feasible && !noEffect ? 1 : 0.55 }}>
              <td style={td}>{i + 1}</td>
              <td style={td}><b style={{ color: INK }}>{o.title}</b><div style={{ color: DIM }}>{o.how}</div></td>
              <td style={td}>{o.line_down_days == null ? "n/a" : <>{o.line_down_days}{o.days_avoided > 0 && <span style={{ color: "#4ADE80" }}> (−{o.days_avoided})</span>}</>}</td>
              <td style={td}>{money(o.revenue_at_risk) ?? "n/a"}</td>
              <td style={td}>{o.cost != null ? money(o.cost) : "n/a"}{o.cost_note && <div style={{ color: DIM }}>{o.cost_note}</div>}</td>
              <td style={{ ...td, color: o.note && !o.feasible ? "#F4A742" : o.note ? MUTED : DIM }}>{o.note || o.risk || ""}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11.5, color: DIM }}>
        Model: supply pauses for the lead-time stretch from {a.starts_in_days > 0 ? `${a.starts_in_days} days from now (the window's midpoint)` : "now (lead times are already moving)"}; a part runs short by the stretch minus its days of cover.
        Ranked by cost per line-down day avoided. {a.stretch_by_sku?.length && a.stretch_source !== "override" ? "Stretch comes from today's quotes; the rest are FOR-C assumptions, not a forecast: change them above." : "FOR-C assumptions, not a forecast: change them above."}
      </div>
      <div>{cutBtn}</div>
    </div>
  );
}

const QSTATUS = {
  gap: { label: "Gap", color: "#F87171" },
  buy_now: { label: "Buy now", color: "#F4A742" },
  covered: { label: "Covered", color: "#4ADE80" },
  unknown: { label: "Unclear", color: "#E8D44D" },
  not_found: { label: "Not listed", color: "#64748B" },
  unmapped: { label: "No part number", color: "#64748B" },
};
const n0 = (v) => (v == null ? "n/a" : Math.round(v).toLocaleString());
const usd = (v) => (v == null ? "" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);

function PartQuotes({ skus, apiBase, authHeader }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState({});
  const [saving, setSaving] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setErr("");
    (async () => {
      try {
        const r = await fetch(`${apiBase}/api/network-parts/quotes?skus=${encodeURIComponent(skus.join(","))}`, { headers: authHeader() });
        const b = await r.json();
        if (live) setRes(b);
      } catch (e) {
        if (live) setErr("Could not reach the distributor lookup. Try again shortly.");
      }
    })();
    return () => { live = false; };
  }, [apiBase, authHeader, skus.join(","), tick]);

  const save = async (sku) => {
    setSaving(sku);
    try {
      const r = await fetch(`${apiBase}/api/network-parts/mpn`, {
        method: "PUT", headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ mapping: { [sku]: (edit[sku] || "").trim() } }),
      });
      const b = await r.json();
      if (!r.ok) { setErr((b.errors || []).join(" ") || "Could not save that part number."); return; }
      setEdit((e) => ({ ...e, [sku]: undefined }));
      setTick((t) => t + 1);
    } finally { setSaving(""); }
  };

  if (err) return <div style={{ fontSize: 13, color: "#F87171" }}>{err}</div>;
  if (!res) return <div style={{ fontSize: 13, color: MUTED }}>Checking live distributor quotes for your part numbers...</div>;
  if (res.status === "upgrade_required") return <div style={{ fontSize: 13, color: MUTED }}>{res.message}</div>;
  if (res.status === "no_sources") return <div style={{ fontSize: 13, color: MUTED }}>Distributor lookups are not switched on yet.</div>;
  if (res.status !== "ok") return <div style={{ fontSize: 13, color: MUTED }}>Load your network data to check your part numbers.</div>;

  const gaps = res.parts.filter((p) => p.status === "gap");
  const short = gaps.filter((p) => p.spot_covers_gap === false);
  return (
    <div style={{ fontSize: 13, color: MUTED, display: "grid", gap: 8 }}>
      <div>
        {gaps.length
          ? <><b style={{ color: "#F87171" }}>{gaps.length}</b> of {res.parts.length} part{res.parts.length === 1 ? "" : "s"} run out before a re-order placed today would land at today's quoted lead time.
              {short.length > 0 && <> Distributor stock does not cover the gap on {short.length === gaps.length ? (gaps.length === 1 ? "it" : "any of them") : short.length}; the rest has to come from allocation, a broker, or a design change.</>}</>
          : <>At today's quoted lead times, cover on these parts outlasts a re-order placed today.</>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr>
            <th style={th}>Part</th><th style={th}>Part number</th><th style={th}>Quoted lead time</th><th style={th}>Distributor stock</th>
            <th style={th}>Cover</th><th style={th}>Verdict</th>
          </tr></thead>
          <tbody>{res.parts.map((p) => {
            const st = QSTATUS[p.status === "gap" && p.spot_covers_gap ? "buy_now" : p.status] || QSTATUS.unknown;
            const editing = edit[p.sku] !== undefined;
            return (
              <React.Fragment key={p.sku}>
                <tr>
                  <td style={{ ...td, color: INK }}>{p.sku}</td>
                  <td style={td}>
                    {editing ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <input value={edit[p.sku]} onChange={(e) => setEdit({ ...edit, [p.sku]: e.target.value })} placeholder="Manufacturer part number"
                          style={{ background: "rgba(2,6,23,0.6)", border: `1px solid ${LINE}`, borderRadius: 4, color: INK, fontSize: 12, padding: "2px 6px", width: 170 }} />
                        <button type="button" disabled={saving === p.sku} onClick={() => save(p.sku)} style={linkBtn}>{saving === p.sku ? "Saving" : "Save"}</button>
                        <button type="button" onClick={() => setEdit({ ...edit, [p.sku]: undefined })} style={{ ...linkBtn, color: MUTED }}>Cancel</button>
                      </span>
                    ) : (
                      <>
                        {p.mpn ? <span style={{ color: INK }}>{p.mpn}</span> : <span>none</span>}
                        {p.manufacturer && <span style={{ color: DIM }}> · {p.manufacturer}</span>}
                        {" "}<button type="button" onClick={() => setEdit({ ...edit, [p.sku]: p.mpn || "" })} style={{ ...linkBtn, fontSize: 11.5 }}>{p.mpn ? "change" : "set"}</button>
                      </>
                    )}
                  </td>
                  <td style={td}>
                    {p.lead_weeks != null ? <>{p.lead_weeks} wks{p.lead_weeks_max != null && p.lead_weeks_max !== p.lead_weeks && <span style={{ color: DIM }}> to {p.lead_weeks_max}</span>}</> : "n/a"}
                    {p.planned_lead_days != null && p.lead_weeks != null && <div style={{ fontSize: 11, color: DIM }}>{p.planned_lead_source === "plan" ? "your planned lead time" : "your recent POs"}: {Math.round(p.planned_lead_days / 7 * 10) / 10} wks</div>}
                  </td>
                  <td style={td}>{p.stock != null ? n0(p.stock) : "n/a"}</td>
                  <td style={td}>{p.days_cover != null ? `${p.days_cover} days` : "n/a"}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111B21", background: st.color, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase" }}>{st.label}</span>
                    {p.lifecycle_risk && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#F4A742" }}>{p.lifecycle}</span>}
                  </td>
                </tr>
                {(p.status === "gap" || p.status === "covered" || p.status === "not_found") && (
                  <tr><td colSpan={6} style={{ ...td, paddingTop: 0, fontSize: 12 }}>
                    {p.text}
                    {p.status === "gap" && p.spot_cost != null && (p.spot_covers_gap
                      ? <> Distributor stock covers it: buying the gap runs about <b style={{ color: INK }}>{usd(p.spot_cost)}</b> at list price.</>
                      : <> Buying what distributors list runs about <b style={{ color: INK }}>{usd(p.spot_cost)}</b> at list price.</>)}
                    {(p.offers || []).filter((o) => o.url && !o.error).map((o) => (
                      <a key={o.source} href={o.url} target="_blank" rel="noopener noreferrer" style={{ color: LIME, fontSize: 11.5, marginLeft: 8 }}>{o.source}</a>
                    ))}
                  </td></tr>
                )}
              </React.Fragment>
            );
          })}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: DIM }}>
        Live from {res.sources.join(" and ")}, refreshed every 6 hours. Distributor stock is a signal, not your full supply: most volume moves through direct and franchised allocation. Gaps net off your open POs.
        {res.sample_mapping && " Sample network: part numbers are representative public parts."}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 12, color: DIM, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

const actBtn = { padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: 0, background: LIME, color: "#11200A" };
const linkBtn = { background: "none", border: 0, color: LIME, cursor: "pointer", textDecoration: "underline", fontSize: "inherit", padding: 0 };
const th = { textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${LINE}` };
const td = { padding: "6px 8px", color: MUTED, borderBottom: `1px solid ${LINE}` };
