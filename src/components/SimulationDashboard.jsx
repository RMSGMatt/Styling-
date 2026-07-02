import React, { useEffect, useMemo, useState, useRef } from "react";
import MapView from "./MapView";
import ScenarioBuilder from "./ScenarioBuilder";
import { Line } from "react-chartjs-2";
import Select from "react-select";
import Papa from "papaparse";
import DecisionNarrativePanel from "./DecisionNarrativePanel";

// Roll a raw runout-risk time series up to ONE classification per
// (facility, sku) for the whole analysis window. This must be the single
// source of truth used by Severity Mix, High-Risk SKUs, the Network Graph,
// Cascade View, and the Actions tab — they must never disagree.
//
// Why not "any High day ever" and not "the day with lowest days_until_runout":
//   - "lowest days_until_runout" silently discards real shortfall days that
//     don't happen to coincide with the lowest-runout day — makes real
//     disruptions look safer than they are.
//   - "any High day ever" treats one isolated, immediately-recovered
//     shortfall (normal demand/lead-time noise, happens even in a clean
//     baseline run) the same as 40+ sustained High days in a real
//     disruption — both get branded "High" forever.
// Instead: require a minimum number of distinct High-risk days before
// calling it High. A lone blip downgrades to Medium (still visible, not
// hidden) instead of either disappearing or dominating the dashboard.
const HIGH_RISK_MIN_DAYS = 2;

function classifyFacilitySkuRisk(rows) {
  const groups = new Map();
  for (const r of (rows || [])) {
    const facility = (r.facility || r.Facility || "").toString().trim();
    const sku = (r.sku || r.SKU || "").toString().trim();
    if (!facility) continue;
    const key = `${facility}__${sku}`;
    const level = (r.risk_level || r.RiskLevel || "low").toString().toLowerCase().trim();
    const days = Number(r.days_until_runout ?? 9999);
    let g = groups.get(key);
    if (!g) {
      g = { facility, sku, highDays: 0, mediumDays: 0, lowDays: 0, minDays: days, sampleRow: r };
      groups.set(key, g);
    }
    if (level === "high") g.highDays += 1;
    else if (level === "medium" || level === "med") g.mediumDays += 1;
    else g.lowDays += 1;
    if (days < g.minDays) { g.minDays = days; g.sampleRow = r; }
  }

  const out = [];
  for (const g of groups.values()) {
    let finalLevel;
    if (g.highDays >= HIGH_RISK_MIN_DAYS) finalLevel = "high";
    else if (g.highDays >= 1 || g.mediumDays >= 1) finalLevel = "medium";
    else finalLevel = "low";
    out.push({ ...g.sampleRow, facility: g.facility, sku: g.sku, risk_level: finalLevel, days_until_runout: g.minDays });
  }
  return out;
}
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  listScenarios,
  loadScenario,
  saveScenario,
  runSimulationWithScenario
} from "../apiClient/scenarios.js";
import SupplierNetworkGraph from "./SupplierNetworkGraph";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale
);

// ===============================
// KPI display helpers
// ===============================
function _toNumberLoose(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const cleaned = s.replace(/[$,%]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatPercent(v, opts) {
  const o = opts || {};
  const zeroIsDash = !!o.zeroIsDash;
  const digits = Number.isFinite(o.digits) ? o.digits : 1;
  if (v === null || v === undefined) return "--";
  if (typeof v === "string" && v.trim().endsWith("%")) {
    const t = v.trim();
    if (t === "%" || t === "0%") return zeroIsDash ? "--" : "0%";
    return t;
  }
  const n = _toNumberLoose(v);
  if (!Number.isFinite(n)) return "--";
  if (zeroIsDash && n === 0) return "--";
  const pct = n <= 1 ? n * 100 : n;
  return pct.toFixed(digits) + "%";
}

function formatNumber(v, opts) {
  const o = opts || {};
  const zeroIsDash = (o.zeroIsDash !== undefined) ? !!o.zeroIsDash : true;
  const digits = Number.isFinite(o.digits) ? o.digits : 0;
  const n = _toNumberLoose(v);
  if (!Number.isFinite(n)) return "--";
  if (zeroIsDash && n === 0) return "--";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(v, opts) {
  const o = opts || {};
  const zeroIsDash = (o.zeroIsDash !== undefined) ? !!o.zeroIsDash : true;
  const digits = Number.isFinite(o.digits) ? o.digits : 0;
  const n = _toNumberLoose(v);
  if (!Number.isFinite(n)) return "--";
  if (zeroIsDash && n === 0) return "--";
  return "$" + n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrencyCompact(v, opts) {
  const o = opts || {};
  const zeroIsDash = (o.zeroIsDash !== undefined) ? !!o.zeroIsDash : false;
  const n = _toNumberLoose(v);
  if (!Number.isFinite(n)) return "--";
  if (zeroIsDash && n === 0) return "--";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function safeArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.rows)) return input.rows;
  if (Array.isArray(input.data)) return input.data;
  return [input];
}

// ===============================
// Overlay helpers
// ===============================
function pickOutputUrlForType(sim, outputType) {
  const u = sim?.outputUrls || sim?.output_urls || sim?.urls || {};
  if (outputType === "inventory") return u.inventory_output_file_url;
  if (outputType === "production") return u.production_output_file_url;
  if (outputType === "flow") return u.flow_output_file_url;
  if (outputType === "occurrence") return u.occurrence_output_file_url;
  return null;
}

function normalizeDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatRunLabel(sim, idx) {
  if (sim?.name) return `${idx + 1}. ${sim.name}`;
  const raw = sim?.timestamp || sim?.created_at || sim?.run_id || sim?.id || "";
  const s = String(raw).trim();
  const m = s.match(/(\d{8})_(\d{6})/);
  if (m) {
    const d = m[1];
    const t = m[2];
    const dt = new Date(
      Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)),
      Number(t.slice(0, 2)), Number(t.slice(2, 4)), Number(t.slice(4, 6))
    );
    if (!Number.isNaN(dt.getTime())) return `${idx + 1}. ${dt.toLocaleString()}`;
  }
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) return `${idx + 1}. ${fallback.toLocaleString()}`;
  return `${idx + 1}. Run ${idx + 1}`;
}

function buildOverlaySeriesFromCsvText(csvText, { outputType, selectedSkus, selectedFacility, runLabelPrefix, style = {} }) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data || [];
  const getSku = (r) => r.sku ?? r.SKU ?? r.Sku ?? r.part ?? r.Part ?? r.item ?? r.Item;
  const getFacility = (r) => r.facility ?? r.Facility ?? r.plant ?? r.Plant ?? r.site ?? r.Site;
  const getDate = (r) => normalizeDate(r.date ?? r.Date ?? r.day ?? r.Day ?? r.timestamp ?? r.Timestamp);
  const getY = (r) => {
    const candidates = [r.value, r.Value, r.qty, r.Qty, r.quantity, r.Quantity, r.amount, r.Amount, r.inventory, r.Inventory, r.production, r.Production, r.flow, r.Flow, r.occurrence, r.Occurrence, r.on_hand, r.onHand, r["initial inventory"], r["Initial Inventory"]];
    for (const c of candidates) {
      if (c === undefined || c === null || c === "") continue;
      const n = typeof c === "string" ? Number(c.replace(/,/g, "")) : Number(c);
      if (Number.isFinite(n)) return n;
    }
    for (const k of Object.keys(r)) {
      const v = r[k];
      if (v === undefined || v === null || v === "") continue;
      const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };
  const skuSet = !selectedSkus || selectedSkus === "ALL" ? null : new Set(Array.isArray(selectedSkus) ? selectedSkus : [selectedSkus]);
  const facilityFilter = selectedFacility && selectedFacility !== "All / None Selected" ? String(selectedFacility).trim() : null;
  const map = new Map();
  for (const r of rows) {
    const sku = getSku(r);
    const fac = getFacility(r);
    const date = getDate(r);
    if (!sku || !date) continue;
    if (skuSet && !skuSet.has(String(sku).trim())) continue;
    if (facilityFilter && String(fac || "").trim() !== facilityFilter) continue;
    if (outputType === "flow") {
      const ft = String(r.flow_type || r.FlowType || r.type || "").trim().toLowerCase();
      const isCustomerShip = ft === "customer_ship" || ft === "customer ship" || ft === "customership";
      if (!isCustomerShip) continue;
    }
    const y = getY(r);
    const key = String(sku).trim();
    if (!map.has(key)) map.set(key, new Map());
    map.get(key).set(date, (map.get(key).get(date) || 0) + y);
  }
  const dateSet = new Set();
  for (const skuMap of map.values()) for (const d of skuMap.keys()) dateSet.add(d);
  const labels = Array.from(dateSet).sort();
  const datasets = [];
  for (const [sku, skuMap] of map.entries()) {
    datasets.push({ label: `${sku} — ${runLabelPrefix}`, data: labels.map((d) => skuMap.get(d) ?? 0), borderWidth: 2, pointRadius: 0, tension: 0.25, ...style });
  }
  return { labels, datasets };
}

// ===============================
// Tab nav component
// ===============================
const TABS = [
  { id: "impact", label: "📊 Impact Summary" },
  { id: "intelligence", label: "🔎 Intelligence" },
  { id: "actions", label: "🛡️ Actions" },
  { id: "analysis", label: "📈 Analysis" },
  { id: "warroom", label: "🧪 War Room" },
];

function TabNav({ activeTab, setActiveTab, hasRun }) {
  return (
    <div className="flex gap-1 flex-wrap border-b mb-6" style={{ borderColor: "#123528" }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = !hasRun;
        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-semibold transition-all relative"
            style={{
              color: isDisabled ? "#334155" : isActive ? "#9FD63A" : "#94a3b8",
              borderBottom: isActive ? "2px solid #9FD63A" : "2px solid transparent",
              cursor: isDisabled ? "not-allowed" : "pointer",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
            {isDisabled && (
              <span className="ml-1.5 text-[9px] text-slate-600">●</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ===============================
// Safety Stock Panel
// ===============================
function SafetyStockPanel({ kpis, apiBase, hasRun }) {
  const [targetSL, setTargetSL] = React.useState(95);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchOptimization = React.useCallback(async (sl) => {
    if (!hasRun) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const revenueAtRisk = Number(kpis?.revenueExposure ?? kpis?.estimatedRevenueExposure ?? 847000);
      const res = await fetch(`${apiBase}/api/safety-stock/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_service_level: sl / 100,
          revenue_at_risk: revenueAtRisk > 0 ? revenueAtRisk * 12 : 847000,
        }),
      });
      const data = await res.json();
      if (data.ok) setResult(data);
      else setError(data.error || "Optimization failed");
    } catch (e) {
      setError("Could not reach optimization service");
    } finally {
      setLoading(false);
    }
  }, [hasRun, apiBase]);

  React.useEffect(() => {
    if (hasRun) fetchOptimization(targetSL);
  }, [hasRun, fetchOptimization]);

  if (!hasRun) return null;

  const rec = result?.recommendation;
  const slColors = { 90: "#F59E0B", 92: "#F59E0B", 95: "#2EC4A6", 97: "#2EC4A6", 98: "#9FD63A", 99: "#9FD63A" };
  const slColor = slColors[targetSL] || "#9FD63A";

  return (
    <div className="rounded-2xl border p-4" style={{ background: "linear-gradient(145deg, rgba(13,31,24,0.97), rgba(6,37,26,0.95))", borderColor: "rgba(159,214,58,0.2)" }}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-lime-400 mb-1">🛡️ Resilience Optimizer</p>
          <p className="text-sm font-semibold text-white">Safety Stock Optimization</p>
        </div>
        {rec && (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Additional Cost</p>
              <p className="text-lg font-bold text-white">${rec.total_additional_cost_usd?.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Revenue Protected</p>
              <p className="text-lg font-bold" style={{ color: slColor }}>${(rec.revenue_protected_usd / 1000).toFixed(0)}K</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">ROI</p>
              <p className="text-lg font-bold" style={{ color: slColor }}>
                {rec.roi === Infinity || rec.roi > 9999 ? "∞" : `${rec.roi}x`}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Target Service Level</p>
          <p className="text-sm font-bold" style={{ color: slColor }}>{targetSL}%</p>
        </div>
        <input
          type="range" min="90" max="99" step="1" value={targetSL}
          onChange={(e) => { const v = Number(e.target.value); setTargetSL(v); fetchOptimization(v); }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: slColor }}
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span>90% Baseline</span><span>95% Target</span><span>99% Premium</span>
        </div>
      </div>
      {loading && <div className="text-center py-4 text-slate-400 text-sm">Calculating optimal buffer positions...</div>}
      {error && <div className="text-center py-3 text-rose-400 text-sm">{error}</div>}
      {!loading && rec && rec.recommendations?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Recommended Buffer Actions</p>
          {rec.recommendations.map((r, i) => (
            <div key={i} className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: "rgba(2,6,23,0.5)", borderColor: "rgba(148,163,184,0.12)" }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{r.action}</p>
                <p className="text-[10px] text-slate-400">{r.days_coverage} days coverage</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-white">${r.additional_cost_usd?.toLocaleString()}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${r.priority === "HIGH" ? "bg-rose-500/20 text-rose-300" : r.priority === "MEDIUM" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{r.priority}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && rec && rec.recommendations?.length === 0 && (
        <div className="text-center py-3 text-emerald-400 text-sm">✅ Current inventory is sufficient for {targetSL}% service level</div>
      )}
    </div>
  );
}

// ===============================
// Safety Stock Summary Card (for Impact Summary tab)
// ===============================
function SafetyStockSummaryCard({ kpis, apiBase, hasRun, onNavigateToActions }) {
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!hasRun) return;
    setLoading(true);
    const fetch95 = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const revenueAtRisk = Number(kpis?.revenueExposure ?? kpis?.estimatedRevenueExposure ?? 847000);
        const res = await fetch(`${apiBase}/api/safety-stock/optimize`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ target_service_level: 0.95, revenue_at_risk: revenueAtRisk > 0 ? revenueAtRisk * 12 : 847000 }),
        });
        const data = await res.json();
        if (data.ok) setResult(data);
      } catch (e) {
        // silent fail — summary card is non-critical
      } finally {
        setLoading(false);
      }
    };
    fetch95();
  }, [hasRun, apiBase]);

  if (!hasRun) return null;

  const rec = result?.recommendation;

  return (
    <div
      className="rounded-2xl border p-4 cursor-pointer hover:border-lime-400/40 transition-all"
      style={{ background: "linear-gradient(145deg, rgba(13,31,24,0.97), rgba(6,37,26,0.95))", borderColor: "rgba(159,214,58,0.2)" }}
      onClick={onNavigateToActions}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-lime-400 mb-0.5">🛡️ Resilience Optimizer</p>
          <p className="text-sm font-semibold text-white">Safety Stock Optimization</p>
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          View full optimizer →
        </span>
      </div>
      {loading && <p className="text-xs text-slate-400">Calculating...</p>}
      {!loading && rec && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-1">Additional Cost</p>
            <p className="text-base font-bold text-white">${rec.total_additional_cost_usd?.toLocaleString()}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-1">Revenue Protected</p>
            <p className="text-base font-bold" style={{ color: "#2EC4A6" }}>${(rec.revenue_protected_usd / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-1">ROI at 95% SL</p>
            <p className="text-base font-bold" style={{ color: "#9FD63A" }}>
              {rec.roi === Infinity || rec.roi > 9999 ? "∞" : `${rec.roi}x`}
            </p>
          </div>
        </div>
      )}
      {!loading && !rec && (
        <p className="text-xs text-slate-400">Click to run optimization analysis →</p>
      )}
    </div>
  );
}

// ===============================
// Disruption Panels
// ===============================
function DisruptionSignalsPanel({ disruptionImpactData, runoutRiskData, executiveKpis, hasNarrativeRun }) {
  const impactRows = safeArray(disruptionImpactData);
  const runoutRows = safeArray(runoutRiskData);
  const exec = executiveKpis || {};
  const execOnTimePct = Number(exec.serviceLevelPct || 0);

  const facilitiesImpacted = new Set(impactRows.map((row) => row.facility || row.Facility).filter((x) => typeof x === "string" && x.trim() !== "")).size;

  const revenueExposureDisplayValue = (() => {
    const directRevenue = Number(exec?.revenueExposure ?? exec?.estimatedRevenueExposure ?? 0);
    if (directRevenue > 0) return directRevenue;
    return Number(exec?.demandAtRiskUnits ?? 0) * 100;
  })();

  const uniqueRunoutRows = classifyFacilitySkuRisk(runoutRows)
    .sort((a, b) => Number(a.days_until_runout ?? 9999) - Number(b.days_until_runout ?? 9999));

  const highRiskSkus = [...new Set(
    uniqueRunoutRows
      .filter((r) => (r.risk_level || r.RiskLevel || "").toString().toLowerCase().trim() === "high")
      .map((r) => (r.sku || r.SKU || "Unknown SKU").toString().trim())
  )];

  const riskDistribution = uniqueRunoutRows.reduce((acc, row) => {
    const level = (row.risk_level || row.riskLevel || "").toString().toLowerCase().trim();
    if (level === "high") acc.high++;
    else if (level === "medium" || level === "med") acc.medium++;
    else if (level === "low") acc.low++;
    else acc.unknown++;
    return acc;
  }, { high: 0, medium: 0, low: 0, unknown: 0 });

  const firstImpactedFacility = impactRows[0]?.facility || impactRows[0]?.Facility || (impactRows[0] ? "First impacted facility" : "No disruptions recorded");

  return (
    <div className="border rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(6,37,26,0.96))", borderColor: "#173b30" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span style={{ color: "#FFB200" }}>🔎 Disruption Signals</span>
        </h3>
        <span className="text-xs text-slate-300">Powered by latest simulation run</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Service Degradation</p>
          <p className="text-3xl font-bold tracking-tight">
            {(() => {
              const isDegraded = execOnTimePct < 97;
              const hasEarlyRisk = riskDistribution.high > 0 || riskDistribution.medium > 0;
              if (!hasNarrativeRun) {
                return <span className="text-slate-400"><span className="opacity-40">—</span></span>;
              }
              if (isDegraded) {
                return (
                  <span className={execOnTimePct < 80 ? "text-red-400" : "text-yellow-400"}>
                    {`-${(100 - execOnTimePct).toFixed(1)}pp`}
                  </span>
                );
              }
              if (hasEarlyRisk) {
                return <span className="text-amber-400">Early Risk</span>;
              }
              return <span className="text-emerald-400">None</span>;
            })()}
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Facilities Impacted</p>
          <p className="text-3xl font-bold tracking-tight text-white">{facilitiesImpacted || 0}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Revenue Exposure</p>
          <p className="text-3xl font-bold tracking-tight font-bold" style={{ color: "#9CF700" }}>{formatCurrencyCompact(revenueExposureDisplayValue, { zeroIsDash: false })}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">High-Risk SKUs</p>
          <p className="text-3xl font-bold tracking-tight text-rose-400">{highRiskSkus.length}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-slate-300">
        <div className="bg-slate-900/70 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="font-semibold mb-2 text-slate-50">📍 First Impacted Facility</p>
          <p>{firstImpactedFacility}</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="font-semibold mb-2 text-slate-50">📊 Severity Mix</p>
          <p>
            <span className="text-rose-400 font-semibold">High:</span> {riskDistribution.high} &nbsp;|&nbsp;
            <span className="text-amber-400 font-semibold">Med:</span> {riskDistribution.medium} &nbsp;|&nbsp;
            <span className="text-emerald-400 font-semibold">Low:</span> {riskDistribution.low} &nbsp;|&nbsp;
            <span className="text-slate-300 font-semibold">Unk:</span> {riskDistribution.unknown}
          </p>
        </div>
        <div className="bg-slate-900/70 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="font-semibold mb-2 text-slate-50">🎯 High-Risk SKUs (Examples)</p>
          {highRiskSkus.length === 0 ? (
            <p className="text-slate-300">No high-risk SKUs in this scenario.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {highRiskSkus.slice(0, 3).map((sku) => <li key={sku}>{sku}</li>)}
              {highRiskSkus.length > 3 && <li className="text-slate-300">+{highRiskSkus.length - 3} more...</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MaterialRiskPanel({ runoutRiskData, countermeasuresData, executiveKpis, kpis, apiBase, hasNarrativeRun }) {
  const [mraTab, setMraTab] = React.useState("countermeasures");
  const runoutRows = safeArray(runoutRiskData);
  const exec = executiveKpis || {};
  const execOnTimePct = Number(exec.serviceLevelPct || 0);

  const uniqueRunoutRows = classifyFacilitySkuRisk(runoutRows)
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, med: 2, low: 1 };
      const aRank = rank[(a.risk_level || "").toLowerCase().trim()] ?? 0;
      const bRank = rank[(b.risk_level || "").toLowerCase().trim()] ?? 0;
      if (bRank !== aRank) return bRank - aRank;
      return Number(a.days_until_runout ?? 9999) - Number(b.days_until_runout ?? 9999);
    });

  const uniqueRunoutRiskSkus = [...new Set(
    uniqueRunoutRows
      .filter((r) => {
        const level = (r.risk_level || r.RiskLevel || "").toString().toLowerCase().trim();
        return level === "high" || level === "medium" || level === "med";
      })
      .map((r) => (r.sku || r.SKU || "").toString().trim())
      .filter(Boolean)
  )];

  const candidateActions = [];
  const seenActionKeys = new Set();
  for (const row of uniqueRunoutRows) {
    const sku = (row.sku || row.SKU || "Unknown SKU").toString().trim();
    const facility = (row.facility || row.Facility || "Unknown facility").toString().trim();
    const risk = (row.risk_level || row.RiskLevel || "Medium").toString().trim();
    const riskLower = risk.toLowerCase();
    let action = "Review mitigation plan";
    let expectedImpact = "Reduce runout risk";
    if (riskLower.includes("high")) { action = `Expedite supply for ${facility}`; expectedImpact = "Protect service"; }
    else if (riskLower.includes("low")) { action = `Monitor and rebalance inventory at ${facility}`; expectedImpact = "Stabilize supply"; }
    else { action = `Evaluate alternate sourcing for ${facility}`; expectedImpact = "Improve resilience"; }
    const dedupeKey = `${sku}__${facility}__${action}`;
    if (seenActionKeys.has(dedupeKey)) continue;
    seenActionKeys.add(dedupeKey);
    candidateActions.push({ sku, facility, risk, action, expectedImpact });
    if (candidateActions.length >= 3) break;
  }

  return (
    <div className="border rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(7,54,38,0.96))", borderColor: "#173b30" }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-emerald-300">🛡️ Material Risk & Actions</span>
        </h3>
        <span className="text-xs text-slate-300">Scenario-aware outputs</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">SKUs at Runout Risk</p>
          <p className="text-3xl font-bold tracking-tight text-rose-400">{uniqueRunoutRiskSkus.length}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Recommended Actions</p>
          <p className="text-3xl font-bold tracking-tight text-emerald-400">{candidateActions.length}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Service Level (On-Time)</p>
          <p className="text-3xl font-bold tracking-tight text-sky-400">{formatPercent(execOnTimePct, { zeroIsDash: false, digits: 1 })}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4">
        {[{ id: "countermeasures", label: "✅ Countermeasures" }, { id: "safetystock", label: "🛡️ Safety Stock" }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMraTab(tab.id)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
            style={{
              background: mraTab === tab.id ? "rgba(159,214,58,0.15)" : "rgba(15,23,42,0.5)",
              border: mraTab === tab.id ? "1px solid rgba(159,214,58,0.5)" : "1px solid rgba(71,85,105,0.4)",
              color: mraTab === tab.id ? "#9FD63A" : "#94a3b8",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mraTab === "countermeasures" && (
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.35fr] gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/70 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">🔍 Highest Runout Risk (Top 3)</p>
            {uniqueRunoutRows.length === 0 ? (
              <p className="text-slate-300">No SKUs flagged for runout.</p>
            ) : (
              <ul className="space-y-2 leading-6">
                {uniqueRunoutRows.slice(0, 3).map((row, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{row.sku || row.SKU || "Unknown SKU"}</span>{" "}
                    @ {row.facility || row.Facility || "Unknown facility"} —{" "}
                    <span className="text-rose-300">{row.risk_level || row.RiskLevel || "High"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-slate-900/70 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">✅ Suggested Countermeasures (Examples)</p>
            {candidateActions.length === 0 ? (
              <p className="text-slate-300">No countermeasures generated yet for this scenario.</p>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {candidateActions.map((row, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{row.sku}</span>{" "}
                    <span className="text-slate-400">@ {row.facility}</span>:{" "}
                    {row.action}{" "}
                    <span className="text-emerald-300">({row.expectedImpact})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mraTab === "safetystock" && (
        <SafetyStockPanel kpis={kpis} apiBase={apiBase} hasRun={hasNarrativeRun} />
      )}
    </div>
  );
}

// ===============================
// Scenario Comparison
// ===============================
function ScenarioComparison({ runA, runB }) {
  const [kpisA, setKpisA] = useState(null);
  const [kpisB, setKpisB] = useState(null);
  const [loading, setLoading] = useState(false);

  async function extractKpis(sim) {
    const urls = sim?.outputUrls || sim?.output_urls || sim?.urls || {};
    const flowUrl = urls.flow_output_file_url || urls.flow;
    const inventoryUrl = urls.inventory_output_file_url || urls.inventory;
    const occurrenceUrl = urls.occurrence_output_file_url || urls.occurrence;
    let onTime = "--", backorders = "--", avgInventory = "--", occurrences = "--";
    try {
      if (flowUrl) {
        const res = await fetch(flowUrl);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = parsed.data || [];
        const customerRows = rows.filter(r => { const ft = String(r.flow_type || r.FlowType || "").toLowerCase(); return ft === "customer_ship" || ft === "customer ship"; });
        const shipped = customerRows.reduce((s, r) => s + (_toNumberLoose(r.shipped || r.flow || 0)), 0);
        const lastBacklog = customerRows.length ? _toNumberLoose(customerRows[customerRows.length - 1].backlog_out || 0) : 0;
        const demand = shipped + lastBacklog;
        onTime = demand > 0 ? ((shipped / demand) * 100).toFixed(1) + "%" : "--";
        backorders = Math.round(lastBacklog).toLocaleString();
      }
    } catch (e) { }
    try {
      if (inventoryUrl) {
        const res = await fetch(inventoryUrl);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = parsed.data || [];
        const invCol = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes("inventory"));
        if (invCol) {
          const vals = rows.map(r => _toNumberLoose(r[invCol])).filter(Number.isFinite);
          avgInventory = vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length).toLocaleString() : "--";
        }
      }
    } catch (e) { }
    try {
      if (occurrenceUrl) {
        const res = await fetch(occurrenceUrl);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        occurrences = String((parsed.data || []).length);
      }
    } catch (e) { }
    return { onTime, backorders, avgInventory, occurrences };
  }

  async function runComparison() {
    if (!runA || !runB) return;
    setLoading(true); setKpisA(null); setKpisB(null);
    try {
      const [a, b] = await Promise.all([extractKpis(runA), extractKpis(runB)]);
      setKpisA(a); setKpisB(b);
    } finally { setLoading(false); }
  }

  const METRICS = [
    { key: "onTime", label: "On-Time Fulfillment", better: "higher" },
    { key: "backorders", label: "Backorders", better: "lower" },
    { key: "avgInventory", label: "Avg Inventory", better: "higher" },
    { key: "occurrences", label: "Exception Events", better: "lower" },
  ];

  if (!runA || !runB) return (
    <div className="mt-3 flex items-start gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
      <span className="text-lg">⚖️</span>
      <p className="text-[11px] text-slate-400 leading-relaxed">Select both runs above to generate a KPI scorecard comparison.</p>
    </div>
  );

  return (
    <div className="mt-4">
      <button onClick={runComparison} disabled={loading} className="px-4 py-2 rounded-lg text-xs font-bold mb-4 transition" style={{ background: "#9CF700", color: "#020617", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
        {loading ? "Comparing..." : "⚖️ Compare KPIs →"}
      </button>
      {kpisA && kpisB && (
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(15,30,24,0.9)" }}>
                <th className="text-left px-4 py-2 text-slate-400 font-semibold uppercase tracking-wider">Metric</th>
                <th className="text-center px-4 py-2 font-semibold" style={{ color: "#9CF700" }}>Baseline</th>
                <th className="text-center px-4 py-2 font-semibold" style={{ color: "#2EC4A6" }}>Comparison</th>
                <th className="text-center px-4 py-2 text-slate-400 font-semibold uppercase tracking-wider">Winner</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, i) => {
                const a = kpisA[m.key]; const b = kpisB[m.key];
                const na = parseFloat(String(a).replace(/[%,]/g, "")); const nb = parseFloat(String(b).replace(/[%,]/g, ""));
                const aWins = Number.isFinite(na) && Number.isFinite(nb) && (m.better === "higher" ? na > nb : na < nb);
                const bWins = Number.isFinite(na) && Number.isFinite(nb) && (m.better === "higher" ? nb > na : nb < na);
                return (
                  <tr key={m.key} style={{ background: i % 2 === 0 ? "rgba(10,25,20,0.6)" : "rgba(15,30,24,0.4)" }}>
                    <td className="px-4 py-3 text-slate-300 font-medium">{m.label}</td>
                    <td className={`px-4 py-3 text-center font-bold ${aWins ? "text-emerald-400" : "text-slate-300"}`}>{a}</td>
                    <td className={`px-4 py-3 text-center font-bold ${bWins ? "text-emerald-400" : "text-slate-300"}`}>{b}</td>
                    <td className="px-4 py-3 text-center">
                      {aWins ? <span style={{ color: "#9CF700" }}>Baseline ✓</span> : bWins ? <span style={{ color: "#2EC4A6" }}>Comparison ✓</span> : <span className="text-slate-500">Tie</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===============================
// Run Card
// ===============================
function RunCard({ sim, globalIdx, svcLevel, ttr, onReloadRun, formatRunLabel }) {
  const [showDownloads, setShowDownloads] = useState(false);
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{sim?.name || `Run ${globalIdx + 1}`}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{formatRunLabel(sim, globalIdx).replace(/^\d+\.\s/, "")}</p>
        </div>
        <button onClick={() => onReloadRun(sim)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0" style={{ background: "linear-gradient(90deg,#9CF700,#22c55e)", color: "#020617" }}>
          🔄 Reload
        </button>
      </div>
      {svcLevel > 0 && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Service</span>
            <span className={`text-xs font-bold ${svcLevel >= 97 ? "text-emerald-400" : svcLevel >= 80 ? "text-yellow-400" : "text-red-400"}`}>{svcLevel.toFixed(1)}%</span>
          </div>
          {ttr > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">TTR</span>
              <span className="text-xs font-bold text-rose-400">{ttr}d</span>
            </div>
          )}
        </div>
      )}
      <button onClick={() => setShowDownloads(p => !p)} className="text-[11px] text-slate-500 hover:text-slate-300 transition">
        {showDownloads ? "▲ Hide outputs" : "▼ Download outputs"}
      </button>
      {showDownloads && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
          <a href={sim.outputUrls?.flow_output_file_url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">➜ Flow CSV</a>
          <a href={sim.outputUrls?.inventory_output_file_url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">➜ Inventory CSV</a>
          <a href={sim.outputUrls?.production_output_file_url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">➜ Production CSV</a>
          <a href={sim.outputUrls?.occurrence_output_file_url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">➜ Occurrence CSV</a>
          <a href={sim.outputUrls?.disruption_impact_output_file_url} target="_blank" rel="noreferrer" className="text-rose-300 hover:underline">⚡ Disruption Impact</a>
          <a href={sim.outputUrls?.projected_impact_output_file_url} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">🔮 Projected Impact</a>
          <a href={sim.outputUrls?.runout_risk_output_file_url} target="_blank" rel="noreferrer" className="text-red-300 hover:underline">🛑 SKU Runout Risk</a>
          <a href={sim.outputUrls?.countermeasures_output_file_url} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">🛡️ Countermeasures</a>
          <a href={sim.outputUrls?.locations_output_file_url} target="_blank" rel="noreferrer" className="text-slate-200 hover:underline">📍 Locations CSV</a>
        </div>
      )}
    </div>
  );
}

// ===============================
// Tour
// ===============================
const TOUR_STEPS_SIMULATION = [
  { id: "scenario-builder", title: "Build a Disruption Scenario", body: "Define what breaks — which facility, how severe, how long. FOR-C simulates the downstream impact across your entire network.", target: "tour-scenario-builder", position: "bottom" },
  { id: "disruption-signals", title: "Disruption Signals", body: "Instant KPI impact from the simulation — service degradation, revenue exposure, facilities impacted, high-risk SKUs.", target: "tour-disruption-signals", position: "bottom" },
  { id: "scenario-comparison", title: "Scenario Comparison", body: "Run two simulations and diff the outcomes. Find the sourcing strategy or mitigation path that wins on every KPI.", target: "tour-scenario-comparison", position: "top" },
];

function SimTour({ steps, onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 100, left: 100 });
  const current = steps[step];
  useEffect(() => {
    if (!current?.target) return;
    const el = document.getElementById(current.target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const tooltipHeight = 160;
      const rawTop = current.position === "bottom" ? rect.bottom + window.scrollY + 12 : rect.top + window.scrollY - tooltipHeight - 12;
      const maxTop = window.scrollY + window.innerHeight - tooltipHeight - 16;
      const top = Math.min(rawTop, maxTop);
      const left = Math.min(rect.left + window.scrollX, window.innerWidth - 340);
      setPos({ top, left: Math.max(left, 16) });
    }, 400);
    el.style.outline = "2px solid #9FD63A";
    el.style.outlineOffset = "4px";
    el.style.borderRadius = "8px";
    return () => { el.style.outline = ""; el.style.outlineOffset = ""; };
  }, [step, current]);
  return (
    <div className="fixed z-[100] w-80 rounded-2xl shadow-2xl p-5" style={{ top: pos.top, left: pos.left, background: "#0a2e22", border: "1px solid rgba(159,214,58,0.4)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9FD63A" }}>FOR-C Tour · Step {step + 1} of {steps.length}</p>
        <button onClick={onSkip} className="text-gray-500 hover:text-white text-xs">Skip</button>
      </div>
      <h3 className="text-white font-bold text-sm mb-1">{current.title}</h3>
      <p className="text-gray-300 text-xs leading-relaxed mb-4">{current.body}</p>
      <div className="flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 disabled:opacity-30">← Back</button>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="text-xs px-4 py-1.5 rounded-lg font-bold" style={{ background: "#9FD63A", color: "#020617" }}>Next →</button>
        ) : (
          <button onClick={onFinish} className="text-xs px-4 py-1.5 rounded-lg font-bold" style={{ background: "#9FD63A", color: "#020617" }}>Done ✓</button>
        )}
      </div>
    </div>
  );
}

// ===============================
// Main SimulationDashboard
// ===============================
export default function SimulationDashboard({
  handleFileChange,
  handleSubmit,
  simulationStatus,
  outputUrls,
  skuOptions,
  selectedSku,
  setSelectedSku,
  selectedOutputType,
  setSelectedOutputType,
  chartData,
  summaryStats,
  scenarioImpactSummary,
  simulationHistory,
  files,
  kpis,
  executiveKpis,
  onLogout,
  switchView,
  onReloadRun,
  disruptionImpactData,
  runoutRiskData,
  countermeasuresData,
  locationsUrl,
  scenarioData,
  setScenarioData,
  selectedFacility,
  handleFacilityClick,
  userPlan,
  requirePro,
  openUpgradeGate,
  lastRunScenarioData,
}) {
  const API_BASE = import.meta.env.VITE_API_BASE || "https://supply-chain-simulator-v2.onrender.com";
  const [presentationMode, setPresentationMode] = useState(false);
  const [activeTab, setActiveTab] = useState("impact");
  const mainRef = useRef(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [baselineRunIndex, setBaselineRunIndex] = useState(null);
  const [compareRunIndex, setCompareRunIndex] = useState(null);
  const [runName, setRunName] = useState("");
  const runsPerPage = 5;

  const exec = executiveKpis || {};
  const execOnTimePct = Number(exec.serviceLevelPct || 0);
  const execLateUnits = Number(exec.demandAtRiskUnits || 0);
  const execPeakBacklog = Number(exec.unfulfilledDemandUnits || 0);
  const execMissedServiceDays = Number(exec.missedServiceDays || 0);
  const execWorstWeeklyPct = Number(exec.worstWeeklyServicePct || 0);
  const execFalseConfidenceDays = Number(exec.falseConfidenceDays || 0);
  const execTtrDays = Number(exec.timeToRecoverDays || 0);
  const execTtsDays = Number(exec.timeToSurviveDays || 0);
  const execRevenueExposure = Number(exec.revenueExposure || 0);

  const hasNarrativeRun = execOnTimePct > 0 || execLateUnits > 0 || execPeakBacklog > 0 || execTtrDays > 0 || execRevenueExposure > 0;
  const isHealthy = hasNarrativeRun && execOnTimePct >= 97;

  // Auto-switch to Impact Summary when a run completes
  useEffect(() => {
    if (simulationStatus === "done") {
      setActiveTab("impact");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
  }, [simulationStatus]);

  const [aiNarrative, setAiNarrative] = useState(null);
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false);
  const [suggestedScenarios, setSuggestedScenarios] = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);

  useEffect(() => {
    if (!hasNarrativeRun) return;
    const generateNarrative = async () => {
      try {
        setAiNarrativeLoading(true);
        const res = await fetch(`${API_BASE}/api/narrative/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: runName || "Supply chain disruption scenario", kpis: { serviceLevelPct: execOnTimePct, peakBacklogUnits: execPeakBacklog, timeToRecoverDays: execTtrDays, timeToSurviveDays: execTtsDays, demandAtRiskUnits: execLateUnits, facilitiesImpacted: 0, revenueExposure: execRevenueExposure } })
        });
        const data = await res.json();
        if (data.status === "success" && data.narrative) {
          const clean = data.narrative.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/^#+\s/gm, "").trim();
          setAiNarrative(clean);
        }
      } catch (e) { } finally { setAiNarrativeLoading(false); }
    };
    generateNarrative();
  }, [execOnTimePct, execPeakBacklog, execTtrDays, execTtsDays, execLateUnits, execRevenueExposure, hasNarrativeRun]);

  useEffect(() => {
    if (!hasNarrativeRun) return;
    const fetchSuggestedScenarios = async () => {
      try {
        setScenariosLoading(true);
        const res = await fetch(`${API_BASE}/api/narrative/suggest-scenarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastScenario: runName || "Supply chain disruption scenario", kpis: { serviceLevelPct: execOnTimePct, timeToRecoverDays: execTtrDays }, liveIncidents: [] })
        });
        const data = await res.json();
        if (data.status === "success" && data.scenarios?.length) setSuggestedScenarios(data.scenarios);
      } catch (e) { } finally { setScenariosLoading(false); }
    };
    fetchSuggestedScenarios();
  }, [execOnTimePct, execTtrDays, hasNarrativeRun, runName]);

  const [scenarioJson, setScenarioJson] = useState(null);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [overlayChartData, setOverlayChartData] = useState(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState(null);
  const [parsedBomData, setParsedBomData] = useState([]);
  const [parsedLocationsData, setParsedLocationsData] = useState([]);
  const [parsedLanesData, setParsedLanesData] = useState([]);
  const [parsedLocationMaterialsData, setParsedLocationMaterialsData] = useState([]);

  useEffect(() => {
    if (!files.bom) return;
    const reader = new FileReader();
    reader.onload = (e) => { const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true }); setParsedBomData(parsed.data || []); };
    reader.readAsText(files.bom);
  }, [files.bom]);

  useEffect(() => {
    if (!files.locations) return;
    const reader = new FileReader();
    reader.onload = (e) => { const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true }); setParsedLocationsData(parsed.data || []); };
    reader.readAsText(files.locations);
  }, [files.locations]);

  useEffect(() => {
    if (!files.lanes) { setParsedLanesData([]); return; }
    const reader = new FileReader();
    reader.onload = (e) => { const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true }); setParsedLanesData(parsed.data || []); };
    reader.readAsText(files.lanes);
  }, [files.lanes]);

  useEffect(() => {
    if (!files.locationMaterials) return;
    const reader = new FileReader();
    reader.onload = (e) => { const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true }); setParsedLocationMaterialsData(parsed.data || []); };
    reader.readAsText(files.locationMaterials);
  }, [files.locationMaterials]);

  useEffect(() => { if (!scenarioJson) setScenarioJson({}); }, []);
  useEffect(() => { setScenarioJson((prev) => ({ ...(prev || {}), ...scenarioData })); }, [scenarioData]);

  useEffect(() => {
    listScenarios().then((res) => {
      const data = res.data;
      const arr = Array.isArray(data) ? data : Array.isArray(data?.scenarios) ? data.scenarios : [];
      setSavedScenarios(arr);
    }).catch(() => { });
  }, []);

  const isRunning = simulationStatus === "running";
  const statusLabel = simulationStatus === "idle" ? "Run Simulation" : simulationStatus === "running" ? "Running..." : simulationStatus === "done" ? "Run Again" : "Error — Retry";

  const outputTypes = [
    { value: "inventory", label: "Inventory Levels" },
    { value: "production", label: "Production Output" },
    { value: "flow", label: "Material Flow" },
    { value: "occurrence", label: "Disruption Occurrences" },
  ];

  const multiSkuOptions = useMemo(() => {
    if (!Array.isArray(skuOptions)) return [];
    return skuOptions.map((item) => {
      if (typeof item === "object" && item !== null) {
        if ("value" in item || "label" in item) return { value: item.value ?? item.sku ?? item.SKU ?? item.label ?? String(item), label: item.label ?? item.value ?? item.sku ?? item.SKU ?? String(item) };
        const val = item.sku ?? item.SKU ?? String(item);
        return { value: val, label: val };
      }
      return { value: String(item), label: String(item) };
    });
  }, [skuOptions]);

  const handleSkuChange = (options) => {
    if (!options || options.length === 0) { setSelectedSku("ALL"); return; }
    setSelectedSku(options.map((opt) => opt.value));
  };

  const isSimulationReady = files.demand && files.disruptions && files.locations && files.processes && files.bom && files.locationMaterials;
  const isSimulateDisabled = !isSimulationReady || isRunning;

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { color: "#E8FFE8" } },
      tooltip: { callbacks: { label: (context) => `${context.dataset.label || ""}: ${(context.parsed.y ?? 0).toLocaleString()}` } },
    },
    scales: {
      x: { type: "time", time: { unit: "day", tooltipFormat: "yyyy-MM-dd" }, ticks: { color: "#9CA3AF" }, grid: { color: "rgba(148, 163, 184, 0.18)" } },
      y: { ticks: { color: "#9CA3AF" }, grid: { color: "rgba(148, 163, 184, 0.18)" } },
    },
  }), []);

  const isInventoryFlatline = useMemo(() => {
    if (selectedOutputType !== "inventory") return false;
    const datasets = chartData?.datasets || [];
    if (!datasets.length) return false;
    return datasets.every((ds) => Array.isArray(ds.data) && ds.data.every((v) => { const n = Number(v ?? 0); return Number.isFinite(n) && n === 0; }));
  }, [selectedOutputType, chartData]);

  const derivedChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData.datasets)) return { labels: [], datasets: [] };
    const labels = chartData.labels || [];
    const palette = ["#9CF700", "#3b82f6", "#FFB200", "#a855f7", "#14b8a6"];
    const datasets = chartData.datasets.map((ds, idx) => ({ ...ds, borderWidth: 2, pointRadius: 0, tension: 0.25, borderColor: ds.borderColor || palette[idx % palette.length], backgroundColor: "transparent" }));
    return { labels, datasets };
  }, [chartData]);

  useEffect(() => {
    const baselineIdx = baselineRunIndex;
    const compareIdx = compareRunIndex;
    if (baselineIdx === null || baselineIdx === undefined || compareIdx === null || compareIdx === undefined || baselineIdx === compareIdx || !Array.isArray(simulationHistory) || simulationHistory.length === 0) {
      setOverlayChartData(null); setOverlayError(null); setOverlayLoading(false); return;
    }
    const baselineSim = simulationHistory[baselineIdx];
    const compareSim = simulationHistory[compareIdx];
    const baselineUrl = pickOutputUrlForType(baselineSim, selectedOutputType);
    const compareUrl = pickOutputUrlForType(compareSim, selectedOutputType);
    if (!baselineUrl || !compareUrl) { setOverlayChartData(null); setOverlayError("Missing output URL(s) for selected run(s)."); setOverlayLoading(false); return; }
    let cancelled = false;
    async function buildOverlay() {
      try {
        setOverlayLoading(true); setOverlayError(null);
        const [baselineText, compareText] = await Promise.all([fetch(baselineUrl).then((r) => r.text()), fetch(compareUrl).then((r) => r.text())]);
        if (cancelled) return;
        if (baselineUrl === compareUrl) { setOverlayChartData(null); setOverlayError("Baseline + Compare point to the same output file URL. Pick two different runs."); setOverlayLoading(false); return; }
        const SKU_COLORS = ["#9CF700", "#60A5FA", "#F59E0B", "#F472B6", "#A78BFA", "#34D399", "#FB7185", "#22D3EE"];
        function colorForSku(sku) { const s = String(sku || "").trim(); let hash = 0; for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0; return SKU_COLORS[hash % SKU_COLORS.length]; }
        const chainSkus = ["WIDGET_A", "CHIP", "WAFER"];
        const base = buildOverlaySeriesFromCsvText(baselineText, { outputType: selectedOutputType, selectedSkus: chainSkus, selectedFacility, runLabelPrefix: formatRunLabel(baselineSim, baselineIdx) });
        const comp = buildOverlaySeriesFromCsvText(compareText, { outputType: selectedOutputType, selectedSkus: chainSkus, selectedFacility, runLabelPrefix: formatRunLabel(compareSim, compareIdx) });
        const allLabels = Array.from(new Set([...(base.labels || []), ...(comp.labels || [])])).sort();
        const realignAndStyle = (series, mode) => {
          const labels = series.labels || [];
          return (series.datasets || []).map((ds) => {
            const sku = String(ds.label || "").split("—")[0].trim();
            const col = colorForSku(sku);
            const map = new Map(labels.map((l, i) => [l, ds.data?.[i] ?? 0]));
            return { ...ds, data: allLabels.map((l) => map.get(l) ?? 0), borderColor: col, backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, tension: 0.25, borderDash: mode === "compare" ? [6, 4] : [] };
          });
        };
        setOverlayChartData({ labels: allLabels, datasets: [...realignAndStyle(base, "baseline"), ...realignAndStyle(comp, "compare")] });
      } catch (e) { setOverlayChartData(null); setOverlayError("Failed to build overlay (CSV fetch/parse error)."); } finally { setOverlayLoading(false); }
    }
    buildOverlay();
    return () => { cancelled = true; };
  }, [baselineRunIndex, compareRunIndex, simulationHistory, selectedOutputType, selectedSku, selectedFacility]);

  const handleRunSimulationWithScenario = async (scenarioOverride, runLabel) => {
    try {
      const activeScenario = (() => {
        try {
          if (scenarioData && typeof scenarioData === "object" && Object.keys(scenarioData).length > 0) return scenarioData;
          const raw = localStorage.getItem("currentScenarioJSON");
          if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) return parsed; }
        } catch (e) { }
        return {};
      })();
      {
        const scenarioData = activeScenario;
        const readFileAsText = (file) => new Promise((resolve, reject) => { if (!file) return resolve(""); const reader = new FileReader(); reader.onload = (ev) => resolve(ev.target.result || ""); reader.onerror = reject; reader.readAsText(file); });
        const isValidCsvText = (txt) => { if (txt === null || txt === undefined) return false; const t = String(txt).trim(); if (!t) return false; const lower = t.toLowerCase(); if (lower === "null" || lower === "undefined") return false; if (t.startsWith("{") || t.startsWith("[")) return false; const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0); const firstLine = lines[0] || ""; return t.length > 5 && firstLine.includes(","); };
        const setFormFile = (fd, key, fileOrBlob, filename) => { if (typeof fd.set === "function") { fd.set(key, fileOrBlob, filename); } else { try { if (typeof fd.delete === "function") fd.delete(key); } catch (_) { } fd.append(key, fileOrBlob, filename); } };
        const required = [["demand", files.demand], ["disruptions", files.disruptions], ["locations", files.locations], ["processes", files.processes], ["bom", files.bom], ["location_materials", files.locationMaterials]];
        const missing = required.filter(([, f]) => !f).map(([k]) => k);
        if (missing.length) { alert(`Missing required file(s): ${missing.join(", ")}. Please re-upload and try again.`); return; }
        const formData = new FormData();
        setFormFile(formData, "demand", files.demand, files.demand?.name || "demand.csv");
        setFormFile(formData, "disruptions", files.disruptions, files.disruptions?.name || "disruptions.csv");
        setFormFile(formData, "locations", files.locations, files.locations?.name || "locations.csv");
        setFormFile(formData, "processes", files.processes, files.processes?.name || "processes.csv");
        setFormFile(formData, "bom", files.bom, files.bom?.name || "bom.csv");
        setFormFile(formData, "location_materials", files.locationMaterials, files.locationMaterials?.name || "location_materials.csv");
        if (files.lanes) setFormFile(formData, "lanes", files.lanes, files.lanes?.name || "lanes.csv");
        const originalDemandText = await readFileAsText(files.demand);
        const originalDisruptionsText = await readFileAsText(files.disruptions);
        const originalLocMaterialsText = await readFileAsText(files.locationMaterials);
        let transformedDemand = originalDemandText;
        let transformedDisruptions = originalDisruptionsText;
        let transformedLocMaterials = originalLocMaterialsText;
        if (isValidCsvText(originalDemandText) && scenarioData?.demandAdjustments?.length) {
          const parsed = Papa.parse(originalDemandText, { header: true, skipEmptyLines: true });
          const rows = parsed.data || [];
          scenarioData.demandAdjustments.forEach((adj) => { rows.forEach((row) => { const sku = row.sku || row.SKU; const facility = row.facility || row.Facility || row.plant || row.Plant; const matchesSku = !adj.sku || sku?.toString().trim() === adj.sku.trim(); const matchesFacility = !adj.facility || facility?.toString().trim() === adj.facility.trim(); if (matchesSku && matchesFacility) { const original = Number(row.demand || row.Demand || 0) || 0; const delta = adj.changeType === "absolute" ? Number(adj.value || 0) : (Number(adj.value || 0) / 100) * original; row.demand = original + delta; } }); });
          transformedDemand = Papa.unparse(rows);
        }
        if (!scenarioData?.disruptionScenarios?.length) { try { const stored = localStorage.getItem("forc_active_scenario"); if (stored) Object.assign(scenarioData, JSON.parse(stored)); } catch { } }
        if (scenarioData?.disruptionScenarios?.length) {
          const scenarioRows = scenarioData.disruptionScenarios.map((scenario) => ({ start_date: scenario.startDate || scenario.start_date || "2025-01-01", end_date: scenario.endDate || scenario.end_date || "2025-01-10", facility: scenario.facility || "ScenarioFacility", severity: scenario.severity !== undefined && scenario.severity !== null && scenario.severity !== "" ? scenario.severity : 1.0, production_impact: scenario.production_impact !== undefined ? scenario.production_impact : scenario.severity, shipping_impact: scenario.shipping_impact !== undefined ? scenario.shipping_impact : 0.0 }));
          transformedDisruptions = Papa.unparse(scenarioRows, { columns: ["facility", "start_date", "end_date", "severity", "production_impact", "shipping_impact"] });
        }
        if (isValidCsvText(originalLocMaterialsText) && scenarioData?.inventoryPolicies?.length) {
          const parsed = Papa.parse(originalLocMaterialsText, { header: true, skipEmptyLines: true });
          const rows = parsed.data || [];
          scenarioData.inventoryPolicies.forEach((policy) => { rows.forEach((row) => { const sku = row.sku || row.SKU; const facility = row.facility || row.Facility || row.plant || row.Plant; const matchesSku = !policy.sku || sku?.toString().trim() === policy.sku.trim(); const matchesFacility = !policy.facility || facility?.toString().trim() === policy.facility.trim(); if (matchesSku && matchesFacility) { if (policy.reorderPoint !== undefined) row.reorder_point = policy.reorderPoint; if (policy.safetyStock !== undefined) row.safety_stock = policy.safetyStock; } }); });
          transformedLocMaterials = Papa.unparse(rows);
        }
        const overwriteCsvIfValid = (key, csvText, fallbackName) => { if (!isValidCsvText(csvText)) { console.warn(`⚠️ Skipping overwrite for "${key}"`); return; } const blob = new Blob([csvText], { type: "text/csv" }); setFormFile(formData, key, blob, fallbackName); };
        overwriteCsvIfValid("demand", transformedDemand, files.demand?.name || "demand.csv");
        overwriteCsvIfValid("disruptions", transformedDisruptions, files.disruptions?.name || "disruptions.csv");
        overwriteCsvIfValid("location_materials", transformedLocMaterials, files.locationMaterials?.name || "location_materials.csv");
        if (runLabel) formData.append("run_name", runLabel);
        await handleSubmit(formData);
      }
    } catch (err) { alert("Scenario run failed. Check console + backend logs for details."); }
  };

  const selectedSkuValue = useMemo(() => {
    if (!selectedSku || selectedSku === "ALL") return [];
    const values = Array.isArray(selectedSku) ? selectedSku : [selectedSku];
    return multiSkuOptions.filter((opt) => values.includes(opt.value));
  }, [selectedSku, multiSkuOptions]);

  const totalHistoryPages = Math.max(1, Math.ceil((Array.isArray(simulationHistory) ? simulationHistory.length : 0) / runsPerPage));
  const pagedSimulationHistory = (Array.isArray(simulationHistory) ? simulationHistory : []).slice((historyPage - 1) * runsPerPage, historyPage * runsPerPage);

  const narrativeHeadline = hasNarrativeRun ? (isHealthy ? "✅ Network Operating Normally" : "⚠️ Service Breakdown Detected") : "Run a Scenario to Generate Impact";
  const narrativeSummary = hasNarrativeRun ? (isHealthy ? "The supply network is performing at full capacity with no material disruptions detected." : `The network fulfilled demand but at a degraded service level of ${execOnTimePct.toFixed(1)}%. Backlog accumulated, recovery will take ${execTtrDays} days, and the network has ${execTtsDays} days of survival buffer remaining.`) : "Run a simulation to generate a live narrative of service impact, backlog risk, and recovery pressure.";
  const narrativeWhyText = hasNarrativeRun ? (isHealthy ? "All customer commitments are being met on time. Inventory levels are healthy and the network has sufficient buffer to absorb minor disruptions." : "Fulfillment masked the problem—service degradation introduced real risk, backlog, and recovery cost.") : "This panel will translate simulation outputs into an executive-ready summary of what changed, why it matters, and what to do next.";

  const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: "#e5e7eb", borderColor: "#cbd5e1", color: "#111827", boxShadow: "none" }),
    menu: (base) => ({ ...base, backgroundColor: "#f8fafc", color: "#111827" }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? "#e2e8f0" : "#f8fafc", color: "#111827", cursor: "pointer" }),
    singleValue: (base) => ({ ...base, color: "#111827", fontWeight: 600 }),
    placeholder: (base) => ({ ...base, color: "#374151", opacity: 1, fontWeight: 500 }),
    input: (base) => ({ ...base, color: "#111827" }),
    multiValue: (base) => ({ ...base, backgroundColor: "#e5e7eb" }),
    multiValueLabel: (base) => ({ ...base, color: "#111827", fontWeight: 600 }),
    multiValueRemove: (base) => ({ ...base, color: "#6b7280" }),
  };

  const executiveKpisForPanels = {
    serviceLevelPct: Number(kpis?.serviceLevelPct ?? kpis?.onTimeFulfillment ?? 0),
    demandAtRiskUnits: Number(kpis?.demandAtRiskUnits ?? kpis?.occurrenceUnfulfilledUnits ?? kpis?.unitsAtRisk ?? kpis?.peakBacklogUnits ?? 0),
    unfulfilledDemandUnits: Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0),
    missedServiceDays: Number(kpis?.missedServiceDays ?? 0),
    timeToRecoverDays: Number(kpis?.timeToRecoverDays ?? kpis?.ttrDays ?? 0),
    timeToSurviveDays: Number(kpis?.timeToSurviveDays ?? kpis?.ttsDays ?? 0),
    worstWeeklyServicePct: Number(kpis?.worstWeeklyServicePct ?? 0),
    falseConfidenceDays: Number(kpis?.falseConfidenceDays ?? 0),
    revenueExposure: Number(kpis?.revenueExposure ?? 0),
    estimatedRevenueExposure: Number(kpis?.estimatedRevenueExposure ?? 0),
    // Run context — dates/duration, not performance numbers. Lets False
    // Confidence ("105 days") be read alongside real calendar dates
    // instead of as an abstract duration.
    simulationStartDate: kpis?.simulationStartDate ?? null,
    simulationEndDate: kpis?.simulationEndDate ?? null,
    horizonWeeks: kpis?.horizonWeeks ?? null,
    disruptionStartDate: kpis?.disruptionStartDate ?? null,
    firstServiceImpactDate: kpis?.firstServiceImpactDate ?? null,
  };

  // ── Tab content renderers ──────────────────────────────────────────

  const renderImpactSummary = () => (
    <div className="space-y-6">
      {/* Narrative header */}
      <div
        className="rounded-2xl p-5 shadow-xl border"
        style={{
          background: !hasNarrativeRun ? "linear-gradient(160deg, rgba(8,15,24,0.96), rgba(10,18,30,0.96))" : execOnTimePct >= 97 ? "linear-gradient(160deg, rgba(4,24,12,0.96), rgba(6,30,16,0.96))" : execOnTimePct >= 80 ? "linear-gradient(160deg, rgba(28,20,2,0.96), rgba(40,30,4,0.96))" : "linear-gradient(160deg, rgba(24,7,7,0.96), rgba(34,10,10,0.96))",
          borderColor: !hasNarrativeRun ? "rgba(71,85,105,0.55)" : execOnTimePct >= 97 ? "rgba(20,100,50,0.65)" : execOnTimePct >= 80 ? "rgba(202,138,4,0.65)" : "rgba(127,29,29,0.65)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.22em] mb-1 ${!hasNarrativeRun ? "text-slate-400" : execOnTimePct >= 97 ? "text-emerald-300/80" : execOnTimePct >= 80 ? "text-yellow-400/80" : "text-red-300/80"}`}>
              Decision Narrative
            </p>
            <h3 className={`text-lg tracking-tight font-semibold ${!hasNarrativeRun ? "text-slate-200" : execOnTimePct >= 97 ? "text-emerald-200" : execOnTimePct >= 80 ? "text-yellow-200" : "text-red-200"} ${hasNarrativeRun && !isHealthy ? "animate-pulse" : ""}`}>
              {narrativeHeadline}
            </h3>
          </div>
          <div className="text-right">
            <p className={`text-[11px] uppercase tracking-[0.22em] mb-1 ${!hasNarrativeRun ? "text-slate-400" : execOnTimePct >= 97 ? "text-emerald-300/80" : "text-red-300/80"}`}>Current State</p>
            <p className={`text-xs font-semibold ${!hasNarrativeRun ? "text-slate-300" : execOnTimePct >= 97 ? "text-emerald-300" : execOnTimePct >= 80 ? "text-yellow-400" : "text-red-400"}`}>
              {!hasNarrativeRun ? "Awaiting Simulation" : execOnTimePct >= 97 ? "Stable" : execOnTimePct >= 80 ? "Under Stress" : "High Service Risk"}
            </p>
          </div>
        </div>

        {!hasNarrativeRun ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-5xl">🎯</div>
            <div className="text-center">
              <p className="text-slate-200 font-semibold text-sm mb-1">Upload your files and run a scenario</p>
              <p className="text-slate-400 text-xs max-w-md leading-relaxed">FOR-C will simulate the downstream impact across your supply network and generate an executive-ready narrative of service risk, backlog pressure, and recovery time.</p>
            </div>
            <div className="flex items-center gap-6 mt-2 text-[11px] text-slate-500">
              <span>📂 Upload CSVs</span><span style={{ color: "#9FD63A" }}>→</span>
              <span>▶ Run Simulation</span><span style={{ color: "#9FD63A" }}>→</span>
              <span>📊 See Impact</span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-200 mb-6">{aiNarrativeLoading ? "Generating executive narrative..." : aiNarrative || narrativeSummary}</p>

            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-7 gap-3 mb-6">
              {[
                { label: "Service Level",      value: `${Math.round(execOnTimePct)}%`,                                                                                              color: execOnTimePct < 80 ? "text-red-400" : execOnTimePct < 97 ? "text-yellow-400" : "text-green-400" },
                { label: "Demand at Risk",      value: Math.round(execLateUnits).toLocaleString(),                                                                                  color: isHealthy ? "text-emerald-300" : "text-orange-300" },
                { label: "Peak Backlog",        value: Math.round(execPeakBacklog).toLocaleString(),                                                                                color: isHealthy ? "text-emerald-300" : "text-amber-300" },
                { label: "Time to Recover",     value: `${Math.round(execTtrDays)}d`,                                                                                               color: isHealthy ? "text-emerald-300" : "text-rose-300" },
                { label: "Time to Survive",     value: `${Math.round(execTtsDays)}d`,                                                                                               color: isHealthy ? "text-emerald-300" : "text-purple-300" },
                { label: "Worst Week",          value: execWorstWeeklyPct > 0 ? `${Math.round(execWorstWeeklyPct)}%` : "—",                                                         color: isHealthy ? "text-emerald-300" : execWorstWeeklyPct < 50 ? "text-red-400" : "text-orange-300" },
                { label: "False Confidence",    value: (execFalseConfidenceDays > 0 && execWorstWeeklyPct < 99.5) ? `${Math.round(execFalseConfidenceDays)}d` : "—",                    color: isHealthy ? "text-emerald-300" : "text-orange-300" },
              ].map((kpi) => (
                <div key={kpi.label} className={`rounded-xl border bg-black/20 p-3 ${isHealthy ? "border-emerald-900/40" : "border-slate-700/50"}`}>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{kpi.label}</p>
                  <p className={`text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Run Context — pairs abstract durations (TTR, TTS, False
                Confidence) with real calendar dates from this specific run */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 mb-6">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Run Context</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                {[
                  { label: "Simulation Start", value: kpis?.simulationStartDate ?? "—" },
                  { label: "Horizon", value: kpis?.horizonWeeks ? `${kpis.horizonWeeks}w` : "—" },
                  { label: "Disruption Start", value: kpis?.disruptionStartDate ?? "—" },
                  { label: "First Service Impact", value: kpis?.firstServiceImpactDate ?? "—" },
                  { label: "Simulation End", value: kpis?.simulationEndDate ?? "—" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] text-slate-500">{item.label}</p>
                    <p className="text-xs font-medium text-slate-300">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Stock summary card → navigates to Actions tab */}
            <SafetyStockSummaryCard
              kpis={kpis}
              apiBase={API_BASE}
              hasRun={hasNarrativeRun}
              onNavigateToActions={() => setActiveTab("actions")}
            />

            {/* Why this matters */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 mt-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Why this matters</p>
              <p className="text-sm leading-6 text-slate-200">{narrativeWhyText}</p>
            </div>

            {/* Recommended actions */}
            <div className={`rounded-xl border p-4 mt-4 ${isHealthy ? "border-emerald-700/40 bg-emerald-950/20" : "border-emerald-900/35 bg-emerald-950/20"}`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90 mb-2">Recommended action</p>
              <ul className="space-y-2 text-sm text-slate-200">
                {isHealthy ? (
                  <><li>• Continue monitoring Taiwan Strait supplier concentration risk.</li><li>• Validate buffer inventory levels ahead of Q3 demand peak.</li><li>• Run blockade scenario to quantify latent exposure.</li></>
                ) : (
                  <><li>• Prioritize the constrained component path immediately.</li><li>• Protect customer-facing service before backlog accelerates.</li><li>• Expedite the limiting supply node to reduce recovery time.</li></>
                )}
              </ul>

              {(suggestedScenarios.length > 0 || scenariosLoading) && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4 mt-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-lime-400/90 mb-3">🧪 Suggested Next Scenarios</p>
                  {scenariosLoading ? (
                    <p className="text-xs text-slate-400">Analyzing live feed data...</p>
                  ) : (
                    <div className="space-y-3">
                      {suggestedScenarios.map((s, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-100">{s.title}</p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">Severity {Math.round(s.severity * 100)}%</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mb-1">{s.description}</p>
                          <p className="text-[10px] text-lime-400/70 italic">{s.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Generate Report */}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
                      const res = await fetch(`${API_BASE}/api/report/generate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          scenario: runName || "Supply Chain Disruption Scenario",
                          networkName: "Nexty Electronics Network",
                          aiNarrative: aiNarrative || narrativeSummary,
                          kpis: { serviceLevelPct: execOnTimePct, peakBacklogUnits: execPeakBacklog, timeToRecoverDays: execTtrDays, timeToSurviveDays: execTtsDays, demandAtRiskUnits: execLateUnits, revenueExposure: execRevenueExposure, worstWeeklyServicePct: execWorstWeeklyPct, falseConfidenceDays: execFalseConfidenceDays },
                          suggestedScenarios,
                          disruptionSignals: {
                            facilitiesImpacted: Array.isArray(disruptionImpactData) ? new Set(disruptionImpactData.map(r => r.facility || r.Facility).filter(Boolean)).size : 0,
                            highRiskSkuCount: Array.isArray(runoutRiskData) ? new Set(runoutRiskData.filter(r => (r.risk_level || "").toLowerCase().includes("high")).map(r => r.sku || r.SKU)).size : 0,
                            highRiskSkus: Array.isArray(runoutRiskData) ? [...new Set(classifyFacilitySkuRisk(runoutRiskData).filter(r => r.risk_level === "high").map(r => r.sku))].slice(0, 5) : [],
                            occurrenceCount: Array.isArray(disruptionImpactData) ? disruptionImpactData.length : 0,
                            revenueExposure: execRevenueExposure,
                            severityMix: Array.isArray(runoutRiskData) ? runoutRiskData.reduce((acc, r) => { const l = (r.risk_level || "").toLowerCase(); if (l.includes("high")) acc.high = (acc.high || 0) + 1; else if (l.includes("med")) acc.medium = (acc.medium || 0) + 1; else if (l.includes("low")) acc.low = (acc.low || 0) + 1; return acc; }, {}) : {},
                          },
                          countermeasures: Array.isArray(countermeasuresData) ? countermeasuresData.slice(0, 5) : [],
                          runMetadata: { runId: simulationHistory?.[0]?.run_id || simulationHistory?.[0]?.timestamp || "", timestamp: simulationHistory?.[0]?.timestamp || "" },
                        })
                      });
                      if (!res.ok) throw new Error("Report generation failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `forc_report_${Date.now()}.pdf`; a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) { console.error("❌ Report download failed:", e); alert("Report generation failed. Check console."); }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition"
                  style={{ background: "linear-gradient(90deg, #9CF700, #22c55e)", color: "#020617" }}
                >
                  📄 Generate Executive Report
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderIntelligence = () => (
    <div className="space-y-6" id="tour-disruption-signals">
      <DisruptionSignalsPanel
        disruptionImpactData={disruptionImpactData}
        runoutRiskData={runoutRiskData}
        executiveKpis={executiveKpisForPanels}
        hasNarrativeRun={hasNarrativeRun}
      />
      <div className="rounded-2xl p-5 shadow-xl border" style={{ background: "linear-gradient(170deg, rgba(4,24,18,0.98), rgba(4,28,21,0.98))", borderColor: "#123528" }}>
        <h2 className="text-sm font-semibold text-slate-50 mb-1">🕸️ Supplier Network Graph</h2>
        <p className="text-xs text-slate-300 mb-4">Facility-level supply chain topology derived from your BOM and locations data. Node color indicates risk level from the latest simulation run.</p>
        <SupplierNetworkGraph
          bomData={parsedBomData}
          locationsData={parsedLocationsData}
          locationMaterialsData={parsedLocationMaterialsData}
          lanesData={parsedLanesData}
          runoutRiskData={safeArray(runoutRiskData)}
          scenarioData={lastRunScenarioData || scenarioData}
          apiBase={API_BASE}
          kpis={kpis}
        />
      </div>
    </div>
  );

  const renderActions = () => (
    <MaterialRiskPanel
      runoutRiskData={runoutRiskData}
      countermeasuresData={countermeasuresData}
      executiveKpis={executiveKpisForPanels}
      kpis={kpis}
      apiBase={API_BASE}
      hasNarrativeRun={hasNarrativeRun}
    />
  );

  const renderAnalysis = () => (
    <div className="space-y-6 simulation-chart-container">
      <style>{`.simulation-chart-container .select__placeholder,.simulation-chart-container .select__single-value{color:#111827!important;opacity:1!important;font-weight:600!important}.simulation-chart-container canvas{color:#eafff4!important}`}</style>

      <div className="rounded-2xl p-5 shadow-xl border" style={{ background: "linear-gradient(160deg, rgba(4,22,17,0.98), rgba(4,27,21,0.98))", borderColor: "#123528" }}>
        <h2 className="text-sm font-semibold text-slate-50 mb-1">📈 Operational Performance Trends</h2>
        <p className="text-xs text-slate-300 mb-4">Explore how inventory, production, and service levels evolve across the network.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div>
            <p className="text-xs text-white font-semibold mb-1">Product (SKU)</p>
            <Select isMulti options={multiSkuOptions} onChange={handleSkuChange} value={selectedSkuValue} className="text-sm select" classNamePrefix="select" styles={selectStyles} />
          </div>
          <div>
            <p className="text-xs text-white font-semibold mb-1">Performance Metric</p>
            <Select options={outputTypes} onChange={(opt) => setSelectedOutputType(opt?.value || "inventory")} value={outputTypes.find((o) => o.value === selectedOutputType)} className="text-sm select" classNamePrefix="select" styles={selectStyles} />
          </div>
          <div>
            <p className="text-xs text-white font-semibold mb-1">Facility</p>
            <input type="text" className="w-full bg-slate-900/70 border border-slate-700 rounded-lg text-slate-200 text-sm px-2 py-1" value={selectedFacility || "All / None Selected"} disabled />
          </div>
        </div>

        {selectedOutputType === "inventory" && isInventoryFlatline && (
          <div className="rounded-2xl border p-4 mb-6" style={{ background: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.30)" }}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-300 mb-1">Zero Buffer Exposure</p>
                <p className="text-sm text-slate-100 leading-relaxed">Inventory is flat at zero across the selected period. The network is operating with no visible buffer.</p>
              </div>
            </div>
          </div>
        )}

        <div className="relative h-80 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          {overlayLoading && <div className="text-xs text-slate-300 mb-2">Building overlay chart…</div>}
          {overlayError && <div className="text-xs text-red-400 mb-2">{overlayError}</div>}
          {(overlayChartData?.datasets?.length > 0 || derivedChartData?.datasets?.length > 0) ? (
            <Line data={overlayChartData?.datasets?.length ? overlayChartData : derivedChartData} options={chartOptions} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">📊</span>
              <p className="text-slate-400 text-sm font-semibold">No data to display</p>
              <p className="text-slate-500 text-xs">Select a product and facility, then run a simulation to populate this chart.</p>
            </div>
          )}
        </div>
      </div>

      {/* Run comparison */}
      <div className="rounded-2xl p-5 shadow-xl border" style={{ background: "linear-gradient(160deg, rgba(4,22,17,0.98), rgba(4,27,21,0.98))", borderColor: "#123528" }}>
        <h2 className="text-sm font-semibold text-slate-50 mb-4">🔀 Compare Simulation Runs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[11px] text-slate-300 mb-1">Baseline Run (Left)</p>
            <Select options={(Array.isArray(simulationHistory) ? simulationHistory : []).map((s, idx) => ({ value: idx, label: formatRunLabel(s, idx) }))} onChange={(opt) => setBaselineRunIndex(opt?.value ?? null)} className="text-sm select" classNamePrefix="select" styles={selectStyles} />
          </div>
          <div>
            <p className="text-[11px] text-slate-300 mb-1">Comparison Run (Right)</p>
            <Select options={(Array.isArray(simulationHistory) ? simulationHistory : []).map((s, idx) => ({ value: idx, label: formatRunLabel(s, idx) }))} onChange={(opt) => setCompareRunIndex(opt?.value ?? null)} className="text-sm select" classNamePrefix="select" styles={selectStyles} />
          </div>
        </div>
        {!overlayChartData && (
          <div className="flex items-start gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 mb-4">
            <span className="text-lg">💡</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">Select any two simulation runs above to generate a side-by-side overlay comparison.</p>
          </div>
        )}
        <div id="tour-scenario-comparison">
          <ScenarioComparison
            runA={baselineRunIndex !== null ? simulationHistory[baselineRunIndex] : null}
            runB={compareRunIndex !== null ? simulationHistory[compareRunIndex] : null}
          />
        </div>
      </div>
    </div>
  );

  const renderWarRoom = () => (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 border" style={{ background: "linear-gradient(140deg, rgba(4,24,18,0.98), rgba(5,36,26,0.98))", borderColor: "#143629" }}>
        <h2 className="text-sm font-semibold text-slate-50 mb-2">🧪 Scenario Builder</h2>
        <p className="text-xs text-slate-300 mb-4">Configure demand shocks, disruption injections, and inventory policies, then apply them to the next simulation run.</p>

        {scenarioData?.name && (
          <div className="mb-3 px-3 py-2 rounded-md text-xs font-semibold" style={{ backgroundColor: "rgba(156, 247, 0, 0.08)", border: "1px solid #9CF700", color: "#9CF700" }}>
            🧪 Active Scenario: {scenarioData.name}
          </div>
        )}
        {scenarioData?.name && (
          <button onClick={() => { if (!window.confirm("Restore baseline? This will clear the active scenario.")) return; setScenarioData(null); setScenarioJson(null); setSelectedScenarioId(""); alert("🔄 Baseline restored!"); }} className="mb-3 text-[11px] text-slate-300 hover:text-slate-100 underline">
            🔄 Restore Baseline
          </button>
        )}

        <div id="tour-scenario-builder" className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">🎯 War Game the Scenario</h2>
            <p className="text-sm text-slate-400 mt-1">Apply disruptions, demand shocks, and policy changes to stress test your network.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {[
              { label: "Service Level", value: typeof kpis?.onTimeFulfillment === 'number' ? `${kpis.onTimeFulfillment.toFixed(1)}%` : '-', color: "text-green-400" },
              { label: "Demand at Risk", value: formatNumber(kpis?.demandAtRiskUnits ?? kpis?.occurrenceUnfulfilledUnits ?? kpis?.unitsAtRisk ?? kpis?.peakBacklogUnits ?? 0, { zeroIsDash: true }), color: "text-yellow-400" },
              { label: "Revenue Exposure", value: formatCurrencyCompact(kpis?.revenueExposure ?? 0), color: "text-red-400" },
              { label: "Peak Backlog", value: formatNumber(kpis?.peakBacklog ?? 0, { zeroIsDash: true }), color: "text-orange-400" },
              { label: "TTR", value: `${kpis?.timeToRecoverDays ?? '-'}d`, color: "text-blue-400" },
              { label: "TTS", value: `${kpis?.timeToSurviveDays ?? kpis?.ttsDays ?? '-'}d`, color: "text-purple-400" },
              { label: "Status", value: (() => {
                  const curOnTime = Number(kpis?.onTimeFulfillment ?? 100);
                  const curBacklogVal = Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0);
                  // A scenario name alone doesn't mean impact actually occurred,
                  // and a missing name doesn't mean nothing happened — judge by
                  // the run's own numbers first, falling back to scenarioData
                  // only when the KPIs themselves show no degradation.
                  if (curOnTime < 99.5 || curBacklogVal > 0) return "Under Stress";
                  return scenarioData?.name ? "Scenario Active" : "Baseline";
                })(), color: "text-slate-300" },
            ].map((item) => (
              <div key={item.label} className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Run Context — pairs abstract durations (TTR, TTS, False
              Confidence) with real calendar dates from this specific run */}
          <div className="bg-slate-800/30 border border-slate-700/60 rounded-lg p-3 mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Run Context</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              {[
                { label: "Simulation Start", value: kpis?.simulationStartDate ?? "—" },
                { label: "Horizon", value: kpis?.horizonWeeks ? `${kpis.horizonWeeks}w` : "—" },
                { label: "Disruption Start", value: kpis?.disruptionStartDate ?? "—" },
                { label: "First Service Impact", value: kpis?.firstServiceImpactDate ?? "—" },
                { label: "Simulation End", value: kpis?.simulationEndDate ?? "—" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                  <p className="text-xs font-medium text-slate-300">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Before vs After */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">Before vs After (Scenario Impact)</p>
              <select
                className="text-xs bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                onChange={(e) => setBaselineRunIndex(e.target.value !== "" ? Number(e.target.value) : null)}
                defaultValue=""
              >
                <option value="">Select baseline run...</option>
                {(Array.isArray(simulationHistory) ? simulationHistory : []).map((s, idx) => (
                  <option key={idx} value={idx}>{formatRunLabel(s, idx)}</option>
                ))}
              </select>
            </div>
            {(() => {
              const baselineIdx = baselineRunIndex;
              const baselineRun = (baselineIdx !== null && baselineIdx !== undefined) ? simulationHistory?.[baselineIdx] : null;
              const baseKpis = baselineRun?.kpis || baselineRun?.raw?.kpis || {};
              const hasBaseline = Object.keys(baseKpis).length > 0;
              const baseSvc = (() => { const raw = baseKpis?.onTimeFulfillment ?? baseKpis?.serviceLevelPct ?? 0; const n = typeof raw === "string" ? parseFloat(raw.replace(/[^0-9.]/g, "")) : Number(raw); return Number.isFinite(n) ? n : 0; })();
              const curSvc = Number(kpis?.onTimeFulfillment ?? 0);
              const svcDelta = curSvc - baseSvc;
              const baseRev = Number(baseKpis?.revenueExposure ?? 0); const curRev = Number(kpis?.revenueExposure ?? 0); const revDelta = curRev - baseRev;
              const baseTtr = Number(baseKpis?.ttrDays ?? baseKpis?.timeToRecoverDays ?? 0); const curTtr = Number(kpis?.ttrDays ?? kpis?.timeToRecoverDays ?? 0); const ttrDelta = curTtr - baseTtr;
              const curBacklog = Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0); const baseBacklog = Number(baseKpis?.peakBacklogUnits ?? 0); const backlogDelta = curBacklog - baseBacklog;
              const curRisk = Number(kpis?.demandAtRiskUnits ?? kpis?.occurrenceUnfulfilledUnits ?? kpis?.peakBacklogUnits ?? 0); const baseRisk = Number(baseKpis?.demandAtRiskUnits ?? baseKpis?.occurrenceUnfulfilledUnits ?? baseKpis?.peakBacklogUnits ?? 0); const riskDelta = curRisk - baseRisk;
              const deltaColor = (val, lowerIsBetter = false) => { if (val === 0) return "text-slate-400"; return (lowerIsBetter ? val > 0 : val < 0) ? "text-red-400" : "text-emerald-400"; };
              const deltaSign = (val) => Number(val) > 0 ? `+${val}` : `${val}`;
              const impactLabel = !hasBaseline ? "Select baseline" : svcDelta < -10 ? "High Impact" : svcDelta < -3 ? "Moderate Impact" : svcDelta < 0 ? "Low Impact" : "No Impact";
              const impactColor = !hasBaseline ? "text-yellow-400" : svcDelta < -10 ? "text-red-400" : svcDelta < -3 ? "text-amber-400" : svcDelta < 0 ? "text-yellow-400" : "text-emerald-400";
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                  {[
                    { label: "Service", cur: curSvc > 0 ? `${curSvc.toFixed(1)}%` : '-', delta: hasBaseline ? `${deltaSign(svcDelta.toFixed(1))}%` : "→ Select baseline", deltaClass: hasBaseline ? deltaColor(svcDelta) : "text-slate-500" },
                    { label: "Risk", cur: curRisk > 0 ? formatNumber(curRisk) : '-', delta: hasBaseline ? deltaSign(Math.round(riskDelta)) + " units" : "→ Select baseline", deltaClass: hasBaseline ? deltaColor(riskDelta, true) : "text-slate-500" },
                    { label: "Revenue", cur: formatCurrencyCompact(curRev), delta: hasBaseline ? (revDelta >= 0 ? `+${formatCurrencyCompact(revDelta)}` : formatCurrencyCompact(revDelta)) : "→ Select baseline", deltaClass: hasBaseline ? deltaColor(revDelta, true) : "text-slate-500" },
                    { label: "Backlog", cur: curBacklog > 0 ? formatNumber(curBacklog) : '-', delta: hasBaseline ? deltaSign(Math.round(backlogDelta)) + " units" : "→ Select baseline", deltaClass: hasBaseline ? deltaColor(backlogDelta, true) : "text-slate-500" },
                    { label: "TTR", cur: curTtr > 0 ? `${curTtr}d` : '-', delta: hasBaseline ? deltaSign(ttrDelta) + "d" : "→ Select baseline", deltaClass: hasBaseline ? deltaColor(ttrDelta, true) : "text-slate-500" },
                    { label: "Impact", cur: impactLabel, delta: null, deltaClass: impactColor, curClass: impactColor },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] text-slate-400">{item.label}</p>
                      <p className={`text-sm font-semibold text-slate-200 ${item.curClass || ""}`}>{item.cur}</p>
                      {item.delta !== null && <p className={`text-xs font-semibold ${item.deltaClass}`}>{item.delta}</p>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <ScenarioBuilder
            scenarioData={scenarioData}
            setScenarioData={setScenarioData}
            onRun={() => handleRunSimulationWithScenario(null, runName)}
            locationsFile={files.locations}
            apiBase={API_BASE}
          />
        </div>

        <div className="mt-3">
          {scenarioData?.name ? (
            <div className="px-3 py-2 rounded-md text-xs font-semibold" style={{ backgroundColor: "rgba(156, 247, 0, 0.10)", border: "1px solid #9CF700", color: "#9CF700" }}>✅ Scenario ready for next simulation run</div>
          ) : (
            <div className="text-[11px] text-slate-400">No active scenario applied.</div>
          )}
        </div>

        {/* Save/Load */}
        <div className="mt-4 flex flex-wrap gap-2 items-center text-xs">
          <input
            type="text"
            placeholder="Scenario name..."
            value={scenarioJson?.name || ""}
            onChange={(e) => setScenarioJson((prev) => ({ ...(prev || {}), name: e.target.value }))}
            className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-500"
            style={{ minWidth: "180px" }}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const finalData = { ...(scenarioData || {}), ...(scenarioJson || {}) };
                const name = String(finalData.name || "").trim();
                if (!name) { alert("Scenario must have a name."); return; }
                finalData.name = name;
                setScenarioData(finalData);
                await saveScenario({ name, data: JSON.stringify(finalData) });
                alert("💾 Scenario Saved!");
                const res = await listScenarios();
                setSavedScenarios(res.data || []);
              } catch (err) { alert(`Save failed: ${err?.response?.data?.message || err?.message || "Unknown error"}`); }
            }}
            className="px-3 py-1.5 rounded-md font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-900"
          >💾 Save</button>
          <select value={selectedScenarioId || ""} onChange={(e) => setSelectedScenarioId(e.target.value)} className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200">
            <option value="">Saved...</option>
            {(savedScenarios || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            type="button"
            onClick={async () => {
              try {
                if (!selectedScenarioId) { alert("Select a scenario first."); return; }
                const res = await loadScenario(selectedScenarioId);
                const raw = res?.data || {};
                let loaded = raw;
                if (raw?.data && typeof raw.data === "string") { try { loaded = JSON.parse(raw.data); } catch { loaded = raw; } }
                setScenarioJson(loaded); setScenarioData(loaded);
                alert(`📥 Scenario "${loaded?.name || raw?.name || ""}" applied!`);
              } catch (err) { alert(`Load failed. ${err?.response?.data?.message || err?.message || ""}`); }
            }}
            className="px-3 py-1.5 rounded-md font-semibold bg-blue-500 hover:bg-blue-400 text-slate-900"
          >📥 Load</button>
        </div>
      </div>

      {/* Simulation History */}
      <div className="rounded-2xl p-5 shadow-xl border" style={{ background: "linear-gradient(170deg, rgba(4,24,18,0.98), rgba(4,28,21,0.98))", borderColor: "#123528" }}>
        <h2 className="text-sm font-semibold text-slate-50 mb-1">🗂 Simulation History</h2>
        <p className="text-xs text-slate-300 mb-4">Reload previous simulation output files and compare scenarios.</p>
        {(!Array.isArray(simulationHistory) || simulationHistory.length === 0) ? (
          <p className="text-xs text-slate-300">No past simulations yet.</p>
        ) : (
          <div className="space-y-3">
            {pagedSimulationHistory.map((sim, idx) => {
              const globalIdx = (historyPage - 1) * runsPerPage + idx;
              const runKpis = sim?.kpis || sim?.raw?.kpis || {};
              const svcLevel = Number(runKpis?.onTimeFulfillment ?? runKpis?.serviceLevelPct ?? 0);
              const ttr = Number(runKpis?.ttrDays ?? runKpis?.timeToRecoverDays ?? 0);
              return <RunCard key={globalIdx} sim={sim} globalIdx={globalIdx} svcLevel={svcLevel} ttr={ttr} onReloadRun={onReloadRun} formatRunLabel={formatRunLabel} />;
            })}
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition" style={{ borderColor: historyPage === 1 ? "rgba(71,85,105,0.35)" : "#355e52", color: historyPage === 1 ? "#64748b" : "#E2E8F0", backgroundColor: "rgba(2,6,23,0.45)", cursor: historyPage === 1 ? "not-allowed" : "pointer" }}>← Previous</button>
              <p className="text-xs text-slate-400">Page {historyPage} of {totalHistoryPages}</p>
              <button type="button" onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition" style={{ borderColor: historyPage === totalHistoryPages ? "rgba(71,85,105,0.35)" : "#355e52", color: historyPage === totalHistoryPages ? "#64748b" : "#E2E8F0", backgroundColor: "rgba(2,6,23,0.45)", cursor: historyPage === totalHistoryPages ? "not-allowed" : "pointer" }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (!hasNarrativeRun) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-6xl">🎯</div>
          <div className="text-center">
            <p className="text-slate-200 font-semibold text-base mb-2">Upload your files and run a scenario</p>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">FOR-C will simulate the downstream impact across your supply network and generate an executive-ready narrative of service risk, backlog pressure, and recovery time.</p>
          </div>
          <div className="flex items-center gap-6 mt-2 text-xs text-slate-500">
            <span>📂 Upload CSVs</span><span style={{ color: "#9FD63A" }}>→</span>
            <span>▶ Run Simulation</span><span style={{ color: "#9FD63A" }}>→</span>
            <span>📊 See Impact</span>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case "impact": return renderImpactSummary();
      case "intelligence": return renderIntelligence();
      case "actions": return renderActions();
      case "analysis": return renderAnalysis();
      case "warroom": return renderWarRoom();
      default: return renderImpactSummary();
    }
  };

  // ── Main render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-slate-50 flex flex-col" style={{ background: "radial-gradient(circle at top left, #0B3D2E 0, #020617 40%, #020617 100%)" }}>
      {/* Header */}
      <header className="border-b shadow-lg" style={{ borderColor: "#0f2b22", background: "linear-gradient(90deg, #020617 0%, #0B3D2E 45%, #020617 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span style={{ color: "#9CF700" }}>FOR-C</span>
              <span className="text-slate-200">Simulation Dashboard</span>
            </h1>
            {!presentationMode && <p className="text-sm text-slate-400 mt-1">Run digital twin scenarios, analyze disruption impact, and compare mitigation strategies.</p>}
          </div>
          <div className="flex items-center gap-3">
            {!presentationMode && (
              <button type="button" className="px-3 py-1.5 rounded-full text-xs border transition text-slate-200 hover:text-white" style={{ borderColor: "#1f3f33", backgroundColor: "rgba(2, 6, 23, 0.6)" }} onClick={() => switchView("control")}>
                ⬅ Back to Control Tower
              </button>
            )}
            <button type="button" onClick={() => setPresentationMode(p => !p)} className="px-3 py-1.5 rounded-full text-xs border transition font-semibold" style={{ borderColor: "#9CF700", color: "#9CF700", backgroundColor: "rgba(2, 6, 23, 0.6)" }}>
              {presentationMode ? "⬜ Exit Presentation" : "🖥 Presentation Mode"}
            </button>
            {!presentationMode && (
              <button type="button" onClick={onLogout} className="px-3 py-1.5 rounded-full text-xs border border-rose-500/80 text-rose-300 hover:bg-rose-500/10 transition">Logout</button>
            )}
          </div>
        </div>
      </header>

      <main ref={mainRef} className={`flex-1 max-w-7xl mx-auto px-4 py-4 space-y-6 ${presentationMode ? "text-lg" : "text-sm"}`}>

        {/* ── LAYER 1: Persistent header zone ── */}
        <section className={`grid grid-cols-1 gap-4 ${presentationMode ? "" : "lg:grid-cols-5"}`}>
          {/* Map */}
          <div className={`${presentationMode ? "col-span-1" : "lg:col-span-3"} rounded-2xl p-4 shadow-xl border`} style={{ background: "linear-gradient(135deg, rgba(5,25,20,0.98), rgba(7,46,34,0.98))", borderColor: "#123528" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-50"><span style={{ color: "#9CF700" }}>🌐 Network Map</span></h2>
              <div className="text-[11px] text-slate-400">Updated {new Date().toLocaleTimeString()}</div>
            </div>
            <div className="h-[26rem] rounded-2xl overflow-hidden border border-slate-700/70 bg-slate-950/80 shadow-inner">
              <MapView locationsUrl={locationsUrl} selectedFacility={selectedFacility} onFacilityClick={handleFacilityClick} />
            </div>
          </div>

          {/* Inputs */}
          {!presentationMode && (
            <div className="lg:col-span-2 rounded-2xl p-4 border" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "#143629" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-50">📂 Simulation Inputs</h2>
                <button type="button" onClick={() => { ["demand", "disruptions", "locations", "processes", "bom", "locationMaterials", "lanes"].forEach((key) => handleFileChange(key, null)); }} className="px-2.5 py-1 rounded-md text-[11px] font-semibold border transition" style={{ borderColor: "#355e52", color: "#E2E8F0", backgroundColor: "rgba(2, 6, 23, 0.45)" }}>Clear All</button>
              </div>
              
                <a href="/forc-sample-data.zip" download className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold border transition mb-3" style={{ borderColor: "#2EC4A6", color: "#2EC4A6", background: "rgba(46,196,166,0.07)" }}>📦 Download Sample Data</a>
              <div className="divide-y divide-slate-700/40 text-xs">
                {[["Demand", "demand"], ["Disruptions", "disruptions"], ["Locations", "locations"], ["Processes", "processes"], ["BOM", "bom"], ["Location Materials", "locationMaterials"], ["Lanes (Optional)", "lanes"]].map(([label, key]) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                      <span className="text-slate-200">{label}</span>
                      <span className="text-[11px]" style={{ color: files[key] ? "#9CF700" : "#94a3b8", fontWeight: files[key] ? "500" : "400" }}>{files[key] ? `✓ ${files[key].name}` : "No file selected"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input key={`upload-${key}-${files[key]?.name || "empty"}`} id={`upload-${key}`} type="file" accept=".csv" onChange={(e) => handleFileChange(key, e.target.files[0])} className="hidden" />
                      <label htmlFor={`upload-${key}`} className="cursor-pointer px-3 py-1 rounded-md text-[11px] border text-slate-200 hover:bg-slate-800/70 transition" style={{ borderColor: "#355e52", backgroundColor: "rgba(2,6,23,0.55)" }}>Upload</label>
                      {files[key] ? <button type="button" onClick={() => handleFileChange(key, null)} className="h-7 w-7 rounded-md text-[12px] font-bold border transition" style={{ borderColor: "rgba(248,113,113,0.45)", color: "#fca5a5", backgroundColor: "rgba(127,29,29,0.18)" }} title={`Clear ${label}`}>×</button> : null}
                    </div>
                  </div>
                ))}
              </div>
              <input type="text" value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Name this run (e.g. Taiwan Blockade July)" className="mt-3 w-full px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
              <button type="button" onClick={() => { try { localStorage.removeItem("forc_active_scenario"); localStorage.removeItem("currentScenarioJSON"); } catch { } setScenarioData(null); alert("✅ Baseline cleared — next run will use uploaded files only."); }} className="mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition" style={{ borderColor: "#355e52", color: "#94a3b8", background: "rgba(2,6,23,0.45)" }}>
                🔄 Clear to Baseline
              </button>
              <button
                onClick={() => { const activeScenario = scenarioData && Object.keys(scenarioData).length > 0 ? scenarioData : null; handleRunSimulationWithScenario(activeScenario, runName); }}
                disabled={isSimulateDisabled}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition active:scale-[0.98]"
                style={isSimulateDisabled ? { backgroundColor: "rgba(15,23,42,0.8)", color: "#64748b", cursor: "not-allowed" } : { background: "linear-gradient(90deg,#9CF700,#22c55e)", color: "#020617" }}
              >
                {statusLabel}
              </button>
              {!isSimulationReady && <p className="text-[11px] text-amber-300 mt-2">⚠ Upload all six required files before running the simulation.</p>}
            </div>
          )}
        </section>

        {/* ── LAYER 2: Tabbed results zone ── */}
        <div className="rounded-2xl border p-5 shadow-xl" style={{ background: "linear-gradient(160deg, rgba(4,20,15,0.99), rgba(3,16,12,0.99))", borderColor: "#123528" }}>
          <TabNav activeTab={activeTab} setActiveTab={setActiveTab} hasRun={hasNarrativeRun} />
          {renderTabContent()}
        </div>

      </main>
    </div>
  );
}
