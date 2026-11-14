// ─────────────────────────────────────────────────────────────────────────────
// ChokepointPanel.jsx
// FOR-C Risk Intelligence: Chokepoints
//
// The public Chokepoint Watch dataset (for-c.com/chokepoints) joined to the
// user's own network snapshot: which of their parts route through which
// upstream chokepoints, and, when a chokepoint is cut, the day each part runs
// dry and the finished goods it takes down with it.
//
// Backend: GET /api/chokepoints, PUT /api/chokepoints/mapping,
//          POST /api/chokepoints/simulate (snapshot_routes.py + chokepoints.py)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const LIME = "#9FD63A", MINT = "#2EC4A6", MUTED = "#94A3B8", DIM = "#64748B", LINE = "rgba(148,163,184,0.18)";
const PANEL = { background: "rgba(2,6,23,0.45)", border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 };
const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";

const scoreTone = (s) => s >= 15 ? { bg: "#4A1C1C", fg: "#FECACA", bd: "#F87171" }
  : s >= 10 ? { bg: "#3D2A10", fg: "#FDE2B0", bd: "#F4A742" }
  : s >= 6 ? { bg: "#38320F", fg: "#FDE68A", bd: "#F4C542" }
  : { bg: "#1D2D37", fg: "#E8F2EC", bd: "#5F7A88" };

function ScorePill({ s }) {
  if (s == null) return null;
  const t = scoreTone(s);
  return <span style={{ display: "inline-block", minWidth: 28, textAlign: "center", fontWeight: 700, fontSize: 12, padding: "2px 7px", borderRadius: 6, background: t.bd, color: "#111B21" }}>{s}</span>;
}

function fmtDate(iso) {
  if (!iso) return "n/a";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function addDays(iso, n) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(n));
  return d.toISOString().slice(0, 10);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

// Months to qualify an alternative: low end if North America has one, midpoint if partial, high end if none.
function recoveryMonths(c) {
  const [lo, hi] = c?.switchMonths || [6, 12];
  return c?.northAmerica === "Available" ? lo : c?.northAmerica === "Partial" ? Math.round((lo + hi) / 2) : hi;
}

// Component categories (tier 0) that sit downstream of a node in the graph.
function categoriesFor(ds, id) {
  const up = {};
  (ds.graph?.edges || []).forEach(([a, b]) => { (up[b] = up[b] || []).push(a); });
  const nodes = Object.fromEntries((ds.graph?.nodes || []).map((n) => [n.id, n]));
  const seen = new Set(), out = new Set(), stack = [id];
  while (stack.length) {
    const x = stack.pop();
    (up[x] || []).forEach((y) => { if (!seen.has(y)) { seen.add(y); stack.push(y); if (nodes[y]?.tier === 0) out.add(y); } });
  }
  if (nodes[id]?.tier === 0) out.add(id);
  return [...out];
}

function topSuppliers(c, n = 3) {
  return (c.suppliers || []).filter((s) => s[1] != null && !/^Rest of world/.test(s[0])).slice(0, n).map((s) => `${s[0]} ${s[1]}%`).join(" · ");
}

// ── Detail card shared by map, heat map and risk scores ─────────────────────
function CpDetail({ c, exp, onCut }) {
  if (!c) return null;
  const row = (k, v, note) => v ? (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, padding: "6px 0", borderTop: `1px solid ${LINE}` }}>
      <div style={{ color: DIM, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</div>
      <div><span style={{ color: "#E8F2EC" }}>{v}</span>{note && <span style={{ color: MUTED }}>. {note}</span>}</div>
    </div>) : null;
  return (
    <div style={{ ...PANEL, marginTop: 10, fontSize: 13.5, color: MUTED }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <ScorePill s={c.score} />
        <b style={{ color: "#E8F2EC", fontSize: 15 }}>{c.name}</b>
        <span>{c.layer} · {c.what}</span>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>Likelihood {c.likelihood} × impact {c.impact}</span>
      </div>
      {row("Market", c.structure, c.structureNote)}
      {row("Suppliers", topSuppliers(c, 5), c.basis)}
      {row("Supply now", c.supply, c.supplyNote)}
      {row("Policy risk", c.geo, c.geoNote)}
      {row("Switch time", c.switchMonths ? `${c.switchMonths[0]}-${c.switchMonths[1]} months` : null, c.switchNote)}
      {row("North America", c.northAmerica, c.northAmericaNote)}
      {exp && row("Your parts", `${exp.parts.join(", ")} at ${exp.sites.length} site${exp.sites.length === 1 ? "" : "s"}`, exp.min_days_cover != null ? `Thinnest cover ${exp.min_days_cover} days` : null)}
      {onCut && <div style={{ marginTop: 10 }}><button type="button" style={actBtn} onClick={onCut}>Cut {c.name} and date the impact</button></div>}
    </div>
  );
}

// ── Heat map: likelihood × impact ───────────────────────────────────────────
function HeatMap({ list, selected, onSelect, exposedIds }) {
  const cell = (l, i) => list.filter((c) => c.likelihood === l && c.impact === i);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "34px repeat(5, minmax(140px, 1fr))", gap: 4, minWidth: 760 }}>
        {[5, 4, 3, 2, 1].map((l) => (
          <React.Fragment key={l}>
            <div style={{ color: MUTED, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</div>
            {[1, 2, 3, 4, 5].map((i) => {
              const t = scoreTone(l * i);
              return (
                <div key={i} style={{ minHeight: 78, background: t.bg, border: `1px solid ${t.bd}55`, borderRadius: 6, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 10.5, color: t.fg, opacity: 0.6 }}>{l * i}</div>
                  {cell(l, i).map((c) => (
                    <button key={c.id} type="button" onClick={() => onSelect(selected === c.id ? null : c.id)}
                            style={{ textAlign: "left", fontSize: 12, padding: "3px 6px", borderRadius: 4, cursor: "pointer", color: "#111B21", fontWeight: 600,
                                     background: selected === c.id ? LIME : t.bd, border: exposedIds?.has(c.id) ? "2px solid #E8F2EC" : "2px solid transparent" }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div />
        {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ color: MUTED, fontSize: 12, textAlign: "center" }}>{i}</div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: DIM, marginTop: 6 }}>
        <span>Rows: likelihood (supply state plus policy risk)</span>
        <span>Columns: impact (how many categories it feeds, switch time, North American alternative)</span>
      </div>
    </div>
  );
}

// ── Risk scores table ───────────────────────────────────────────────────────
function RiskScores({ list, selected, onSelect, expById }) {
  const [sort, setSort] = useState("score");
  const [layer, setLayer] = useState("all");
  const layers = [...new Set(list.map((c) => c.layer))];
  const rows = list.filter((c) => layer === "all" || c.layer === layer).slice().sort((a, b) =>
    sort === "switch" ? (b.switchMonths?.[1] || 0) - (a.switchMonths?.[1] || 0) : sort === "name" ? a.name.localeCompare(b.name) : (b.score - a.score) || (b.impact - a.impact));
  const SUP = { Constrained: "#F87171", Tight: "#F4A742", Balanced: MUTED, Surplus: "#4ADE80" };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {["all", ...layers].map((k) => <button key={k} type="button" style={chip(layer === k)} onClick={() => setLayer(k)}>{k === "all" ? "All layers" : k}</button>)}
        <span style={{ marginLeft: "auto", fontSize: 12, color: DIM }}>Sort</span>
        {[["score", "Score"], ["switch", "Switch time"], ["name", "Name"]].map(([k, l]) => <button key={k} type="button" style={chip(sort === k)} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tbl}>
          <thead><tr>{["Score", "L × I", "Chokepoint", "Layer", "Market", "Top suppliers", "Supply", "Policy", "Switch", "N. America", ...(expById ? ["Your parts"] : [])].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => onSelect(selected === c.id ? null : c.id)} style={{ cursor: "pointer", background: selected === c.id ? "rgba(159,214,58,0.08)" : "transparent" }}>
                <td style={td}><ScorePill s={c.score} /></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{c.likelihood} × {c.impact}</td>
                <td style={{ ...td, color: "#E8F2EC", fontWeight: 600 }}>{c.name}</td>
                <td style={td}>{c.layer}</td>
                <td style={td}>{c.structure}</td>
                <td style={{ ...td, minWidth: 200 }}>{topSuppliers(c)}</td>
                <td style={{ ...td, color: SUP[c.supply] || MUTED }}>{c.supply}</td>
                <td style={td}>{c.geo}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{c.switchMonths ? `${c.switchMonths[0]}-${c.switchMonths[1]} mo` : "n/a"}</td>
                <td style={td}>{c.northAmerica}</td>
                {expById && <td style={{ ...td, color: expById[c.id] ? LIME : DIM }}>{expById[c.id] ? expById[c.id].parts.length : 0}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Industry-level cut, for accounts without a network loaded ──────────────
function IndustryCut({ ds, cut, pipe, defaults }) {
  const cps = Object.fromEntries((ds.chokepoints || []).map((c) => [c.id, c]));
  const nodes = Object.fromEntries((ds.graph?.nodes || []).map((n) => [n.id, n]));
  const rows = [];
  cut.forEach((id) => {
    const c = cps[id]; if (!c) return;
    const wk = pipe[id] ?? defaults[id] ?? 12;
    categoriesFor(ds, id).forEach((cat) => rows.push({ cat, c, wk, dry: addDays(todayIso(), wk * 7), rec: recoveryMonths(c) }));
  });
  const cats = [...new Set(rows.map((r) => r.cat))];
  if (!cut.length) return null;
  return (
    <div>
      <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 14, color: "#E8F2EC" }}>
        Cutting <b>{cut.map((id) => cps[id]?.name).join(", ")}</b> reaches <b>{cats.length}</b> component categor{cats.length === 1 ? "y" : "ies"}: {cats.map((k) => nodes[k]?.name || k).join(", ")}.
        {" "}Load your network to date the outage part by part using your own days of cover.
      </div>
      <table style={tbl}>
        <thead><tr>{["Component category", "Via", "Pipeline", "Pipeline runs out", "Qualify alternative"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td style={{ ...td, color: "#E8F2EC", fontWeight: 600 }}>{nodes[r.cat]?.name || r.cat}</td><td style={td}>{r.c.name}</td>
            <td style={td}>{r.wk} wk</td><td style={{ ...td, color: "#E8F2EC" }}>{fmtDate(r.dry)}</td><td style={td}>{r.rec} mo</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Relationship map ─────────────────────────────────────────────────────────
function ChokepointMap({ ds, counts, selected, onSelect }) {
  const G = ds.graph || { nodes: [], edges: [] };
  const cps = useMemo(() => Object.fromEntries((ds.chokepoints || []).map((c) => [c.id, c])), [ds]);
  const { up, down } = useMemo(() => {
    const u = {}, d = {};
    G.nodes.forEach((n) => { u[n.id] = []; d[n.id] = []; });
    G.edges.forEach(([a, b]) => { if (d[a] && u[b]) { d[a].push(b); u[b].push(a); } });
    return { up: u, down: d };
  }, [G]);
  const walk = (id, m, acc = new Set()) => { (m[id] || []).forEach((x) => { if (!acc.has(x)) { acc.add(x); walk(x, m, acc); } }); return acc; };
  const lit = selected ? new Set([selected, ...walk(selected, up), ...walk(selected, down)]) : null;
  const cols = [0, 1, 2].map((t) => G.nodes.filter((n) => n.tier === t));
  const W = 1000, BW = 220, BH = 44, top = 30;
  const H = Math.max(...cols.map((c) => c.length), 1) * (BH + 12);
  const gap = (W - 4 * BW) / 3, xs = [0, BW + gap, 2 * (BW + gap), W - BW];
  const pos = {};
  cols.forEach((c, t) => { const sp = H / Math.max(1, c.length); c.forEach((n, i) => { pos[n.id] = { x: xs[t], y: top + sp * (i + 0.5) }; }); });
  const colorFor = (n) => {
    if (n.tier === 0) return n.group === "electronics" ? { f: "#13314A", s: "#5AA6E6", t: "#BFE0FF" } : { f: "#0F3A32", s: MINT, t: "#B8F1E4" };
    const c = cps[n.id];
    if (!c) return { f: "#1D2D37", s: "#3A5160", t: "#E8F2EC" };
    const t = scoreTone(c.score);
    return { f: t.bg, s: t.bd, t: t.fg };
  };
  const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
  const node = (n, x, y, title, sub, col, dashed, key) => {
    const dim = lit && !lit.has(n.id);
    const c = cps[n.id];
    const mine = n.tier === 0 ? counts[n.id] : null;
    return (
      <g key={key} opacity={dim ? 0.16 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(selected === n.id ? null : n.id)}
         tabIndex={0} role="button" aria-label={title} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selected === n.id ? null : n.id); } }}>
        <rect x={x} y={y - BH / 2} width={BW} height={BH} rx={7} fill={col.f} stroke={n.id === selected && !dashed ? LIME : col.s}
              strokeWidth={n.id === selected && !dashed ? 2.5 : 1} strokeDasharray={dashed ? "4 3" : "none"} />
        <text x={x + 10} y={y - 4} fill={col.t} fontSize={12.5} fontWeight={600}>{trunc(title, mine > 0 ? 21 : 29)}</text>
        <text x={x + 10} y={y + 12} fill={MUTED} fontSize={11}>{trunc(sub, 33)}</text>
        {c && !dashed && (<>
          <rect x={x + BW - 30} y={y + 3} width={24} height={15} rx={4} fill={col.s} />
          <text x={x + BW - 18} y={y + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#111B21">{c.score}</text>
        </>)}
        {mine > 0 && (<>
          <rect x={x + BW - 52} y={y - BH / 2 + 5} width={46} height={15} rx={7} fill={LIME} />
          <text x={x + BW - 29} y={y - BH / 2 + 16} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#111B21">{mine} {mine === 1 ? "part" : "parts"}</text>
        </>)}
      </g>
    );
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H + top + 8} viewBox={`0 0 ${W} ${H + top + 8}`} role="img" aria-label="Component categories to process steps to material chokepoints and market structure">
        {["Component category", "Process step", "Material chokepoint", "Market structure"].map((h, t) => (
          <text key={h} x={xs[t] + BW / 2} y={16} textAnchor="middle" fill={MUTED} fontSize={11} letterSpacing=".06em">{h.toUpperCase()}</text>
        ))}
        {G.edges.map(([a, b], i) => {
          const pa = pos[a], pb = pos[b]; if (!pa || !pb) return null;
          const x1 = pa.x + BW, x2 = pb.x, mx = (x1 + x2) / 2, on = lit && lit.has(a) && lit.has(b);
          return <path key={i} d={`M${x1} ${pa.y} C${mx} ${pa.y} ${mx} ${pb.y} ${x2 - 2} ${pb.y}`} fill="none" stroke={on ? LIME : "#3A5160"} strokeWidth={on ? 2 : 1.2} opacity={lit && !on ? 0.16 : 1} />;
        })}
        {cols.flat().map((n) => {
          const p = pos[n.id], c = cps[n.id];
          const top1 = c && n.tier === 2 && c.suppliers && c.suppliers[0] && c.suppliers[0][1] != null ? `${c.suppliers[0][0]} ${c.suppliers[0][1]}%` : n.sub;
          return node(n, p.x, p.y, n.name, top1, colorFor(n), false, n.id);
        })}
        {cols[2].map((n) => {
          const c = cps[n.id]; if (!c) return null;
          const p = pos[n.id], x = xs[3];
          const top2 = (c.suppliers || []).filter((s) => s[1] != null && !/^Rest of world/.test(s[0])).slice(0, 2).map((s) => `${s[0]} ${s[1]}%`).join(" · ");
          return (
            <g key={`m-${n.id}`}>
              <path d={`M${p.x + BW} ${p.y} L${x - 2} ${p.y}`} stroke={lit && lit.has(n.id) ? LIME : "#3A5160"} strokeDasharray="3 3" opacity={lit && !lit.has(n.id) ? 0.16 : 1} />
              {node(n, x, p.y, c.structure, top2 || c.basis, colorFor(n), true, `ms-${n.id}`)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
const VIEWS = [
  { key: "map", label: "Map" },
  { key: "heat", label: "Heat map" },
  { key: "scores", label: "Risk scores" },
  { key: "exposure", label: "Your exposure", needsData: true },
  { key: "simulate", label: "Cut a chokepoint" },
  { key: "mapping", label: "Part mapping", needsData: true },
];

export default function ChokepointPanel({ switchView, onLaunchScenario }) {
  const apiBase = getApiBase();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState("map");
  const [sel, setSel] = useState(null);
  const [cut, setCut] = useState([]);
  const [pipe, setPipe] = useState({});
  const [sim, setSim] = useState(null);
  const [busy, setBusy] = useState(false);
  const [critOnly, setCritOnly] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch(`${apiBase}/api/chokepoints`, { headers: { Authorization: `Bearer ${token()}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.msg || "Could not load chokepoints.");
      setData(body);
    } catch (e) { setErr(e.message || "Could not load chokepoints."); }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);

  const ds = data?.dataset;
  const cps = useMemo(() => Object.fromEntries((ds?.chokepoints || []).map((c) => [c.id, c])), [ds]);
  const nodes = useMemo(() => Object.fromEntries((ds?.graph?.nodes || []).map((n) => [n.id, n])), [ds]);
  const counts = useMemo(() => {
    const out = {};
    (data?.exposure?.categories || []).forEach((c) => { out[c.category] = c.parts.length; });
    return out;
  }, [data]);
  const ok = data?.status === "ok";

  const runSim = async (body) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${apiBase}/api/chokepoints/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...body, pipeline_weeks: pipe }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((out.errors || [])[0] || "Simulation failed.");
      setSim(out);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const cutNow = (ids) => { setCut(ids); setView("simulate"); if (ok) runSim({ cut: ids }); else setSim(null); };

  // Hand a dated cut to the full simulator: each affected site is disrupted from the day its
  // first exposed part runs dry until an alternative is qualified, offset from the start of the loaded data.
  const launchFull = async () => {
    if (!sim || !onLaunchScenario) return;
    let start = todayIso(), horizon = null;
    try {
      const r = await fetch(`${apiBase}/api/network-snapshot/sim-inputs`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json().catch(() => ({}));
      if (j?.summary?.start) start = String(j.summary.start).slice(0, 10);
      if (j?.summary?.horizon_days) horizon = Number(j.summary.horizon_days);
    } catch { /* fall back to today */ }
    const bySite = {};
    sim.parts.forEach((p) => {
      if (p.runs_dry_day == null || !p.facility) return;
      const s = bySite[p.facility] || (bySite[p.facility] = { first: Infinity, end: 0 });
      s.first = Math.min(s.first, p.runs_dry_day);
      s.end = Math.max(s.end, p.runs_dry_day + p.recovery_months * 30);
    });
    const rows = Object.entries(bySite).map(([facility, s]) => ({
      facility, startDate: addDays(start, s.first), endDate: addDays(start, s.end), severity: 1.0, production_impact: 1.0, shipping_impact: 0,
    }));
    if (!rows.length) { setErr("No dated parts to send. Parts need usage data to be dated."); return; }
    const first = Math.min(...Object.values(bySite).map((s) => s.first));
    if (horizon && first >= horizon) {
      setErr(`Your first part runs dry on day ${first}, after the ${horizon}-day simulation window ends. Within that window your cover holds; extend the demand horizon to simulate the outage.`);
      return;
    }
    const name = `Chokepoint cut: ${sim.cut_names.join(", ")}`;
    onLaunchScenario({ scenario: name, params: {
      facility: rows[0].facility, severity: 1.0, startDate: rows[0].startDate, endDate: rows[0].endDate,
      disruptionScenarios: rows, name, autoRun: true,
    } });
  };

  const setMap = async (sku, value) => {
    setErr("");
    try {
      const res = await fetch(`${apiBase}/api/chokepoints/mapping`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ mapping: { [sku]: value || null } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr((body.errors || ["Could not save."])[0]); return; }
      setData(body); setSim(null);
    } catch { setErr("Could not save."); }
  };

  if (!data && !err) return <div style={{ ...PANEL, color: MUTED }}>Loading chokepoints…</div>;
  if (!ds) return <div style={{ ...PANEL, color: "#F87171" }}>{err || "Chokepoint data is unavailable."}</div>;

  const ex = data.exposure;
  const selInfo = sel ? (cps[sel] || nodes[sel]) : null;
  const selExp = sel && ex ? ex.chokepoints.find((r) => r.id === sel) : null;
  const selCat = sel && ex ? ex.categories.find((c) => c.category === sel) : null;

  return (
    <div>
      {/* Status strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {ok ? (<>
          <Stat big={ex.exposed_count} label="chokepoints your parts route through" />
          <Stat big={ex.critical_count} label="of them critical (score 15+)" tone={ex.critical_count ? "#F87171" : null} />
          <Stat big={`${ex.mapped} of ${ex.total_skus}`} label="parts mapped to a component category" />
        </>) : (
          <div style={{ ...PANEL, flex: 1, color: MUTED, fontSize: 14 }}>
            {data.status === "upgrade_required"
              ? <>The industry map is below. <b style={{ color: "#E8F2EC" }}>Mapping it to your own parts and dating a cutoff</b> needs a Pro or Enterprise plan.{switchView && <> <button type="button" onClick={() => switchView("billing")} style={linkBtn}>Upgrade</button></>}</>
              : <>The industry map is below. <b style={{ color: "#E8F2EC" }}>Load your network data</b> in the Control Tower to see which chokepoints your own parts route through.{switchView && <> <button type="button" onClick={() => switchView("dashboard")} style={linkBtn}>Open Control Tower</button></>}</>}
          </div>
        )}
        <div style={{ fontSize: 12, color: DIM, alignSelf: "flex-end" }}>
          Dataset reviewed {fmtDate(ds.meta?.updated)} · {ds.data_source === "live" ? "live from for-c.com" : "bundled copy"}
        </div>
      </div>

      {/* View switch */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {VIEWS.filter((v) => ok || !v.needsData).map((v) => (
          <button key={v.key} type="button" onClick={() => setView(v.key)} style={chip(view === v.key)}>{v.label}</button>
        ))}
      </div>
      {err && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 10 }}>{err}</div>}

      {view === "map" && (
        <>
          <div style={PANEL}><ChokepointMap ds={ds} counts={counts} selected={sel} onSelect={setSel} /></div>
          <div style={{ ...PANEL, marginTop: 10, fontSize: 14, color: MUTED }}>
            {!selInfo ? "Tap any box to trace its chain. Lime badges show how many of your parts sit in each category." : (
              <>
                <b style={{ color: "#E8F2EC" }}>{selInfo.name}</b>{" "}
                {cps[sel] && <><ScorePill s={cps[sel].score} /> · {cps[sel].structure} · supply {String(cps[sel].supply || "").toLowerCase()} · policy risk {String(cps[sel].geo || "").toLowerCase()}. {cps[sel].supplyNote}</>}
                {selExp && <div style={{ marginTop: 6, color: "#E8F2EC" }}>Your parts: {selExp.parts.join(", ")} at {selExp.sites.length} site{selExp.sites.length === 1 ? "" : "s"}{selExp.min_days_cover != null && <>, thinnest cover {selExp.min_days_cover} days</>}{selExp.finished_goods.length > 0 && <>. Feeds {selExp.finished_goods.join(", ")}</>}.</div>}
                {selCat && <div style={{ marginTop: 6, color: "#E8F2EC" }}>Your parts here: {selCat.parts.join(", ")}. Routes through {selCat.chokepoints.length} scored chokepoints.</div>}
                {cps[sel] && <div style={{ marginTop: 8 }}><button type="button" style={actBtn} onClick={() => cutNow([sel])}>Cut {cps[sel].name} and date the impact</button></div>}
              </>
            )}
          </div>
        </>
      )}

      {view === "heat" && (
        <>
          <div style={PANEL}><HeatMap list={ds.chokepoints || []} selected={sel} onSelect={setSel} exposedIds={ok ? new Set(ex.chokepoints.map((r) => r.id)) : null} /></div>
          {ok && <div style={{ fontSize: 12, color: DIM, marginTop: 6 }}>White outline: your parts route through it.</div>}
          {cps[sel] ? <CpDetail c={cps[sel]} exp={selExp} onCut={() => cutNow([sel])} /> : <div style={{ ...PANEL, marginTop: 10, fontSize: 14, color: MUTED }}>Tap a chokepoint for its suppliers, supply state and switch time.</div>}
        </>
      )}

      {view === "scores" && (
        <>
          <div style={PANEL}><RiskScores list={ds.chokepoints || []} selected={sel} onSelect={setSel} expById={ok ? Object.fromEntries(ex.chokepoints.map((r) => [r.id, r])) : null} /></div>
          {cps[sel] && <CpDetail c={cps[sel]} exp={selExp} onCut={() => cutNow([sel])} />}
          <div style={{ fontSize: 12, color: DIM, marginTop: 8 }}>Score = likelihood × impact, each 1 to 5. 15 and above is critical.</div>
        </>
      )}

      {view === "exposure" && ok && (
        <div style={PANEL}>
          <label style={{ fontSize: 13, color: MUTED, display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
            <input type="checkbox" checked={critOnly} onChange={(e) => setCritOnly(e.target.checked)} /> Critical only (score 15+)
          </label>
          {ex.chokepoints.length === 0 ? <div style={{ color: MUTED }}>None of your mapped parts route through a scored chokepoint. Check Part mapping.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tbl}>
                <thead><tr>{["Score", "Chokepoint", "Market", "Supply", "Your parts", "Sites", "Thinnest cover", "Finished goods", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {ex.chokepoints.filter((r) => !critOnly || r.score >= 15).map((r) => (
                    <tr key={r.id}>
                      <td style={td}><ScorePill s={r.score} /></td>
                      <td style={{ ...td, color: "#E8F2EC", fontWeight: 600 }}>{r.name}</td>
                      <td style={td}>{r.structure}</td>
                      <td style={td}>{r.supply}</td>
                      <td style={td}>{r.parts.join(", ")}</td>
                      <td style={td}>{r.sites.length}</td>
                      <td style={{ ...td, color: r.min_days_cover != null && r.min_days_cover < 14 ? "#F87171" : MUTED }}>{r.min_days_cover != null ? `${r.min_days_cover} d` : "n/a"}</td>
                      <td style={td}>{r.finished_goods.join(", ") || (data.has_bom ? "none" : "add a BOM")}</td>
                      <td style={td}><button type="button" style={linkBtn} onClick={() => cutNow([r.id])}>Cut</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "simulate" && (
        <div style={PANEL}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{ok
            ? "Pick a scenario or cut individual chokepoints. Each part runs dry after the material already in the pipeline plus its own days of cover from your snapshot."
            : "Pick a scenario or cut individual chokepoints to see which component categories it reaches and when the material already in the pipeline runs out."}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {data.presets.map((p) => <button key={p.key} type="button" style={chip(false)} onClick={() => cutNow(p.cut)}>{p.label}</button>)}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {(ds.chokepoints || []).slice().sort((a, b) => b.score - a.score).map((c) => {
              const on = cut.includes(c.id);
              return <button key={c.id} type="button" onClick={() => setCut(on ? cut.filter((x) => x !== c.id) : [...cut, c.id])}
                             style={{ ...chip(false), ...(on ? { background: "#EF4444", borderColor: "#EF4444", color: "#fff" } : {}) }}>{c.name}</button>;
            })}
          </div>
          {cut.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
              {cut.map((id) => (
                <label key={id} style={{ fontSize: 12, color: MUTED, display: "flex", flexDirection: "column", gap: 3 }}>
                  {cps[id]?.name} pipeline (weeks)
                  <input type="number" min={0} value={pipe[id] ?? data.pipeline_weeks[id] ?? 12}
                         onChange={(e) => setPipe({ ...pipe, [id]: e.target.value === "" ? undefined : Number(e.target.value) })}
                         style={{ width: 110, padding: "5px 8px", borderRadius: 6, border: `1px solid ${LINE}`, background: "#0B1418", color: "#E8F2EC" }} />
                </label>
              ))}
              {ok && <button type="button" disabled={busy} style={actBtn} onClick={() => runSim({ cut })}>{busy ? "Running…" : "Run"}</button>}
              <button type="button" style={chip(false)} onClick={() => { setCut([]); setSim(null); }}>Clear</button>
            </div>
          )}
          {!ok && <IndustryCut ds={ds} cut={cut} pipe={pipe} defaults={data.pipeline_weeks} />}
          {ok && sim && sim.status === "ok" && (
            <>
              <SimResult sim={sim} hasBom={data.has_bom} />
              {onLaunchScenario && sim.summary.parts_hit > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                  <button type="button" style={actBtn} onClick={launchFull}>Run in full simulator</button>
                  <span style={{ fontSize: 12, color: DIM }}>Disrupts each affected site from the day its first part runs dry until an alternative is qualified, so you see fill rate, backlog and revenue at risk.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "mapping" && ok && (
        <div style={PANEL}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Parts are matched to a component category from their names. Correct any that are wrong; your choice always wins. Finished goods and parts outside these categories can stay unmapped.</div>
          <div style={{ overflowX: "auto" }}>
            <table style={tbl}>
              <thead><tr>{["Part", "Category", "Source"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.mapping.map((m) => (
                  <tr key={m.sku}>
                    <td style={{ ...td, color: "#E8F2EC" }}>{m.sku}</td>
                    <td style={td}>
                      <select value={m.source === "user" ? (m.category || "none") : ""} onChange={(e) => setMap(m.sku, e.target.value)}
                              style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${LINE}`, background: "#0B1418", color: "#E8F2EC" }}>
                        <option value="">Auto{m.source === "auto" ? `: ${nodes[m.category]?.name || m.category}` : ": not matched"}</option>
                        {data.categories.map((k) => <option key={k} value={k}>{nodes[k]?.name || k}</option>)}
                        <option value="none">None of these</option>
                      </select>
                    </td>
                    <td style={{ ...td, color: m.source === "user" ? LIME : DIM }}>{m.source === "user" ? "You" : m.source === "auto" ? "Auto" : "Unmapped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SimResult({ sim, hasBom }) {
  const s = sim.summary;
  const maxDay = Math.max(30, ...sim.parts.map((p) => (p.runs_dry_day || 0) + p.recovery_months * 30));
  const pct = (d) => `${Math.min(100, (d / maxDay) * 100)}%`;
  return (
    <div>
      <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 14, color: "#E8F2EC" }}>
        {s.parts_hit === 0 ? <>None of your mapped parts route through {sim.cut_names.join(", ")}.</> : (
          <>
            Cutting <b>{sim.cut_names.join(", ")}</b> hits <b>{s.parts_hit}</b> part{s.parts_hit === 1 ? "" : "s"} at <b>{s.sites_hit}</b> site{s.sites_hit === 1 ? "" : "s"}
            {hasBom && <> and <b>{s.finished_goods_hit}</b> finished good{s.finished_goods_hit === 1 ? "" : "s"}</>}.
            {s.first_date && <> First to run dry: <b>{s.first_part}</b> at {s.first_site} on <b>{fmtDate(s.first_date)}</b> (day {s.first_day}).</>}
            {s.worst_recovery_months != null && <> Qualifying an alternative takes up to <b>{s.worst_recovery_months} months</b>.</>}
            {s.undated > 0 && <> {s.undated} line{s.undated === 1 ? " has" : "s have"} no usage data and cannot be dated.</>}
          </>
        )}
      </div>
      {sim.finished_goods.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Finished goods</div>
          <table style={tbl}>
            <thead><tr>{["Finished good", "First short", "Limiting part", "Site", "Exposed parts"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{sim.finished_goods.map((g) => (
              <tr key={g.sku}><td style={{ ...td, color: "#E8F2EC", fontWeight: 600 }}>{g.sku}</td><td style={td}>{g.first_date ? `${fmtDate(g.first_date)} (day ${g.first_day})` : "n/a"}</td>
                <td style={td}>{g.limiting_part || "n/a"}</td><td style={td}>{g.limiting_site || "n/a"}</td><td style={td}>{g.parts.join(", ")}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {sim.parts.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Parts (green = on hand and pipeline, red = outage until an alternative is qualified)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={tbl}>
              <thead><tr>{["Part", "Site", "Via", "Cover", "Runs dry", "Recovery", "Timeline"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{sim.parts.map((p, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: "#E8F2EC", fontWeight: 600 }}>{p.sku}{p.below_safety && <span style={{ color: "#F87171", fontSize: 11 }}> below safety</span>}</td>
                  <td style={td}>{p.facility}</td><td style={td}>{p.via_names.join(", ")}</td>
                  <td style={td}>{p.days_cover != null ? `${p.days_cover} d + ${p.pipeline_weeks} wk` : "n/a"}</td>
                  <td style={{ ...td, color: "#E8F2EC" }}>{p.runs_dry_date ? fmtDate(p.runs_dry_date) : "n/a"}</td>
                  <td style={td}>{p.recovery_months} mo</td>
                  <td style={{ ...td, minWidth: 180 }}>
                    {p.runs_dry_day != null && (
                      <div style={{ position: "relative", height: 12, background: "rgba(148,163,184,0.12)", borderRadius: 4 }}>
                        <div style={{ position: "absolute", left: 0, width: pct(p.runs_dry_day), height: 12, background: "rgba(74,222,128,0.45)", borderRadius: "4px 0 0 4px" }} />
                        <div style={{ position: "absolute", left: pct(p.runs_dry_day), width: pct(p.recovery_months * 30), height: 12, background: "#EF4444", borderRadius: "0 4px 4px 0" }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      <div style={{ fontSize: 12, color: DIM, marginTop: 10 }}>{sim.assumptions}</div>
    </div>
  );
}

function Stat({ big, label, tone }) {
  return (
    <div style={{ ...PANEL, padding: "10px 14px", minWidth: 170 }}>
      <div style={{ fontSize: 24, fontWeight: 600, color: tone || "#E8F2EC", lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
    </div>
  );
}

const chip = (on) => ({ padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: on ? `1px solid ${MINT}` : `1px solid ${LINE}`, background: on ? "rgba(46,196,166,0.12)" : "transparent", color: on ? MINT : MUTED, fontWeight: on ? 600 : 400 });
const actBtn = { padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: 0, background: LIME, color: "#11200A" };
const linkBtn = { background: "none", border: 0, color: LIME, cursor: "pointer", textDecoration: "underline", fontSize: "inherit", padding: 0 };
const tbl = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { textAlign: "left", padding: "7px 8px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", color: MUTED, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
