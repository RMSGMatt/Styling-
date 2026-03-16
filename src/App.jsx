import React, { useEffect, useState, useRef } from "react";
import ToastsHost from "./components/Toasts";
import AboutUs from "./pages/AboutUs";
import AuthPage from "./pages/AuthPage";
import SimulationDashboard from "./components/SimulationDashboard";
import ControlTower from "./components/ControlTower";
import axios from "axios";
import Papa from "papaparse";
import { jwtDecode } from "jwt-decode";
import Reports from "./Reports";
import UpgradeModal from "./UpgradeModal.jsx";
import { api as apiClient, setUpgradeHandler } from "./apiClient";

// 🔐 Admin
import AdminPanel from "./components/ControlTowerEhancements/AdminPanel.jsx";

// ✅ API base normalization (single source of truth)
import { getApiBase } from "./config/apiBase";

const API_BASE = getApiBase();

// Root without trailing slash or `/api`
const API_ROOT = String(API_BASE || "")
  .trim()
  .replace(/\/$/, "")
  .replace(/\/api$/, "");

// Dedicated axios instance for csv fetches (public S3) + auth header
const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// -------------------------------
// Local run history (fallback)
// -------------------------------
const LOCAL_RUNS_KEY = "forc_local_runs_v1";

function loadLocalRunsSafe() {
  try {
    const raw = localStorage.getItem(LOCAL_RUNS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocalRunsSafe(runs) {
  try {
    localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(runs || []));
  } catch {
    // ignore
  }
}

function upsertLocalRun(entry) {
  const runs = loadLocalRunsSafe();
  const id = entry?.run_id || entry?.id || entry?.timestamp || `${Date.now()}`;
  const normalized = { ...entry, id };
  const next = [normalized, ...runs.filter((r) => (r?.id || r?.run_id) !== id)].slice(0, 50);
  saveLocalRunsSafe(next);
  return next;
}

// Auto-build Executive Report after each simulation run
async function buildExecutiveReportAfterSim() {
  try {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token");

    if (!token) {
      console.warn("⚠️ [ExecutiveReport] No token — skipping build");
      return null;
    }

    console.log("🛠️ [ExecutiveReport] Auto-building after simulation...");

    const res = await fetch(`${API_ROOT}/api/executive-report/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ source: "simulation" }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("❌ [ExecutiveReport] Auto-build failed:", res.status, data);
      return null;
    }

    console.log("✅ [ExecutiveReport] Auto-build success:", data);
    return data;
  } catch (err) {
    console.error("❌ [ExecutiveReport] Auto-build error:", err);
    return null;
  }
}

const normalizePlan = (p) => (p || "").toString().trim().toLowerCase();
const isProPlusPlan = (p) => ["pro", "enterprise", "admin"].includes(normalizePlan(p));

const normalizeSku = (sku) => (sku ?? "").toString().trim().toUpperCase();

// Effective SKU selection (prevents empty-array clobbering)
const getEffectiveSkus = (selectedSku, skuOptions) => {
  const sel = Array.isArray(selectedSku)
    ? selectedSku.filter(Boolean)
    : selectedSku
    ? [selectedSku]
    : [];
  if (sel.length > 0) return sel;
  const opt = Array.isArray(skuOptions) ? skuOptions.map((o) => o?.value).filter(Boolean) : [];
  return opt;
};

// Demo-safe SKU scope:
// - Prefer Finished Goods (FG*) for KPI + chart default scope
// - Fallback to original list if no FG SKUs exist
const getDemoSkus = (skus) => {
  const arr = Array.isArray(skus) ? skus : (skus ? [skus] : []);
  const cleaned = arr
    .map((x) => String(x ?? "").trim())
    .filter((x) => x && x.toLowerCase() !== "nan" && x.toLowerCase() !== "undefined" && x.toLowerCase() !== "null");

  const fg = cleaned.filter((x) => /^FG/i.test(x));
  return (fg.length ? fg : cleaned);
};

// Generic CSV loader for disruption / panel data
async function loadCsvToJson(url, setter) {
  if (!url) return;
  try {
    const res = await fetch(url);
    const text = await res.text();
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
    setter(data);
    console.log(`✅ Parsed ${url.split("/").pop()}:`, data.length, "rows");
  } catch (err) {
    console.error("⚠️ Failed to load CSV:", url, err);
  }
}

// CSV helpers
function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v) {
  return (v ?? "").toString();
}
function upper(v) {
  return str(v).trim().toUpperCase();
}
function lower(v) {
  return str(v).trim().toLowerCase();
}

function pickFirstKey(obj, candidates) {
  const keys = Object.keys(obj || {});
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}


function buildScenarioImpactSummary(flowRows = [], occurrenceRows = [], productionRows = []) {
  const custRows = (flowRows || []).filter((r) => {
    const ft = String(r.flow_type || r.FlowType || r.type || "").trim().toLowerCase();
    return ft === "customer_ship" || ft === "customer ship" || ft === "customership";
  });

  const demand = custRows.reduce((sum, r) => {
    const v = Number(r.demand ?? r.Demand ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const shipped = custRows.reduce((sum, r) => {
    const v = Number(r.flow ?? r.Flow ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const fillRate = demand > 0 ? (shipped / demand) * 100 : 0;

  const byReason = (occurrenceRows || []).reduce((acc, r) => {
    const reason = String(r.reason || r.Reason || "UNKNOWN").trim();
    const qty = Number(r.unfulfilled ?? r.Unfulfilled ?? 0);
    acc[reason] = (acc[reason] || 0) + (Number.isFinite(qty) ? qty : 0);
    return acc;
  }, {});

  const lateDemand = byReason["LATE_CUSTOMER_DEMAND"] || 0;
  const missingComponents = byReason["MISSING_COMPONENTS"] || 0;

  const totalProduction = (productionRows || []).reduce((sum, r) => {
    const v = Number(r.produced ?? r.Produced ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  let headline = "Simulation completed.";
  let narrative = "Review KPI and chart outputs for scenario impact.";
  let countermeasures = [];

  const impactedFacilities = new Set(
    (occurrenceRows || [])
      .map((r) => upper(r.facility || r.Facility || r.location || r.Location || ""))
      .filter(Boolean)
  ).size;

  if (fillRate >= 99 && lateDemand === 0) {
    headline =
      missingComponents > 0
        ? "Supply chain remained stable despite upstream material constraints."
        : "Supply chain remained stable under current conditions.";
    narrative =
      missingComponents > 0
        ? `The network fulfilled ${shipped.toLocaleString()} units against ${demand.toLocaleString()} units of demand with no meaningful service degradation. Although ${missingComponents.toLocaleString()} missing component events were recorded across ${impactedFacilities || 0} impacted facilities, mitigation actions were sufficient to preserve downstream service and maintain production continuity.`
        : `The network fulfilled ${shipped.toLocaleString()} units against ${demand.toLocaleString()} units of demand with no meaningful service degradation. Production flow remained stable, backlog did not accumulate materially, and no major component constraints were detected across the selected scope.`;
    countermeasures = missingComponents > 0
      ? [
          "Maintain current mitigation measures that are preserving service performance.",
          "Continue monitoring constrained materials for any further escalation in supply risk.",
          "Review whether targeted safety stock increases could reduce future exposure to the same component constraint.",
        ]
      : [
          "Maintain current sourcing and replenishment policies.",
          "Monitor live incident feeds for early-warning changes in supply conditions.",
          "Preserve baseline safety stock settings and continue routine network surveillance.",
        ];
  } else if (lateDemand > 0 || fillRate < 95) {
    headline = missingComponents > 0
      ? "Component shortages constrained production and reduced service."
      : "Customer service degradation increased backlog across the network.";
    narrative =
      missingComponents > 0
        ? `Upstream material shortages prevented full production execution, contributing to ${missingComponents.toLocaleString()} missing component events and ${lateDemand.toLocaleString()} units of late demand. As the disruption propagated across ${impactedFacilities || 0} impacted facilities, fill rate fell to ${fillRate.toFixed(1)}%, indicating that mitigation actions were not sufficient to fully protect downstream service.`
        : `The model indicates that shipment performance fell below demand requirements, with ${lateDemand.toLocaleString()} units pushed late and overall fill rate reduced to ${fillRate.toFixed(1)}%. While production continued, the network was unable to fully convert available supply into on-time fulfillment, signaling downstream service pressure and recovery risk.`;
    countermeasures = missingComponents > 0
      ? [
          "Expedite constrained components from alternate or backup suppliers.",
          "Temporarily prioritize high-value or customer-critical demand to protect service levels.",
          "Increase safety stock buffers for the affected material at impacted facilities.",
          "Evaluate production reallocation across available plants to reduce downstream backlog.",
        ]
      : [
          "Re-prioritize customer allocation to stabilize on-time delivery performance.",
          "Increase short-term replenishment frequency for constrained downstream nodes.",
          "Review fulfillment sequencing rules to reduce avoidable backlog accumulation.",
        ];
  } else {
    headline = "Network performance weakened but remained partially resilient.";
    narrative =
      `Demand was not fully met at target service levels, but the network maintained partial continuity through available production and shipment flows. Performance degradation was measurable, though not severe enough to represent a full operational breakdown in the selected scenario.`;
    countermeasures = [
      "Tighten monitoring on the affected lanes and facilities.",
      "Review inventory positioning to improve resilience against additional variability.",
      "Prepare targeted mitigation actions in case service conditions deteriorate further.",
    ];
  }

  let networkHealth = "healthy";
  let networkHealthLabel = "🟢 Healthy Network";

  if (fillRate >= 99 && lateDemand === 0) {
    networkHealth = "healthy";
    networkHealthLabel = "🟢 Healthy Network";
  } else if (fillRate < 90) {
    networkHealth = "critical";
    networkHealthLabel = "🔴 Critical Supply Disruption";
  } else {
    networkHealth = "stress";
    networkHealthLabel = "🟠 Network Under Stress";
  }

  return {
    demand,
    shipped,
    fillRate,
    lateDemand,
    missingComponents,
    totalProduction,
    headline,
    narrative,
    networkHealth,
    networkHealthLabel,
    countermeasures,
  };
}

async function fetchCsvRows(url) {
  if (!url) return [];
  const response = await axios.get(url, { responseType: "text" });
  const parsed = Papa.parse(response.data, { header: true, skipEmptyLines: true });
  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  return rows.filter((r) => r && typeof r === "object");
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [upgradeGate, setUpgradeGate] = useState({
    open: false,
    required: ["pro"],
    plan: "free",
  });

  // Default to Control Tower
  const [view, setView] = useState("control");

  const [files, setFiles] = useState({});
  const [simulationStatus, setSimulationStatus] = useState("idle"); // idle | running | done | error
  const [outputUrls, setOutputUrls] = useState(null);

  const [chartData, setChartData] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState([]); // normalize to array
  const [selectedOutputType, setSelectedOutputType] = useState("inventory");

  // Facility selected on the map
  const [selectedFacility, setSelectedFacility] = useState(null);

  const [simulationHistory, setSimulationHistory] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [kpis, setKpis] = useState({});
  const [scenarioImpactSummary, setScenarioImpactSummary] = useState(null);

  const [disruptionImpactData, setDisruptionImpactData] = useState([]);
  const [projectedImpactData, setProjectedImpactData] = useState([]);
  const [runoutRiskData, setRunoutRiskData] = useState([]);
  const [countermeasuresData, setCountermeasuresData] = useState([]);

  const [locationsUrl, setLocationsUrl] = useState(null);
  const [scenarioData, setScenarioData] = useState({});

  // Post-run deterministic pipeline gate: idle | seeding | primed
  const [postRunPhase, setPostRunPhase] = useState("idle");

  // Scenario Authority (Step 0)
  const scenarioRef = useRef({});
  const justPrimedRef = useRef(false);

  // Tracks whether backend supplied KPIs for the CURRENT run
  const backendKpisRef = useRef(false);

  const [userRole, setUserRole] = useState("");
  const [userPlan, setUserPlan] = useState("");

  // Keep scenario ref + localStorage sync
  useEffect(() => {
    scenarioRef.current = scenarioData || {};
    try {
      const hasScenario =
        scenarioData && typeof scenarioData === "object" && Object.keys(scenarioData).length > 0;

      if (hasScenario) {
        localStorage.setItem("currentScenarioJSON", JSON.stringify(scenarioData));
        console.log("🧪 [App] Scenario synced → localStorage + ref", scenarioData);
      } else {
        localStorage.removeItem("currentScenarioJSON");
        console.log("🧪 [App] Scenario cleared (baseline)");
      }
    } catch (e) {
      console.warn("⚠️ [App] Failed to sync scenario to localStorage:", e);
    }
  }, [scenarioData]);

  // Upgrade gate handler
  useEffect(() => {
    setUpgradeHandler(({ required, plan }) => {
      console.log("💳 [UpgradeGate] Triggered:", { required, plan });
      setUpgradeGate({
        open: true,
        required: required || ["pro"],
        plan: plan || "free",
      });
    });
    return () => setUpgradeHandler(null);
  }, []);

  // Boot auth + plan + history
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    setIsAuthenticated(!!token);

    // Always seed local history first (so you NEVER see an empty history panel)
    const localRuns = loadLocalRunsSafe();
    if (localRuns.length > 0) {
      setSimulationHistory(localRuns);
    }

    if (!token) return;

    const boot = async () => {
      // 1) Decode JWT for ROLE fallback only
      try {
        const decoded = jwtDecode(token);
        setUserRole(decoded?.role || "user");
      } catch (e) {
        console.error("❌ Failed to decode JWT:", e);
        setUserRole("user");
      }

      // 2) Fetch DB-truth user info
      try {
        const res = await fetch(`${API_ROOT}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("❌ /api/me failed:", res.status, data);
          return;
        }

        const planFromDb = data?.plan || "free";
        const roleFromDb = data?.role || "user";

        setUserPlan(planFromDb);
        setUserRole(roleFromDb);

        // Pro+ only: fetch remote history and merge with local
        if (isProPlusPlan(planFromDb)) {
          await fetchSimulationHistory(); // merges into state
        } else {
          console.log("🔒 Skipping /api/simulations on Free plan (using local history).");
        }
      } catch (err) {
        console.error("❌ Failed to fetch /api/me:", err);
      }
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose view switcher
  useEffect(() => {
    window.__FORC_SWITCHVIEW = (v) => setView(v);
    return () => {
      delete window.__FORC_SWITCHVIEW;
    };
  }, []);

  // Keep view in sync with URL path
  useEffect(() => {
    if (!isAuthenticated) return;
    const path = window.location.pathname;

    if (path === "/about") setView("about");
    else if (path === "/reports") setView("reports");
    else if (path === "/repository") setView("repository");
    else if (path === "/admin") setView("admin");
    else if (path === "/simulation") setView("simulation");
    else if (path === "/" || path === "/control" || path === "/control-tower") {
      setView("control");
      if (path !== "/control-tower") window.history.replaceState(null, "", "/control-tower");
    }
  }, [isAuthenticated]);

  const handleFileChange = (type, file) => {
    setFiles((prev) => ({ ...prev, [type]: file }));
  };

  const handleFacilityClick = (facilityName) => {
    console.log("🏭 [App] Facility selected:", facilityName);
    setSelectedFacility(facilityName);
  };

  // Remote history (Pro+) — merge with local
  const fetchSimulationHistory = async () => {
    try {
      const res = await apiClient.get("/api/simulations");
      const remote = Array.isArray(res.data) ? res.data : [];
      const local = loadLocalRunsSafe();

      // merge (prefer remote)
      const merged = [
        ...remote.map((r) => ({ ...r, _source: "remote" })),
        ...local
          .filter((lr) => {
            const lid = lr?.id || lr?.run_id;
            return !remote.some((rr) => (rr?.id || rr?.run_id) === lid);
          })
          .map((r) => ({ ...r, _source: "local" })),
      ];

      setSimulationHistory(merged);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        console.log("🔒 /api/simulations blocked (plan gating). Using local history.");
        setSimulationHistory(loadLocalRunsSafe());
        return;
      }
      console.error("❌ Error fetching simulation history:", err);
      setSimulationHistory(loadLocalRunsSafe());
    }
  };

  // Robust chart data loader — single source of truth
  const loadFilteredChart = async (urls, outputType, skuFilterRaw) => {
    try {
      console.log("📥 [Chart] Loading", outputType, "for", skuFilterRaw);

      const skuFilter = Array.isArray(skuFilterRaw)
        ? skuFilterRaw.filter(Boolean).map((s) => lower(s))
        : skuFilterRaw
        ? [lower(skuFilterRaw)]
        : [];

      const url =
        urls?.[`${outputType}_output_file_url`] ||
        urls?.[`${outputType}.csv`] ||
        Object.values(urls || {})[0];

      if (!url) {
        console.warn("⚠️ [Chart] No CSV URL for type:", outputType);
        return;
      }

      const results = await fetchCsvRows(url);
      if (!results.length) {
        console.warn("⚠️ [Chart] CSV empty:", url);
        return;
      }

      const sample = results[0] || {};

      const dateKey =
        pickFirstKey(sample, ["date", "day", "period", "time", "timestamp", "period_start", "period_end"]) ||
        Object.keys(sample)[0];

      const skuKey =
        pickFirstKey(sample, ["sku", "item", "part", "product", "id"]) ||
        Object.keys(sample)[1];

      let desiredValueKey =
        outputType === "inventory"
          ? ["ending_inventory", "inventory", "on_hand", "level", "initial_inventory"]
          : outputType === "production"
          ? ["produced", "production", "qty"]
          : outputType === "flow"
          ? ["flow"]
          : ["unfulfilled", "event", "value", "amount"];

      const valueKey = pickFirstKey(sample, desiredValueKey) || Object.keys(sample)[2];

      const filtered = results.filter((row) => {
        const skuVal = lower(row[skuKey]);
        const facilityVal =
          row.facility ||
          row.Facility ||
          row.facility_id ||
          row.Location ||
          row.location ||
          row.from ||
          row.from_facility ||
          "";

        const skuMatch = skuFilter.length === 0 || skuFilter.includes(skuVal);
        const facilityMatch =
          !selectedFacility || upper(facilityVal) === upper(selectedFacility);

        if (outputType === "flow") {
          const ft = lower(row.flow_type || row.type || "");
          const isCustomerShip =
            ft === "customer_ship" || ft === "customer ship" || ft === "customership";
          return skuMatch && facilityMatch && isCustomerShip;
        }

        return skuMatch && facilityMatch;
      });

      const dateSet = [...new Set(filtered.map((r) => r[dateKey]))].filter(Boolean).sort();

      const skuGroups = {};
      filtered.forEach((row) => {
        const skuVal = str(row[skuKey] || "Unknown").trim();
        const dateVal = row[dateKey];
        const numVal = toNum(row[valueKey]);
        if (!skuGroups[skuVal]) skuGroups[skuVal] = {};
        // sum if multiple rows collide on same date
        skuGroups[skuVal][dateVal] = (skuGroups[skuVal][dateVal] || 0) + numVal;
      });

      const datasets = Object.entries(skuGroups).map(([skuName, dateMap]) => ({
        label: skuName,
        data: dateSet.map((d) => (dateMap[d] ?? null)),
        fill: false,
        borderWidth: 2,
        tension: 0.25,
      }));

      setChartData({ labels: dateSet, datasets });

      const total = filtered.reduce((sum, r) => sum + toNum(r[valueKey]), 0);
      const avg = (total / Math.max(filtered.length || 1, 1)).toFixed(2);
      const uniqueDates = [...new Set(filtered.map((r) => r[dateKey]))].length;
      const uniqueFacilities = new Set(
        filtered.map((r) => r.facility || r.Facility || r.Location || r.location).map((x) => upper(x))
      ).size;

      setSummaryStats({ total, avg, uniqueDates, uniqueFacilities });
    } catch (err) {
      console.error("❌ [Chart] Failed to load chart data:", err);
    }
  };

  // Parse simulation panels (impact, runout, countermeasures)
  const parseSimulationPanels = async (urls) => {
    try {
      if (urls.projected_impact_output_file_url) {
        const rows = await fetchCsvRows(urls.projected_impact_output_file_url);
        setProjectedImpactData(rows);
      }
      if (urls.runout_risk_output_file_url) {
        const rows = await fetchCsvRows(urls.runout_risk_output_file_url);
        setRunoutRiskData(rows);
      }
      if (urls.countermeasures_output_file_url) {
        const rows = await fetchCsvRows(urls.countermeasures_output_file_url);
        setCountermeasuresData(rows);
      }
    } catch (err) {
      console.error("❌ Failed to parse simulation panel data:", err);
    }
  };

  // ✅ KPI aggregation — FIXED source of truth for service KPIs
  const runAllKpiUpdates = async (urlsOverride, skuOverride) => {
    const urls = urlsOverride || outputUrls;
    if (!urls) return;

    const effectiveSkusLocal = getEffectiveSkus((skuOverride ?? selectedSku), skuOptions);
    const demoSkusLocal = getDemoSkus(effectiveSkusLocal);
    const skuFilter = demoSkusLocal
      .filter(Boolean)
      .map(normalizeSku);

    const facilityFilter = selectedFacility ? upper(selectedFacility) : null;

    const allKpis = {};


    let avgInventoryNum = 0;

    let invUniqueDays = 0;
    try {
      // ----- INVENTORY KPIs -----
      if (urls.inventory_output_file_url) {
        const invRows = await fetchCsvRows(urls.inventory_output_file_url);

        const sample = invRows[0] || {};
        const skuKey = pickFirstKey(sample, ["sku"]) || "sku";
        const facKey = pickFirstKey(sample, ["facility", "facility_id", "location"]) || "facility";
        const invKey =
          pickFirstKey(sample, ["ending_inventory", "inventory", "on_hand", "level", "initial_inventory"]) ||
          "ending_inventory";

        const invFiltered = invRows.filter((r) => {
          const sku = normalizeSku(r[skuKey] || r.sku || r.SKU);
          const fac = upper(r[facKey] || r.facility || r.facility_id || r.Location || r.location);
          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          const facMatch = !facilityFilter || fac === facilityFilter;
          return skuMatch && facMatch;
        });

        const invValues = invFiltered.map((r) => toNum(r[invKey])).filter((n) => Number.isFinite(n));
        const avgInventory = invValues.length ? invValues.reduce((a, b) => a + b, 0) / invValues.length : 0;

        allKpis.avgInventory = avgInventory.toFixed(1);

        avgInventoryNum = avgInventory;

        try {

          const invDates = (invFiltered || []).map((r) => r.date || r.Date || r.day || r.Day).filter(Boolean);

          invUniqueDays = new Set(invDates).size;

        } catch { invUniqueDays = 0; }
      }

      // ----- PRODUCTION KPIs -----
      if (urls.production_output_file_url) {
        const prodRows = await fetchCsvRows(urls.production_output_file_url);
        const sample = prodRows[0] || {};
        const skuKey = pickFirstKey(sample, ["sku"]) || "sku";
        const facKey = pickFirstKey(sample, ["facility", "facility_id", "location"]) || "facility";
        const prodKey = pickFirstKey(sample, ["produced", "production", "qty"]) || "produced";
        const recKey = pickFirstKey(sample, ["recovery_days", "ttr", "recovery"]) || "recovery_days";

        let totalProduction = 0;
        const facilityRecovery = {};

        prodRows.forEach((row) => {
          const sku = normalizeSku(row[skuKey] || row.sku);
          const fac = upper(row[facKey] || row.facility || row.facility_id || "");
          if (skuFilter.length && !skuFilter.includes(sku)) return;
          if (facilityFilter && fac !== facilityFilter) return;

          const produced = toNum(row[prodKey]);
          totalProduction += produced;

          const recovery = parseInt(row[recKey] || 0, 10) || 0;
          if (produced > 0 && fac) {
            facilityRecovery[fac] = Math.max(facilityRecovery[fac] || 0, recovery);
          }
        });

        const impactedFacilities = Object.keys(facilityRecovery).length;
        const avgTimeToRecovery =
          impactedFacilities > 0
            ? Math.round(Object.values(facilityRecovery).reduce((a, b) => a + b, 0) / impactedFacilities)
            : 0;

        allKpis.totalProduction = totalProduction.toFixed(0);
        allKpis.impactedFacilities = impactedFacilities;
        allKpis.avgTimeToRecovery = avgTimeToRecovery;
      }

      // ----- SERVICE KPIs (SOURCE OF TRUTH = demand.csv + CUSTOMER_SHIP rows) -----
      // Truth definition for demo:
      // - Demand = total qty in demand.csv for selected SKU/facility scope
      // - Fulfillment = CUSTOMER_SHIP flow rows
      // - BackorderVolume = latest backlog_out from CUSTOMER_SHIP rows
      // - OnTimeFulfillment = fulfilled / demand
      //
      // Important:
      // - shipped_downstream is not customer fulfillment
      // - inbound replenishment into OEM is not customer fulfillment
      // - only CUSTOMER_SHIP rows count as service fulfillment
      if (urls.flow_output_file_url) {
        const flowRows = await fetchCsvRows(urls.flow_output_file_url);

        // 1) Load demand truth from uploaded demand file
        let demandRows = [];
        try {
          const demandFile = files?.demand || files?.demand_file || files?.demandCsv;
          if (demandFile) {
            const demandText = await demandFile.text();
            const parsed = Papa.parse(demandText, { header: true, skipEmptyLines: true });
            demandRows = Array.isArray(parsed.data) ? parsed.data : [];
          } else {
            console.warn("⚠️ [KPI] No uploaded demand file found; service KPI demand truth unavailable.");
          }
        } catch (e) {
          console.warn("⚠️ [KPI] Failed to parse uploaded demand file:", e);
        }

        const demandSample = demandRows[0] || {};
        const flowSample = flowRows[0] || {};

        const demandSkuKey = pickFirstKey(demandSample, ["sku"]) || "sku";
        const demandFacilityKey =
          pickFirstKey(demandSample, ["facility", "facility_id", "location"]) || "facility";
        const demandQtyKey = pickFirstKey(demandSample, ["demand", "qty", "quantity"]) || "demand";

        const flowSkuKey = pickFirstKey(flowSample, ["sku"]) || "sku";
        const flowFromKey =
          pickFirstKey(flowSample, ["from", "from_facility", "facility", "facility_id", "location"]) || "from";
        const flowQtyKey = pickFirstKey(flowSample, ["flow", "quantity", "shipped"]) || "flow";
        const flowTypeKey = pickFirstKey(flowSample, ["flow_type", "type"]) || "flow_type";
        const backlogOutKey = pickFirstKey(flowSample, ["backlog_out", "backorder", "unfulfilled"]) || "backlog_out";
        const dateKey = pickFirstKey(flowSample, ["date", "day", "timestamp", "time"]) || "date";

        // Scope demand rows
        const scopedDemandRows = demandRows.filter((r) => {
          const sku = normalizeSku(r[demandSkuKey] || r.sku);
          const fac = upper(
            r[demandFacilityKey] || r.facility || r.facility_id || r.location || r.Location || ""
          );

          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          const facMatch = !facilityFilter || fac === facilityFilter;
          return skuMatch && facMatch;
        });

        const totalDemand = scopedDemandRows.reduce((sum, r) => sum + toNum(r[demandQtyKey]), 0);

        const demandFacilities = new Set(
          scopedDemandRows
            .map((r) =>
              upper(
                r[demandFacilityKey] || r.facility || r.facility_id || r.location || r.Location || ""
              )
            )
            .filter(Boolean)
        );

        // Only CUSTOMER_SHIP rows count as customer fulfillment
        const customerShipRows = flowRows
          .filter((r) => {
            const sku = normalizeSku(r[flowSkuKey] || r.sku);
            const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
            if (!skuMatch) return false;

            const ft = lower(r[flowTypeKey] || r.flow_type || r.type);
            const isCustomerShip =
              ft === "customer_ship" || ft === "customer ship" || ft === "customership";
            if (!isCustomerShip) return false;

            const fromFacility = upper(
              r[flowFromKey] ||
                r.from ||
                r.from_facility ||
                r.facility ||
                r.facility_id ||
                r.location ||
                ""
            );

            const facMatch =
              !facilityFilter || fromFacility === facilityFilter || demandFacilities.has(fromFacility);

            return facMatch;
          })
          .map((r) => ({
            date: r[dateKey],
            flow: toNum(r[flowQtyKey]),
            backlogOut: toNum(r[backlogOutKey]),
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const fulfilledCustomerShip = customerShipRows.reduce((sum, r) => sum + toNum(r.flow), 0);
        const latestBacklogOut =
          customerShipRows.length > 0
            ? toNum(customerShipRows[customerShipRows.length - 1].backlogOut)
            : Math.max(0, totalDemand - fulfilledCustomerShip);

        const otfFrac = totalDemand > 0 ? fulfilledCustomerShip / totalDemand : 0;
        const backorderVolume = Math.max(0, latestBacklogOut);
        const backorderRateFrac = totalDemand > 0 ? backorderVolume / totalDemand : 0;

        allKpis.onTimeFulfillment = `${(100 * otfFrac).toFixed(1)}%`;
        allKpis.backorderRate = `${(100 * backorderRateFrac).toFixed(1)}%`;
        allKpis.backorderVolume = `${Math.round(backorderVolume)}`;

        if (avgInventoryNum > 0 && invUniqueDays > 0) {
          const annualFactor = 365 / Math.max(invUniqueDays, 1);
          const annualizedThroughput = fulfilledCustomerShip * annualFactor;
          const turns = annualizedThroughput / avgInventoryNum;
          allKpis.inventoryTurns = `${turns.toFixed(1)}x`;
        } else {
          allKpis.inventoryTurns = "--x";
        }

        // ----- INVENTORY BUFFER INDEX (days of demand coverage) -----
        try {
          const avgDailyDemand = invUniqueDays > 0 ? totalDemand / Math.max(invUniqueDays, 1) : 0;
          if (avgInventoryNum > 0 && avgDailyDemand > 0) {
            const ibiDays = avgInventoryNum / avgDailyDemand;
            allKpis.inventoryBuffer = `${ibiDays.toFixed(1)} days`;
          } else {
            allKpis.inventoryBuffer = "--";
          }
        } catch (e) {
          console.warn("⚠️ [KPI] inventoryBuffer calc failed:", e);
          allKpis.inventoryBuffer = "--";
        }

        console.log("📦 [KPI] Service truth:", {
          totalDemand,
          fulfilledCustomerShip,
          backorderVolume,
          otfPercent: (100 * otfFrac).toFixed(1),
          customerShipRowCount: customerShipRows.length,
          demandFacilities: Array.from(demandFacilities),
        });
      }
      // ----- COST TO SERVE + EXPEDITE RATIO (flow output, all flow types) -----
      if (urls.flow_output_file_url) {
        const flowRows = await fetchCsvRows(urls.flow_output_file_url);
        const sample = flowRows[0] || {};
        const skuKey = pickFirstKey(sample, ["sku"]) || "sku";
        const facKey = pickFirstKey(sample, ["facility", "facility_id", "to", "from", "location"]) || "facility";
        const qtyKey = pickFirstKey(sample, ["quantity", "flow", "shipped"]) || "quantity";
        const cpuKey = pickFirstKey(sample, ["cost_per_unit", "cpu", "unit_cost"]) || "cost_per_unit";
        const expKey = pickFirstKey(sample, ["expedited", "expedite", "is_expedited"]) || "expedited";

        const filtered = flowRows.filter((r) => {
          const sku = normalizeSku(r[skuKey] || r.sku);
          const fac = upper(r[facKey] || r.facility || r.facility_id || r.to || r.from || "");
          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          const facMatch = !facilityFilter || fac === facilityFilter;
          return skuMatch && facMatch;
        });

        const totalCost = filtered.reduce((sum, r) => {
          const quantity = toNum(r[qtyKey]);
          const cpu = toNum(r[cpuKey] ?? 10);
          return sum + quantity * cpu;
        }, 0);

        const customerShipRowsForCost = filtered.filter((r) => {
          const ft = lower(r.flow_type || r.FlowType || r.type || "");
          return ft === "customer_ship" || ft === "customer ship" || ft === "customership";
        });

        const shippedUnits = customerShipRowsForCost.reduce((sum, r) => {
          const quantity = toNum(r[qtyKey] ?? r.flow ?? r.Flow ?? r.quantity ?? r.Quantity ?? r.shipped ?? r.Shipped);
          return sum + quantity;
        }, 0);

        const expediteCount = filtered.filter((r) => {
          const v = lower(r[expKey]);
          return v === "true" || v === "1" || v === "yes";
        }).length;

        const expediteRatio = filtered.length ? (100 * expediteCount) / filtered.length : 0;

        allKpis.costToServe = shippedUnits > 0
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(totalCost / shippedUnits)
          : "--";
        allKpis.expediteRatio = `${expediteRatio.toFixed(1)}%`;
      }

      // ----- OCCURRENCE COUNT (sanity metric) -----
      if (urls.occurrence_output_file_url) {
        const occRows = await fetchCsvRows(urls.occurrence_output_file_url);
        const sample = occRows[0] || {};
        const skuKey = pickFirstKey(sample, ["sku"]) || "sku";
        const facKey = pickFirstKey(sample, ["facility", "facility_id", "location"]) || "facility";
        const dateKey = pickFirstKey(sample, ["date", "Date", "day", "Day"]) || "date";

        const filtered = occRows.filter((r) => {
          const sku = normalizeSku(r[skuKey] || r.sku);
          const fac = upper(r[facKey] || r.facility || r.facility_id || "");
          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          const facMatch = !facilityFilter || fac === facilityFilter;
          return skuMatch && facMatch;
        });

        allKpis.occurrenceCount = `${filtered.length}`;

        // ----- TIME TO RECOVERY (occurrence-span based) -----
        try {
          const occDates = filtered
            .map((r) => r[dateKey] || r.date || r.Date || r.day || r.Day)
            .filter(Boolean)
            .map((d) => new Date(d))
            .filter((d) => !Number.isNaN(d.getTime()));

          if (occDates.length > 0) {
            const first = new Date(Math.min(...occDates.map((d) => d.getTime())));
            const last = new Date(Math.max(...occDates.map((d) => d.getTime())));
            const diffDays = Math.round((last - first) / (1000 * 60 * 60 * 24));
            allKpis.timeToRecovery = `${diffDays} days`;
          } else {
            allKpis.timeToRecovery = "--";
          }
        } catch (e) {
          console.warn("⚠️ [KPI] timeToRecovery calc failed:", e);
          allKpis.timeToRecovery = "--";
        }
      }

      // ----- SCENARIO IMPACT SUMMARY -----
      try {
        const flowRowsForSummary = urls.flow_output_file_url
          ? await fetchCsvRows(urls.flow_output_file_url)
          : [];

        const occurrenceRowsForSummary = urls.occurrence_output_file_url
          ? await fetchCsvRows(urls.occurrence_output_file_url)
          : [];

        const productionRowsForSummary = urls.production_output_file_url
          ? await fetchCsvRows(urls.production_output_file_url)
          : [];

        const summary = buildScenarioImpactSummary(
          flowRowsForSummary,
          occurrenceRowsForSummary,
          productionRowsForSummary
        );

        setScenarioImpactSummary(summary);
      } catch (e) {
        console.warn("⚠️ Failed to build scenario impact summary:", e);
        setScenarioImpactSummary(null);
      }

      console.log("KPI_DEBUG_DUMP", allKpis);
      setKpis({ ...allKpis });
    } catch (err) {
      console.error("❌ [KPI] Failed KPI pipeline:", err);
    }
  };

  // Submit simulation (FormData)
  const handleSubmit = async (maybeFormData) => {
    if (simulationStatus === "running") return;

    setSimulationStatus("running");
    setChartData(null);

    backendKpisRef.current = false;

    try {
      const formData =
        maybeFormData ||
        (() => {
          const fd = new FormData();

          const fileMap = {
            demand: files.demand || files.demand_file || files.demandCsv,
            disruptions: files.disruptions || files.disruptions_file || files.disruptionsCsv,
            locations: files.locations || files.locations_file || files.locationsCsv,
            bom: files.bom || files.bom_file || files.bomCsv,
            processes: files.processes || files.processes_file || files.processesCsv,
            location_materials:
              files.location_materials ||
              files.locationMaterials ||
              files.location_materials_file ||
              files.locationMaterialsCsv,
          };

          Object.entries(fileMap).forEach(([backendKey, file]) => {
            if (file) fd.append(backendKey, file);
          });

          // Prefer authoritative in-memory scenario
          try {
            const activeScenario = scenarioRef.current;
            const hasScenario =
              activeScenario && typeof activeScenario === "object" && Object.keys(activeScenario).length > 0;

            if (hasScenario) {
              fd.append("scenario", JSON.stringify(activeScenario));
              console.log("🧪 [App] Applying scenario to simulation:", activeScenario);
            } else {
              console.log("🧪 [App] No scenario applied (baseline run)");
            }
          } catch (e) {
            console.warn("⚠️ [App] Scenario attach failed, falling back to localStorage:", e);
            const scenarioRaw = localStorage.getItem("currentScenarioJSON");
            if (scenarioRaw) fd.append("scenario", scenarioRaw);
          }

          console.log("🧾 [App] FormData keys:");
          for (const [k] of fd.entries()) console.log("  -", k);

          return fd;
        })();

      console.log("▶️ [App] Starting simulation run...");
      console.log("📡 [App] POST", `${API_ROOT}/api/run`);

      const res = await apiClient.post("/api/run", formData);
      const payload = res.data || {};

      // unwrap urls
      let raw = payload.output_urls || payload.urls || payload.outputUrls || payload;
      if (
        raw &&
        typeof raw === "object" &&
        raw.urls &&
        typeof raw.urls === "object" &&
        !raw.inventory_output_file_url &&
        !raw.flow_output_file_url
      ) {
        raw = raw.urls;
      }

      const normalizedUrls = {
        ...raw,

        inventory_output_file_url: raw.inventory_output_file_url || raw.inventory_output || raw.inventory,
        flow_output_file_url: raw.flow_output_file_url || raw.flow_output || raw.flow,
        production_output_file_url: raw.production_output_file_url || raw.production_output || raw.production,
        occurrence_output_file_url: raw.occurrence_output_file_url || raw.occurrence_output || raw.occurrence,

        disruption_impact_output_file_url:
          raw.disruption_impact_output_file_url || raw.disruption_impact_output || raw.disruption_impact,
        projected_impact_output_file_url:
          raw.projected_impact_output_file_url || raw.projected_impact_output || raw.projected_impact,

        runout_risk_output_file_url:
          raw.runout_risk_output_file_url ||
          raw.sku_runout_risk_output_file_url ||
          raw.sku_runout_risk_output ||
          raw.runout_risk ||
          raw.sku_runout_risk,

        countermeasures_output_file_url:
          raw.countermeasures_output_file_url || raw.countermeasures_output || raw.countermeasures,

        locations_output_file_url:
          raw.locations_output_file_url || raw.locations_output || raw.locations_url || raw.locations,
      };

      console.log("✅ [App] Simulation complete (normalized):", {
        keys: Object.keys(normalizedUrls || {}),
        normalizedUrls,
      });

      // Update locationsUrl
      const locUrl =
        normalizedUrls.locations_output_file_url ||
        normalizedUrls.locations_Output_File_URL ||
        normalizedUrls.locations_output ||
        normalizedUrls.locations_url ||
        normalizedUrls.locations ||
        null;

      if (locUrl) {
        const cacheBusted = `${locUrl}?v=${Date.now()}`;
        console.log("🗺️ [App] Updating locationsUrl →", cacheBusted);
        setLocationsUrl(cacheBusted);
      } else {
        console.warn("⚠️ No dynamic locations URL found in simulation output.");
      }

      // Commit urls to state
      setPostRunPhase("seeding");
      setOutputUrls(normalizedUrls);

      // Save run locally immediately (so history is never empty)
      const entry = {
        id: payload.run_id || payload.id || payload.timestamp || `${Date.now()}`,
        run_id: payload.run_id,
        created_at: payload.timestamp || new Date().toISOString(),
        output_urls: normalizedUrls,
        urls: normalizedUrls,
        outputUrls: normalizedUrls,
        _source: "local",
      };
      const nextLocal = upsertLocalRun(entry);
      setSimulationHistory((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        // merge: prefer remote entries if present
        const merged = [
          ...prevArr.filter((r) => r?._source === "remote"),
          ...nextLocal,
        ];
        return merged;
      });

      await buildExecutiveReportAfterSim();

      // Reset facility selection
      setSelectedFacility(null);

      // Seed SKUs BEFORE charts/KPIs
      let seededSkus = null;
      try {
        if (normalizedUrls?.inventory_output_file_url) {
          seededSkus = await extractAndSetSkuOptions(normalizedUrls.inventory_output_file_url);
        } else {
          console.warn("⚠️ [PostRun] No inventory_output_file_url available to seed SKUs.");
        }
      } catch (e) {
        console.warn("⚠️ [PostRun] SKU seed failed:", e);
      }

      setPostRunPhase("primed");

      // Load panel CSVs (non-blocking)
      await Promise.all([
        loadCsvToJson(normalizedUrls.disruption_impact_output_file_url, setDisruptionImpactData),
        loadCsvToJson(normalizedUrls.projected_impact_output_file_url, setProjectedImpactData),
        loadCsvToJson(normalizedUrls.runout_risk_output_file_url, setRunoutRiskData),
        loadCsvToJson(normalizedUrls.countermeasures_output_file_url, setCountermeasuresData),
      ]);

      try {
        await parseSimulationPanels(normalizedUrls);
      } catch (e) {
        console.warn("⚠️ parseSimulationPanels failed:", e);
      }

      // Prefer backend KPIs if present
      if (payload.kpis && Object.keys(payload.kpis || {}).length > 0) {
        backendKpisRef.current = true;
        setKpis(payload.kpis);
      } else {
        backendKpisRef.current = false;
      }

      setSimulationStatus("done");
      console.log("✅ [App] Simulation workflow finished successfully.");
      setTimeout(() => setSimulationStatus("idle"), 3000);
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      if (status === 402) {
        setUpgradeGate({
          open: true,
          required: data?.required || ["pro"],
          plan: data?.plan || "free",
        });
        setSimulationStatus("idle");
        return;
      }

      console.error("❌ [App] Simulation API call failed:", {
        status,
        data,
        message: error?.message,
        stack: error?.stack,
      });

      alert(
        `Simulation failed (${status || "no status"}). ` +
          `Check console + server logs. ` +
          (data?.stage ? `Stage: ${data.stage}. ` : "")
      );

      setSimulationStatus("error");
      setTimeout(() => setSimulationStatus("idle"), 3000);
    }
  };

  // Extract SKUs and build options
  const extractAndSetSkuOptions = async (url) => {
    if (!url) return;
    try {
      const rows = await fetchCsvRows(url);

      const skus = [...new Set(rows.map((r) => normalizeSku(r.sku || r.SKU)).filter(Boolean))];
      const options = skus.map((sku) => ({ label: sku, value: sku }));
      setSkuOptions(options);

      const seeded =
        selectedSku && selectedSku.length > 0
          ? Array.isArray(selectedSku)
            ? selectedSku
            : [selectedSku]
          : options.map((o) => o.value);

      if (!selectedSku || selectedSku.length === 0) {
        setSelectedSku(seeded);
      }

      return seeded;
    } catch (err) {
      console.error("❌ Failed to extract SKUs:", err);
    }
  };

  // Recompute KPIs & chart whenever outputs / SKU / type change
  useEffect(() => {
    const urls = outputUrls;

    console.log("🧪 [PostRun] outputUrls keys:", Object.keys(urls || {}));
    console.log("🧪 [PostRun] sample urls:", {
      inventory: urls?.inventory_output_file_url,
      production: urls?.production_output_file_url,
      flow: urls?.flow_output_file_url,
      occurrence: urls?.occurrence_output_file_url,
    });

    if (!urls) return;

    if (postRunPhase === "idle" && justPrimedRef.current) {
      justPrimedRef.current = false;
      console.log("⏭️ [PostRun] Skipping immediate post-primed rerun");
      return;
    }

    if (postRunPhase === "seeding") {
      console.log("⏳ [PostRun] Seeding SKUs — holding KPI/chart recompute...");
      return;
    }

    const effectiveSkus = getEffectiveSkus(selectedSku, skuOptions);
    const demoSkus = getDemoSkus(effectiveSkus);
    if (!demoSkus || demoSkus.length === 0) {
      console.log("⏳ [PostRun] Waiting for SKU seed before KPI/chart recompute...");
      return;
    }

    if (postRunPhase === "primed") {
      console.log("✅ [PostRun] Primed — running deterministic KPI+chart recompute once...");

      if (!backendKpisRef.current || !kpis || Object.keys(kpis).length === 0) {
        runAllKpiUpdates(urls, demoSkus);
      }

      loadFilteredChart(urls, selectedOutputType || "inventory", demoSkus);

      justPrimedRef.current = true;
      setPostRunPhase("idle");
      return;
    }

    // Normal interactive recompute
    runAllKpiUpdates(urls, demoSkus);
    loadFilteredChart(urls, selectedOutputType || "inventory", demoSkus);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputUrls, selectedSku, selectedOutputType, selectedFacility, postRunPhase]);

  const onReloadRun = async (entry) => {
    const urls = entry.output_urls || entry.outputUrls || entry.urls || {};
    setChartData(null);

    setPostRunPhase("seeding");
    setOutputUrls(urls);
    setSimulationStatus("done");

    try {
      if (urls?.inventory_output_file_url) {
        await extractAndSetSkuOptions(urls.inventory_output_file_url);
      } else if (urls?.[`${selectedOutputType}_output_file_url`]) {
        await extractAndSetSkuOptions(urls[`${selectedOutputType}_output_file_url`]);
      }
    } catch (e) {
      console.warn("⚠️ [ReloadRun] SKU seed failed:", e);
    }

    try {
      await parseSimulationPanels(urls);
    } catch (e) {
      console.warn("⚠️ [ReloadRun] parseSimulationPanels failed:", e);
    }

    setPostRunPhase("primed");

    setView("simulation");
    window.history.pushState(null, "", "/simulation");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("access_token");
    setIsAuthenticated(false);
    setView("auth");
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setView("control");
    window.history.replaceState(null, "", "/control-tower");

    // Always show local history immediately
    setSimulationHistory(loadLocalRunsSafe());

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("access_token");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const plan = decoded.plan || "free";
      setUserPlan(plan);
      setUserRole(decoded.role || "user");

      if (isProPlusPlan(plan)) {
        fetchSimulationHistory();
      } else {
        console.log("🔒 Skipping /api/simulations on Free plan (login). Using local history.");
      }
    } catch (e) {
      console.error("❌ Failed to decode JWT on login:", e);
    }
  };

  // Render
  return (
    <>
      {!isAuthenticated ? (
        <AuthPage onLogin={handleLogin} />
      ) : view === "simulation" ? (
        <SimulationDashboard
          handleFileChange={handleFileChange}
          handleSubmit={handleSubmit}
          simulationStatus={simulationStatus}
          outputUrls={outputUrls}
          skuOptions={skuOptions}
          selectedSku={selectedSku}
          setSelectedSku={setSelectedSku}
          selectedOutputType={selectedOutputType}
          setSelectedOutputType={setSelectedOutputType}
          chartData={chartData}
          summaryStats={summaryStats}
          scenarioImpactSummary={scenarioImpactSummary}
          simulationHistory={simulationHistory}
          files={files}
          kpis={kpis}
          onLogout={handleLogout}
          switchView={setView}
          onReloadRun={onReloadRun}
          disruptionImpactData={disruptionImpactData}
          projectedImpactData={projectedImpactData}
          runoutRiskData={runoutRiskData}
          countermeasuresData={countermeasuresData}
          locationsUrl={locationsUrl}
          scenarioData={scenarioData}
          setScenarioData={setScenarioData}
          selectedFacility={selectedFacility}
          handleFacilityClick={handleFacilityClick}
        />
      ) : view === "admin" ? (
        userRole === "admin" ? (
          <AdminPanel switchView={setView} onLogout={handleLogout} userRole={userRole} />
        ) : (
          <ControlTower
            onLogout={handleLogout}
            switchView={setView}
            view={view}
            userRole={userRole}
            userPlan={userPlan}
            selectedFacility={selectedFacility}
            handleFacilityClick={handleFacilityClick}
            locationsUrl={locationsUrl}
          />
        )
      ) : view === "about" ? (
        <AboutUs switchView={setView} />
      ) : view === "reports" ? (
        <Reports simulationHistory={simulationHistory} switchView={setView} />
      ) : (
        <ControlTower
          onLogout={handleLogout}
          switchView={setView}
          view={view}
          userRole={userRole}
          userPlan={userPlan}
          simulationHistory={simulationHistory}
        />
      )}

      <UpgradeModal
        open={upgradeGate.open}
        required={upgradeGate.required}
        plan={upgradeGate.plan}
        onClose={() => setUpgradeGate((p) => ({ ...p, open: false }))}
        onBackToControlTower={() => {
          setUpgradeGate((p) => ({ ...p, open: false }));
          setView("control");
          window.history.replaceState(null, "", "/control-tower");
        }}
      />

      <ToastsHost />
    </>
  );
}