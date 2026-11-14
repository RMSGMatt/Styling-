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
  { key: "exposure", label: "Your exposure" },
  { key: "simulate", label: "Cut a chokepoint" },
  { key: "mapping", label: "Part mapping" },
];

export default function ChokepointPanel({ switchView }) {
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
        {VIEWS.filter((v) => ok || v.key === "map").map((v) => (
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
                {ok && cps[sel] && <div style={{ marginTop: 8 }}><button type="button" style={actBtn} onClick={() => { setCut([sel]); setView("simulate"); runSim({ cut: [sel] }); }}>Cut {cps[sel].name} and date the impact</button></div>}
              </>
            )}
          </div>
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
                      <td style={td}><button type="button" style={linkBtn} onClick={() => { setCut([r.id]); setView("simulate"); runSim({ cut: [r.id] }); }}>Cut</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "simulate" && ok && (
        <div style={PANEL}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>Pick a scenario or cut individual chokepoints. Each part runs dry after the material already in the pipeline plus its own days of cover from your snapshot.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {data.presets.map((p) => <button key={p.key} type="button" style={chip(false)} onClick={() => { setCut(p.cut); runSim({ cut: p.cut }); }}>{p.label}</button>)}
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
              <button type="button" disabled={busy} style={actBtn} onClick={() => runSim({ cut })}>{busy ? "Running…" : "Run"}</button>
              <button type="button" style={chip(false)} onClick={() => { setCut([]); setSim(null); }}>Clear</button>
            </div>
          )}
          {sim && sim.status === "ok" && <SimResult sim={sim} hasBom={data.has_bom} />}
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
