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
              {t.start ? `since ${fmt(t.start)}` : t.note ? t.note : t.fresh ? `${t.agree} of ${t.fresh} signals tightening` : "no live signals"}
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
      {tiers.filter((t) => t.tier !== "pos").map((t) => (
        <div key={t.tier}>
          <div style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>{t.label} <span style={{ color: (STATE[t.state] || STATE.no_data).color, fontWeight: 600 }}>· {(STATE[t.state] || STATE.no_data).label}</span></div>
          {t.lines.length === 0 ? <div style={{ fontSize: 12.5, color: DIM }}>No signals on this tier yet.</div> : (
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, display: "grid", gap: 3 }}>
              {t.lines.map((ln, i) => (
                <li key={`${ln.signal}-${i}`} style={{ fontSize: 12.5, color: ln.tightening || (ln.score ?? 0) >= 1 ? INK : MUTED }}>
                  {ln.kind === "event" ? (
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
  }, [apiBase, authHeader]);

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
            </Section>
          )}

          <Section title="What it means for you"><ForYou card={card} personalized={res.personalized} switchView={switchView} /></Section>

          <Section title="What would change this call">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3 }}>{card.change.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: MUTED }}>{x}</li>)}</ul>
          </Section>

          <Section title="Options">
            <div style={{ fontSize: 12.5, color: DIM, marginBottom: 8 }}>Ranked options with simulated outcomes (extend cover, reserve capacity, qualify an alternate) arrive with PO drift signals. For now you can date the impact of losing this chain's chokepoints.</div>
            {cutIds.length > 0 && <button type="button" style={actBtn} onClick={() => onCut(cutIds)}>Cut {card.name} chokepoints and date the impact</button>}
          </Section>
        </div>
      )}
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
