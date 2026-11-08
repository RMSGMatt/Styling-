import React, { useEffect, useState, useCallback } from "react";
import { COMMODITY_REGISTRY } from "./RiskIntelligence/commodityRegistry";
import { loadCommodityProfiles } from "./RiskIntelligence/commodityProfiles";

const LABEL = Object.fromEntries(COMMODITY_REGISTRY.map((c) => [c.key, c.label]));
const coverTone = (d, below) => (below || (d != null && d < 7) ? "#EF4444" : d != null && d < 14 ? "#F59E0B" : "#22C55E");

// Parts with thin cover, joined to the commodity risk behind them. Mapping is auto-detected from the part name; the user can correct it.
export default function PartsAtRiskCard({ apiBase, refreshKey, onSelectSite, onOpenRisk }) {
  const [data, setData] = useState(null);
  const [prof, setProf] = useState({});
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/network-parts`, { headers: { Authorization: `Bearer ${token()}` } });
      const body = await res.json().catch(() => ({}));
      setData(body);
      if (body.status === "ok") setProf(await loadCommodityProfiles(body.skus.map((s) => s.commodity).filter(Boolean)));
    } catch { setData({ status: "error" }); }
  }, [apiBase]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const setMap = async (sku, value) => {
    setErr("");
    try {
      const res = await fetch(`${apiBase}/api/network-parts/mapping`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ mapping: { [sku]: value || null } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr((body.errors || ["Could not save."])[0]); return; }
      setData(body);
      setProf(await loadCommodityProfiles(body.skus.map((s) => s.commodity).filter(Boolean)));
    } catch { setErr("Could not save."); }
  };

  if (!data || data.status !== "ok") return null;
  const box = { borderColor: "rgba(148,163,184,0.15)", background: "rgba(9,25,19,0.5)" };
  const mapped = data.skus.filter((s) => s.commodity);
  const tight = data.parts.filter((p) => p.below_safety || (p.days_cover != null && p.days_cover < 14));
  const rows = tight.slice().sort((a, b) => {
    const sa = a.commodity && prof[a.commodity] ? prof[a.commodity].score : -1;
    const sb = b.commodity && prof[b.commodity] ? prof[b.commodity].score : -1;
    return (a.days_cover ?? 999) - (b.days_cover ?? 999) || sb - sa;
  }).slice(0, 8);
  const used = [...new Set(mapped.map((s) => s.commodity))].filter((k) => prof[k]);
  const anyMock = used.some((k) => prof[k].source === "mock");

  return (
    <section className="mb-6 rounded-2xl border px-5 py-4" style={box} data-testid="parts-risk-block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Parts at risk</h2>
          <div className="text-sm" style={{ color: "#64748B" }}>Thin cover, with the commodity risk behind each part. {mapped.length} of {data.skus.length} parts mapped to a commodity.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(!editing)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "rgba(148,163,184,0.3)", color: "#94A3B8" }}>{editing ? "Done" : "Edit mapping"}</button>
          {onOpenRisk && <button type="button" onClick={onOpenRisk} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" }}>Open Risk Intelligence</button>}
        </div>
      </div>

      {used.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {used.map((k) => (
            <span key={k} className="text-xs rounded-lg px-2 py-1 border" style={{ borderColor: `${prof[k].color}66`, color: prof[k].color, background: `${prof[k].color}14` }}>
              {LABEL[k] || k}: {prof[k].score} {prof[k].label}{prof[k].triggers.length ? ` · ${prof[k].triggers.length} trigger${prof[k].triggers.length > 1 ? "s" : ""}` : ""}
            </span>
          ))}
        </div>
      )}

      {!editing && (
        rows.length ? (
          <ul className="mt-3 space-y-2">
            {rows.map((p) => {
              const c = p.commodity ? prof[p.commodity] : null;
              return (
                <li key={`${p.facility}|${p.sku}`} className="rounded-xl px-3 py-2 flex items-center gap-3 cursor-pointer" style={{ background: "rgba(2,6,23,0.35)" }} onClick={() => onSelectSite && onSelectSite(p.facility)}>
                  <span className="shrink-0 text-xs font-bold rounded-md px-2 py-0.5" style={{ background: `${coverTone(p.days_cover, p.below_safety)}22`, color: coverTone(p.days_cover, p.below_safety) }}>{p.days_cover != null ? `${p.days_cover}d` : "n/a"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold" style={{ color: "#E2E8F0" }}>{p.sku.replace(/_/g, " ")} <span className="font-normal" style={{ color: "#64748B" }}>at {p.facility.replace(/_/g, " ")}{p.below_safety ? " · below safety stock" : ""}</span></span>
                  </span>
                  {c ? <span className="shrink-0 text-xs rounded-md px-2 py-0.5 border" style={{ color: c.color, borderColor: `${c.color}66` }} title={LABEL[p.commodity]}>{LABEL[p.commodity] || p.commodity} {c.score}</span>
                     : <span className="shrink-0 text-[11px]" style={{ color: "#64748B" }}>{p.commodity ? "not scored" : "no commodity"}</span>}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 text-sm" style={{ color: "#94A3B8" }}>No parts below 14 days of cover or under safety stock.</p>
      )}

      {editing && (
        <div className="mt-3 space-y-1">
          {data.skus.map((s) => (
            <div key={s.sku} className="flex items-center gap-3 text-sm">
              <span className="w-56 truncate" style={{ color: "#E2E8F0" }}>{s.sku.replace(/_/g, " ")}</span>
              <select value={s.source === "user" ? (s.commodity || "none") : ""} onChange={(e) => setMap(s.sku, e.target.value)} className="rounded-md px-2 py-1 text-xs" style={{ background: "#0B1F17", color: "#E2E8F0", border: "1px solid rgba(148,163,184,0.3)" }}>
                <option value="">{s.source === "auto" ? `Auto: ${LABEL[s.commodity]}` : "Auto: none"}</option>
                <option value="none">Not a tracked commodity</option>
                {data.commodities.map((k) => <option key={k} value={k}>{LABEL[k] || k}</option>)}
              </select>
            </div>
          ))}
          {err && <p className="text-xs" style={{ color: "#FCA5A5" }}>{err}</p>}
        </div>
      )}

      <p className="mt-2 text-[11px]" style={{ color: "#64748B" }}>
        Part-to-commodity mapping is guessed from part names; correct it under Edit mapping.{anyMock ? " Commodity scores currently use illustrative and analyst-reviewed signals, not a full live feed." : ""}
      </p>
    </section>
  );
}
