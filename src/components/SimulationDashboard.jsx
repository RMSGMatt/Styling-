import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import ScenarioBuilder from "./ScenarioBuilder";
import { Line } from "react-chartjs-2";
import Select from "react-select";
import Papa from "papaparse";
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
  const u = sim?.outputUrls || {};
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
  kpis,
}) {
  const impactRows = safeArray(disruptionImpactData);
  const runoutRows = safeArray(runoutRiskData);
  const counterRows = safeArray(countermeasuresData);

  const totalEvents = impactRows.length;
  const facilitiesImpacted = new Set(
    impactRows
      .map((row) => row.facility || row.Facility)
      .filter((x) => typeof x === "string" && x.trim() !== "")
  ).size;

  // 🔥 Revenue at Risk (real revenue if present, otherwise proxy from severity_score × days_affected)
const totalRevenueAtRisk = impactRows.reduce((sum, row) => {
  // 1️⃣ Prefer explicit revenue fields if available
  let rawRevenue =
    row.revenue_at_risk ??
    row.RevenueAtRisk ??
    row.revenue ??
    row.Revenue ??
    null;

  let value;

  if (rawRevenue != null && rawRevenue !== "") {
    if (typeof rawRevenue === "string") {
      const cleaned = rawRevenue.replace(/[$,]/g, "");
      value = parseFloat(cleaned);
    } else {
      value = Number(rawRevenue);
    }
  }

  // 2️⃣ No revenue field? → derive proxy
  if (!Number.isFinite(value)) {
    const rawSeverity =
      row.severity_score ??
      row.SeverityScore ??
      row.severityScore ??
      null;
    const severity =
      typeof rawSeverity === "string"
        ? parseFloat(rawSeverity)
        : Number(rawSeverity);

    const rawDays =
      row.days_affected ??
      row.DaysAffected ??
      row.days ??
      null;
    const days =
      typeof rawDays === "string"
        ? parseFloat(rawDays)
        : Number(rawDays);

    // Baseline model: severity (0–100) × days × $10k
    const BASE_REVENUE_PER_DAY = 10_000;

    if (Number.isFinite(severity) && Number.isFinite(days)) {
      const severityFactor = Math.max(0, Math.min(1, severity / 100));
      value = severityFactor * days * BASE_REVENUE_PER_DAY;
    } else {
      value = 0;
    }
  }

  return sum + (Number.isFinite(value) ? value : 0);
}, 0);

// 3️⃣ Convert to millions for the UI tile
const revenueAtRiskMillions =
  Number.isFinite(totalRevenueAtRisk) && totalRevenueAtRisk > 0
    ? totalRevenueAtRisk / 1_000_000
    : 0;

  const riskDistribution = impactRows.reduce(
  (acc, row) => {
    // 1️⃣ Try explicit severity text first, if present
    let sev = (row.severity || row.Severity || "")
      .toString()
      .toLowerCase()
      .trim();

    // 2️⃣ If missing, derive from severity_score
    if (!sev) {
      const rawScore =
        row.severity_score ??
        row.SeverityScore ??
        row.severityScore ??
        null;

      const score =
        typeof rawScore === "string"
          ? parseFloat(rawScore)
          : Number(rawScore);

      if (Number.isFinite(score)) {
        if (score >= 70) sev = "high";
        else if (score >= 30) sev = "medium";
        else if (score >= 0) sev = "low";
      }
    }

    // Normalize allowed values
    if (sev === "high" || sev === "severe" || sev === "critical") sev = "high";
    else if (sev === "medium" || sev === "med") sev = "medium";
    else if (sev === "low") sev = "low";

    // 3️⃣ Bucket into High / Med / Low / Unknown
    if (sev === "high") acc.high++;
    else if (sev === "medium") acc.medium++;
    else if (sev === "low") acc.low++;
    else acc.unknown++;

    return acc;
  },
  { high: 0, medium: 0, low: 0, unknown: 0 }
);



  const firstImpactedFacility =
    impactRows[0]?.facility ||
    impactRows[0]?.Facility ||
    (impactRows[0] ? "First impacted facility" : "No disruptions recorded");

  // Runout / Countermeasures quick summaries
  const highRiskSkus = runoutRows
    .filter((r) => {
      const risk = (r.risk_level || r.RiskLevel || "")
        .toString()
        .toLowerCase();
      return risk.includes("high");
    })
    .map((r) => r.sku || r.SKU || "Unknown SKU");

  const uniqueHighRiskSkus = [...new Set(highRiskSkus)];

  const candidateActions = counterRows.slice(0, 3).map((row) => ({
    sku: row.sku || row.SKU || "Unknown SKU",
    action:
      row.recommended_action || row.Action || "Review mitigation plan",
    expectedImpact:
      row.expected_impact || row.ExpectedImpact || "Stabilize supply",
  }));

  return (
    <section className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Disruption Impact & Projected Impact */}
      <div
        className="border rounded-2xl p-5 shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(6,37,26,0.96))",
          borderColor: "#173b30",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <span style={{ color: "#FFB200" }}>⚡ Disruption Impact Analysis</span>
          </h3>
          <span className="text-xs text-slate-300">
            Powered by latest simulation run
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">Disruption Events</p>
            <p className="text-xl font-semibold text-slate-50">
              {totalEvents || 0}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">Facilities Impacted</p>
            <p className="text-xl font-semibold text-slate-50">
              {facilitiesImpacted || 0}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">Revenue at Risk</p>
            <p
              className="text-xl font-semibold"
              style={{ color: "#9CF700" }}
            >
              {revenueAtRiskMillions > 0
                ? `$${revenueAtRiskMillions.toFixed(1)}M`
                : "$0.0M"}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">High-Risk SKUs</p>
            <p className="text-xl font-semibold text-rose-400">
              {uniqueHighRiskSkus.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/40 border border-slate-700/80 rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              📍 First Impacted Facility
            </p>
            <p>{firstImpactedFacility}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/80 rounded-xl p-3">
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
          <div className="bg-slate-900/40 border border-slate-700/80 rounded-xl p-3">
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

      {/* Right: Runout Risk & Countermeasures */}
      <div
        className="border rounded-2xl p-5 shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(3,18,14,0.96), rgba(7,54,38,0.96))",
          borderColor: "#173b30",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <span className="text-emerald-300">
              🛡️ Runout Risk & Countermeasures
            </span>
          </h3>
          <span className="text-xs text-slate-300">Scenario-aware outputs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">SKUs at Runout Risk</p>
            <p className="text-xl font-semibold text-rose-400">
              {runoutRows.length}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">Countermeasure Actions</p>
            <p className="text-xl font-semibold text-emerald-400">
              {counterRows.length}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
            <p className="text-xs text-slate-300">On-Time Fulfillment</p>
            <p className="text-xl font-semibold text-sky-400">
              {kpis?.onTimeFulfillment ?? "--"}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900/40 border border-slate-700/80 rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              🔍 Highest Runout Risk (Top 3)
            </p>
            {runoutRows.length === 0 ? (
              <p className="text-slate-300">No SKUs flagged for runout.</p>
            ) : (
              <ul className="space-y-1">
                {runoutRows.slice(0, 3).map((row, idx) => (
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

          <div className="bg-slate-900/40 border border-slate-700/80 rounded-xl p-3">
            <p className="font-semibold mb-2 text-slate-50">
              ✅ Suggested Countermeasures (Examples)
            </p>
            {candidateActions.length === 0 ? (
              <p className="text-slate-300">
                No countermeasures generated yet for this scenario.
              </p>
            ) : (
              <ul className="space-y-1">
                {candidateActions.map((row, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{row.sku}</span>:{" "}
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
  simulationHistory,
  files,
  kpis,
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

  const [projectedSlider, setProjectedSlider] = useState(0);
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

  // 📥 Load Saved Scenarios on Mount
  useEffect(() => {
    listScenarios()
      .then((res) => setSavedScenarios(res.data))
      .catch(() => console.warn("No scenarios found or fetch failed."));
  }, []);

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
    const baselineIdx = scenarioData?.baselineRunIndex;
    const compareIdx = scenarioData?.compareRunIndex;

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

const base = buildOverlaySeriesFromCsvText(baselineText, {
  outputType: selectedOutputType,
  selectedSkus: selectedSku,
  selectedFacility,
  runLabelPrefix: "Run 1",
});

const comp = buildOverlaySeriesFromCsvText(compareText, {
  outputType: selectedOutputType,
  selectedSkus: selectedSku,
  selectedFacility,
  runLabelPrefix: "Run 2",
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
    scenarioData?.baselineRunIndex,
    scenarioData?.compareRunIndex,
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

  const handleRunSimulationWithScenario = async () => {
  try {
    console.log("🧪 Applying scenario transforms before run...");

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
      if (!txt) return false;
      const t = String(txt).trim();
      // must have at least one newline and at least one comma in header
      const firstLine = t.split(/\r?\n/)[0] || "";
      return t.length > 5 && t.includes("\n") && firstLine.includes(",");
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

    if (
      isValidCsvText(originalDisruptionsText) &&
      scenarioData?.disruptionScenarios?.length
    ) {
      const parsed = Papa.parse(originalDisruptionsText, { header: true, skipEmptyLines: true });
      const rows = parsed.data || [];

      scenarioData.disruptionScenarios.forEach((scenario) => {
        rows.push({
          sku: scenario.sku || "SCENARIO_SKU",
          facility: scenario.facility || "ScenarioFacility",
          start_date: scenario.startDate || "2025-01-01",
          end_date: scenario.endDate || "2025-01-10",
          severity: scenario.severity || "High",
          type: scenario.type || "ScenarioInjection",
        });
      });

      transformedDisruptions = Papa.unparse(rows);
      console.log("✅ disruptions.csv appended");
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
      if (!isValidCsvText(csvText)) {
        console.warn(
          `⚠️ Skipping overwrite for "${key}" (transform produced empty/invalid CSV). Using raw uploaded file instead.`
        );
        return;
      }
      const blob = new Blob([csvText], { type: "text/csv" });
      setFormFile(formData, key, blob, fallbackName);
    };

    overwriteCsvIfValid("demand", transformedDemand, files.demand?.name || "demand.csv");
    overwriteCsvIfValid(
      "disruptions",
      transformedDisruptions,
      files.disruptions?.name || "disruptions.csv"
    );
    overwriteCsvIfValid(
      "location_materials",
      transformedLocMaterials,
      files.locationMaterials?.name || "location_materials.csv"
    );

    // Debug: final keys
    console.log(
      "🧾 [Scenario Run] FormData:",
      Array.from(formData.entries()).map(([k, v]) => `${k} → ${v?.name || "blob"}`)
    );

    await handleSubmit(formData);

    console.log("🎯 Scenario-applied run submitted.");
  } catch (err) {
    console.error("❌ Error applying scenario before run:", err);
    alert("Scenario run failed. Check console + backend logs for details.");
  }
};

  const latestSimulation = simulationHistory?.[0];

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
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <span style={{ color: "#9CF700" }}>FOR-C</span>
              <span className="text-slate-200">Simulation Dashboard</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Run digital twin scenarios, analyze disruption impact, and
              compare mitigation strategies.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-full text-xs border border-rose-500/80 text-rose-300 hover:bg-rose-500/10 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-4 space-y-6">
        {/* Top row: map + KPI panel */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Map */}
          <div
            className="lg:col-span-3 rounded-2xl p-4 shadow-xl border"
            style={{
              background:
                "linear-gradient(135deg, rgba(5,25,20,0.98), rgba(7,46,34,0.98))",
              borderColor: "#123528",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-50">
                <span style={{ color: "#9CF700" }}>🌐 Network Map</span>
                <span className="text-xs text-slate-300">
                  Facilities & live incident overlays
                </span>
              </h2>
            </div>
            <div className="h-64 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/60">
              <MapView
                locationsUrl={locationsUrl}
                selectedFacility={selectedFacility}
                onFacilityClick={handleFacilityClick}
              />
            </div>
          </div>

          {/* KPI Panel */}
          <div
            className="lg:col-span-2 rounded-2xl p-4 flex flex-col border shadow-xl"
            style={{
              background:
                "linear-gradient(150deg, rgba(5,23,18,0.98), rgba(6,37,26,0.98))",
              borderColor: "#123528",
            }}
          >
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              🚀 Simulation KPIs (Current View)
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
                <p className="text-slate-300 mb-1">On-Time Fulfillment</p>
                <p
                  className="text-lg font-semibold"
                  style={{ color: "#9CF700" }}
                >
                  {kpis?.onTimeFulfillment ?? "--"}%
                </p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Share of demand met on requested date.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
                <p className="text-slate-300 mb-1">Inventory Turns</p>
                <p className="text-lg font-semibold text-sky-400">
                  {kpis?.inventoryTurns ?? "--"}x
                </p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Average annualized turns for selected scope.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
                <p className="text-slate-300 mb-1">Backorder Rate</p>
                <p className="text-lg font-semibold text-rose-400">
                  {kpis?.backorderRate ?? "--"}%
                </p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Portion of demand missed or delayed.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-3">
                <p className="text-slate-300 mb-1">Expedite Cost</p>
                <p className="text-lg font-semibold text-amber-400">
                  {kpis?.expediteCost
                    ? `$${kpis.expediteCost.toLocaleString()}`
                    : "--"}
                </p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Incremental cost from mitigation actions.
                </p>
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

        {/* Scenario and Inputs */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Scenario Builder */}
          <div
            className="lg:col-span-2 rounded-2xl p-4 border scenario-builder-panel"
            style={{
              background:
                "linear-gradient(140deg, rgba(4,24,18,0.98), rgba(5,36,26,0.98))",
              borderColor: "#143629",
            }}
          >
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              🧪 Scenario Builder (Phase 1A)
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

            <ScenarioBuilder
              scenarioData={scenarioData}
              setScenarioData={setScenarioData}
            />

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
  className="px-3 py-1.5 rounded-md font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-900"
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

          {/* Inputs + Run Button */}
          <div
            className="rounded-2xl p-4 flex flex-col border"
            style={{
              background:
                "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))",
              borderColor: "#143629",
            }}
          >
            <h2 className="text-sm font-semibold text-slate-50 mb-2">
              📂 Simulation Inputs
            </h2>
            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <p className="text-slate-300 mb-1">Demand (CSV)</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange("demand", e.target.files[0])
                  }
                  className="text-slate-300 text-xs"
                />
              </div>

              <div>
                <p className="text-slate-300 mb-1">Disruptions (CSV)</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange("disruptions", e.target.files[0])
                  }
                  className="text-slate-300 text-xs"
                />
              </div>

              <div>
                <p className="text-slate-300 mb-1">Locations (CSV)</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange("locations", e.target.files[0])
                  }
                  className="text-slate-300 text-xs"
                />
              </div>

              <div>
                <p className="text-slate-300 mb-1">Processes (CSV)</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange("processes", e.target.files[0])
                  }
                  className="text-slate-300 text-xs"
                />
              </div>

              <div>
                <p className="text-slate-300 mb-1">BOM (CSV)</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange("bom", e.target.files[0])
                  }
                  className="text-slate-300 text-xs"
                />
              </div>

              <div>
                <p className="text-slate-300 mb-1">
                  Location Materials (CSV)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    handleFileChange(
                      "locationMaterials",
                      e.target.files[0]
                    )
                  }
                  className="text-slate-300 text-xs"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const activeScenario =
                  scenarioData && Object.keys(scenarioData).length > 0
                    ? scenarioData
                    : null;
                // We ignore the arg and just rely on scenarioData in closure,
                // but this keeps your intent explicit.
                handleRunSimulationWithScenario(activeScenario);
              }}
              disabled={isSimulateDisabled}
              className="mt-4 w-full py-2 rounded-xl text-sm font-semibold transition shadow-md"
              style={
                isSimulateDisabled
                  ? {
                      backgroundColor: "rgba(15, 23, 42, 0.8)",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }
                  : {
                      background:
                        "linear-gradient(90deg, #9CF700, #22c55e)",
                      color: "#020617",
                    }
              }
            >
              {statusLabel}
            </button>

            {!isSimulationReady && (
              <p className="text-[11px] text-rose-400 mt-2">
                ⚠️ All six input files must be uploaded before simulation.
              </p>
            )}
          </div>
        </section>

        {/* ===== Disruption Panels ====================================== */}
        <DisruptionPanels
          disruptionImpactData={disruptionImpactData}
          runoutRiskData={runoutRiskData}
          countermeasuresData={countermeasuresData}
          kpis={kpis}
        />

        {/* ===== Filters + Chart ======================================== */}
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
                color: #e8ffe8 !important;
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
              menu: (base) => ({
                ...base,
                backgroundColor: "rgba(10,30,24,0.95)",
                color: "#eafff4",
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused
                  ? "rgba(156, 247, 0, 0.20)"
                  : "rgba(10,30,24,0.95)",
                color: "#eafff4",
                cursor: "pointer",
              }),
              singleValue: (base) => ({
                ...base,
                color: "#eafff4",
              }),
              placeholder: (base) => ({
                ...base,
                color: "#c0ffd8",
              }),
              input: (base) => ({
                ...base,
                color: "#eafff4",
              }),
            };

            return (
              <>
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-50">
                      <span style={{ color: "#9CF700" }}>
                        📈 Simulation Output Chart
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Filter by SKU, Output Type, and Facility.
                    </p>
                  </div>
                </div>

                {/* FILTERS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {/* SKU */}
                  <div>
                    <p className="text-xs text-slate-300 mb-1">Select SKUs</p>
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

                  {/* Output Type */}
                  <div>
                    <p className="text-xs text-slate-300 mb-1">Output Type</p>
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
                    <p className="text-xs text-slate-300 mb-1">
                      Selected Facility
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
                <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-slate-200 mb-2">
                    🔀 Compare Simulation Runs (Overlay Mode)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Baseline run */}
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1">
                        Baseline Run (Left)
                      </p>
                      <Select
                        options={simulationHistory.map((s, idx) => ({
                          value: idx,
                          label: `${idx + 1}. ${new Date(
                            s.timestamp
                          ).toLocaleString()}`,
                        }))}
                        onChange={(opt) =>
                          setScenarioData((d) => ({
                            ...d,
                            baselineRunIndex: opt?.value ?? null,
                          }))
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
                        options={simulationHistory.map((s, idx) => ({
                          value: idx,
                          label: `${idx + 1}. ${new Date(
                            s.timestamp
                          ).toLocaleString()}`,
                        }))}
                        onChange={(opt) =>
                          setScenarioData((d) => ({
                            ...d,
                            compareRunIndex: opt?.value ?? null,
                          }))
                        }
                        className="text-sm select"
                        classNamePrefix="select"
                        styles={selectStyles}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-2">
                    Select any two runs to generate an overlay comparison of
                    the chart below.
                  </p>
                </div>

                {/* CHART */}
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
    <p className="text-slate-300 text-xs">No data available for selected filters.</p>
  )}
</div>
</>
);
})()}
</section>


        {/* ===== Projected Disruption Impact (Slider) =================== */}
        <section
          className="rounded-2xl p-5 shadow-xl border"
          style={{
            background:
              "linear-gradient(160deg, rgba(4,23,18,0.98), rgba(6,36,27,0.98))",
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

        {/* ===== Simulation History ==================================== */}
        <section
          className="rounded-2xl p-5 shadow-xl border mb-4"
          style={{
            background:
              "linear-gradient(170deg, rgba(4,24,18,0.98), rgba(4,28,21,0.98))",
            borderColor: "#123528",
          }}
        >
          <h2 className="text-sm font-semibold text-slate-50 mb-3">
            🗂 Simulation History
          </h2>
          <p className="text-xs text-slate-300 mb-4">
            Reload previous simulation output files and compare
            scenarios.
          </p>

          {simulationHistory.length === 0 ? (
            <p className="text-xs text-slate-300">
              No past simulations yet.
            </p>
          ) : (
            <div className="space-y-4">
              {simulationHistory.map((sim, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300">
                      {new Date(sim.timestamp).toLocaleString()}
                    </p>
                    <button
                      onClick={() => onReloadRun(idx)}
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
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
