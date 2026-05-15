import React, { useEffect, useMemo, useState, useRef } from "react";
import MapView from "./MapView";
import ScenarioBuilder from "./ScenarioBuilder";
import { Line } from "react-chartjs-2";
import Select from "react-select";
import Papa from "papaparse";
import DecisionNarrativePanel from "./DecisionNarrativePanel";
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
// 🔐 Scenario APIs
import {
  listScenarios,
  loadScenario,
  saveScenario,
  runSimulationWithScenario
} from "../apiClient/scenarios.js";

// ✅ Register Chart.js components
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
// ✅ KPI display helpers (demo-safe)
// ===============================
function _toNumberLoose(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  // strip common formatting ($, commas, %)
  const cleaned = s.replace(/[$,%]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatPercent(v, opts) {
  const o = opts || {};
  const zeroIsDash = !!o.zeroIsDash;
  const digits = Number.isFinite(o.digits) ? o.digits : 1;

  if (v === null || v === undefined) return "--";

  // If already "7.6%" etc., keep it unless it’s empty
  if (typeof v === "string" && v.trim().endsWith("%")) {
    const t = v.trim();
    if (t === "%" || t === "0%") return zeroIsDash ? "--" : "0%";
    return t;
  }

  const n = _toNumberLoose(v);
  if (!Number.isFinite(n)) return "--";
  if (zeroIsDash && n === 0) return "--";

  // If caller passes 0-1 ratio, convert to percent. If already 0-100, keep.
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

// Small helper for fallbacks so panels don't explode on "missing" data
function safeArray(input) {
  if (!input) return [];

  // Already an array
  if (Array.isArray(input)) return input;

  // Common “wrapped” shapes: { rows: [...] } or { data: [...] }
  if (Array.isArray(input.rows)) return input.rows;
  if (Array.isArray(input.data)) return input.data;

  // Fallback: treat the single value as one row
  return [input];
}

// ===============================
// 🔀 Overlay helpers
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
  const raw =
    sim?.timestamp ||
    sim?.created_at ||
    sim?.run_id ||
    sim?.id ||
    "";

  const s = String(raw).trim();

  // Match patterns like:
  // 20260306_123314
  // BASELINE_HEALTHY_20260306_122636
  const m = s.match(/(\d{8})_(\d{6})/);

  if (m) {
    const d = m[1];
    const t = m[2];
    const dt = new Date(
      Number(d.slice(0, 4)),
      Number(d.slice(4, 6)) - 1,
      Number(d.slice(6, 8)),
      Number(t.slice(0, 2)),
      Number(t.slice(2, 4)),
      Number(t.slice(4, 6))
    );

    if (!Number.isNaN(dt.getTime())) {
      return `${idx + 1}. ${dt.toLocaleString()}`;
    }
  }

  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) {
    return `${idx + 1}. ${fallback.toLocaleString()}`;
  }

  return `${idx + 1}. Run ${idx + 1}`;
}

// Build chart datasets from CSV text for a given output type.
// We use flexible column detection to survive schema drift.
function buildOverlaySeriesFromCsvText(
  csvText,
  { outputType, selectedSkus, selectedFacility, runLabelPrefix, style = {} }
) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data || [];

  const getSku = (r) => r.sku ?? r.SKU ?? r.Sku ?? r.part ?? r.Part ?? r.item ?? r.Item;
  const getFacility = (r) =>
    r.facility ?? r.Facility ?? r.plant ?? r.Plant ?? r.site ?? r.Site;

  const getDate = (r) =>
    normalizeDate(r.date ?? r.Date ?? r.day ?? r.Day ?? r.timestamp ?? r.Timestamp);

  const getY = (r) => {
    const candidates = [
      r.value, r.Value,
      r.qty, r.Qty,
      r.quantity, r.Quantity,
      r.amount, r.Amount,
      r.inventory, r.Inventory,
      r.production, r.Production,
      r.flow, r.Flow,
      r.occurrence, r.Occurrence,
      r.on_hand, r.onHand,
      r["initial inventory"], r["Initial Inventory"],
    ];

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

  const skuSet =
    !selectedSkus || selectedSkus === "ALL"
      ? null
      : new Set(Array.isArray(selectedSkus) ? selectedSkus : [selectedSkus]);

  const facilityFilter =
    selectedFacility && selectedFacility !== "All / None Selected"
      ? String(selectedFacility).trim()
      : null;

  const map = new Map();

  for (const r of rows) {
    const sku = getSku(r);
    const fac = getFacility(r);
    const date = getDate(r);
    if (!sku || !date) continue;

    if (skuSet && !skuSet.has(String(sku).trim())) continue;
    if (facilityFilter && String(fac || "").trim() !== facilityFilter) continue;

    // For flow output, only count CUSTOMER_SHIP rows
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
  for (const skuMap of map.values()) {
    for (const d of skuMap.keys()) dateSet.add(d);
  }
  const labels = Array.from(dateSet).sort();

  const datasets = [];
  for (const [sku, skuMap] of map.entries()) {
    datasets.push({
      label: `${sku} — ${runLabelPrefix}`,
      data: labels.map((d) => skuMap.get(d) ?? 0),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
      ...style,
    });
  }

  return { labels, datasets };
}

// ======================================================================
// 📊 Disruption Panels (Impact, Projected, Runout Risk, Countermeasures)
// ======================================================================
function DisruptionPanels({
  disruptionImpactData,
  runoutRiskData,
  countermeasuresData,
  executiveKpis,
  hasNarrativeRun = false,
}) {
  const impactRows = safeArray(disruptionImpactData);
  const runoutRows = safeArray(runoutRiskData);
  const counterRows = safeArray(countermeasuresData);

  const exec = executiveKpis || {};
  const execOnTimePct = Number(exec.serviceLevelPct || 0);

  const execLateUnits = Number(exec.demandAtRiskUnits || 0);
  const execPeakBacklog = Number(exec.unfulfilledDemandUnits || 0);
  const execMissedServiceDays = Number(exec.missedServiceDays || 0);
  const execTtrDays = Number(exec.timeToRecoverDays || 0);
  const execTtsDays = Number(exec.timeToSurviveDays || 0);

  const totalEvents = impactRows.length;

  const facilitiesImpacted = new Set(
    impactRows
      .map((row) => row.facility || row.Facility)
      .filter((x) => typeof x === "string" && x.trim() !== "")
  ).size;

  const revenueExposureDisplayValue = (() => {
    const directRevenue = Number(
      exec?.revenueExposure ??
      exec?.estimatedRevenueExposure ??
      0
    );

    if (directRevenue > 0) return directRevenue;

    const unitsAtRisk = Number(exec?.demandAtRiskUnits ?? 0);
    return unitsAtRisk * 100;
  })();

  // Take the worst-case row per SKU/facility combo (lowest days_until_runout = highest risk)
  const uniqueRunoutRows = Array.from(
    runoutRows.reduce((map, r) => {
      const key = `${r.sku || r.SKU}__${r.facility || r.Facility}`;
      const existing = map.get(key);
      const days = Number(r.days_until_runout ?? 9999);
      const existingDays = existing ? Number(existing.days_until_runout ?? 9999) : 9999;
      if (!existing || days < existingDays) map.set(key, r);
      return map;
    }, new Map()).values()
  ).sort((a, b) => Number(a.days_until_runout ?? 9999) - Number(b.days_until_runout ?? 9999));

  const riskDistribution = uniqueRunoutRows.reduce(
    (acc, row) => {
      const level = (row.risk_level || row.riskLevel || "")
        .toString()
        .toLowerCase()
        .trim();
      if (level === "high") acc.high++;
      else if (level === "medium" || level === "med") acc.medium++;
      else if (level === "low") acc.low++;
      else acc.unknown++;
      return acc;
    },
    { high: 0, medium: 0, low: 0, unknown: 0 }
  );

  const firstImpactedFacility =
    impactRows[0]?.facility ||
    impactRows[0]?.Facility ||
    (impactRows[0] ? "First impacted facility" : "No disruptions recorded");

  const highRiskSkus = runoutRows
    .filter((r) => {
      const risk = (r.risk_level || r.RiskLevel || "")
        .toString()
        .toLowerCase();
      return risk.includes("high");
    })
    .map((r) => (r.sku || r.SKU || "Unknown SKU").toString().trim());

  const uniqueHighRiskSkus = [...new Set(highRiskSkus)];

  const uniqueRunoutRiskSkus = [
    ...new Set(
      runoutRows
        .map((r) => (r.sku || r.SKU || "").toString().trim())
        .filter(Boolean)
    ),
  ];

  const candidateActions = [];
  const seenActionKeys = new Set();

  for (const row of uniqueRunoutRows) {
    const sku = (row.sku || row.SKU || "Unknown SKU").toString().trim();
    const facility = (row.facility || row.Facility || "Unknown facility").toString().trim();
    const risk = (row.risk_level || row.RiskLevel || "Medium").toString().trim();
    const riskLower = risk.toLowerCase();

    let action = "Review mitigation plan";
    let expectedImpact = "Reduce runout risk";

    if (riskLower.includes("high")) {
      action = `Expedite supply for ${facility}`;
      expectedImpact = "Protect service";
    } else if (riskLower.includes("low")) {
      action = `Monitor and rebalance inventory at ${facility}`;
      expectedImpact = "Stabilize supply";
    } else {
      action = `Evaluate alternate sourcing for ${facility}`;
      expectedImpact = "Improve resilience";
    }

    const dedupeKey = `${sku}__${facility}__${action}`;
    if (seenActionKeys.has(dedupeKey)) continue;
    seenActionKeys.add(dedupeKey);

    candidateActions.push({
      sku,
      facility,
      risk,
      action,
      expectedImpact,
    });

    if (candidateActions.length >= 3) break;
  }

  const uniqueRecommendedActions = candidateActions.map((row) => row.action);

  return (
    <section className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div
        className="border rounded-2xl p-5 shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(6,37,26,0.96))",
          borderColor: "#173b30",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-3xl font-bold tracking-tight text-white font-semibold text-slate-50 flex items-center gap-2">
            <span style={{ color: "#FFB200" }}>🔎 Disruption Signals</span>
          </h3>
          <span className="text-xs text-slate-300">
            Powered by latest simulation run
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Service Degradation</p>
            <p className="text-3xl font-bold tracking-tight font-semibold">
  <span
    className={
      !hasNarrativeRun ? "text-slate-400"
        : execOnTimePct >= 99 ? "text-emerald-400"
        : execOnTimePct < 80 ? "text-red-400"
        : "text-yellow-400"
    }
  >
    {!hasNarrativeRun
      ? <span className="opacity-40">—</span>
      : execOnTimePct >= 99
      ? "None"
      : `-${(100 - execOnTimePct).toFixed(1)}pp`}
  </span>
</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Facilities Impacted</p>
            <p className="text-3xl font-bold tracking-tight text-white font-semibold text-slate-50">
              {facilitiesImpacted || 0}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Estimated Revenue Exposure</p>
            <p className="text-3xl font-bold tracking-tight text-white font-bold" style={{ color: "#9CF700" }}>
              {formatCurrencyCompact(revenueExposureDisplayValue, { zeroIsDash: false })}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">High-Risk SKUs</p>
            <p className="text-3xl font-bold tracking-tight text-white font-semibold text-rose-400">
              {uniqueHighRiskSkus.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              📍 First Impacted Facility
            </p>
            <p>{firstImpactedFacility}</p>
          </div>
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">📊 Severity Mix</p>
            <p>
              <span className="text-rose-400 font-semibold">High:</span>{" "}
              {riskDistribution.high} &nbsp;|&nbsp;
              <span className="text-amber-400 font-semibold">Med:</span>{" "}
              {riskDistribution.medium} &nbsp;|&nbsp;
              <span className="text-emerald-400 font-semibold">Low:</span>{" "}
              {riskDistribution.low} &nbsp;|&nbsp;
              <span className="text-slate-300 font-semibold">Unk:</span>{" "}
              {riskDistribution.unknown}
            </p>
          </div>
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              🎯 High-Risk SKUs (Examples)
            </p>
            {uniqueHighRiskSkus.length === 0 ? (
              <p className="text-slate-300">
                No high-risk SKUs in this scenario.
              </p>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {uniqueHighRiskSkus.slice(0, 3).map((sku) => (
                  <li key={sku}>{sku}</li>
                ))}
                {uniqueHighRiskSkus.length > 3 && (
                  <li className="text-slate-300">
                    +{uniqueHighRiskSkus.length - 3} more...
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div
        className="border rounded-2xl p-5 shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(7,54,38,0.96))",
          borderColor: "#173b30",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-3xl font-bold tracking-tight text-white font-semibold text-slate-50 flex items-center gap-2">
            <span className="text-emerald-300">
              🛡️ Material Risk & Actions
            </span>
          </h3>
          <span className="text-xs text-slate-300">Scenario-aware outputs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Facilities at Runout Risk</p>
            <p className="text-3xl font-bold tracking-tight text-white font-semibold text-rose-400">
              {uniqueRunoutRiskSkus.length}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Recommended Actions</p>
            <p className="text-3xl font-bold tracking-tight text-white font-semibold text-emerald-400">
              {uniqueRecommendedActions.length}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Service Level (On-Time)</p>
            <p className="text-3xl font-bold tracking-tight text-white font-semibold text-sky-400">
              {formatPercent(execOnTimePct, { zeroIsDash: false, digits: 1 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.35fr] gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              🔍 Highest Runout Risk (Top 3)
            </p>
            {uniqueRunoutRows.length === 0 ? (
              <p className="text-slate-300">No SKUs flagged for runout.</p>
            ) : (
              <ul className="space-y-2 leading-6">
                {uniqueRunoutRows.slice(0, 3).map((row, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">
                      {row.sku || row.SKU || "Unknown SKU"}
                    </span>{" "}
                    @ {row.facility || row.Facility || "Unknown facility"} —{" "}
                    <span className="text-rose-300">
                      {row.risk_level || row.RiskLevel || "High"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              ✅ Suggested Countermeasures (Examples)
            </p>
            {candidateActions.length === 0 ? (
              <p className="text-slate-300">
                No countermeasures generated yet for this scenario.
              </p>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {candidateActions.map((row, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{row.sku}</span>{" "}
                    <span className="text-slate-400">@ {row.facility}</span>:{" "}
                    {row.action}{" "}
                    <span className="text-emerald-300">
                      ({row.expectedImpact})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ======================================================================
// 🧪 Main Simulation Dashboard
// ======================================================================

function getDecisionKpiSeverity(key, value) {
  const n = Number(value || 0);

  switch (key) {
    case "onTimeFill":
      if (n >= 95) return "good";
      if (n >= 80) return "warning";
      return "critical";

    case "unitsAtRisk":
    case "peakBacklog":
      if (n <= 0) return "good";
      if (n <= 100) return "warning";
      return "critical";

    case "missedServiceDays":
      if (n <= 0) return "good";
      if (n <= 2) return "warning";
      return "critical";

    case "ttrDays":
      if (n <= 1) return "good";
      if (n <= 5) return "warning";
      return "critical";

    case "ttsDays":
      if (n <= 0) return "good";
      if (n <= 2) return "warning";
      return "critical";

    default:
      return "neutral";
  }
}

function getDecisionKpiStyles(severity) {
  switch (severity) {
    case "good":
      return {
        bg: "rgba(34,197,94,0.10)",
        border: "rgba(34,197,94,0.28)",
        value: "#166534",
        pillBg: "rgba(34,197,94,0.16)",
        pillText: "#166534",
      };

    case "warning":
      return {
        bg: "rgba(245,158,11,0.10)",
        border: "rgba(245,158,11,0.30)",
        value: "#92400e",
        pillBg: "rgba(245,158,11,0.16)",
        pillText: "#92400e",
      };

    case "critical":
      return {
        bg: "rgba(239,68,68,0.10)",
        border: "rgba(239,68,68,0.30)",
        value: "#991b1b",
        pillBg: "rgba(239,68,68,0.16)",
        pillText: "#991b1b",
      };

    default:
      return {
        bg: "rgba(148,163,184,0.10)",
        border: "rgba(148,163,184,0.24)",
        value: "#334155",
        pillBg: "rgba(148,163,184,0.16)",
        pillText: "#334155",
      };
  }
}

function getDecisionKpiIcon(key, severity) {
  if (severity === "critical") {
    switch (key) {
      case "onTimeFill":
        return "🚨";
      case "unitsAtRisk":
        return "⚠️";
      case "peakBacklog":
        return "📦";
      case "missedServiceDays":
        return "⛔";
      case "ttrDays":
        return "🛠️";
      case "ttsDays":
        return "🔍";
      default:
        return "⚠️";
    }
  }

  if (severity === "warning") {
    switch (key) {
      case "onTimeFill":
        return "🟠";
      case "unitsAtRisk":
        return "⚠️";
      case "peakBacklog":
        return "📦";
      case "missedServiceDays":
        return "📅";
      case "ttrDays":
        return "🧭";
      case "ttsDays":
        return "👀";
      default:
        return "🟠";
    }
  }

  return "✅";
}

function getDecisionKpiStatus(key, value) {
  const n = Number(value || 0);

  switch (key) {
    case "onTimeFill":
      if (n >= 95) return "Stable";
      if (n >= 80) return "Degrading";
      return "Service Risk";

    case "unitsAtRisk":
      if (n <= 0) return "Protected";
      if (n <= 100) return "Exposed";
      return "Critical";

    case "peakBacklog":
      if (n <= 0) return "Clear";
      if (n <= 100) return "Building";
      return "Severe";

    case "missedServiceDays":
      if (n <= 0) return "No Misses";
      if (n <= 2) return "Minor Miss";
      return "Customer Impact";

    case "ttrDays":
      if (n <= 1) return "Fast Recovery";
      if (n <= 5) return "Delayed";
      return "Slow Recovery";

    case "ttsDays":
      if (n <= 0) return "No Delay";
      if (n <= 2) return "Emerging";
      return "Vulnerable";

    default:
      return "Normal";
  }
}

function formatDecisionKpiValue(key, value) {
  const n = Number(value || 0);

  if (key === "onTimeFill") return `${n.toFixed(2)}%`;

  if (key === "ttrDays" || key === "ttsDays" || key === "missedServiceDays") {
    return `${n} day${n === 1 ? "" : "s"}`;
  }

  return n.toLocaleString();
}

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

  // 🔐 plan gating hooks (from App.jsx)
  userPlan,
  requirePro,
  openUpgradeGate,
}) {

  const API_BASE = import.meta?.env?.VITE_API_BASE || "https://supply-chain-simulator-v2.onrender.com";
  const [presentationMode, setPresentationMode] = useState(false);
  const [projectedSlider, setProjectedSlider] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [scenarioJustRan, setScenarioJustRan] = useState(false);
  const [baselineRunIndex, setBaselineRunIndex] = useState(null);
  const [compareRunIndex, setCompareRunIndex] = useState(null);
  const [runName, setRunName] = useState("");
  
  
  const runsPerPage = 5;

  const exec = executiveKpis || {};

  const execOnTimePct = Number(exec.serviceLevelPct || 0);
  const execLateUnits = Number(exec.demandAtRiskUnits || 0);
  const execPeakBacklog = Number(exec.unfulfilledDemandUnits || 0);
  const execMissedServiceDays = Number(exec.missedServiceDays || 0);
  const execTtrDays = Number(exec.timeToRecoverDays || 0);
  const execTtsDays = Number(exec.timeToSurviveDays || 0);
  const execRevenueExposure = Number(exec.revenueExposure || 0);

  const hasNarrativeRun =
    execOnTimePct > 0 ||
    execLateUnits > 0 ||
    execPeakBacklog > 0 ||
    execTtrDays > 0 ||
    execRevenueExposure > 0;

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
          body: JSON.stringify({
            scenario: runName || "Supply chain disruption scenario",
            kpis: {
              serviceLevelPct: execOnTimePct,
              peakBacklogUnits: execPeakBacklog,
              timeToRecoverDays: execTtrDays,
              timeToSurviveDays: execTtsDays,
              demandAtRiskUnits: execLateUnits,
              facilitiesImpacted: 0,
              revenueExposure: execRevenueExposure,
            }
          })
        });
        const data = await res.json();
        if (data.status === "success" && data.narrative) {
          // Strip markdown bold/italic formatting
          const clean = data.narrative
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/^#+\s/gm, "")
            .trim();
          setAiNarrative(clean);
        }
      } catch (e) {
        console.error("❌ AI narrative failed:", e);
      } finally {
        setAiNarrativeLoading(false);
      }
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
          body: JSON.stringify({
            lastScenario: runName || "Supply chain disruption scenario",
            kpis: {
              serviceLevelPct: execOnTimePct,
              timeToRecoverDays: execTtrDays,
            },
            liveIncidents: []
          })
        });
        const data = await res.json();
        if (data.status === "success" && data.scenarios?.length) {
          setSuggestedScenarios(data.scenarios);
        }
      } catch (e) {
        console.error("❌ Scenario suggestion failed:", e);
      } finally {
        setScenariosLoading(false);
      }
    };

    fetchSuggestedScenarios();
  }, [execOnTimePct, execTtrDays, hasNarrativeRun, runName]);

  const isHealthy = hasNarrativeRun && execOnTimePct >= 99;
  const narrativeEyebrowClass = !hasNarrativeRun
    ? "text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-1"
    : execOnTimePct >= 99
    ? "text-[11px] uppercase tracking-[0.22em] text-emerald-300/80 mb-1"
    : execOnTimePct >= 80
    ? "text-[11px] uppercase tracking-[0.22em] text-yellow-400/80 mb-1"
    : "text-[11px] uppercase tracking-[0.22em] text-red-300/80 mb-1";
  const narrativeHeadline = hasNarrativeRun
    ? isHealthy
      ? "✅ Network Operating Normally"
      : "⚠️ Service Breakdown Detected"
    : "Run a Scenario to Generate Impact";
  const narrativeSummary = hasNarrativeRun
    ? isHealthy
      ? "The supply network is performing at full capacity with no material disruptions detected."
      : `The network fulfilled demand but at a degraded service level of ${execOnTimePct.toFixed(1)}%. Backlog accumulated, recovery will take ${execTtrDays} days, and the network has ${execTtsDays} days of survival buffer remaining.`
    : "Run a simulation to generate a live narrative of service impact, backlog risk, and recovery pressure.";
  const narrativeStateLabel = hasNarrativeRun
    ? "Current State"
    : "Status";
  const narrativeStateValue = hasNarrativeRun
    ? isHealthy
      ? "Service Healthy"
      : "Service Under Stress"
    : "Awaiting Simulation";
  const narrativeWhyText = hasNarrativeRun
    ? isHealthy
      ? "All customer commitments are being met on time. Inventory levels are healthy and the network has sufficient buffer to absorb minor disruptions."
      : "Fulfillment masked the problem—service degradation introduced real risk, backlog, and recovery cost."
    : "This panel will translate simulation outputs into an executive-ready summary of what changed, why it matters, and what to do next.";
  // 🧠 Scenario State
  const [scenarioJson, setScenarioJson] = useState(null);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);

    // 🔀 Overlay state (compare 2 historical runs)
  const [overlayChartData, setOverlayChartData] = useState(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState(null);

  // 🧪 Ensure scenarioJson is initialized for saving/loading
  useEffect(() => {
    if (!scenarioJson) {
      setScenarioJson({});
    }
  }, []);

  // Keep scenarioJson always synced with scenarioData
  useEffect(() => {
    setScenarioJson((prev) => ({
      ...(prev || {}),
      ...scenarioData,
    }));
  }, [scenarioData]);

  useEffect(() => {
    console.log("🧩 SimulationDashboard loaded (with scenario transforms)");
  }, []);

  useEffect(() => {
    console.log("🧪 [SimulationDashboard] kpis prop:", kpis);
  }, [kpis]);

  // 📥 Load Saved Scenarios on Mount
  useEffect(() => {
    listScenarios()
      .then((res) => {
        const data = res.data;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.scenarios) ? data.scenarios : [];
        setSavedScenarios(arr);
      })
      .catch(() => console.warn("No scenarios found or fetch failed."));
  }, []);

  const liveServiceLevel = Number(
    exec?.serviceLevelPct ??
    0
  );

  const liveDemandAtRisk = Number(
    exec?.demandAtRiskUnits ??
    0
  );

  const liveUnfulfilledDemand = Number(
    exec?.unfulfilledDemandUnits ??
    kpis?.peakBacklog ??
    kpis?.serviceTruth?.peakBacklogUnits ??
    0
  );

  const liveMissedServiceDays = Number(
    kpis?.missedServiceDays ??
    kpis?.serviceTruth?.daysWithMissedService ??
    0
  );

  const liveTtrDays = Number(
    kpis?.ttrDays ??
    kpis?.timeToRecoverDays ??
    0
  );

  const liveRevenueExposure = Number(
    kpis?.estimatedRevenueExposure ??
    kpis?.revenueExposure ??
    0
  );

  const liveOccurrenceCount = Number(
    kpis?.occurrenceCount ??
    0
  );

  const liveNetworkHealthLabel =
    liveServiceLevel >= 90 && liveDemandAtRisk <= 0 && liveUnfulfilledDemand <= 0
      ? "🟢 Network Stable"
      : liveServiceLevel >= 70 && liveDemandAtRisk > 0
      ? "🟠 Network Under Stress"
      : "🔴 Service At Risk";

  const livePrimaryConstraint =
    liveUnfulfilledDemand > 0 ? "Unfulfilled Demand" : "Service Degradation";

  const liveImmediatePriority =
    liveUnfulfilledDemand > 0
      ? "Restore supply flow"
      : liveDemandAtRisk > 0
      ? "Stabilize service"
      : "Monitor performance";
    const isRunning = simulationStatus === "running";

  const statusLabel =
    simulationStatus === "idle"
      ? "Run Simulation"
      : simulationStatus === "running"
      ? "Running..."
      : simulationStatus === "done"
      ? "Run Again"
      : "Error — Retry";

  const outputTypes = [
    { value: "inventory", label: "Inventory Levels" },
    { value: "production", label: "Production Output" },
    { value: "flow", label: "Material Flow" },
    { value: "occurrence", label: "Disruption Occurrences" },
  ];

  // ✅ Normalize skuOptions so we never end up with label = {label,value} objects
  const multiSkuOptions = useMemo(() => {
    if (!Array.isArray(skuOptions)) return [];
    return skuOptions.map((item) => {
      // Already an object? Try to keep or normalize it.
      if (typeof item === "object" && item !== null) {
        if ("value" in item || "label" in item) {
          return {
            value:
              item.value ??
              item.sku ??
              item.SKU ??
              item.label ??
              String(item),
            label:
              item.label ??
              item.value ??
              item.sku ??
              item.SKU ??
              String(item),
          };
        }
        const val = item.sku ?? item.SKU ?? String(item);
        return { value: val, label: val };
      }

      // Plain string or number
      return { value: String(item), label: String(item) };
    });
  }, [skuOptions]);

  // --- SKU SELECT FIX ---
  const handleSkuChange = (options) => {
    if (!options || options.length === 0) {
      setSelectedSku("ALL");
      return;
    }
    // Store only string values in state
    const values = options.map((opt) => opt.value);
    setSelectedSku(values);
  };

  // --- Derived Resilience KPIs ---
const recoveryGap =
  Number(
    (typeof execTtrDays !== "undefined" && execTtrDays) ||
    kpis?.ttrDays ||
    kpis?.ttr ||
    0
  ) -
  Number(
    (typeof execTtsDays !== "undefined" && execTtsDays) ||
    kpis?.ttsDays ||
    kpis?.tts ||
    0
  );

const demandAtRiskUnits = Number(
  kpis?.peakBacklogUnits ||
  (typeof execDemandAtRisk !== "undefined" && execDemandAtRisk) ||
  (typeof execUnitsAtRisk !== "undefined" && execUnitsAtRisk) ||
  kpis?.demandAtRisk ||
  kpis?.unitsAtRisk ||
  0
);

const revenueAtRisk =
  demandAtRiskUnits * 100; // placeholder multiplier until unit-value mapping is wired

const avgInventoryForBuffer = Number(kpis?.avgInventory || 0);

  const revenueExposureDisplayValue = Number(
    revenueAtRisk ??
    kpis?.estimatedRevenueExposure ??
    kpis?.revenueExposure ??
    0
  );
const annualDemandForBuffer = Number(kpis?.totalDemand || 0);
const dailyDemandForBuffer =
  annualDemandForBuffer > 0 ? annualDemandForBuffer / 365 : 0;

const bufferCoverageDays =
  dailyDemandForBuffer > 0 ? avgInventoryForBuffer / dailyDemandForBuffer : 0;

const bufferRiskValue = Number(
  (execTtrDays || 0) - (bufferCoverageDays || 0)
);

const decisionKpis = [
  {
    key: "recoveryGap",
    label: "Recovery Gap",
    value: recoveryGap,
    subtitle: "Recovery is slower than disruption impact — service failure risk",
  },
  {
    key: "revenueAtRisk",
    label: "Revenue at Risk",
    value: revenueAtRisk,
    subtitle: "Estimated revenue exposure from demand at risk",
  },
  {
    key: "bufferRisk",
    label: "Buffer Risk",
    value: bufferCoverageDays,
    subtitle: bufferCoverageDays < (execTtrDays || 0)
  ? `Runs out ${(Number(execTtrDays || 0) - bufferCoverageDays).toFixed(1)} days before recovery`
  : `Buffer exceeds recovery by ${(bufferCoverageDays - Number(execTtrDays || 0)).toFixed(1)} days`,
  },

    {
      key: "onTimeFill",
      title: "On-Time Fill",
      subtitle: "Demand fulfilled on time",
      value: execOnTimePct ?? 0,
    },
    {
      key: "unitsAtRisk",
      title: "Units at Risk",
      subtitle: "Demand exposed to disruption pressure",
      value: execLateUnits ?? 0,
    },
    {
      key: "peakBacklog",
      title: "Peak Backlog",
      subtitle: "Maximum accumulated unmet demand",
      value: execPeakBacklog ?? 0,
    },
    {
      key: "missedServiceDays",
      title: "Missed Service Days",
      subtitle: "Days demand service was missed",
      value: execMissedServiceDays ?? 0,
    },
    {
      key: "ttrDays",
      title: "TTR",
      subtitle: "Time required to restore full production after disruption",
      value: execTtrDays ?? 0,
    },
    {
      key: "ttsDays",
      title: "TTS",
      subtitle: "Time until customer impact occurs without intervention",
      value: execTtsDays ?? 0,
    },
  ];

  const comparisonMetrics = [
    {
      label: "On-Time Fill",
      healthy: "100.00%",
      stressed: `${execOnTimePct.toFixed(2)}%`,
      delta: `${(execOnTimePct - 100).toFixed(2)}%`,
      direction: execOnTimePct < 100 ? "down" : "flat",
    },
    {
      label: "Units at Risk",
      healthy: "0",
      stressed: execLateUnits.toLocaleString(),
      delta: `+${!hasNarrativeRun ? <span className="opacity-40">—</span> : execLateUnits.toLocaleString()}`,
      direction: Number(execLateUnits ?? 0) > 0 ? "up" : "flat",
    },
    {
      label: "Peak Backlog",
      healthy: "0",
      stressed: execPeakBacklog.toLocaleString(),
      delta: `+${!hasNarrativeRun ? <span className="opacity-40">—</span> : execPeakBacklog.toLocaleString()}`,
      direction: Number(execPeakBacklog ?? 0) > 0 ? "up" : "flat",
    },
    {
      label: "Missed Service Days",
      healthy: "0",
      stressed: String(Number(execMissedServiceDays ?? 0)),
      delta: `+${Number(execMissedServiceDays ?? 0)}`,
      direction: Number(execMissedServiceDays ?? 0) > 0 ? "up" : "flat",
    },
    {
      label: "TTR",
      healthy: "0 days",
      stressed: `${execTtrDays} day${execTtrDays === 1 ? "" : "s"}`,
      delta: `+${execTtrDays} day${execTtrDays === 1 ? "" : "s"}`,
      direction: execTtrDays > 0 ? "up" : "flat",
    },
  ];

  const selectedSkuValue = useMemo(() => {
    if (!selectedSku || selectedSku === "ALL") return [];
    const values = Array.isArray(selectedSku) ? selectedSku : [selectedSku];
    // Map from values -> full option objects for react-select
    return multiSkuOptions.filter((opt) => values.includes(opt.value));
  }, [selectedSku, multiSkuOptions]);

  const handleOutputTypeChange = (option) => {
    setSelectedOutputType(option?.value || "inventory");
  };

  const isSimulationReady =
    files.demand &&
    files.disruptions &&
    files.locations &&
    files.processes &&
    files.bom &&
    files.locationMaterials;

  const isSimulateDisabled = !isSimulationReady || isRunning;

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#E8FFE8",
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.parsed.y ?? 0;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "yyyy-MM-dd",
          },
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
        },
        y: {
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },
        },
      },
    }),
    []
  );

  const isInventoryFlatline = useMemo(() => {
    if (selectedOutputType !== "inventory") return false;

    const datasets = chartData?.datasets || [];
    if (!datasets.length) return false;

    return datasets.every((ds) =>
      Array.isArray(ds.data) &&
      ds.data.every((v) => {
        const n = Number(v ?? 0);
        return Number.isFinite(n) && n === 0;
      })
    );
  }, [selectedOutputType, chartData]);

  const derivedChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData.datasets)) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = chartData.labels || [];
    const palette = ["#9CF700", "#3b82f6", "#FFB200", "#a855f7", "#14b8a6"];

    const datasets = chartData.datasets.map((ds, idx) => ({
      ...ds,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
      borderColor: ds.borderColor || palette[idx % palette.length],
      backgroundColor: "transparent",
    }));

    return { labels, datasets };
  }, [chartData]);

    // 🔀 Build overlay chart when two historical runs are selected
  useEffect(() => {
    const baselineIdx = baselineRunIndex;
    const compareIdx = compareRunIndex;

    // Reset overlay when not active
    if (
      baselineIdx === null ||
      baselineIdx === undefined ||
      compareIdx === null ||
      compareIdx === undefined ||
      baselineIdx === compareIdx ||
      !Array.isArray(simulationHistory) ||
      simulationHistory.length === 0
    ) {
      setOverlayChartData(null);
      setOverlayError(null);
      setOverlayLoading(false);
      return;
    }

    const baselineSim = simulationHistory[baselineIdx];
    const compareSim = simulationHistory[compareIdx];

    const baselineUrl = pickOutputUrlForType(baselineSim, selectedOutputType);
    const compareUrl = pickOutputUrlForType(compareSim, selectedOutputType);

    console.log("🔀 Overlay debug:", {
  baselineIdx,
  compareIdx,
  selectedOutputType,
  baselineUrl,
  compareUrl,
  sameUrl: baselineUrl === compareUrl,
});

    if (!baselineUrl || !compareUrl) {
      setOverlayChartData(null);
      setOverlayError("Missing output URL(s) for selected run(s).");
      setOverlayLoading(false);
      return;
    }

    let cancelled = false;

    async function buildOverlay() {
      try {
        setOverlayLoading(true);
        setOverlayError(null);

        const [baselineText, compareText] = await Promise.all([
  fetch(baselineUrl).then((r) => r.text()),
  fetch(compareUrl).then((r) => r.text()),
]);

if (cancelled) return;

// ✅ If user accidentally selected two runs that point to the same file,
// warn immediately (this is the #1 reason baseline/compare look identical)
if (baselineUrl === compareUrl) {
  setOverlayChartData(null);
  setOverlayError(
    "Baseline + Compare point to the same output file URL (identical data). Pick two different runs."
  );
  setOverlayLoading(false);
  return;
}

// 🎨 SKU color palette (high contrast on dark background)
const SKU_COLORS = [
  "#9CF700", // lime
  "#60A5FA", // blue
  "#F59E0B", // amber
  "#F472B6", // pink
  "#A78BFA", // purple
  "#34D399", // green
  "#FB7185", // rose
  "#22D3EE", // cyan
];

// Deterministic sku -> color mapping
function colorForSku(sku) {
  const s = String(sku || "").trim();
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SKU_COLORS[hash % SKU_COLORS.length];
}

const chainSkus = ["WIDGET_A", "CHIP", "WAFER"];

const base = buildOverlaySeriesFromCsvText(baselineText, {
  outputType: selectedOutputType,
  selectedSkus: chainSkus,
  selectedFacility,
  runLabelPrefix: formatRunLabel(baselineSim, baselineIdx),
});

const comp = buildOverlaySeriesFromCsvText(compareText, {
  outputType: selectedOutputType,
  selectedSkus: chainSkus,
  selectedFacility,
  runLabelPrefix: formatRunLabel(compareSim, compareIdx),
});

// Merge labels across both runs
const allLabels = Array.from(
  new Set([...(base.labels || []), ...(comp.labels || [])])
).sort();

// Re-align datasets to merged label axis + enforce color/dash rules:
// ✅ Run 1 (baseline) = solid
// ✅ Run 2 (compare) = dashed
const realignAndStyle = (series, mode) => {
  const labels = series.labels || [];
  return (series.datasets || []).map((ds) => {
    // label format: `${sku} — Run 1`
    const sku = String(ds.label || "").split("—")[0].trim();
    const col = colorForSku(sku);

    const map = new Map(labels.map((l, i) => [l, ds.data?.[i] ?? 0]));

    return {
      ...ds,
      data: allLabels.map((l) => map.get(l) ?? 0),

      // Force visible styling
      borderColor: col,
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,

      // Run styling
      borderDash: mode === "compare" ? [6, 4] : [],
    };
  });
};

const overlay = {
  labels: allLabels,
  datasets: [
    ...realignAndStyle(base, "baseline"), // solid
    ...realignAndStyle(comp, "compare"),  // dashed
  ],
};

setOverlayChartData(overlay);

      } catch (e) {
        console.error("❌ Overlay build failed:", e);
        setOverlayChartData(null);
        setOverlayError("Failed to build overlay (CSV fetch/parse error).");
      } finally {
        setOverlayLoading(false);
      }
    }

    buildOverlay();

    return () => {
      cancelled = true;
    };
  }, [
    baselineRunIndex,
    compareRunIndex,
    simulationHistory,
    selectedOutputType,
    selectedSku,
    selectedFacility,
  ]);

  const projectedSeries = useMemo(() => {
    const impactRows = safeArray(disruptionImpactData);
    if (!impactRows.length) return null;

    const groupedByDate = impactRows.reduce((acc, row) => {
      const date =
        row.date ||
        row.Date ||
        row.event_date ||
        row.EventDate ||
        "2025-01-01";
      const severityFactor =
        ((row.severity_score ?? row.SeverityScore) ?? 1) *
        (row.revenue_at_risk ?? row.RevenueAtRisk ?? 1);
      acc[date] = (acc[date] || 0) + severityFactor;
      return acc;
    }, {});

    const dates = Object.keys(groupedByDate).sort();
    const base = dates.map((d) => groupedByDate[d]);

    const factor = 1 + projectedSlider / 100;

    return {
      labels: dates,
      datasets: [
        {
          label: "Base Disruption Severity",
          data: base,
          borderColor: "#3b82f6",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
        },
        {
          label: `Projected (+${projectedSlider}%)`,
          data: base.map((v) => v * factor),
          borderColor: "#FFB200",
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    };
  }, [disruptionImpactData, projectedSlider]);

  const handleProjectedSliderChange = (e) => {
    const v = Number(e.target.value) || 0;
    setProjectedSlider(Math.max(0, Math.min(100, v)));
  };

  const handleRunSimulationWithScenario = async (scenarioOverride, runLabel) => {
  try {
    console.log("🧪 Applying scenario transforms before run...");

    // ✅ Always use authoritative scenario from props first,
    // then fall back to localStorage (legacy), then baseline {}
    const activeScenario = (() => {
      try {
        // Prefer props scenarioData (from App.jsx)
        if (
          scenarioData &&
          typeof scenarioData === "object" &&
          Object.keys(scenarioData).length > 0
        ) {
          return scenarioData;
        }

        // Fallback: localStorage (legacy support)
        const raw = localStorage.getItem("currentScenarioJSON");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn("⚠️ Scenario parse failed:", e);
      }
      return {};
    })();

    console.log("🧪 [Scenario Debug] activeScenario used:", activeScenario);

    // ==============================
    // 🔥 Shadow scenarioData SAFELY (block-scoped)
    // Everything below can keep using `scenarioData`
    // ==============================
    {
      const scenarioData = activeScenario;

    // -----------------------------
    // Helpers
    // -----------------------------
    const readFileAsText = (file) =>
      new Promise((resolve, reject) => {
        if (!file) return resolve("");
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result || "");
        reader.onerror = reject;
        reader.readAsText(file);
      });

    const isValidCsvText = (txt) => {
    if (txt === null || txt === undefined) return false;

    const t = String(txt).trim();
    if (!t) return false;

    // guard against accidental non-CSV payloads
    const lower = t.toLowerCase();
    if (lower === "null" || lower === "undefined") return false;
    if (t.startsWith("{") || t.startsWith("[")) return false;

    // Accept header-only CSVs (valid for “no rows”, e.g., empty disruptions)
    const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const firstLine = lines[0] || "";

    // must at least look like a CSV header
    return t.length > 5 && firstLine.includes(",");
  };

    const setFormFile = (fd, key, fileOrBlob, filename) => {
      // Prefer .set() to avoid duplicate keys (critical)
      if (typeof fd.set === "function") {
        fd.set(key, fileOrBlob, filename);
      } else {
        // fallback (older browsers)
        try {
          if (typeof fd.delete === "function") fd.delete(key);
        } catch (_) {}
        fd.append(key, fileOrBlob, filename);
      }
    };

   // -----------------------------
  // 0) Hard validation: required uploads
  // -----------------------------
  const required = [
    ["demand", files.demand],
    ["disruptions", files.disruptions],
    ["locations", files.locations],
    ["processes", files.processes],
    ["bom", files.bom],
    ["location_materials", files.locationMaterials],
  ];

  const missing = required.filter(([, f]) => !f).map(([k]) => k);
  if (missing.length) {
    alert(`Missing required file(s): ${missing.join(", ")}. Please re-upload and try again.`);
    return;
  }

  // -----------------------------
  // 1) Build FormData with RAW files first
  // -----------------------------
  const formData = new FormData();

  setFormFile(formData, "demand", files.demand, files.demand?.name || "demand.csv");
  setFormFile(
    formData,
    "disruptions",
    files.disruptions,
    files.disruptions?.name || "disruptions.csv"
  );
  setFormFile(
    formData,
    "locations",
    files.locations,
    files.locations?.name || "locations.csv"
  );
  setFormFile(
    formData,
    "processes",
    files.processes,
    files.processes?.name || "processes.csv"
  );
  setFormFile(formData, "bom", files.bom, files.bom?.name || "bom.csv");
  setFormFile(
    formData,
    "location_materials",
    files.locationMaterials,
    files.locationMaterials?.name || "location_materials.csv"
  );
  if (files.lanes) {
    setFormFile(formData, "lanes", files.lanes, files.lanes?.name || "lanes.csv");
  }

    // Debug: raw keys
    console.log(
      "🧾 [Scenario Run] Raw uploads:",
      Array.from(formData.entries()).map(([k, v]) => `${k} → ${v?.name || "blob"}`)
    );

    // -----------------------------
    // 2) Read originals for transforms
    // -----------------------------
    const originalDemandText = await readFileAsText(files.demand);
    const originalDisruptionsText = await readFileAsText(files.disruptions);
    const originalLocMaterialsText = await readFileAsText(files.locationMaterials);

    let transformedDemand = originalDemandText;
    let transformedDisruptions = originalDisruptionsText;
    console.log("🧪 [Scenario Debug] transformedDisruptions length:", String(transformedDisruptions || "").length);
    console.log("🧪 [Scenario Debug] transformedDisruptions preview:", String(transformedDisruptions || "").slice(0, 300));
    let transformedLocMaterials = originalLocMaterialsText;

    // -----------------------------
    // 3) Apply scenario transforms
    // -----------------------------
    if (isValidCsvText(originalDemandText) && scenarioData?.demandAdjustments?.length) {
      const parsed = Papa.parse(originalDemandText, { header: true, skipEmptyLines: true });
      const rows = parsed.data || [];

      scenarioData.demandAdjustments.forEach((adj) => {
        rows.forEach((row) => {
          const sku = row.sku || row.SKU;
          const facility = row.facility || row.Facility || row.plant || row.Plant;

          const matchesSku = !adj.sku || sku?.toString().trim() === adj.sku.trim();
          const matchesFacility =
            !adj.facility || facility?.toString().trim() === adj.facility.trim();

          if (matchesSku && matchesFacility) {
            const original = Number(row.demand || row.Demand || 0) || 0;
            const delta =
              adj.changeType === "absolute"
                ? Number(adj.value || 0)
                : (Number(adj.value || 0) / 100) * original;

            row.demand = original + delta;
          }
        });
      });

      transformedDemand = Papa.unparse(rows);
      console.log("✅ demand.csv transformed");
    }

    if (!scenarioData?.disruptionScenarios?.length) {
      try {
        const stored = localStorage.getItem("forc_active_scenario");
        if (stored) Object.assign(scenarioData, JSON.parse(stored));
        console.log("🔁 [ScenarioFallback] Loaded from localStorage:", scenarioData);
      } catch {}
    }

if (!scenarioData?.disruptionScenarios?.length) {
      try {
        const stored = localStorage.getItem("forc_active_scenario");
        if (stored) Object.assign(scenarioData, JSON.parse(stored));
        console.log("🔁 [ScenarioFallback] Loaded from localStorage:", scenarioData);
      } catch {}
    }

    if (scenarioData?.disruptionScenarios?.length) {
      const scenarioRows = scenarioData.disruptionScenarios.map((scenario) => ({
        start_date: scenario.startDate || scenario.start_date || "2025-01-01",
        end_date: scenario.endDate || scenario.end_date || "2025-01-10",
        facility: scenario.facility || "ScenarioFacility",
        severity:
          scenario.severity !== undefined && scenario.severity !== null && scenario.severity !== ""
            ? scenario.severity
            : 1.0,
        production_impact: scenario.production_impact !== undefined ? scenario.production_impact : scenario.severity,
        shipping_impact: scenario.shipping_impact !== undefined ? scenario.shipping_impact : 0.0,
      }));

      transformedDisruptions = Papa.unparse(scenarioRows, {
        columns: ["start_date", "end_date", "facility", "severity", "production_impact", "shipping_impact"],
      });

      console.log("✅ disruptions.csv replaced from Scenario Builder");
      try {
        const txt = String(transformedDisruptions || "");
        const lines = txt.split(/\r?\n/).filter(Boolean);
        console.log("🧪 [Verify] disruptions total lines:", lines.length);
        console.log("🧪 [Verify] disruptions header:", lines[0] || "(none)");
        console.log("🧪 [Verify] disruptions first row:", lines[1] || "(no rows written)");
      } catch (e) {
        console.warn("⚠️ [Verify] disruptions check failed:", e);
      }
    }

    if (
      isValidCsvText(originalLocMaterialsText) &&
      scenarioData?.inventoryPolicies?.length
    ) {
      const parsed = Papa.parse(originalLocMaterialsText, { header: true, skipEmptyLines: true });
      const rows = parsed.data || [];

      scenarioData.inventoryPolicies.forEach((policy) => {
        rows.forEach((row) => {
          const sku = row.sku || row.SKU;
          const facility = row.facility || row.Facility || row.plant || row.Plant;

          const matchesSku = !policy.sku || sku?.toString().trim() === policy.sku.trim();
          const matchesFacility =
            !policy.facility || facility?.toString().trim() === policy.facility.trim();

          if (matchesSku && matchesFacility) {
            if (policy.reorderPoint !== undefined) row.reorder_point = policy.reorderPoint;
            if (policy.safetyStock !== undefined) row.safety_stock = policy.safetyStock;
          }
        });
      });

      transformedLocMaterials = Papa.unparse(rows);
      console.log("✅ location_materials.csv transformed");
    }

    // -----------------------------
    // 4) Overwrite ONLY if transform produced a valid CSV
    // -----------------------------
    const overwriteCsvIfValid = (key, csvText, fallbackName) => {
    // ---------- INVALID CSV ----------
    if (!isValidCsvText(csvText)) {
      if (key === "disruptions") {
        console.log("🧪 [Verify] disruptions INVALID length:", String(csvText || "").length);
        console.log("🧪 [Verify] disruptions INVALID preview:", String(csvText || "").slice(0, 300));
      }

      console.warn(
        `⚠️ Skipping overwrite for "${key}" (transform produced empty/invalid CSV). Using raw uploaded file instead.`
      );
      return;
    }

    // ---------- VALID CSV (THIS IS WHAT WE CARE ABOUT) ----------
    if (key === "disruptions") {
      const t = String(csvText || "").trim();
      const lines = t.split(/\r?\n/);

      console.log("🧪 [Verify] disruptions total lines:", lines.length);
      console.log("🧪 [Verify] disruptions header:", lines[0]);
      console.log("🧪 [Verify] disruptions first row:", lines[1] || "(no rows written)");
    }

    const blob = new Blob([csvText], { type: "text/csv" });
    setFormFile(formData, key, blob, fallbackName);
  };

    overwriteCsvIfValid("demand", transformedDemand, files.demand?.name || "demand.csv");
    overwriteCsvIfValid("disruptions", transformedDisruptions, files.disruptions?.name || "disruptions.csv");
    overwriteCsvIfValid("location_materials", transformedLocMaterials, files.locationMaterials?.name || "location_materials.csv");

    // Debug: final keys
    console.log(
      "🧾 [Scenario Run] FormData:",
      Array.from(formData.entries()).map(([k, v]) => `${k} → ${v?.name || "blob"}`)
    );

    if (runLabel) formData.append("run_name", runLabel);
    await handleSubmit(formData);

    console.log("🎯 Scenario-applied run submitted.");}
  } catch (err) {
    console.error("❌ Error applying scenario before run:", err);
    alert("Scenario run failed. Check console + backend logs for details.");
  }
};

  const latestSimulation = simulationHistory?.[0];

  const totalHistoryPages = Math.max(
    1,
    Math.ceil((Array.isArray(simulationHistory) ? simulationHistory.length : 0) / runsPerPage)
  );

  const pagedSimulationHistory = (Array.isArray(simulationHistory) ? simulationHistory : []).slice(
    (historyPage - 1) * runsPerPage,
    historyPage * runsPerPage
  );

  return (
    <div
      className="min-h-screen text-slate-50 flex flex-col"
      style={{
        background:
          "radial-gradient(circle at top left, #0B3D2E 0, #020617 40%, #020617 100%)",
      }}
    >
      {/* Header */}
      <header
        className="border-b shadow-lg"
        style={{
          borderColor: "#0f2b22",
          background:
            "linear-gradient(90deg, #020617 0%, #0B3D2E 45%, #020617 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span style={{ color: "#9CF700" }}>FOR-C</span>
              <span className="text-slate-200">Simulation Dashboard</span>
            </h1>
            {!presentationMode && (
            <p className="text-sm text-slate-400 mt-1">
              Run digital twin scenarios, analyze disruption impact, and
              compare mitigation strategies.
            </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!presentationMode && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-full text-xs border transition text-slate-200 hover:text-white"
              style={{
                borderColor: "#1f3f33",
                backgroundColor: "rgba(2, 6, 23, 0.6)",
              }}
              onClick={() => switchView("control")}
            >
              ⬅ Back to Control Tower
            </button>
            )}
            <button
              type="button"
              onClick={() => setPresentationMode(p => !p)}
              className="px-3 py-1.5 rounded-full text-xs border transition font-semibold"
              style={{ borderColor: "#9CF700", color: "#9CF700", backgroundColor: "rgba(2, 6, 23, 0.6)" }}
            >
              {presentationMode ? "⬜ Exit Presentation" : "🖥 Presentation Mode"}
            </button>
            {!presentationMode && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-full text-xs border border-rose-500/80 text-rose-300 hover:bg-rose-500/10 transition"
            >
              Logout
            </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className={`flex-1 max-w-7xl mx-auto px-4 py-4 space-y-6 ${presentationMode ? "text-lg" : "text-sm"}`}>
                {/* Top row: map + inputs */}
        <section className={`grid grid-cols-1 gap-4 ${presentationMode ? "" : "lg:grid-cols-5"}`}>
{/* Map */}
          <div
            className={`${presentationMode ? "col-span-1" : "lg:col-span-3"} rounded-2xl p-4 shadow-xl border`}
            style={{
              background:
                "linear-gradient(135deg, rgba(5,25,20,0.98), rgba(7,46,34,0.98))",
              borderColor: "#123528",
            }}
          >
            
            
<div className="flex items-center justify-between mb-3">
  <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-50">
    <span style={{ color: "#9CF700" }}>🌐 Network Map</span>
  </h2>

  <div className="text-[11px] text-slate-400">
    Updated {new Date().toLocaleTimeString()}
  </div>
</div>

            <div className="h-[26rem] rounded-2xl overflow-hidden border border-slate-700/70 bg-slate-950/80 shadow-inner">
              <MapView
                locationsUrl={locationsUrl}
                selectedFacility={selectedFacility}
                onFacilityClick={handleFacilityClick}
              />
            </div>
          </div>

{/* Inputs + Run Button */}
{!presentationMode && (
<div
  className="lg:col-span-2 rounded-2xl p-4 border"
  style={{
    background:
      "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))",
    borderColor: "#143629",
  }}
>

  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-slate-50">
      📂 Simulation Inputs
    </h2>

    <button
      type="button"
      onClick={() => {
        ["demand", "disruptions", "locations", "processes", "bom", "locationMaterials"].forEach((key) =>
          handleFileChange(key, null)
        );
      }}
      className="px-2.5 py-1 rounded-md text-[11px] font-semibold border transition"
      style={{
        borderColor: "#355e52",
        color: "#E2E8F0",
        backgroundColor: "rgba(2, 6, 23, 0.45)",
      }}
    >
      Clear All
    </button>
  </div>

  <div className="divide-y divide-slate-700/40 text-xs">

    {[
      ["Demand", "demand"],
      ["Disruptions", "disruptions"],
      ["Locations", "locations"],
      ["Processes", "processes"],
      ["BOM", "bom"],
      ["Location Materials", "locationMaterials"],
      ["Lanes (Optional)", "lanes"]
    ].map(([label, key]) => (
      <div key={key} className="flex items-center justify-between py-2">

        <div className="flex flex-col">
          <span className="text-slate-200">{label}</span>
          <span
            className="text-[11px]"
            style={{
              color: files[key] ? "#9CF700" : "#94a3b8",
              fontWeight: files[key] ? "500" : "400"
            }}
          >
            {files[key] ? `✓ ${files[key].name}` : "No file selected"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <input
            key={`upload-${key}-${files[key]?.name || "empty"}`}
            id={`upload-${key}`}
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange(key, e.target.files[0])}
            className="hidden"
          />

          <label
            htmlFor={`upload-${key}`}
            className="cursor-pointer px-3 py-1 rounded-md text-[11px] border text-slate-200 hover:bg-slate-800/70 transition"
            style={{
              borderColor: "#355e52",
              backgroundColor: "rgba(2,6,23,0.55)",
            }}
          >
            Upload
          </label>

          {files[key] ? (
            <button
              type="button"
              onClick={() => handleFileChange(key, null)}
              className="h-7 w-7 rounded-md text-[12px] font-bold border transition"
              style={{
                borderColor: "rgba(248, 113, 113, 0.45)",
                color: "#fca5a5",
                backgroundColor: "rgba(127, 29, 29, 0.18)",
              }}
              title={`Clear ${label}`}
            >
              ×
            </button>
          ) : null}
        </div>

      </div>
    ))}

  </div>

  <input
    type="text"
    value={runName}
    onChange={(e) => setRunName(e.target.value)}
    placeholder="Name this run (e.g. Taiwan Blockade July)"
    className="mt-3 w-full px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
  />
  <button
    onClick={() => {
      const activeScenario =
        scenarioData && Object.keys(scenarioData).length > 0
          ? scenarioData
          : null;
      handleRunSimulationWithScenario(activeScenario, runName);
    }}
    disabled={isSimulateDisabled}
    className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition hover:bg-lime-400 active:scale-[0.98] transition-all duration-150"
    style={
      isSimulateDisabled
        ? {
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            color: "#64748b",
            cursor: "not-allowed",
          }
        : {
            background: "linear-gradient(90deg,#9CF700,#22c55e)",
            color: "#020617",
          }
    }
  >
    {statusLabel}
  </button>

  {!isSimulationReady && (
    <p className="text-[11px] text-amber-300 mt-2">
      ⚠ Upload all six required files before running the simulation.
    </p>
  )}

</div>
)}

        </section>

        {/* KPI row */}
        {false && (
<section className="grid grid-cols-1 gap-4">
{/* KPI Panel */}
          <div
            className="rounded-2xl p-4 flex flex-col border shadow-xl"
            style={{
              background:
                "linear-gradient(150deg, rgba(5,23,18,0.98), rgba(6,37,26,0.98))",
              borderColor: "#123528",
            }}
          >
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              📊 Operational Efficiency
            </h2>
            <div className="space-y-4 text-xs">
      <DecisionNarrativePanel
        kpis={kpis}
        baselineKpis={typeof baselineKpis !== "undefined" ? baselineKpis : null}
        materialRiskData={typeof materialRiskData !== "undefined" ? materialRiskData : []}
      />

              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                  Executive Signals
                </p>

                <div
                  className="rounded-2xl border p-3 mb-3"
                  style={{
                    background:
                      (Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(34,197,94,0.08)",
                    borderColor:
                      (Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                        ? "rgba(239,68,68,0.24)"
                        : "rgba(34,197,94,0.24)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                    Scenario Readout
                  </p>
                  <p className="text-sm text-slate-100 leading-relaxed">
                    {(Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                      ? `Service failure hidden behind 100% fulfillment. Only ${formatPercent(execOnTimePct, { zeroIsDash: false, digits: 1 })} of demand was met on time, with ${formatNumber(execLateUnits)} units delivered late and a ${formatNumber(execTtrDays || 0, { zeroIsDash: false })}-day recovery period.`
                      : "Network remained stable with no service misses, no backlog, and full on-time fulfillment."}
                  </p>
                </div>

                <div
                  className="rounded-2xl border p-3 mb-3"
                  style={{
                    background:
                      (Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(34,197,94,0.08)",
                    borderColor:
                      (Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                        ? "rgba(239,68,68,0.24)"
                        : "rgba(34,197,94,0.24)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                    Scenario Readout
                  </p>
                  <p className="text-sm text-slate-100 leading-relaxed">
                    {(Number(execPeakBacklog || 0) > 0 || execMissedServiceDays > 0)
                      ? `Service failure hidden behind 100% fulfillment. Only ${formatPercent(execOnTimePct, { zeroIsDash: false, digits: 1 })} of demand was met on time, with ${formatNumber(execLateUnits)} units delivered late and a ${formatNumber(execTtrDays || 0, { zeroIsDash: false })}-day recovery period.`
                      : "Network remained stable with no service misses, no backlog, and full on-time fulfillment."}
                  </p>
                </div>

                <div
                  className="rounded-2xl border p-3 mb-3"
                  style={{
                    background: "rgba(15,23,42,0.55)",
                    borderColor: "rgba(148,163,184,0.20)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <p className="text-[10px] uppercase tracking-wide text-slate-300">
                      Hidden Cost of Recovery
                    </p>
                    <p className="text-[10px] text-slate-400">
                      What your KPI dashboard misses
                    </p>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Revenue at Risk
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white font-semibold text-rose-300">
                        {formatCurrency(
                          revenueExposureDisplayValue,
                          { zeroIsDash: true, digits: 0 }
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Estimated exposure tied to missed or delayed fulfillment.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Units at Risk
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white font-semibold text-amber-300">
                        {!hasNarrativeRun ? <span className="opacity-40">—</span> : execLateUnits.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Demand exposed before the network stabilized.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Peak Backlog
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white font-semibold text-orange-300">
                        {!hasNarrativeRun ? <span className="opacity-40">—</span> : execPeakBacklog.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Maximum accumulated unmet demand during recovery.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Recovery Window
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white font-semibold text-violet-300">
                        {execTtrDays} day{execTtrDays === 1 ? "" : "s"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Time required to work back to operational stability.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                        Time to Survive
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-white font-semibold text-purple-300">
                        {execTtsDays} day{execTtsDays === 1 ? "" : "s"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Days of buffer before customer impact begins.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-100">
                    📊 What Changed vs Baseline
                  </h3>
                </div>

                <div
                  className="rounded-2xl border p-3 mb-3"
                  style={{
                    background: "rgba(2,6,23,0.45)",
                    borderColor: "rgba(148,163,184,0.20)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <p className="text-[10px] uppercase tracking-wide text-slate-300">
                      Healthy vs Stressed
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Immediate scenario delta
                    </p>
                    <div className="mt-3 text-sm text-slate-300">
                      <span className="font-semibold text-emerald-400">
                        On-Time: {formatPercent(execOnTimePct, { zeroIsDash: false, digits: 1 })}
                      </span>
                      {" | "}
                      <span className="font-semibold text-rose-400">
                        Late: {formatPercent(Math.max(0, 100 - execOnTimePct), { zeroIsDash: false, digits: 1 })}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[680px]">
                      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-slate-400 mb-2 px-1">
                        <div>Metric</div>
                        <div>Healthy</div>
                        <div>Stressed</div>
                        <div>Delta</div>
                      </div>

                      <div className="space-y-2">
                        {comparisonMetrics.map((row) => (
                          <div
                            key={row.label}
                            className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 items-center rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2"
                          >
                            <div className="text-sm font-medium text-slate-100">
                              {row.label}
                            </div>
                            <div className="text-sm text-emerald-300">
                              {row.healthy}
                            </div>
                            <div className="text-sm text-slate-100">
                              {row.stressed}
                            </div>
                            <div
                              className="text-sm font-semibold"
                              style={{
                                color:
                                  row.direction === "up"
                                    ? "#fca5a5"
                                    : row.direction === "down"
                                    ? "#fca5a5"
                                    : "#cbd5e1",
                              }}
                            >
                              {row.direction === "up"
                                ? `🔺 ${row.delta}`
                                : row.direction === "down"
                                ? `🔻 ${row.delta}`
                                : `➖ ${row.delta}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    ⚠️ Critical Risks & Required Actions
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {decisionKpis.map((item) => {
                    const executiveLabelMap = {
                      "On-Time Fill": "Service Level",
                      "Units at Risk": "Demand at Risk",
                      "Peak Backlog": "Unfulfilled Demand",
                      "Hidden Cost of Recovery": "Recovery Cost Exposure",
                      onTimeFill: "Service Level",
                      unitsAtRisk: "Demand at Risk",
                      peakBacklog: "Unfulfilled Demand",
                      missedServiceDays: "Missed Service Days",
                      ttr: "Time to Recover",
                      tts: "Time to Survive",
                      ttrTts: "Time to Recover / Survive",
                      hiddenCostOfRecovery: "Recovery Cost Exposure",
                      recoveryGap: "Recovery Gap",
                      revenueAtRisk: "Revenue at Risk",
                      bufferRisk: "Buffer Risk",
                    };

                    const executiveInsightMap = {
                      "On-Time Fill": "Protect service at the customer node",
                      "Units at Risk": "Expedite constrained components",
                      "Peak Backlog": "Reallocate production to reduce backlog",
                      "Missed Service Days": "Prioritize recovery at the bottleneck",
                      "TTR / TTS": "Shorten recovery at the critical constraint",
                      "Hidden Cost of Recovery": "Quantify cost required to protect service",
                      onTimeFill: "Protect service at the customer node",
                      unitsAtRisk: "Expedite constrained components",
                      peakBacklog: "Reallocate production to reduce backlog",
                      missedServiceDays: "Prioritize recovery at the bottleneck",
                      ttr: "Accelerate recovery at constrained production nodes",
                      tts: "Increase buffer to delay customer impact",
                      ttrTts: "Shorten recovery at the critical constraint",
                      hiddenCostOfRecovery: "Quantify cost required to protect service",
                      recoveryGap: "Recovery is slower than disruption impact",
                      revenueAtRisk: "Financial exposure from current disruption",
                      bufferRisk: "Structural gap: insufficient buffer or over-reliance on single-source supply",
                    };

                    const sourceLabel = item.label || item.title || item.name || item.key || "";

                    const executiveLabel = executiveLabelMap[sourceLabel] || sourceLabel;
                    const executiveInsight =
                      executiveInsightMap[sourceLabel] || "Prioritize mitigation at the primary constraint";

                    const severity = getDecisionKpiSeverity(item.key, item.value);
                    const styles = getDecisionKpiStyles(severity);
                    const icon = getDecisionKpiIcon(item.key, severity);

                    const pillBg =
                      item.key === "recoveryGap"
                        ? "rgba(239, 68, 68, 0.18)"
                        : item.key === "revenueAtRisk"
                        ? "rgba(251, 191, 36, 0.18)"
                        : item.key === "bufferRisk"
                        ? (Number(item.value) < Number(execTtrDays || 0)
                            ? "rgba(239, 68, 68, 0.18)"
                            : Number(item.value) < Number(execTtrDays || 0) * 1.5
                            ? "rgba(251, 191, 36, 0.18)"
                            : "rgba(52, 211, 153, 0.18)")
                        : styles.pillBg;

                    const pillText =
                      item.key === "recoveryGap"
                        ? "#fca5a5"
                        : item.key === "revenueAtRisk"
                        ? "#fcd34d"
                        : item.key === "bufferRisk"
                        ? (Number(item.value) < Number(execTtrDays || 0)
                            ? "#fca5a5"
                            : Number(item.value) < Number(execTtrDays || 0) * 1.5
                            ? "#fcd34d"
                            : "#86efac")
                        : styles.pillText;

                    const status =
                      item.key === "recoveryGap"
                        ? (Number(item.value) > 0 ? "Recovery Risk" : "Resilient")
                        : item.key === "revenueAtRisk"
                        ? (Number(item.value) > 0 ? "Revenue Exposure" : "Low Risk")
                        : item.key === "bufferRisk"
                        ? (Number(item.value) < Number(execTtrDays || 0)
                            ? "Buffer Failure"
                            : Number(item.value) < Number(execTtrDays || 0) * 1.5
                            ? "Thin Buffer"
                            : "Protected")
                        : getDecisionKpiStatus(item.key, item.value);

                    return (
                      <div
                        key={item.key}
                        className="rounded-xl p-3 border shadow-sm"
                        style={{
                          backgroundColor: styles.bg,
                          borderColor: styles.border,
                          boxShadow:
                            item.key === "unitsAtRisk" && severity === "critical"
                              ? "0 0 0 1px rgba(239,68,68,0.35), 0 0 12px rgba(239,68,68,0.25)"
                              : "none",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 mb-1">
                              {executiveLabel}
                            </p>
                            <p
                              className="text-3xl font-bold tracking-tight text-white font-semibold"
                              style={{
                              color:
                                item.key === "recoveryGap"
                                  ? (Number(item.value) > 0 ? "#f87171" : "#34d399")
                                  : item.key === "revenueAtRisk"
                                  ? "#fbbf24"
                                  : item.key === "bufferRisk"
                                  ? (Number(item.value) < Number(execTtrDays || 0)
                                      ? "#f87171"
                                      : Number(item.value) < Number(execTtrDays || 0) * 1.5
                                      ? "#fbbf24"
                                      : "#34d399")
                                  : styles.value
                            }}
                            >
                              {item.key === "recoveryGap"
        ? `${item.value > 0 ? "+" : ""}${item.value} day${Math.abs(item.value) === 1 ? "" : "s"}`
        : item.key === "revenueAtRisk"
        ? `$${Number(item.value) >= 1000
            ? (Number(item.value)/1000).toFixed(0) + "K"
            : Number(item.value)}`
        : item.key === "bufferRisk"
        ? `${bufferCoverageDays.toFixed(1)} days buffer`
        : formatDecisionKpiValue(item.key, item.value)}
                            </p>
                          </div>
                          <div className="text-3xl font-bold tracking-tight text-white leading-none">{icon}</div>
                        </div>

                        <p className="text-[12px] text-slate-200 mt-2 min-h-[28px]">
                          {item.subtitle}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold"
                            style={{
                              backgroundColor: pillBg,
                              color: pillText,
                            }}
                          >
                            {status}
                          </span>
                          <span className="text-[11px] text-slate-300 text-right max-w-[160px] leading-4">
                            {executiveInsight}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                  Efficiency Signals
                </p>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
                    <p className="text-slate-300 mb-1">Inventory Turns</p>
                    <p className="text-3xl font-bold tracking-tight text-white font-semibold text-sky-400">
                      {String(kpis?.inventoryTurns || "--x")}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">
                      Annualized throughput relative to average inventory.
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
                    <p className="text-slate-300 mb-1">Inventory Buffer</p>
                    <p className="text-3xl font-bold tracking-tight text-white font-semibold text-emerald-300">
                      {String(kpis?.inventoryBuffer || "--")}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">
                      Days of demand coverage from average inventory.
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
                    <p className="text-slate-300 mb-1">Total Production</p>
                    <p className="text-3xl font-bold tracking-tight text-white font-semibold text-cyan-300">
                      {formatNumber(kpis?.totalProduction, { zeroIsDash: false, digits: 0 })}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">
                      Aggregate units produced in selected scope.
                    </p>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-600 hover:border-emerald-400/70 hover:bg-slate-800/60 transition rounded-xl p-3">
                    <p className="text-slate-300 mb-1">Cost per Unit Shipped</p>
                    <p className="text-3xl font-bold tracking-tight text-white font-semibold text-amber-400">
                      {String(kpis?.costToServe || "--")}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">
                      Estimated logistics and service cost across flow rows.
                    </p>
                  </div>
                </div>
              </div>
            </div>

              <div className="mt-3 text-[10px] text-slate-300">
                <p>
                  <span
                    className="font-semibold"
                    style={{ color: "#9CF700" }}
                  >
                    Tip:
                  </span>{" "}
                  Use the SKU and output filters below to see how KPIs move by
                  product or output type.
                </p>
              </div>
            </div>
        </section>
)}

{/* ===== Scenario Impact Summary ============================== */}
  <section
    className="rounded-2xl p-5 shadow-xl border"
    style={{
      background: !hasNarrativeRun
        ? "linear-gradient(160deg, rgba(8,15,24,0.96), rgba(10,18,30,0.96))"
        : execOnTimePct >= 99
        ? "linear-gradient(160deg, rgba(4,24,12,0.96), rgba(6,30,16,0.96))"
        : execOnTimePct >= 80
        ? "linear-gradient(160deg, rgba(28,20,2,0.96), rgba(40,30,4,0.96))"
        : "linear-gradient(160deg, rgba(24,7,7,0.96), rgba(34,10,10,0.96))",
      borderColor: !hasNarrativeRun
        ? "rgba(71,85,105,0.55)"
        : execOnTimePct >= 99
        ? "rgba(20,100,50,0.65)"
        : execOnTimePct >= 80
        ? "rgba(202,138,4,0.65)"
        : "rgba(127,29,29,0.65)",
    }}
  >
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className={narrativeEyebrowClass}>
          Decision Narrative
        </p>
        <h3 className={`text-lg tracking-tight font-semibold shadow-2xl transition-all duration-500 ${
          !hasNarrativeRun
            ? "text-slate-200 border border-slate-700/60 ring-1 ring-slate-700/40"
            : execOnTimePct >= 99
            ? "text-emerald-200 border border-emerald-500/40 ring-1 ring-emerald-500/20"
            : execOnTimePct >= 80
            ? "text-yellow-200 border border-yellow-500/40 ring-1 ring-yellow-500/20"
            : "text-red-200 border border-red-500/40 ring-1 ring-red-500/20"
        } ${
          scenarioJustRan ? "ring-2 ring-lime-400/60 shadow-[0_0_25px_rgba(132,204,22,0.35)]" : ""
        } ${
          hasNarrativeRun && !isHealthy ? "animate-pulse" : ""
        }`}>
          {narrativeHeadline}
        </h3>
      </div>

      <div className="text-right">
        <p className={
          !hasNarrativeRun ? "text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-1" :
          execOnTimePct >= 99 ? "text-[11px] uppercase tracking-[0.22em] text-emerald-300/80 mb-1" :
          execOnTimePct >= 80 ? "text-[11px] uppercase tracking-[0.22em] text-yellow-400/80 mb-1" :
          "text-[11px] uppercase tracking-[0.22em] text-red-300/80 mb-1"
        }>
          {narrativeStateLabel}
        </p>
        <p className={
          !hasNarrativeRun ? "text-xs font-semibold text-slate-300" :
          execOnTimePct >= 99 ? "text-xs font-semibold text-emerald-300" :
          execOnTimePct >= 80 ? "text-xs font-semibold text-yellow-400" :
          "text-xs font-semibold text-red-400"
        }>
          {!hasNarrativeRun ? narrativeStateValue : execOnTimePct >= 99 ? "Stable" : execOnTimePct >= 80 ? "Under Stress" : "High Service Risk"}
        </p>
      </div>
    </div>

    <p className="text-sm leading-6 text-slate-200 mb-6">
      {aiNarrativeLoading
        ? "Generating executive narrative..."
        : aiNarrative || narrativeSummary}
    </p>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      <div
        className={
          isHealthy
            ? "rounded-xl border border-emerald-900/40 bg-black/20 p-3"
            : hasNarrativeRun && execOnTimePct >= 80
            ? "rounded-xl border border-amber-900/40 bg-black/20 p-3"
            : hasNarrativeRun
            ? "rounded-xl border border-red-900/40 bg-black/20 p-3"
            : "rounded-xl border border-slate-700/50 bg-black/20 p-3"
        }
      >
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Service Level
        </p>
        <p className="text-3xl font-bold tracking-tight font-semibold">
          {!hasNarrativeRun ? (
            <span className="opacity-40 text-slate-200">—</span>
          ) : (
            <span className="flex items-center gap-2">
              <span
                className={
                  execOnTimePct < 80
                    ? "text-red-400"
                    : execOnTimePct < 99
                    ? "text-yellow-400"
                    : "text-green-400"
                }
              >
                {execOnTimePct.toFixed(1)}%
              </span>
              <span className={execOnTimePct < 80 ? "text-[10px] text-red-400 opacity-80" : execOnTimePct < 99 ? "text-[10px] text-yellow-400 opacity-80" : "text-[10px] text-green-400 opacity-80"}>
                {execOnTimePct < 99 ? "▼" : "▲"}
              </span>
            </span>
          )}
        </p>
      </div>

      <div className={isHealthy ? "rounded-xl border border-emerald-900/40 bg-black/20 p-3" : hasNarrativeRun ? "rounded-xl border border-orange-900/40 bg-black/20 p-3" : "rounded-xl border border-slate-700/50 bg-black/20 p-3"}>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Demand at Risk</p>
        <p className={`text-3xl font-bold tracking-tight font-semibold ${isHealthy ? "text-emerald-300" : hasNarrativeRun ? "text-orange-300" : "text-slate-200"}`}>{!hasNarrativeRun ? <span className="opacity-40">—</span> : execLateUnits.toLocaleString()}</p>
      </div>

      <div className={isHealthy ? "rounded-xl border border-emerald-900/40 bg-black/20 p-3" : hasNarrativeRun ? "rounded-xl border border-amber-900/40 bg-black/20 p-3" : "rounded-xl border border-slate-700/50 bg-black/20 p-3"}>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Peak Backlog</p>
        <p className={`text-3xl font-bold tracking-tight font-semibold ${isHealthy ? "text-emerald-300" : hasNarrativeRun ? "text-amber-300" : "text-slate-200"}`}>{!hasNarrativeRun ? <span className="opacity-40">—</span> : execPeakBacklog.toLocaleString()}</p>
      </div>

      <div className={isHealthy ? "rounded-xl border border-emerald-900/40 bg-black/20 p-3" : hasNarrativeRun ? "rounded-xl border border-rose-900/40 bg-black/20 p-3" : "rounded-xl border border-slate-700/50 bg-black/20 p-3"}>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Time to Recover</p>
        <p className={`text-3xl font-bold tracking-tight font-semibold ${isHealthy ? "text-emerald-300" : hasNarrativeRun ? "text-rose-300" : "text-slate-200"}`}>{!hasNarrativeRun ? <span className="opacity-40">—</span> : execTtrDays + " days"}</p>
      </div>
      <div className={isHealthy ? "rounded-xl border border-emerald-900/40 bg-black/20 p-3" : hasNarrativeRun ? "rounded-xl border border-purple-900/40 bg-black/20 p-3" : "rounded-xl border border-slate-700/50 bg-black/20 p-3"}>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Time to Survive</p>
        <p className={`text-3xl font-bold tracking-tight font-semibold ${isHealthy ? "text-emerald-300" : hasNarrativeRun ? "text-purple-300" : "text-slate-200"}`}>{!hasNarrativeRun ? <span className="opacity-40">—</span> : execTtsDays + " days"}</p>
      </div>
    </div>


<div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 mb-6">
    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
      Why this matters
    </p>
    <p className="text-sm leading-6 text-slate-200">
      {narrativeWhyText}
    </p>
  </div>

  <div className={`rounded-xl border p-4 ${isHealthy ? "border-emerald-700/40 bg-emerald-950/20" : "border-emerald-900/35 bg-emerald-950/20"}`}>
    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90 mb-2">
      Recommended action
    </p>
    <ul className="space-y-2 text-sm text-slate-200">
      {isHealthy ? (
        <>
          <li>• Continue monitoring Taiwan Strait supplier concentration risk.</li>
          <li>• Validate buffer inventory levels ahead of Q3 demand peak.</li>
          <li>• Run blockade scenario to quantify latent exposure.</li>
        </>
      ) : (
        <>
          <li>• Prioritize the constrained component path immediately.</li>
          <li>• Protect customer-facing service before backlog accelerates.</li>
          <li>• Expedite the limiting supply node to reduce recovery time.</li>
        </>
      )}
    </ul>
  {(suggestedScenarios.length > 0 || scenariosLoading) && (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4 mt-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime-400/90 mb-3">
        🧪 Suggested Next Scenarios
      </p>
      {scenariosLoading ? (
        <p className="text-xs text-slate-400">Analyzing live feed data...</p>
      ) : (
        <div className="space-y-3">
          {suggestedScenarios.map((s, idx) => (
            <div key={idx} className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-semibold text-slate-100">{s.title}</p>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  Severity {Math.round(s.severity * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mb-1">{s.description}</p>
              <p className="text-[10px] text-lime-400/70 italic">{s.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>
</section>


{/* Scenario Builder */}
        <section className="grid grid-cols-1 gap-4">
          <div
            className="rounded-2xl p-4 border scenario-builder-panel"
            style={{
              background:
                "linear-gradient(140deg, rgba(4,24,18,0.98), rgba(5,36,26,0.98))",
              borderColor: "#143629",
            }}
          >
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              🧪 Scenario Builder
            </h2>
            <p className="text-xs text-slate-300 mb-3">
              Configure demand shocks, disruption injections, and inventory
              policies, then apply them to the next simulation run.
            </p>

            {scenarioData?.name && (
              <div
                className="mb-3 px-3 py-2 rounded-md text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(156, 247, 0, 0.08)",
                  border: "1px solid #9CF700",
                  color: "#9CF700",
                }}
              >
                🧪 Active Scenario: {scenarioData.name}
              </div>
            )}

            {scenarioData?.name && (
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      "Restore baseline? This will clear the active scenario."
                    )
                  )
                    return;
                  setScenarioData(null);
                  setScenarioJson(null);
                  setSelectedScenarioId("");
                  alert("🔄 Baseline restored! Scenario cleared.");
                }}
                className="mb-3 text-[11px] text-slate-300 hover:text-slate-100 underline"
              >
                🔄 Restore Baseline
              </button>
            )}

            
<div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mt-6">
  <div className="mb-6">
    <h2 className="text-3xl font-bold tracking-tight text-white font-semibold text-white">
      🎯 War Game the Scenario
    </h2>
    <p className="text-sm text-slate-400 mt-1">
      Apply disruptions, demand shocks, and policy changes to stress test your network.
    </p>
  </div>
  {/* REMOVED SNAPSHOT */}
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">

    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">Service Level</p>
      <p className="text-sm font-semibold text-green-400">
        {typeof kpis?.onTimeFulfillment === 'number' ? `${kpis.onTimeFulfillment.toFixed(1)}%` : '-'}
      </p>
    </div>

    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">Demand at Risk</p>
      <p className="text-sm font-semibold text-yellow-400">
        {kpis?.peakBacklogUnits ?? kpis?.unitsAtRisk ?? '-'}
      </p>
    </div>

    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">Revenue Exposure</p>
      <p className="text-sm font-semibold text-red-400">
        {formatCurrencyCompact(kpis?.revenueExposure ?? 0)}
      </p>
    </div>

    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">Peak Backlog</p>
      <p className="text-sm font-semibold text-orange-400">
        {kpis?.peakBacklog ?? '-'}
      </p>
    </div>
    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">TTR</p>
      <p className="text-sm font-semibold text-blue-400">
        {kpis?.timeToRecoverDays ?? '-'}d
      </p>
    </div>
    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">TTS</p>
      <p className="text-sm font-semibold text-purple-400">
        {kpis?.timeToSurviveDays ?? kpis?.ttsDays ?? '-'}d
      </p>
    </div>
    <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 text-center">
      <p className="text-xs text-slate-400">Status</p>
      <p className="text-sm font-semibold text-slate-300">
        {scenarioData?.name ? "Scenario Active" : "Baseline"}
      </p>
    </div>

  </div>
  {/* Before vs After Comparison */}
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
      const baseSvc = (() => {
        const raw = baseKpis?.onTimeFulfillment ?? baseKpis?.serviceLevelPct ?? baseKpis?.onTimeFill ?? 0;
        const n = typeof raw === "string" ? parseFloat(raw.replace(/[^0-9.]/g, "")) : Number(raw);
        return Number.isFinite(n) ? n : 0;
      })();
      const curSvc = Number(kpis?.onTimeFulfillment ?? 0);
      const svcDelta = curSvc - baseSvc;
      const baseRev = Number(baseKpis?.revenueExposure ?? baseKpis?.estimatedRevenueExposure ?? 0);
      const curRev = Number(kpis?.revenueExposure ?? 0);
      const revDelta = curRev - baseRev;
      const baseTtr = Number(baseKpis?.ttrDays ?? baseKpis?.timeToRecoverDays ?? 0);
      const curTtr = Number(kpis?.ttrDays ?? kpis?.timeToRecoverDays ?? 0);
      const ttrDelta = curTtr - baseTtr;
      const curBacklog = Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0);
      const baseBacklog = Number(baseKpis?.peakBacklogUnits ?? baseKpis?.peakBacklog ?? 0);
      const backlogDelta = curBacklog - baseBacklog;
      const curRisk = Number(kpis?.peakBacklogUnits ?? 0);
      const baseRisk = Number(baseKpis?.peakBacklogUnits ?? 0);
      const riskDelta = curRisk - baseRisk;
      const deltaColor = (val, lowerIsBetter = false) => { if (val === 0) return "text-slate-400"; return (lowerIsBetter ? val > 0 : val < 0) ? "text-red-400" : "text-emerald-400"; };
      const deltaSign = (val) => Number(val) > 0 ? `+${val}` : `${val}`;
      const impactLabel = !hasBaseline ? "Select baseline" : svcDelta < -10 ? "High Impact" : svcDelta < -3 ? "Moderate Impact" : svcDelta < 0 ? "Low Impact" : "No Impact";
      const impactColor = !hasBaseline ? "text-yellow-400" : svcDelta < -10 ? "text-red-400" : svcDelta < -3 ? "text-amber-400" : svcDelta < 0 ? "text-yellow-400" : "text-emerald-400";
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div>
            <p className="text-[10px] text-slate-400">Service</p>
            <p className="text-sm font-semibold text-slate-200">{curSvc > 0 ? `${curSvc.toFixed(1)}%` : '-'}</p>
            <p className={`text-xs font-semibold ${hasBaseline ? deltaColor(svcDelta) : "text-slate-500"}`}>{hasBaseline ? `${deltaSign(svcDelta.toFixed(1))}%` : "→ Select baseline"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Risk</p>
            <p className="text-sm font-semibold text-slate-200">{curRisk > 0 ? curRisk : '-'}</p>
            <p className={`text-xs font-semibold ${hasBaseline ? deltaColor(riskDelta, true) : "text-slate-500"}`}>{hasBaseline ? deltaSign(riskDelta) + " units" : "→ Select baseline"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Revenue</p>
            <p className="text-sm font-semibold text-slate-200">{formatCurrencyCompact(curRev)}</p>
            <p className={`text-xs font-semibold ${hasBaseline ? deltaColor(revDelta, true) : "text-slate-500"}`}>{hasBaseline ? (revDelta >= 0 ? `+${formatCurrencyCompact(revDelta)}` : formatCurrencyCompact(revDelta)) : "→ Select baseline"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Backlog</p>
            <p className="text-sm font-semibold text-slate-200">{curBacklog > 0 ? curBacklog : '-'}</p>
            <p className={`text-xs font-semibold ${hasBaseline ? deltaColor(backlogDelta, true) : "text-slate-500"}`}>{hasBaseline ? deltaSign(backlogDelta) + " units" : "→ Select baseline"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">TTR</p>
            <p className="text-sm font-semibold text-slate-200">{curTtr > 0 ? `${curTtr}d` : '-'}</p>
            <p className={`text-xs font-semibold ${hasBaseline ? deltaColor(ttrDelta, true) : "text-slate-500"}`}>{hasBaseline ? deltaSign(ttrDelta) + "d" : "→ Select baseline"}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Impact</p>
            <p className={`text-sm font-semibold ${impactColor}`}>{impactLabel}</p>
          </div>
        </div>
      );
    })()}
  </div>

  <ScenarioBuilder
    scenarioData={scenarioData}
    setScenarioData={setScenarioData}
    onRun={() => handleRunSimulationWithScenario(null, runName)}
    locationsFile={files.locations}
  />
</div>


            {/* 🧩 Scenario Status (applied via ScenarioBuilder) */}
            <div className="mt-3">
              {scenarioData?.name ? (
                <div
                  className="px-3 py-2 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: "rgba(156, 247, 0, 0.10)",
                    border: "1px solid #9CF700",
                    color: "#9CF700",
                  }}
                >
                  ✅ Scenario ready for next simulation run
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  No active scenario applied.
                </div>
              )}
            </div>

            {/* 💾 Scenario Save/Load Controls */}
            <div className="mt-4 flex flex-wrap gap-2 items-center text-xs">
              {/* 📌 Scenario Name */}
              <input
                type="text"
                placeholder="Scenario name..."
                value={scenarioJson?.name || ""}
                onChange={(e) =>
                  setScenarioJson((prev) => ({
                    ...(prev || {}),
                    name: e.target.value,
                  }))
                }
                className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-500"
                style={{ minWidth: "180px" }}
              />

              {/* 💾 Save Scenario */}
<button
  type="button"
  onClick={async () => {
    try {
      // Merge current builder state + local scenarioJson edits
      const finalData = {
        ...(scenarioData || {}),
        ...(scenarioJson || {}),
      };

      // Force name to be a string
      const name = String(finalData.name || "").trim();
      if (!name) {
        alert("Scenario must have a name.");
        return;
      }

      finalData.name = name;

      // Keep scenarioData in sync so transforms work on the next simulation
      setScenarioData(finalData);

      // ✅ IMPORTANT: match backend contract (same as your console test)
      // Backend expects: { name: string, data: object }
      await saveScenario({
        name,
        data: JSON.stringify(finalData),
      });

      alert("💾 Scenario Saved!");

      const res = await listScenarios();
      setSavedScenarios(res.data || []);
    } catch (err) {
      console.error("❌ Save scenario failed:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unknown error";
      alert(`Save failed: ${msg}`);
    }
  }}
  className="px-3 py-1.5 rounded-md font-semibold bg-emerald-500 hover:bg-emerald-400 shadow-md hover:shadow-xl transition hover:bg-emerald-400 text-slate-900"
>
  💾 Save
</button>

{/* 📂 Scenario Selector */}
<select
  value={selectedScenarioId || ""}
  onChange={(e) => setSelectedScenarioId(e.target.value)}
  className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200"
>
  <option value="">Saved...</option>
  {(savedScenarios || []).map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ))}
</select>

{/* 📥 Load Scenario */}
<button
  type="button"
  onClick={async () => {
    try {
      if (!selectedScenarioId) {
        alert("Select a scenario first.");
        return;
      }

      const res = await loadScenario(selectedScenarioId);

      // Your API may return:
      // - { name, data: "json-string" }
      // - OR the raw object
      const raw = res?.data || {};
      let loaded = raw;

      if (raw?.data && typeof raw.data === "string") {
        try {
          loaded = JSON.parse(raw.data);
        } catch {
          // if parsing fails, fall back to raw
          loaded = raw;
        }
      }

      setScenarioJson(loaded);
      setScenarioData(loaded);

      alert(`📥 Scenario "${loaded?.name || raw?.name || ""}" applied!`);
    } catch (err) {
      console.error("❌ Load scenario failed:", err);
      alert(
        "Load failed. Check console for details.\n\n" +
          (err?.response?.data?.message || err?.message || "")
      );
    }
  }}
  className="px-3 py-1.5 rounded-md font-semibold bg-blue-500 hover:bg-blue-400 text-slate-900"
>
  📥 Load
</button>

            </div>
          </div>
        </section>

{/* ===== Disruption Panels ====================================== */}
        <DisruptionPanels
          disruptionImpactData={disruptionImpactData}
          runoutRiskData={runoutRiskData}
            hasNarrativeRun={hasNarrativeRun}
          countermeasuresData={countermeasuresData}
          executiveKpis={{
            serviceLevelPct: Number(kpis?.serviceLevelPct ?? kpis?.onTimeFulfillment ?? 0),
            demandAtRiskUnits: Number(kpis?.peakBacklogUnits ?? kpis?.lateFulfilledUnits ?? kpis?.unitsAtRisk ?? 0),
            unfulfilledDemandUnits: Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0),
            missedServiceDays: Number(kpis?.missedServiceDays ?? 0),
            timeToRecoverDays: Number(kpis?.timeToRecoverDays ?? kpis?.ttrDays ?? 0),
            timeToSurviveDays: Number(kpis?.timeToSurviveDays ?? kpis?.ttsDays ?? 0),
            revenueExposure: Number(kpis?.revenueExposure ?? 0),
            estimatedRevenueExposure: Number(kpis?.estimatedRevenueExposure ?? 0),
          }}
        />{/* ===== Filters + Chart ======================================== */}
        <section
          className="rounded-2xl p-5 shadow-xl border simulation-chart-container"
          style={{
            background:
              "linear-gradient(160deg, rgba(4,22,17,0.98), rgba(4,27,21,0.98))",
            borderColor: "#123528",
          }}
        >
          {/* 🎨 Chart Text Bright Mint Fix */}
          <style>
            {`
              .simulation-chart-container .select__placeholder,
              .simulation-chart-container .select__single-value {
                color: #111827 !important;
                opacity: 1 !important;
                font-weight: 600 !important;
              }

              .simulation-chart-container canvas {
                color: #eafff4 !important;
              }

              .simulation-chart-container p,
              .simulation-chart-container h2,
              .simulation-chart-container h3 {
                color: #eafff4 !important;
              }
            `}
          </style>

          {(() => {
            const selectStyles = {
              control: (base) => ({
                ...base,
                backgroundColor: "#e5e7eb",
                borderColor: "#cbd5e1",
                color: "#111827",
                boxShadow: "none",
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: "#f8fafc",
                color: "#111827",
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? "#e2e8f0" : "#f8fafc",
                color: "#111827",
                cursor: "pointer",
              }),
              singleValue: (base) => ({
                ...base,
                color: "#111827",
                fontWeight: 600,
              }),
              placeholder: (base) => ({
                ...base,
                color: "#374151",
                opacity: 1,
                fontWeight: 500,
              }),
              input: (base) => ({
                ...base,
                color: "#111827",
              }),
              multiValue: (base) => ({
                ...base,
                backgroundColor: "#e5e7eb",
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: "#111827",
                fontWeight: 600,
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: "#6b7280",
              }),
            };

            return (
              <>
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-50">
                      <span style={{ color: "#9CF700" }}>
                        📈 Operational Performance Trends
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Explore how inventory, production, and service levels evolve across the network.
                    </p>
                    {selectedOutputType === "inventory" && isInventoryFlatline && (
                      <p className="text-xs mt-2" style={{ color: "#fbbf24" }}>
                        Inventory is not accumulating in this run — the chart is showing a true zero-buffer operating condition.
                      </p>
                    )}
                  </div>
                </div>

                {/* FILTERS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  {/* SKU */}
                  <div>
                    <p className="text-xs text-white font-semibold mb-1">Product (SKU)</p>
                    <Select
                      isMulti
                      options={multiSkuOptions}
                      onChange={handleSkuChange}
                      value={selectedSkuValue}
                      className="text-sm select"
                      classNamePrefix="select"
                      styles={selectStyles}
                    />
                  </div>

                  {/* Performance Metric */}
                  <div>
                    <p className="text-xs text-white font-semibold mb-1">Performance Metric</p>
                    <Select
                      options={outputTypes}
                      onChange={handleOutputTypeChange}
                      value={outputTypes.find(
                        (o) => o.value === selectedOutputType
                      )}
                      className="text-sm select"
                      classNamePrefix="select"
                      styles={selectStyles}
                    />
                  </div>

                  {/* Facility */}
                  <div>
                    <p className="text-xs text-white font-semibold mb-1">
                      Facility
                    </p>
                    <input
                      type="text"
                      className="w-full bg-slate-900/70 border border-slate-700 rounded-lg text-slate-200 text-sm px-2 py-1"
                      value={selectedFacility || "All / None Selected"}
                      disabled
                    />
                  </div>
                </div>

                {/* RUN COMPARISON SELECTORS */}
                <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-4 mb-6">
                  <h3 className="text-xs font-semibold text-slate-200 mb-2">
                    🔀 Compare Simulation Runs
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Baseline run */}
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1">
                        Baseline Run (Left)
                      </p>
                      <Select
                        options={(Array.isArray(simulationHistory) ? simulationHistory : []).map((s, idx) => ({
                          value: idx,
                          label: formatRunLabel(s, idx),
                        }))}
                        onChange={(opt) =>
                          setBaselineRunIndex(opt?.value ?? null)
                        }
                        className="text-sm select"
                        classNamePrefix="select"
                        styles={selectStyles}
                      />
                    </div>

                    {/* Comparison run */}
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1">
                        Comparison Run (Right)
                      </p>
                      <Select
                        options={(Array.isArray(simulationHistory) ? simulationHistory : []).map((s, idx) => ({
                          value: idx,
                          label: formatRunLabel(s, idx),
                        }))}
                        onChange={(opt) => setCompareRunIndex(opt?.value ?? null)}
                        className="text-sm select"
                        classNamePrefix="select"
                        styles={selectStyles}
                      />
                    </div>
                  </div>

                  {!overlayChartData && (
                  <div className="mt-3 flex items-start gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                    <span className="text-lg">💡</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Select any two simulation runs above to generate a side-by-side overlay comparison.
                    </p>
                  </div>
                )}
                </div>

                {/* CHART */}
                {selectedOutputType === "inventory" && isInventoryFlatline && (
                  <div
                    className="rounded-2xl border p-4 mb-6"
                    style={{
                      background: "rgba(245,158,11,0.10)",
                      borderColor: "rgba(245,158,11,0.30)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl font-bold tracking-tight text-white">⚠️</div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-amber-300 mb-1">
                          Zero Buffer Exposure
                        </p>
                        <p className="text-sm text-slate-100 leading-relaxed">
                          Inventory is flat at zero across the selected period. This usually means the network is operating with
                          no visible buffer, relying on immediate flow and perfect execution. In practice, that increases
                          sensitivity to even short disruptions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

<div className="relative h-80 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
  {/* 🔀 Overlay status */}
  {overlayLoading && (
    <div className="text-xs text-slate-300 mb-2">Building overlay chart…</div>
  )}

  {overlayError && (
    <div className="text-xs text-red-400 mb-2">{overlayError}</div>
  )}

  {/* 📈 Chart */}
  {(overlayChartData?.datasets?.length > 0 || derivedChartData?.datasets?.length > 0) ? (
    <Line
      data={overlayChartData?.datasets?.length ? overlayChartData : derivedChartData}
      options={chartOptions}
    />
  ) : (
    <div className="flex flex-col items-center justify-center py-10 gap-2"><span className="text-3xl">📊</span><p className="text-slate-400 text-sm font-semibold">No data to display</p><p className="text-slate-500 text-xs">Select a product and facility, then run a simulation to populate this chart.</p></div>
  )}
</div>
</>
);
})()}
</section>

        {/* ===== Projected Disruption Impact (Slider) =================== */}
        {false && (
<section
          className="rounded-2xl p-5 shadow-xl border"
          style={{
            background:
              "linear-gradient(160deg, rgba(4,24,18,0.98), rgba(6,32,24,0.98))",
            borderColor: "#123528",
          }}
        >
          <h2 className="text-sm font-semibold text-slate-50 mb-2">
            📉 Projected Disruption Impacts
          </h2>

          <p className="text-xs text-slate-300 mb-3">
            Adjust the slider to simulate increased disruption severity
            and view the projected impact trend.
          </p>

          <input
            type="range"
            min="0"
            max="100"
            value={projectedSlider}
            onChange={handleProjectedSliderChange}
            className="w-full accent-lime-300"
          />

          <p className="text-xs text-slate-300 mt-2">
            Severity Increase:{" "}
            <span className="text-slate-50 font-semibold">
              +{projectedSlider}%
            </span>
          </p>

          <div className="h-64 mt-4 bg-slate-950/60 rounded-xl border border-slate-800 p-3">
            {projectedSeries ? (
              <Line data={projectedSeries} options={chartOptions} />
            ) : (
              <p className="text-slate-300 text-xs">
                Not enough data to visualize projected impacts.
              </p>
            )}
          </div>
        </section>
)}

        {/* ===== Simulation History ==================================== */}
        <section
          className="rounded-2xl p-5 shadow-xl border mb-6"
          style={{
            background:
              "linear-gradient(170deg, rgba(4,24,18,0.98), rgba(4,28,21,0.98))",
            borderColor: "#123528",
          }}
        >
          <h2 className="text-sm font-semibold text-slate-50 mb-3">
            🗂 Simulation History
          </h2>
          <p className="text-xs text-slate-300 mb-6">
            Reload previous simulation output files and compare
            scenarios.
          </p>

          {(!Array.isArray(simulationHistory) || simulationHistory.length === 0) ? (
            <p className="text-xs text-slate-300">
              No past simulations yet.
            </p>
          ) : (
            <div className="space-y-4">
              {pagedSimulationHistory.map((sim, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300">
                      {formatRunLabel(sim, idx)}
                    </p>
                    <button
                      onClick={() => onReloadRun(sim)}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: "#9CF700" }}
                    >
                      🔄 Reload Results
                    </button>
                  </div>

                  {/* DOWNLOAD GRID */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
                    <a
                      href={sim.outputUrls?.flow_output_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline"
                    >
                      ➜ Flow CSV
                    </a>
                    <a
                      href={sim.outputUrls?.inventory_output_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline"
                    >
                      ➜ Inventory CSV
                    </a>
                    <a
                      href={sim.outputUrls?.production_output_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline"
                    >
                      ➜ Production CSV
                    </a>
                    <a
                      href={sim.outputUrls?.occurrence_output_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline"
                    >
                      ➜ Occurrence CSV
                    </a>

                    <a
                      href={
                        sim.outputUrls?.disruption_impact_output_file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-rose-300 hover:underline"
                    >
                      ⚡ Disruption Impact
                    </a>
                    <a
                      href={
                        sim.outputUrls?.projected_impact_output_file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 hover:underline"
                    >
                      🔮 Projected Impact
                    </a>
                    <a
                      href={
                        sim.outputUrls?.runout_risk_output_file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-red-300 hover:underline"
                    >
                      🛑 SKU Runout Risk
                    </a>
                    <a
                      href={
                        sim.outputUrls?.countermeasures_output_file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-300 hover:underline"
                    >
                      🛡️ Countermeasures
                    </a>

                    <a
                      href={sim.outputUrls?.locations_output_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-200 hover:underline"
                    >
                      📍 Locations CSV
                    </a>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                  style={{
                    borderColor: historyPage === 1 ? "rgba(71, 85, 105, 0.35)" : "#355e52",
                    color: historyPage === 1 ? "#64748b" : "#E2E8F0",
                    backgroundColor: "rgba(2, 6, 23, 0.45)",
                    cursor: historyPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ← Previous
                </button>

                <p className="text-xs text-slate-400">
                  Page {historyPage} of {totalHistoryPages}
                </p>

                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage === totalHistoryPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                  style={{
                    borderColor: historyPage === totalHistoryPages ? "rgba(71, 85, 105, 0.35)" : "#355e52",
                    color: historyPage === totalHistoryPages ? "#64748b" : "#E2E8F0",
                    backgroundColor: "rgba(2, 6, 23, 0.45)",
                    cursor: historyPage === totalHistoryPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
