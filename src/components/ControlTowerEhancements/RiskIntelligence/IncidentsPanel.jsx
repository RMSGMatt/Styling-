/**
 * Incident log: dated supplier-site events (fires, floods, outages) and how each one touches the user's network.
 * Direct: one of your sites is in the affected area. Likely: a supplier of yours in that country ships you parts in the
 * affected categories. Category: you buy those parts elsewhere, so watch the market. Replays run the event on your network.
 */
import React, { useEffect, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const MUTED = "#94A3B8", DIM = "#64748B", INK = "#E8F2EC", LIME = "#9FD63A", LINE = "rgba(148,163,184,0.18)";
const LEVEL = {
  direct: { label: "Direct", color: "#F87171", note: "your sites are in the affected area" },
  likely: { label: "Likely", color: "#F4A742", note: "a supplier of yours is there" },
  category: { label: "Market", color: "#E8D44D", note: "you buy these parts elsewhere" },
  none: { label: "No exposure", color: "#64748B", note: "" },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const ICON = { fire: "🔥", flood: "🌊", explosion: "💥", outage: "⚡", earthquake: "🌐" };

export default function IncidentsPanel({ onLaunchScenario }) {
  const apiBase = getApiBase();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/api/incidents`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((b) => { if (live) setRes(b); }).catch(() => { if (live) setErr("Could not load the incident log."); });
    return () => { live = false; };
  }, [apiBase]);

  const replay = async (i) => {
    if (!onLaunchScenario || !i.replay) return;
    setBusy(i.id); setErr("");
    try {
      const r = await fetch(`${apiBase}/api/scenarios/replays/${i.replay}`, {
        method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ variant: "reported" }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok || b.status !== "ok") { setErr((b.errors || [])[0] || "Could not build the replay."); return; }
      if (!b.disruptions.length) { setErr(b.note || "This replay does not touch your network directly."); return; }
      const rows = b.disruptions.map((d) => {
        const end = new Date(d.startDate); end.setDate(end.getDate() + Number(d.duration));
        return { facility: d.facility, ...(d.sku ? { sku: d.sku } : {}), startDate: d.startDate, endDate: end.toISOString().slice(0, 10),
                 severity: d.productionImpact / 100, production_impact: d.productionImpact / 100, shipping_impact: d.shippingImpact / 100 };
      });
      onLaunchScenario({ scenario: b.name, params: {
        facility: rows[0].facility, severity: rows[0].severity, startDate: rows[0].startDate, endDate: rows[0].endDate,
        disruptionScenarios: rows, demandAdjustments: [], inventoryPolicies: [],
        laneAdjustments: b.laneDelays.map((l) => ({ from_facility: l.fromFacility, to_facility: l.toFacility, ...(l.sku ? { sku: l.sku } : {}), additional_lead_days: l.delayDays })),
        name: b.name, autoRun: true,
      } });
    } catch { setErr("Could not reach the replay service."); } finally { setBusy(""); }
  };

  if (!res && !err) return <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Loading the incident log…</div>;
  const items = res?.incidents || [];
  if (!items.length) return null;
  const order = { direct: 0, likely: 1, category: 2, none: 3 };
  const sorted = [...items].sort((a, b) => (order[a.match?.level] ?? 9) - (order[b.match?.level] ?? 9) || (b.date || "").localeCompare(a.date || ""));
  const shown = showAll ? sorted : sorted.filter((i) => i.match?.level !== "none").slice(0, 4);
  const touching = items.filter((i) => ["direct", "likely"].includes(i.match?.level)).length;

  return (
    <div style={{ background: "rgba(2,6,23,0.45)", border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "#2EC4A6", fontWeight: 600 }}>Incident log</div>
          <div style={{ fontSize: 15, color: INK, marginTop: 4 }}>
            {res?.status !== "ok"
              ? "Supplier-site fires, floods and outages. Load your network to see which touch you."
              : touching
                ? <><b style={{ color: "#F4A742" }}>{touching}</b> recent incident{touching === 1 ? "" : "s"} touch{touching === 1 ? "es" : ""} your suppliers or sites.</>
                : "No recent incident hits your sites or suppliers directly; some tighten markets you buy in."}
          </div>
        </div>
        <button type="button" onClick={() => setShowAll((v) => !v)} style={{ background: "none", border: 0, color: LIME, cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>
          {showAll ? "Show the ones that touch you" : `Show all ${items.length}`}
        </button>
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {shown.map((i) => {
          const lv = LEVEL[i.match?.level] || LEVEL.none;
          return (
            <div key={i.id} style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid ${lv.color}`, borderRadius: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>{ICON[i.type] || "⚠️"} {i.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#111B21", background: lv.color, borderRadius: 4, padding: "1px 7px", textTransform: "uppercase" }}>{lv.label}</span>
                  <span style={{ fontSize: 12, color: DIM }}>{fmt(i.date)}</span>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: DIM, marginTop: 2 }}>{i.company} · {i.place}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>{i.summary}</div>
              {res?.status === "ok" && i.match && i.match.level !== "none" && (
                <div style={{ fontSize: 13, color: lv.color, marginTop: 6 }}>
                  {i.match.why}{i.match.parts?.length ? <span style={{ color: MUTED }}> · your parts: {i.match.parts.join(", ")}</span> : null}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: DIM }}>Status: {i.status}</span>
                {(i.sources || []).map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: LIME }}>{s.title}</a>)}
                {i.replay && onLaunchScenario && res?.status === "ok" && (
                  <button type="button" disabled={busy === i.id} onClick={() => replay(i)}
                    style={{ marginLeft: "auto", background: LIME, color: "#111B21", border: 0, borderRadius: 6, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: busy === i.id ? 0.6 : 1 }}>
                    {busy === i.id ? "Starting…" : "Replay on my network"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {err && <div style={{ fontSize: 12.5, color: "#F87171", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
