/**
 * Supplier scout on a brief: alternate manufacturers for the brief's parts, found on the web and screened (UFLPA,
 * State Department advisories, country risk). Candidates are labeled found or verified; only the customer can mark
 * one qualified. The user confirms the category and region before anything is searched.
 */
import React, { useEffect, useRef, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const LINE = "rgba(148,163,184,0.18)";
const token = () => localStorage.getItem("token") || "";
const headers = (json) => ({ Authorization: `Bearer ${token()}`, ...(json ? { "Content-Type": "application/json" } : {}) });
const api = (path, opts = {}) => fetch(`${getApiBase()}${path}`, opts).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }));

const STATUS = {
  qualified: ["Qualified by you", "#0B0F13", LIME],
  verified: ["Verified operating company", "#86EFAC", "transparent"],
  found: ["Found, not verified", MUTED, "transparent"],
};
const input = { width: "100%", fontSize: 13, color: TEXT, background: "rgba(2,6,23,0.5)", border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 8px" };
const btn = { fontSize: 12, fontWeight: 600, color: LIME, background: "transparent", border: "1px solid rgba(159,214,58,0.35)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" };

function Chip({ children, tone }) {
  const c = tone === "bad" ? "#FCA5A5" : tone === "warn" ? "#FCD34D" : MUTED;
  return <span style={{ fontSize: 11, color: c, border: `1px solid ${c}55`, borderRadius: 20, padding: "1px 8px" }}>{children}</span>;
}

function Candidate({ c, onQualify, busy }) {
  const [label, color, bg] = c.qualified ? STATUS.qualified : STATUS[c.status] || STATUS.found;
  const s = c.screening || {};
  const risk = s.country_risk;
  const sites = (c.sites || []).map((x) => [x.city, x.country].filter(Boolean).join(", ")).join("; ");
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", background: "rgba(2,6,23,0.35)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        {c.website ? (
          <a href={/^https?:/.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.name}</a>
        ) : <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.name}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, border: bg === "transparent" ? `1px solid ${color}66` : 0, borderRadius: 20, padding: "1px 8px" }}>{label}</span>
        <button type="button" disabled={busy} onClick={() => onQualify(c, !c.qualified)} style={{ ...btn, marginLeft: "auto", opacity: busy ? 0.5 : 1 }}>
          {c.qualified ? "Unmark qualified" : "Mark qualified"}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{c.products}{sites ? ` · makes it in ${sites}` : ""}{c.hq_country ? ` · HQ ${c.hq_country}` : ""}</div>
      {c.fit && <div style={{ fontSize: 12.5, color: TEXT, marginTop: 3 }}>{c.fit}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {s.uflpa?.flagged ? <Chip tone="bad">UFLPA Entity List match: {s.uflpa.matched_entity}</Chip> : <Chip>No UFLPA match</Chip>}
        {(s.advisories || []).map((a) => (
          <Chip key={a.country_code} tone={a.level >= 4 ? "bad" : a.level >= 3 ? "warn" : undefined}>{a.country_code} travel advisory level {a.level}</Chip>
        ))}
        {risk && risk.score != null && <Chip tone={risk.score >= 60 ? "bad" : risk.score >= 45 ? "warn" : undefined}>{c.hq_country_code} country risk {risk.score} ({risk.label})</Chip>}
        {c.tier && <Chip>{c.tier}</Chip>}
        {!c.website_ok && <Chip tone="warn">Website did not answer</Chip>}
      </div>
      {(c.evidence || []).length > 0 && (
        <div style={{ fontSize: 11.5, color: DIM, marginTop: 5 }}>
          Sources:{" "}
          {c.evidence.map((e, i) => (
            <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: DIM, marginRight: 8 }}>{e.title || `link ${i + 1}`}</a>
          ))}
        </div>
      )}
    </div>
  );
}

// briefId: a brief's shortlist (prefilled from its parts). source + prefill: any other starting point, e.g. a chokepoint
// ({ source: "chokepoint:industrial:abf", prefill: { category, region } }).
export default function ScoutPanel({ briefId, source, prefill }) {
  const listQuery = briefId ? `brief=${briefId}` : `source=${encodeURIComponent(source || "")}`;
  const [scout, setScout] = useState(null);
  const [usage, setUsage] = useState(null);
  const [form, setForm] = useState(null); // {category, region, note}
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const timer = useRef(null);

  const poll = (id) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await api(`/api/agent/scout/${id}`, { headers: headers() });
      if (r.ok) {
        setScout(r.body.scout);
        if (r.body.scout.status === "running") poll(id);
      }
    }, 4000);
  };

  useEffect(() => {
    api(`/api/agent/scouts?${listQuery}`, { headers: headers() }).then((r) => {
      if (!r.ok) return;
      setUsage(r.body.usage);
      const last = (r.body.scouts || [])[0];
      if (last) {
        setScout(last);
        if (last.status === "running") poll(last.id);
      }
    });
    return () => clearTimeout(timer.current);
  }, [listQuery]);

  async function openForm() {
    setErr("");
    const note = "Edit these before searching: only the category and region below are sent to the web search. Site and supplier names never are.";
    if (!briefId) {
      setForm({ category: prefill?.category || "", region: prefill?.region || "North America, Europe, Japan, Korea or Southeast Asia", note });
      return;
    }
    const r = await api(`/api/agent/scout/prefill?brief=${briefId}`, { headers: headers() });
    setForm(r.ok ? { category: r.body.category, region: r.body.region, note: r.body.note } : { category: "", region: "", note });
  }

  async function run() {
    setBusy(true);
    setErr("");
    const r = await api("/api/agent/scout", { method: "POST", headers: headers(true), body: JSON.stringify({ category: form.category, region: form.region, brief_id: briefId || null, option: briefId ? "alternate_source" : source }) });
    setBusy(false);
    if (r.status === 202) {
      setForm(null);
      setScout(r.body.scout);
      poll(r.body.scout.id);
    } else setErr(r.body.message || "The search could not start.");
  }

  async function qualify(c, value) {
    setBusy(true);
    const r = await api(`/api/agent/scout/${scout.id}/qualified`, { method: "POST", headers: headers(true), body: JSON.stringify({ name: c.name, qualified: value }) });
    setBusy(false);
    if (r.ok) setScout(r.body.scout);
  }

  if (usage && !(usage.limit > 0)) return null;
  const cands = (scout && scout.candidates) || [];

  return (
    <div>
      {!form && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            {scout ? `Searched for ${scout.category} · ${scout.region}` : "Search the web for manufacturers that could become a second source, screened for compliance and country risk."}
          </span>
          <button type="button" onClick={openForm} style={{ ...btn, marginLeft: "auto" }} disabled={scout && scout.status === "running"}>
            {scout ? "New search" : "Find alternate suppliers"}
          </button>
        </div>
      )}
      {form && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <label style={{ fontSize: 11.5, color: DIM }}>Part category to search for
            <input style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. 32-bit automotive microcontrollers" />
          </label>
          <label style={{ fontSize: 11.5, color: DIM }}>Region
            <input style={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </label>
          <div style={{ fontSize: 11.5, color: DIM }}>{form.note}{usage ? ` ${usage.used} of ${usage.limit} searches used this month.` : ""}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={run} disabled={busy || (form.category || "").trim().length < 3} style={{ ...btn, background: "rgba(159,214,58,0.12)" }}>Search</button>
            <button type="button" onClick={() => setForm(null)} style={{ ...btn, color: MUTED, borderColor: LINE }}>Cancel</button>
          </div>
        </div>
      )}
      {err && <div style={{ fontSize: 12.5, color: "#FCA5A5", marginBottom: 8 }}>{err}</div>}
      {scout && scout.status === "running" && <div style={{ fontSize: 12.5, color: MUTED }}>{scout.progress || "Searching"}… this takes a minute or two.</div>}
      {scout && scout.status === "error" && <div style={{ fontSize: 12.5, color: "#FCA5A5" }}>{scout.message}</div>}
      {scout && scout.status === "done" && (
        <div style={{ display: "grid", gap: 6 }}>
          {!cands.length && <div style={{ fontSize: 12.5, color: MUTED }}>No manufacturers found for this category and region. Try a broader category or region.</div>}
          {cands.map((c) => <Candidate key={c.name} c={c} onQualify={qualify} busy={busy} />)}
          <div style={{ fontSize: 11, color: DIM }}>
            Found by web search ({scout.searches || 0} searches){scout.search_note ? `: ${scout.search_note}` : "."} Verified means the website answered and at least two sources show the company makes this category; it is not a quality or capacity check.
            {(scout.dropped || []).length > 0 && (
              <button type="button" onClick={() => setShowDropped((x) => !x)} style={{ marginLeft: 6, fontSize: 11, color: MUTED, background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                {showDropped ? "Hide" : `${scout.dropped.length} left out`}
              </button>
            )}
          </div>
          {showDropped && (scout.dropped || []).map((d) => <div key={d.name} style={{ fontSize: 11.5, color: DIM }}>{d.name}: {d.why}</div>)}
        </div>
      )}
    </div>
  );
}
