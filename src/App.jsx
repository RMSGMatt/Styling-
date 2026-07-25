import React, { useEffect, useState, useRef, useMemo } from "react";
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
async function buildExecutiveReportAfterSim(payload = {}) {
  try {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token");

    if (!token) {
      return null;
    }


    const res = await fetch(`${API_ROOT}/api/executive-report/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        source: "simulation",
        timestamp: payload?.run_id || payload?.id || payload?.timestamp || null,
        kpis: payload?.kpis || {},
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return null;
    }

    return data;
  } catch (err) {
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
  } catch (err) {
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


// TODO(Matthew): replace these with real per-unit dollar values before this
// feeds any customer-facing report. Previously this map only had entries for
// "FG1"/"C1" — SKU codes that don't exist anywhere in the actual network data
// (real SKUs are ECU_MODULE, TRANSMISSION_ECU, MCU, etc.) — so every SKU in
// every run silently fell through to DEFAULT_SKU_VALUE ($75), meaning every
// revenue exposure figure ever shown was (missed units) * $75, regardless of
// which component actually failed. The keys below now at least match real
// SKU codes; the dollar amounts are still placeholders, not sourced data.
const SKU_VALUE_MAP = {
  ECU_MODULE: 75,
  TRANSMISSION_ECU: 75,
  MCU: 75,
  POWER_IC: 75,
  SENSOR_IC: 75,
  MOSFET: 75,
  CAN_TRANSCEIVER: 75,
  MLCC_ARRAY: 75,
  PCB_SUBSTRATE: 75,
  CONNECTOR_ASSY: 75,
};

const DEFAULT_SKU_VALUE = 75;

function buildScenarioImpactSummary(flowRows = [], occurrenceRows = [], productionRows = [], executiveKpis = {}) {
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

  const byReason = (occurrenceRows || []).reduce((acc, r) => {
    const reason = String(r.reason || r.Reason || "UNKNOWN").trim();
    const qty = Number(r.unfulfilled ?? r.Unfulfilled ?? 0);
    acc[reason] = (acc[reason] || 0) + (Number.isFinite(qty) ? qty : 0);
    return acc;
  }, {});

  const missingComponents = byReason["MISSING_COMPONENTS"] || 0;

  const serviceLevel = Number(
    executiveKpis?.onTimeFulfillment ??
    executiveKpis?.serviceLevelPct ??
    0
  );

  const lateDemand = Number(
    executiveKpis?.lateFulfilledUnits ??
    executiveKpis?.demandAtRiskUnits ??
    0
  );

  const peakBacklog = Number(
    executiveKpis?.peakBacklogUnits ??
    executiveKpis?.unfulfilledDemandUnits ??
    0
  );

  const missedServiceDays = Number(
    executiveKpis?.missedServiceDays ??
    0
  );

  const ttrDays = Number(
    executiveKpis?.timeToRecoverDays ??
    0
  );

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

  if (serviceLevel >= 99 && lateDemand === 0) {
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
  } else if (lateDemand > 0 || serviceLevel < 95) {
    headline = missingComponents > 0
      ? "Component shortages constrained production and reduced service."
      : "Customer service degradation increased backlog across the network.";
    narrative =
      missingComponents > 0
        ? `Upstream material shortages prevented full production execution, contributing to ${missingComponents.toLocaleString()} missing component events and ${lateDemand.toLocaleString()} units of late demand. As the disruption propagated across ${impactedFacilities || 0} impacted facilities, service level fell to ${serviceLevel.toFixed(1)}%, indicating that mitigation actions were not sufficient to fully protect downstream service.`
        : `The model indicates that shipment performance fell below demand requirements, with ${lateDemand.toLocaleString()} units pushed late and on-time service level reduced to ${serviceLevel.toFixed(1)}%. While production continued, the network was unable to fully convert available supply into on-time fulfillment, signaling downstream service pressure and recovery risk.`;
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

  if (serviceLevel >= 99 && lateDemand === 0) {
    networkHealth = "healthy";
    networkHealthLabel = "🟢 Healthy Network";
  } else if (serviceLevel < 90) {
    networkHealth = "critical";
    networkHealthLabel = "🔴 Critical Supply Disruption";
  } else {
    networkHealth = "stress";
    networkHealthLabel = "🟠 Network Under Stress";
  }

  return {
    demand,
    shipped,
    serviceLevel,
    lateDemand,
    peakBacklog,
    missedServiceDays,
    ttrDays,
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
  const [selectedBaselineRunId, setSelectedBaselineRunId] = useState("");
  const [summaryStats, setSummaryStats] = useState({});
  const [kpis, setKpis] = useState({});
  // Tracks which run's data is currently displayed, as distinct from
  // "the most recent run in history." Without this, any background
  // history refresh (login, periodic refetch, etc.) silently overwrites
  // a deliberately-opened older run's KPIs with the newest run's numbers,
  // because several setKpis call sites backfill from simulationHistory[0]
  // with no way to tell that the user has since opened something else.
  const [currentlyViewedRunId, setCurrentlyViewedRunId] = useState(null);

  // ===============================
  // BASELINE KPI SELECTION LOGIC
  // ===============================
  const baselineOptions = useMemo(() => {
    if (!Array.isArray(simulationHistory) || simulationHistory.length < 2) return [];

    return simulationHistory.slice(1).map((run, index) => {
      const id = String(
        run?.run_id ||
        run?.id ||
        run?.createdAt ||
        run?.created_at ||
        run?.timestamp ||
        `baseline_${index + 1}`
      );

      const labelBase =
        run?.createdAt ||
        run?.created_at ||
        run?.timestamp ||
        `Run ${index + 2}`;

      return {
        id,
        label: `Run ${index + 2} • ${labelBase}`,
        entry: run,
      };
    });
  }, [simulationHistory]);

  useEffect(() => {
    if (!baselineOptions.length) {
      if (selectedBaselineRunId) setSelectedBaselineRunId("");
      return;
    }

    const exists = baselineOptions.some((o) => o.id === selectedBaselineRunId);
    if (!exists) setSelectedBaselineRunId(baselineOptions[0].id);
  }, [baselineOptions, selectedBaselineRunId]);

  const selectedBaselineEntry = useMemo(() => {
    if (!baselineOptions.length) return null;
    return (
      baselineOptions.find((o) => o.id === selectedBaselineRunId)?.entry ||
      baselineOptions[0]?.entry ||
      null
    );
  }, [baselineOptions, selectedBaselineRunId]);

  const baselineKpis = useMemo(() => {
    const run = selectedBaselineEntry;
    if (!run) return null;

    return (
      run?.report?.metrics?.kpis ||
      run?.executiveReport?.metrics?.kpis ||
      run?.raw?.kpis ||
      run?.kpis ||
      null
    );
  }, [selectedBaselineEntry]);

  const baselineLabel = useMemo(() => {
    if (!baselineOptions.length) return "No baseline selected";

    return (
      baselineOptions.find((o) => o.id === selectedBaselineRunId)?.label ||
      baselineOptions[0]?.label ||
      "Previous Run"
    );
  }, [baselineOptions, selectedBaselineRunId]);

  const [scenarioImpactSummary, setScenarioImpactSummary] = useState(null);

  const [disruptionImpactData, setDisruptionImpactData] = useState([]);
  const [projectedImpactData, setProjectedImpactData] = useState([]);
  const [runoutRiskData, setRunoutRiskData] = useState([]);
  const [countermeasuresData, setCountermeasuresData] = useState([]);

  const [locationsUrl, setLocationsUrl] = useState(null);
  const [scenarioData, setScenarioData] = useState({});
  const [lastRunScenarioData, setLastRunScenarioData] = useState(null);

  // Post-run deterministic pipeline gate: idle | seeding | primed
  const [postRunPhase, setPostRunPhase] = useState("idle");

  // Scenario Authority (Step 0)
  const scenarioRef = useRef({});
  const justPrimedRef = useRef(false);

  // Tracks whether backend supplied KPIs for the CURRENT run
  const backendKpisRef = useRef(false);
  const latestRunIdRef = useRef(null);

  const [userRole, setUserRole] = useState("");
  const [userPlan, setUserPlan] = useState("");

  const persistRunKpis = (targetRunId, finalKpis) => {
    if (!targetRunId || !finalKpis || typeof finalKpis !== "object") return;

    setSimulationHistory((prevHistory) => {
      const nextHistory = (Array.isArray(prevHistory) ? prevHistory : []).map((run) => {
        const runId =
          run?.run_id ??
          run?.runId ??
          run?.id ??
          run?.timestamp ??
          run?.created_at ??
          null;

        if (String(runId) !== String(targetRunId)) return run;

        return {
          ...run,
          kpis: {
            ...(run?.kpis || {}),
            ...finalKpis,
          },
          raw: {
            ...(run?.raw || {}),
            kpis: {
              ...(run?.raw?.kpis || {}),
              ...finalKpis,
            },
          },
        };
      });

      try {
        localStorage.setItem("forc_local_runs_v1", JSON.stringify(nextHistory));
      } catch (err) {
      }

      return nextHistory;
    });
  };

  // Keep scenario ref + localStorage sync
  useEffect(() => {
    scenarioRef.current = scenarioData || {};
    try {
      const hasScenario =
        scenarioData && typeof scenarioData === "object" && Object.keys(scenarioData).length > 0;

      if (hasScenario) {
        localStorage.setItem("currentScenarioJSON", JSON.stringify(scenarioData));
        setLastRunScenarioData(scenarioData);
      } else {
        localStorage.removeItem("currentScenarioJSON");
      }
    } catch (e) {
    }
  }, [scenarioData]);

  // Upgrade gate handler
  useEffect(() => {
    setUpgradeHandler(({ required, plan }) => {
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
        setUserRole("user");
      }

      // 2) Fetch DB-truth user info
      try {
        const res = await fetch(`${API_ROOT}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
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
    setSelectedFacility(facilityName);
  };

  // Remote history (Pro+) — merge with local
  // The /api/simulations endpoint returns flat field names (flow_url,
  // disruption_impact_url, countermeasures_url, etc.). Everywhere else in
  // the app — the download links in SimulationDashboard.jsx and
  // onReloadRun below — expects a nested outputUrls.{name}_output_file_url
  // shape instead. Without this translation, every download link/button
  // sourced from remote history silently renders href={undefined}.
  const normalizeRemoteRunUrls = (r) => ({
    ...r,
    outputUrls: {
      flow_output_file_url: r.flow_url ?? r.outputUrls?.flow_output_file_url,
      inventory_output_file_url: r.inventory_url ?? r.outputUrls?.inventory_output_file_url,
      production_output_file_url: r.production_url ?? r.outputUrls?.production_output_file_url,
      occurrence_output_file_url: r.occurrence_url ?? r.outputUrls?.occurrence_output_file_url,
      disruption_impact_output_file_url: r.disruption_impact_url ?? r.outputUrls?.disruption_impact_output_file_url,
      projected_impact_output_file_url: r.projected_impact_url ?? r.outputUrls?.projected_impact_output_file_url,
      runout_risk_output_file_url: r.runout_risk_url ?? r.outputUrls?.runout_risk_output_file_url,
      countermeasures_output_file_url: r.countermeasures_url ?? r.outputUrls?.countermeasures_output_file_url,
      locations_output_file_url: r.locations_url ?? r.outputUrls?.locations_output_file_url,
    },
  });

  const fetchSimulationHistory = async () => {
    try {
      const res = await apiClient.get("/api/simulations");
      const remote = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.simulations) ? res.data.simulations : [];
      const local = loadLocalRunsSafe();

      // merge (prefer remote)
      const merged = [

        ...remote.map((r) => ({ ...normalizeRemoteRunUrls(r), _source: "remote" })),
        ...local
          .filter((lr) => {
            const lid = lr?.id || lr?.run_id;
            return !remote.some((rr) => (rr?.id || rr?.run_id) === lid);
          })
          .map((r) => ({ ...r, _source: "local" })),
      ];

      setSimulationHistory(merged);
      // Merge backend kpis_json fields into kpis state — but only when the
      // user isn't actively viewing a specific older run (currentlyViewedRunId
      // unset, or it matches the latest run anyway). Without this guard, any
      // background refresh of this list — page load, login/token refresh,
      // periodic refetch — silently overwrites a deliberately-opened run's
      // KPIs with whatever is now most recent, discarding what "Open" loaded.
      try {
        const latest = merged?.[0];
        const latestId = latest?.run_id || latest?.id || null;
        const shouldBackfill = !currentlyViewedRunId || currentlyViewedRunId === latestId;
        console.log("[FORC-DEBUG] history-refresh kpis guard — currentlyViewedRunId:", currentlyViewedRunId, "latestId:", latestId, "shouldBackfill:", shouldBackfill);
        const backendKpis = shouldBackfill && latest?.kpis_json
          ? (typeof latest.kpis_json === "string" ? JSON.parse(latest.kpis_json) : latest.kpis_json)
          : null;
        if (backendKpis) {
          setKpis((prev) => ({
            ...prev,
            worstWeeklyServicePct: Number(backendKpis.worstWeeklyServicePct ?? 0),
            falseConfidenceDays:   Number(backendKpis.falseConfidenceDays   ?? 0),
            simulationStartDate: backendKpis.simulationStartDate ?? prev?.simulationStartDate ?? null,
            simulationEndDate: backendKpis.simulationEndDate ?? prev?.simulationEndDate ?? null,
            horizonWeeks: backendKpis.horizonWeeks ?? prev?.horizonWeeks ?? null,
            disruptionStartDate: backendKpis.disruptionStartDate ?? prev?.disruptionStartDate ?? null,
            firstServiceImpactDate: backendKpis.firstServiceImpactDate ?? prev?.firstServiceImpactDate ?? null,
          }));
        }
      } catch {}
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setSimulationHistory(loadLocalRunsSafe());
        return;
      }
      setSimulationHistory(loadLocalRunsSafe());
    }
  };

  // Robust chart data loader — single source of truth
  const loadFilteredChart = async (urls, outputType, skuFilterRaw) => {
    try {

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
    let invUnitsBySkuDate = {}; // sku -> {date -> units}, populated in the inventory block below, used later for Days on Hand once demand rates are available
    let invUnitsBySkuDateByScope = { CLIENT_SITE: {}, OUR_FACILITIES: {} }; // same shape, split by whether the facility is the OEM/client site or one of our own upstream facilities

    // Facility scope — distinguishes component stock physically sitting at
    // the client's (OEM's) own site from stock at our own upstream
    // facilities. If the client is running thin, that's real exposure even
    // when our own facilities look perfectly healthy, so this needs to be
    // visible as its own dimension, not blended into one network average.
    // Uses locations.csv's own Tier column (explicit "OEM" tag) rather than
    // inferring from facility naming conventions or network topology, which
    // wouldn't generalize across different customers' networks.
    let facilityTierMap = {};
    try {
      if (files?.locations) {
        const locationsText = await files.locations.text();
        const parsedLocations = Papa.parse(locationsText.replace(/^\uFEFF/, ""), {
          header: true, skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
        });
        (parsedLocations.data || []).forEach((row) => {
          const rowKeys = Object.keys(row || {});
          const facKeyLocal = rowKeys.find((k) => ["facility", "facility_id", "location"].includes(k.toLowerCase().trim()));
          const tierKeyLocal = rowKeys.find((k) => k.toLowerCase().trim() === "tier");
          const fac = facKeyLocal ? String(row[facKeyLocal] || "").toUpperCase().trim() : null;
          const tier = tierKeyLocal ? row[tierKeyLocal] : null;
          if (fac && tier) facilityTierMap[fac] = String(tier).trim();
        });
      }
    } catch (e) {
      console.error("locations.csv facility-tier parsing failed:", e);
    }
    const scopeForFacility = (fac) =>
      facilityTierMap[String(fac || "").toUpperCase().trim()] === "OEM" ? "CLIENT_SITE" : "OUR_FACILITIES";

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

        // ----- INVENTORY VALUE & CARRYING COST -----
        // ending_inventory (already parsed above via invRows) valued against
        // real per-SKU unit costs when unit_costs.csv was provided, falling
        // back to the same $30/unit default the backend Safety Stock engine
        // uses when it isn't. Category-level carrying-cost rates reflect
        // that different part types genuinely cost different amounts to
        // hold — a semiconductor's small reeled-tape storage footprint
        // largely offsets its real obsolescence/EOL risk against a bulkier
        // finished assembly's lower obsolescence but higher shelf-space
        // cost, landing both in a similar overall range, while mature
        // commodity passives and PCB substrate sit meaningfully lower.
        // Hardcoded for now against this network's known ~10 SKUs; a
        // drop-in AI-classification replacement (same category->rate output
        // shape) is the natural next step once this needs to generalize to
        // unknown SKU lists from other prospects, where a fixed lookup
        // table isn't an option.
        try {
          const SKU_CARRYING_RATE = {
            // Semiconductors/ICs
            MCU: 0.195, POWER_IC: 0.195, SENSOR_IC: 0.195, CAN_TRANSCEIVER: 0.195, MOSFET: 0.195,
            // Passives/commodity
            MLCC_ARRAY: 0.135, CONNECTOR_ASSY: 0.135,
            // PCB/substrate
            PCB_SUBSTRATE: 0.15,
            // Finished/assembled
            ECU_MODULE: 0.20, TRANSMISSION_ECU: 0.20,
          };
          const DEFAULT_CARRYING_RATE = 0.18;
          const DEFAULT_UNIT_COST = 30.0;

          let unitCostBySku = {};
          if (files?.unitCosts) {
            const unitCostsText = await files.unitCosts.text();
            const parsedUnitCosts = Papa.parse(unitCostsText.replace(/^\uFEFF/, ""), {
              header: true, skipEmptyLines: true,
              transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
            });
            (parsedUnitCosts.data || []).forEach((row) => {
              const rowKeys = Object.keys(row || {});
              const skuKeyLocal = rowKeys.find((k) => ["sku", "material", "part_number", "part"].includes(k.toLowerCase().trim()));
              const costKeyLocal = rowKeys.find((k) => ["unit_cost", "cost", "price", "unit_price"].includes(k.toLowerCase().trim()));
              const rowSku = skuKeyLocal ? row[skuKeyLocal] : null;
              const rowCost = costKeyLocal ? Number(row[costKeyLocal]) : NaN;
              if (rowSku && Number.isFinite(rowCost) && rowCost > 0) unitCostBySku[rowSku] = rowCost;
            });
          }

          // Network-wide (unfiltered) inventory value per date and per-SKU
          // per date, needed to compute both the peak/average total dollar
          // investment and each SKU's own carrying cost against its own
          // category rate. Also segmented by facility scope (client site
          // vs our own facilities) alongside the unsegmented totals.
          const valueByDate = {};
          const skuDailyValues = {};
          const allInvDates = new Set();
          const valueByDateByScope = { CLIENT_SITE: {}, OUR_FACILITIES: {} };
          const skuDailyValuesByScope = { CLIENT_SITE: {}, OUR_FACILITIES: {} };
          invRows.forEach((r) => {
            const date = r.date || r.Date || r.day || r.Day;
            const sku = normalizeSku(r[skuKey] || r.sku || r.SKU);
            const units = toNum(r[invKey]);
            if (!date || !sku || !Number.isFinite(units)) return;
            const cost = unitCostBySku[sku] ?? DEFAULT_UNIT_COST;
            const value = units * cost;
            valueByDate[date] = (valueByDate[date] || 0) + value;
            skuDailyValues[sku] = skuDailyValues[sku] || {};
            skuDailyValues[sku][date] = (skuDailyValues[sku][date] || 0) + value;
            invUnitsBySkuDate[sku] = invUnitsBySkuDate[sku] || {};
            invUnitsBySkuDate[sku][date] = (invUnitsBySkuDate[sku][date] || 0) + units;
            allInvDates.add(date);

            const scope = scopeForFacility(r[facKey] || r.facility);
            valueByDateByScope[scope][date] = (valueByDateByScope[scope][date] || 0) + value;
            skuDailyValuesByScope[scope][sku] = skuDailyValuesByScope[scope][sku] || {};
            skuDailyValuesByScope[scope][sku][date] = (skuDailyValuesByScope[scope][sku][date] || 0) + value;
            invUnitsBySkuDateByScope[scope][sku] = invUnitsBySkuDateByScope[scope][sku] || {};
            invUnitsBySkuDateByScope[scope][sku][date] = (invUnitsBySkuDateByScope[scope][sku][date] || 0) + units;
          });

          const dailyValues = Object.values(valueByDate);
          const avgInventoryValue = dailyValues.length ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
          const peakInventoryValue = dailyValues.length ? Math.max(...dailyValues) : 0;

          // Carrying cost over the actual simulated window: for each SKU,
          // its own average daily inventory value * its category rate *
          // (days this simulation actually covers / 365) — the real dollar
          // cost of holding that SKU's typical level for this run's own
          // horizon, not an arbitrary annualized projection.
          const simulationDays = allInvDates.size || 1;

          const computeCarrying = (skuDailyValuesLocal) => {
            let total = 0;
            Object.keys(skuDailyValuesLocal).forEach((sku) => {
              const skuValues = Object.values(skuDailyValuesLocal[sku]);
              const skuAvgValue = skuValues.length ? skuValues.reduce((a, b) => a + b, 0) / skuValues.length : 0;
              const rate = SKU_CARRYING_RATE[sku] ?? DEFAULT_CARRYING_RATE;
              total += skuAvgValue * rate * (simulationDays / 365);
            });
            return total;
          };
          const totalCarryingCost = computeCarrying(skuDailyValues);

          allKpis.avgInventoryValueUsd = Math.round(avgInventoryValue);
          allKpis.peakInventoryValueUsd = Math.round(peakInventoryValue);
          allKpis.totalCarryingCostUsd = Math.round(totalCarryingCost);
          allKpis.inventoryValueUsedRealCosts = Object.keys(unitCostBySku).length > 0;

          // Same figures, segmented by facility scope — component stock
          // physically at the client's (OEM's) own site vs our own
          // upstream facilities. Only populated if locations.csv provided
          // real facility-tier data to classify against.
          if (Object.keys(facilityTierMap).length > 0) {
            allKpis.inventoryByScope = {};
            ["CLIENT_SITE", "OUR_FACILITIES"].forEach((scope) => {
              const scopeDailyValues = Object.values(valueByDateByScope[scope]);
              const scopeAvg = scopeDailyValues.length ? scopeDailyValues.reduce((a, b) => a + b, 0) / scopeDailyValues.length : 0;
              const scopePeak = scopeDailyValues.length ? Math.max(...scopeDailyValues) : 0;
              const scopeCarrying = computeCarrying(skuDailyValuesByScope[scope]);
              allKpis.inventoryByScope[scope] = {
                avgInventoryValueUsd: Math.round(scopeAvg),
                peakInventoryValueUsd: Math.round(scopePeak),
                totalCarryingCostUsd: Math.round(scopeCarrying),
              };
            });
          }
        } catch (e) {
          console.error("Inventory value / carrying cost computation failed:", e);
        }
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
          }
        } catch (e) {
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

        const demandBySku = scopedDemandRows.reduce((acc, r) => {
          const sku = normalizeSku(r[demandSkuKey] || r.sku || r.SKU);
          const qty = toNum(r[demandQtyKey]);
          if (!sku) return acc;
          acc[sku] = (acc[sku] || 0) + qty;
          return acc;
        }, {});

        // ----- DAYS ON HAND -----
        // Descriptive (what's actually being carried right now, from real
        // simulated inventory levels) — distinct from Safety Stock's
        // days_coverage, which is prescriptive (what SHOULD be carried
        // against demand/lead-time variability). Uses the RAW, unfiltered
        // demand.csv (not scopedDemandRows, which reflects whatever
        // SKU/facility filter happens to be selected in the UI right now)
        // so this stays a genuine network-wide figure regardless of what's
        // currently selected elsewhere on the dashboard.
        try {
          const demandDateKey = pickFirstKey(demandSample, ["date", "day", "timestamp", "time"]) || "date";
          const demandTotalBySku = {};
          const demandDatesBySku = {};
          demandRows.forEach((r) => {
            const sku = normalizeSku(r[demandSkuKey] || r.sku || r.SKU);
            const qty = toNum(r[demandQtyKey]);
            const date = r[demandDateKey] || r.date || r.Date;
            if (!sku || !Number.isFinite(qty)) return;
            demandTotalBySku[sku] = (demandTotalBySku[sku] || 0) + qty;
            if (date) {
              demandDatesBySku[sku] = demandDatesBySku[sku] || new Set();
              demandDatesBySku[sku].add(date);
            }
          });

          const avgDailyDemandBySku = {};
          Object.keys(demandTotalBySku).forEach((sku) => {
            const uniqueDays = demandDatesBySku[sku]?.size || 1;
            avgDailyDemandBySku[sku] = demandTotalBySku[sku] / uniqueDays;
          });

          const computeDoh = (unitsBySkuDateLocal) => {
            const values = [];
            const valuesBySku = {};
            Object.keys(unitsBySkuDateLocal).forEach((sku) => {
              const rate = avgDailyDemandBySku[sku];
              if (!rate || rate <= 0) return; // no demand rate for this SKU -- DOH undefined, skip rather than divide by zero
              Object.values(unitsBySkuDateLocal[sku]).forEach((units) => {
                const doh = units / rate;
                values.push(doh);
                valuesBySku[sku] = valuesBySku[sku] || [];
                valuesBySku[sku].push(doh);
              });
            });
            const bySku = {};
            Object.keys(valuesBySku).forEach((sku) => {
              const vals = valuesBySku[sku];
              bySku[sku] = {
                avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
                peak: Math.round(Math.max(...vals) * 10) / 10,
                low: Math.round(Math.min(...vals) * 10) / 10,
              };
            });
            return {
              avg: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
              peak: values.length ? Math.round(Math.max(...values) * 10) / 10 : null,
              low: values.length ? Math.round(Math.min(...values) * 10) / 10 : null,
              bySku,
            };
          };

          const dohAll = computeDoh(invUnitsBySkuDate);
          allKpis.avgDaysOnHand = dohAll.avg;
          allKpis.peakDaysOnHand = dohAll.peak;
          allKpis.lowDaysOnHand = dohAll.low;

          // Per-SKU breakdown, so the UI can let someone drill into a
          // specific component instead of only seeing the network-wide
          // blend — a single SKU running dangerously low can be completely
          // hidden inside a healthy-looking network average.
          allKpis.daysOnHandBySku = dohAll.bySku;

          // Same breakdown, segmented by facility scope — Days on Hand at
          // the client's own site vs our own upstream facilities. Only
          // populated if locations.csv provided real facility-tier data.
          if (Object.keys(facilityTierMap).length > 0) {
            allKpis.daysOnHandByScope = allKpis.daysOnHandByScope || {};
            ["CLIENT_SITE", "OUR_FACILITIES"].forEach((scope) => {
              const dohScope = computeDoh(invUnitsBySkuDateByScope[scope]);
              allKpis.daysOnHandByScope[scope] = dohScope;
            });
          }
        } catch (e) {
          console.error("Days on Hand computation failed:", e);
        }

        

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
          
        // Filter demand to analysis window only (exclude warmup period)
        const analysisStartDate = customerShipRows.length > 0
          ? customerShipRows[0].date
          : null;

        const filteredDemandRows = analysisStartDate
          ? scopedDemandRows.filter((r) => {
              const d = String(r.date || r.Date || r.day || "").slice(0, 10);
              return d >= analysisStartDate;
            })
          : scopedDemandRows;

        const totalDemand = filteredDemandRows.reduce((sum, r) => sum + toNum(r[demandQtyKey]), 0);

        const demandMixBySku = Object.fromEntries(
          Object.entries(demandBySku).map(([sku, qty]) => [
            sku,
            totalDemand > 0 ? qty / totalDemand : 0,
          ])
        );

        const fulfilledCustomerShip = customerShipRows.reduce((sum, r) => sum + toNum(r.flow), 0);
        const latestBacklogOut =
          customerShipRows.length > 0
            ? toNum(customerShipRows[customerShipRows.length - 1].backlogOut)
            : Math.max(0, totalDemand - fulfilledCustomerShip);

        const fulfillmentFracRaw = totalDemand > 0 ? fulfilledCustomerShip / totalDemand : 0;
        const fulfillmentFrac = Math.max(0, Math.min(1, fulfillmentFracRaw));
        const backorderVolume = Math.max(0, latestBacklogOut);
        const backorderRateFrac = totalDemand > 0 ? backorderVolume / totalDemand : 0;
        const missedDemandQty = Math.max(0, totalDemand - fulfilledCustomerShip);

        allKpis.demandFulfillment = `${(100 * fulfillmentFrac).toFixed(1)}%`;
        allKpis.endingBacklogRate = `${(100 * backorderRateFrac).toFixed(1)}%`;
        allKpis.backorderVolume = `${Math.round(backorderVolume)}`;

        // Canonical decision-engine KPI fields (numeric where possible)
        allKpis.onTimeFill = Number((100 * fulfillmentFrac).toFixed(2));
        allKpis.peakBacklog = Math.round(backorderVolume);
        allKpis.unitsAtRisk = Math.round(backorderVolume);

        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        const datedCustomerShipRows = customerShipRows.filter((r) => {
          const dt = new Date(r.date);
          return r.date && !Number.isNaN(dt.getTime());
        });

        const impactedRows = datedCustomerShipRows.filter((r) => toNum(r.backlogOut) > 0);

        const firstObservedDate =
          datedCustomerShipRows.length > 0
            ? new Date(datedCustomerShipRows[0].date)
            : null;

        const lastObservedDate =
          datedCustomerShipRows.length > 0
            ? new Date(datedCustomerShipRows[datedCustomerShipRows.length - 1].date)
            : null;

        const firstImpactDate =
          impactedRows.length > 0
            ? new Date(impactedRows[0].date)
            : null;

        const recoveryRow =
          firstImpactDate
            ? datedCustomerShipRows.find((r) => {
                const dt = new Date(r.date);
                return dt >= firstImpactDate && toNum(r.backlogOut) <= 0;
              })
            : null;

        const recoveryDate =
          recoveryRow?.date
            ? new Date(recoveryRow.date)
            : lastObservedDate;

        const missedServiceDays = impactedRows.length;

        const ttsDays =
          firstObservedDate && firstImpactDate
            ? Math.max(0, Math.round((firstImpactDate - firstObservedDate) / MS_PER_DAY))
            : 0;

        const ttrDays =
          firstImpactDate && recoveryDate
            ? Math.max(0, Math.round((recoveryDate - firstImpactDate) / MS_PER_DAY))
            : 0;

        allKpis.missedServiceDays = missedServiceDays;
        allKpis.ttsDays = ttsDays;
        allKpis.ttrDays = ttrDays;

        // Backward-compatible aliases for existing UI
        allKpis.onTimeFulfillment = allKpis.demandFulfillment;
        allKpis.backorderRate = allKpis.endingBacklogRate;

        const estimatedRevenueExposure = missedDemandQty > 0
          ? Object.entries(demandMixBySku).reduce((sum, [sku, share]) => {
              const unitValue = SKU_VALUE_MAP[sku] || DEFAULT_SKU_VALUE;
              return sum + missedDemandQty * share * unitValue;
            }, 0)
          : 0;

        const endingBacklogExposure = backorderVolume > 0
          ? Object.entries(demandMixBySku).reduce((sum, [sku, share]) => {
              const unitValue = SKU_VALUE_MAP[sku] || DEFAULT_SKU_VALUE;
              return sum + backorderVolume * share * unitValue;
            }, 0)
          : 0;

        allKpis.estimatedRevenueExposure = estimatedRevenueExposure;
        allKpis.endingBacklogExposure = endingBacklogExposure;
        allKpis.revenueExposure = allKpis.estimatedRevenueExposure;

        if (avgInventoryNum > 0 && invUniqueDays > 0) {
          const annualFactor = 365 / Math.max(invUniqueDays, 1);
          const annualizedThroughput = fulfilledCustomerShip * annualFactor;
          const turns = annualizedThroughput / avgInventoryNum;
          allKpis.estimatedInventoryTurns = `${turns.toFixed(1)}x`;
          allKpis.inventoryTurns = allKpis.estimatedInventoryTurns;
        } else {
          allKpis.estimatedInventoryTurns = "N/A";
          allKpis.inventoryTurns = allKpis.estimatedInventoryTurns;
        }

        // ----- INVENTORY BUFFER INDEX (days of demand coverage) -----
        try {
          const avgDailyDemand = invUniqueDays > 0 ? totalDemand / Math.max(invUniqueDays, 1) : 0;
          if (avgInventoryNum > 0 && avgDailyDemand > 0) {
            const ibiDays = avgInventoryNum / avgDailyDemand;
            allKpis.estimatedDaysCoverage = `${ibiDays.toFixed(1)} days`;
            allKpis.inventoryBuffer = allKpis.estimatedDaysCoverage;
          } else {
            allKpis.estimatedDaysCoverage = "N/A";
            allKpis.inventoryBuffer = allKpis.estimatedDaysCoverage;
          }
        } catch (e) {
          allKpis.estimatedDaysCoverage = "N/A";
          allKpis.inventoryBuffer = allKpis.estimatedDaysCoverage;
        }

        
        // 🔥 CORRECTED SERVICE TRUTH (date-aware)
        let onTimeFulfilled = 0;
        let lateFulfilled = 0;
        let runningBacklog = 0;
        let peakBacklog = 0;
        let missedDays = 0;

        const demandByDate = {};
        const shipByDate = {};

        // Build demand from the demand CSV (source of truth) not flow rows
        filteredDemandRows.forEach((r) => {
          const dateVal = String(r.date || r.Date || r.day || "").slice(0, 10);
          const qty = toNum(r[demandQtyKey]);
          if (dateVal) demandByDate[dateVal] = (demandByDate[dateVal] || 0) + qty;
        });

        // Build shipments from customer ship flow rows
        customerShipRows.forEach((r) => {
          const d = String(r.date || "").slice(0, 10);
          if (d) shipByDate[d] = (shipByDate[d] || 0) + toNum(r.flow);
        });

        const orderedDates = Object.keys(demandByDate).sort();

        orderedDates.forEach((d) => {
          const demand = demandByDate[d] || 0;
          const shipped = shipByDate[d] || 0;

          const onTime = Math.min(shipped, demand);
          const late = Math.max(0, shipped - demand);

          onTimeFulfilled += onTime;
          lateFulfilled += late;

          runningBacklog += demand - onTime;

          if (runningBacklog > peakBacklog) peakBacklog = runningBacklog;
          if (demand > onTime) missedDays += 1;

          if (late > 0) {
            runningBacklog = Math.max(0, runningBacklog - late);
          }
        });

        const correctedOnTimePct =
          totalDemand > 0 ? (onTimeFulfilled / totalDemand) * 100 : 0;

        // 🔥 OVERRIDE KPIs WITH CORRECT VALUES
        allKpis.onTimeFulfillment = correctedOnTimePct;
        allKpis.lateFulfilledUnits = lateFulfilled;
        allKpis.peakBacklogUnits = peakBacklog;
        allKpis.missedServiceDays = missedDays;

        // ── Scenario Bridge Inventory (per-SKU, from THIS specific run) ──────
        // Runs the exact same running-backlog algorithm as peakBacklogUnits
        // above (onTime/late/runningBacklog), but grouped per SKU instead of
        // collapsed into one network-wide total. This is deliberately kept
        // separate from the Safety Stock Optimizer: Safety Stock reflects
        // steady-state statistical variability and is identical whether or
        // not a disruption is loaded, while this reflects what THIS specific
        // simulated run actually showed — a calm baseline naturally produces
        // ~zero bridge inventory, a real disruption produces a real, non-zero
        // number, and the two will no longer look confusingly identical.
        try {
          const bridgeDemandBySkuDate = {};
          const bridgeShipBySkuDate = {};

          scopedDemandRows.forEach((r) => {
            const sku = normalizeSku(r[demandSkuKey] || r.sku || r.SKU);
            const dateVal = String(r.date || r.Date || r.day || "").slice(0, 10);
            const qty = toNum(r[demandQtyKey]);
            if (!sku || !dateVal) return;
            bridgeDemandBySkuDate[sku] = bridgeDemandBySkuDate[sku] || {};
            bridgeDemandBySkuDate[sku][dateVal] = (bridgeDemandBySkuDate[sku][dateVal] || 0) + qty;
          });

          flowRows.forEach((r) => {
            const sku = normalizeSku(r[flowSkuKey] || r.sku);
            if (skuFilter.length > 0 && !skuFilter.includes(sku)) return;
            const ft = lower(r[flowTypeKey] || r.flow_type || r.type);
            const isCustomerShip = ft === "customer_ship" || ft === "customer ship" || ft === "customership";
            if (!isCustomerShip) return;
            const dateVal = String(r[dateKey] || "").slice(0, 10);
            const qty = toNum(r[flowQtyKey]);
            if (!sku || !dateVal) return;
            bridgeShipBySkuDate[sku] = bridgeShipBySkuDate[sku] || {};
            bridgeShipBySkuDate[sku][dateVal] = (bridgeShipBySkuDate[sku][dateVal] || 0) + qty;
          });

          const bridgeInventoryBySku = Object.keys(bridgeDemandBySkuDate).map((sku) => {
            const demandByDate = bridgeDemandBySkuDate[sku];
            const shipByDate = bridgeShipBySkuDate[sku] || {};
            const dates = Object.keys(demandByDate).sort();
            let runningBacklog = 0;
            let peak = 0;
            let totalLate = 0;
            dates.forEach((d) => {
              const demand = demandByDate[d] || 0;
              const shipped = shipByDate[d] || 0;
              const onTime = Math.min(shipped, demand);
              const late = Math.max(0, shipped - demand);
              runningBacklog += demand - onTime;
              if (runningBacklog > peak) peak = runningBacklog;
              if (late > 0) runningBacklog = Math.max(0, runningBacklog - late);
              totalLate += late;
            });
            return { sku, bridgeInventoryUnits: Math.round(peak), lateUnits: Math.round(totalLate) };
          })
            .filter((r) => r.bridgeInventoryUnits > 0)
            .sort((a, b) => b.bridgeInventoryUnits - a.bridgeInventoryUnits);

          allKpis.bridgeInventoryBySku = bridgeInventoryBySku;

          // Revenue Exposure — previously a flat $100 per late-fulfilled
          // unit network-wide, regardless of which SKU those units actually
          // were (a $5 connector and a $95 assembled ECU were valued
          // identically). If the optional unit_costs.csv was uploaded,
          // weight each SKU's own late units by its own real cost instead;
          // SKUs not covered by that file still fall back to $100/unit
          // individually, rather than the whole computation reverting to a
          // single flat total the moment any one SKU is missing.
          try {
            let unitCostBySku = {};
            if (files?.unitCosts) {
              const unitCostsText = await files.unitCosts.text();
              const parsedUnitCosts = Papa.parse(unitCostsText.replace(/^\uFEFF/, ""), {
                header: true, skipEmptyLines: true,
                transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
              });
              (parsedUnitCosts.data || []).forEach((row) => {
                const rowKeys = Object.keys(row || {});
                const skuKey = rowKeys.find((k) => ["sku", "material", "part_number", "part"].includes(k.toLowerCase().trim()));
                const costKey = rowKeys.find((k) => ["unit_cost", "cost", "price", "unit_price"].includes(k.toLowerCase().trim()));
                const rowSku = skuKey ? row[skuKey] : null;
                const rowCost = costKey ? Number(row[costKey]) : NaN;
                if (rowSku && Number.isFinite(rowCost) && rowCost > 0) unitCostBySku[rowSku] = rowCost;
              });
            }
            const FALLBACK_UNIT_VALUE = 100;
            const weightedRevenueExposure = bridgeInventoryBySku.reduce((sum, row) => {
              const cost = unitCostBySku[row.sku] ?? FALLBACK_UNIT_VALUE;
              return sum + (row.lateUnits || 0) * cost;
            }, 0);
            allKpis.weightedRevenueExposure = Math.round(weightedRevenueExposure);
            allKpis.revenueExposureUsedRealCosts = Object.keys(unitCostBySku).length > 0;
          } catch (e) {
            console.error("weightedRevenueExposure computation failed:", e);
            allKpis.weightedRevenueExposure = 0;
            allKpis.revenueExposureUsedRealCosts = false;
          }
        } catch (e) {
          console.error("bridgeInventoryBySku computation failed:", e);
          allKpis.bridgeInventoryBySku = [];
        }
// 🔥 OVERRIDE serviceTruth WITH CORRECT VALUES
      const serviceTruth = {
        totalDemand,
        onTimeFillRatePct: correctedOnTimePct,
        lateFulfilledUnits: Math.max(
          0,
          Number(fulfilledCustomerShip || 0) - Number(onTimeFulfilled || 0)
        ),
        peakBacklogUnits: peakBacklog,
        daysWithMissedService: missedDays,
      };

      allKpis.serviceTruth = serviceTruth;
        allKpis.onTimeFulfillment = Number(serviceTruth?.onTimeFillRatePct || 0);
        allKpis.lateFulfilledUnits = Number(serviceTruth?.lateFulfilledUnits || 0);
        allKpis.unitsAtRisk = Number(serviceTruth?.lateFulfilledUnits || 0);
        allKpis.peakBacklogUnits = Number(serviceTruth?.peakBacklogUnits || 0);
        allKpis.peakBacklog = Number(serviceTruth?.peakBacklogUnits || 0);
        // ----- DEMAND AT RISK (true exposure metric) -----
        // Sum of that day's NEW demand (not backlog level) across every
        // facility/SKU/day that ended with any standing unmet demand —
        // i.e., total units of customer commitment touched by the
        // disruption, whether eventually shipped on time, late, or still
        // outstanding. This accumulates across every degraded day rather
        // than capturing a single peak snapshot, so it stays meaningfully
        // distinct from Peak Backlog even when SKUs are disrupted in sync
        // (a single shared upstream cause hitting correlated SKUs on the
        // same days, which makes any peak-based metric collapse to the
        // same number as Peak Backlog by construction).
        let demandAtRiskUnits = 0;
        flowRows.forEach((r) => {
          const sku = normalizeSku(r[flowSkuKey] || r.sku);
          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          if (!skuMatch) return;

          const ft = lower(r[flowTypeKey] || r.flow_type || r.type);
          const isCustomerShip =
            ft === "customer_ship" || ft === "customer ship" || ft === "customership";
          if (!isCustomerShip) return;

          const backlogOutVal = toNum(r[backlogOutKey] ?? r.backlog_out ?? 0);
          if (backlogOutVal <= 0) return;

          const demandVal = toNum(r.demand ?? r.Demand ?? 0);
          demandAtRiskUnits += demandVal;
        });
        allKpis.demandAtRiskUnits = demandAtRiskUnits;

        allKpis.missedServiceDays = Number(serviceTruth?.daysWithMissedService || 0);

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
        allKpis.occurrenceUnfulfilledUnits = filtered.reduce(
          (sum, r) => sum + toNum(r.unfulfilled ?? r.Unfulfilled ?? 0),
          0
        );

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
            allKpis.ttrDays = diffDays;
            allKpis.timeToRecoverDays = diffDays;
          } else {
            allKpis.timeToRecovery = "N/A";
          }
        } catch (e) {
          allKpis.timeToRecovery = "N/A";
        }
      }

      
      const toNumber = (v) => {
        if (v == null || v === "") return 0;
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const cleaned = v.replace(/[$,%]/g, "");
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };

      const serviceTruth =
        allKpis?.serviceTruth ??
        allKpis?.service_truth ??
        {};

      const normalizedServiceKpis = {
          serviceLevelPct: Number(
            serviceTruth?.onTimeFillRatePct ??
            serviceTruth?.onTimeFillPct ??
            toNumber(allKpis?.onTimeFulfillment) ??
            0
          ),
        onTimeFulfillment: Number(
          serviceTruth?.onTimeFillRatePct ??
          serviceTruth?.onTimeFillPct ??
          toNumber(allKpis?.onTimeFulfillment) ??
          toNumber(allKpis?.onTimeFill) ??
          toNumber(allKpis?.demandFulfillment) ??
          0
        ),
        lateFulfilledUnits: Number(
          serviceTruth?.lateFulfilledUnits ?? 0
        ),
        peakBacklogUnits: Number(
          serviceTruth?.peakBacklogUnits ??
          serviceTruth?.peakBacklog ??
          serviceTruth?.backorderVolume ??
          allKpis?.peakBacklogUnits ??
          allKpis?.peakBacklog ??
          0
        ),
        missedServiceDays: Number(
          serviceTruth?.daysWithMissedService ??
          serviceTruth?.missedServiceDays ??
          allKpis?.missedServiceDays ??
          0
        ),
        timeToRecoverDays: Number(
          serviceTruth?.timeToRecoverDays ??
          serviceTruth?.avgTimeToRecovery ??
          allKpis?.timeToRecoverDays ??
          allKpis?.ttrDays ??
          allKpis?.avgTimeToRecovery ??
          0
        ),
        timeToSurviveDays: Number(
          serviceTruth?.timeToSurviveDays ??
          serviceTruth?.ttsDays ??
          allKpis?.timeToSurviveDays ??
          allKpis?.ttsDays ??
          0
        ),
        unitsAtRisk: Number(
          allKpis?.lateFulfilledUnits ?? 0
        ),
        peakBacklog: Number(
          serviceTruth?.peakBacklogUnits ??
          serviceTruth?.peakBacklog ??
          serviceTruth?.backorderVolume ??
          allKpis?.peakBacklog ??
          0
        ),
        ttrDays: Number(
          serviceTruth?.timeToRecoverDays ??
          serviceTruth?.avgTimeToRecovery ??
          allKpis?.ttrDays ??
          allKpis?.avgTimeToRecovery ??
          0
        ),
        ttsDays: Number(
          serviceTruth?.timeToSurviveDays ??
          serviceTruth?.ttsDays ??
          allKpis?.ttsDays ??
          0
        ),
      };
      const sumRevenueFromImpactRows = (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return 0;

        return rows.reduce((sum, row) => {
          const value = Number(
            row?.revenue_at_risk ??
            row?.revenueAtRisk ??
            row?.estimated_revenue_exposure ??
            row?.estimatedRevenueExposure ??
            row?.revenue_exposure ??
            row?.revenueExposure ??
            row?.financial_impact ??
            row?.financialImpact ??
            row?.estimated_loss ??
            row?.estimatedLoss ??
            row?.revenue_at_risk_usd ??
            row?.revenueAtRiskUsd ??
            row?.value_at_risk ??
            row?.valueAtRisk ??
            0
          );
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
      };

      const projectedImpactRowsForRevenue =
        urls?.projected_impact_output_file_url
          ? await fetchCsvRows(urls.projected_impact_output_file_url)
          : [];
      const disruptionImpactRowsForRevenue =
        urls?.disruption_impact_output_file_url
          ? await fetchCsvRows(urls.disruption_impact_output_file_url)
          : [];

      const rowLevelRevenueExposure =
        sumRevenueFromImpactRows(projectedImpactRowsForRevenue) ||
        sumRevenueFromImpactRows(disruptionImpactRowsForRevenue) ||
        0;

      const finalKpis = {
        ...allKpis,
        ...normalizedServiceKpis,
        estimatedRevenueExposure: rowLevelRevenueExposure || allKpis.weightedRevenueExposure || (serviceTruth?.lateFulfilledUnits || 0) * 100,
        revenueExposure: rowLevelRevenueExposure || allKpis.weightedRevenueExposure || (serviceTruth?.lateFulfilledUnits || 0) * 100,
      };

      const executiveKpis = {
  serviceLevelPct: Number(allKpis?.onTimeFulfillment ?? 0),
  demandAtRiskUnits: Number(allKpis?.demandAtRiskUnits ?? allKpis?.occurrenceUnfulfilledUnits ?? allKpis?.lateFulfilledUnits ?? allKpis?.peakBacklogUnits ?? 0),
  unfulfilledDemandUnits: Number(allKpis?.peakBacklogUnits ?? 0),
  missedServiceDays: Number(allKpis?.missedServiceDays ?? 0),
  timeToRecoverDays: Number(allKpis?.ttrDays ?? allKpis?.timeToRecoverDays ?? 0),
  timeToSurviveDays: Number(allKpis?.ttsDays ?? allKpis?.timeToSurviveDays ?? 0),
  revenueExposure: Number(allKpis?.estimatedRevenueExposure ?? 0),
  onTimeFulfillment: Number(allKpis?.onTimeFulfillment ?? 0),
  lateFulfilledUnits: Number(allKpis?.lateFulfilledUnits ?? 0),
  peakBacklogUnits: Number(allKpis?.peakBacklogUnits ?? 0),
};

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
          productionRowsForSummary,
          executiveKpis
        );

        setScenarioImpactSummary(summary);
      } catch (e) {
        setScenarioImpactSummary(null);
      }

      
      // 🔥 FINAL OVERRIDE — force correct service KPIs
      kpis.lateFulfilledUnits = Number(serviceTruth?.lateFulfilledUnits || 0);
      kpis.unitsAtRisk = Number(serviceTruth?.lateFulfilledUnits || 0);
      kpis.peakBacklog = Number(serviceTruth?.peakBacklogUnits || 0);
      kpis.peakBacklogUnits = Number(serviceTruth?.peakBacklogUnits || 0);
      kpis.missedServiceDays = Number(serviceTruth?.daysWithMissedService || 0);

      
      persistRunKpis(latestRunIdRef.current, finalKpis);
      // Merge, don't replace: finalKpis is computed client-side and doesn't
      // include fields that only live in the backend's persisted kpis_json
      // (worstWeeklyServicePct, falseConfidenceDays, and the Run Context date
      // fields). A full replace here wipes those until the fetchSimulationHistory()
      // call below re-merges them back in — and that only fires for Pro/Enterprise
      // plans, so free-tier sessions would lose them with no recovery at all.
      setKpis((prev) => ({ ...prev, ...finalKpis }));
      if (latestRunIdRef.current) setCurrentlyViewedRunId(latestRunIdRef.current);

      // worstWeeklyServicePct and falseConfidenceDays are only ever sourced
      // from simulationHistory[0]'s persisted kpis_json (see executiveKpis
      // construction below) — they are never recomputed in the client-side
      // allKpis/finalKpis pipeline above. Without this refresh, those two
      // cards stay frozen on whatever run was newest at page load, even
      // after running fresh simulations in the same session.
      if (isProPlusPlan(userPlan)) {
        try {
          await fetchSimulationHistory();
        } catch {}
      }
    } catch (err) {
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
            ...(files.lanes ? { lanes: files.lanes } : {}),
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
            } else {
            }
          } catch (e) {
            const scenarioRaw = localStorage.getItem("currentScenarioJSON");
            if (scenarioRaw) fd.append("scenario", scenarioRaw);
          }

          return fd;
        })();

      const runNameFromForm = maybeFormData instanceof FormData ? (maybeFormData.get("run_name") || "") : "";

      const res = await apiClient.post("/api/run", formData);
      const payload = res.data || {};

      // Set this BEFORE setPostRunPhase("primed") below, not after the
      // CSV-loading awaits that follow it. setPostRunPhase("primed") triggers
      // the KPI-recompute useEffect, and there's a real async gap (the
      // Promise.all + parseSimulationPanels awaits) between that phase
      // transition and where this flag used to get set — enough time for
      // React to run that effect while backendKpisRef.current was still
      // false, triggering a redundant raw-CSV recompute (runAllKpiUpdates)
      // that could race with and overwrite the correct payload.kpis-derived
      // values, including onTimeFulfillment, with values computed from
      // CSV data that may not even be fully available yet.
      backendKpisRef.current = !!(payload.kpis && Object.keys(payload.kpis || {}).length > 0);

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

      // Update locationsUrl
      const locUrl =
        normalizedUrls.locations_output_file_url ||
        normalizedUrls.locations_Output_File_URL ||
        normalizedUrls.locations_output ||
        normalizedUrls.locations_url ||
        normalizedUrls.locations ||
        null;

      if (locUrl) {
        // Strip any previously-appended cache-buster (&v= or ?v=) before
        // adding a new one — on a second run in the same session, locUrl
        // may already contain ?v=... from run 1's cache-bust, causing
        // a double-? URL (?X-Amz-...?v=...?v=...) that breaks S3 presigned
        // signature verification with a 403.
        const strippedUrl = locUrl.replace(/[?&]v=\d+$/, "");
        const separator = strippedUrl.includes("?") ? "&" : "?";
        const cacheBusted = `${strippedUrl}${separator}v=${Date.now()}`;
        setLocationsUrl(cacheBusted);
      }

      // Commit urls to state
      setPostRunPhase("seeding");
      setOutputUrls(normalizedUrls);

      // Save run locally immediately (so history is never empty)
      const entry = {
  ...(normalizedUrls || {}),
  // 🔥 report will be injected after build

        id: payload.run_id || payload.id || payload.timestamp || `${Date.now()}`,
        run_id: payload.run_id,
        created_at: payload.timestamp || new Date().toISOString(),
        output_urls: normalizedUrls,
        urls: normalizedUrls,
        outputUrls: normalizedUrls,
        raw: {
          ...(payload || {}),
          kpis: {
            ...(payload?.kpis || {}),
          },
        },
        _source: "local",
        name: runNameFromForm || null,
      };
      latestRunIdRef.current = entry.run_id || entry.id || entry.created_at || null;
      const nextLocal = upsertLocalRun(entry);

// 🔥 FORCE latest run globally visible immediately
try {
  localStorage.setItem("forc_latest_run", JSON.stringify(entry));
} catch (e) {
}
      // 🔥 Build report BEFORE inserting run
      const reportResult = await buildExecutiveReportAfterSim({
        run_id: normalizedUrls?.run_id || normalizedUrls?.id || normalizedUrls?.timestamp,
        timestamp: normalizedUrls?.run_id || normalizedUrls?.id || normalizedUrls?.timestamp,
        kpis: kpis || {},
      });

      const builtReport =
        reportResult?.report ||
        reportResult?.executiveReport ||
        reportResult?.executive_report ||
        null;

      // 🔥 FORCE inject into nextLocal BEFORE merge
      if (builtReport && Array.isArray(nextLocal) && nextLocal.length > 0) {
        nextLocal[0] = {
          ...nextLocal[0],
          report: builtReport,
          executiveReport: builtReport,
        };
      }

      // 🔥 FORCE inject into nextLocal BEFORE merge
      if (builtReport && Array.isArray(nextLocal) && nextLocal.length > 0) {
        nextLocal[0] = {
          ...nextLocal[0],
          report: builtReport,
          executiveReport: builtReport,
        };
      }

setSimulationHistory((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        // merge: prefer remote entries if present
        const merged = [
          ...prevArr.filter((r) => r?._source === "remote"),
          ...(nextLocal.length > 0
            ? [
                {
                  ...nextLocal[0],
                  kpis: {
                    ...(nextLocal[0]?.kpis || {}),
                  },
                  raw: {
                    ...(nextLocal[0]?.raw || {}),
                    kpis: {
                      ...(nextLocal[0]?.raw?.kpis || {}),
                    },
                  },
                  ...(builtReport
                    ? { report: builtReport, executiveReport: builtReport }
                    : {}),
                },
              ]
            : []),
          ...nextLocal.slice(1),
        ];
        return merged;
      });

      

      

      // Reset facility selection
      setSelectedFacility(null);

      // Seed SKUs BEFORE charts/KPIs
      let seededSkus = null;
      try {
        if (normalizedUrls?.inventory_output_file_url) {
          seededSkus = await extractAndSetSkuOptions(normalizedUrls.inventory_output_file_url, true);
        } else {
        }
      } catch (e) {
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
      }

      // Prefer backend KPIs if present
      if (payload.kpis && Object.keys(payload.kpis || {}).length > 0) {
        backendKpisRef.current = true;
        // Merge, don't replace: a full replace here was wiping out
        // simulationStartDate/horizonWeeks/disruptionStartDate/etc. whenever
        // they weren't present on this specific payload.kpis response, even
        // though other setKpis calls elsewhere correctly populate them from
        // kpis_json. This is why "Run Context" would show real dates, then
        // go blank again the next time a run completed.
        setKpis((prev) => ({ ...prev, ...payload.kpis }));
        // A freshly-completed run becomes the currently-viewed run too —
        // otherwise a stale currentlyViewedRunId from a previously-opened
        // historical run would incorrectly block this new run's own data
        // from being backfileld by the history-refresh guards elsewhere.
        if (payload.run_id) setCurrentlyViewedRunId(payload.run_id);
      } else {
        backendKpisRef.current = false;
      }

      setSimulationStatus("done");
      setTimeout(() => setSimulationStatus("idle"), 3000);
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      if (status === 402) {
        // The backend returns different 402 shapes depending on what fired:
        // - plan_required decorator: { error: "upgrade_required", required: ["pro"] }
        // - complexity/run cap gate: { error: "upgrade_required", limit: "complexity"|"monthly_runs" }
        // - bulk corridor gate: { error: "upgrade_required", limit: "bulk_corridor" }
        // Map all of these to the right tier label for the modal.
        const limit = data?.limit;
        const requiredTier =
          data?.required ||
          (limit === "complexity" || limit === "monthly_runs" || limit === "bulk_corridor"
            ? ["enterprise"]
            : ["pro"]);

        // Build a human-readable explanation of WHY they're being blocked.
        const limitMessage =
          limit === "complexity"
            ? `Your network (${data?.facilities} facilities, ${data?.skus} SKUs) exceeds the Pro plan limit of ${data?.max_facilities} facilities / ${data?.max_skus} SKUs.`
            : limit === "monthly_runs"
            ? `You've used ${data?.used} of ${data?.max} simulation runs this month.`
            : limit === "bulk_corridor"
            ? "Country Watch List and Best Place to Buy bulk scanning require an Enterprise plan."
            : null;

        setUpgradeGate({
          open: true,
          required: requiredTier,
          plan: data?.plan || userPlan || "free",
          limitMessage,
        });
        setSimulationStatus("idle");
        return;
      }

      if (status === 409) {
        // RUN_SIM_LOCK is a single global lock in app.py — this means either
        // a previous request from this session is still actively processing
        // (most likely if you just clicked Run Simulation again quickly), or
        // in rare cases a prior request hung without releasing the lock. This
        // is NOT the same as a real simulation error, so it shouldn't look
        // like one — the generic "Simulation failed" alert below was showing
        // for this case even when the underlying run went on to succeed
        // moments later.
        alert(
          "Another simulation request is still processing. This usually " +
          "clears within a few seconds — please wait a moment and try again. " +
          "If this keeps happening after a fresh page load, the server may " +
          "need a restart."
        );
        setSimulationStatus("idle");
        return;
      }

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
  const extractAndSetSkuOptions = async (url, forceReseed = false) => {
    if (!url) return;
    try {
      const rows = await fetchCsvRows(url);

      const skus = [...new Set(rows.map((r) => normalizeSku(r.sku || r.SKU)).filter(Boolean))];
      const options = skus.map((sku) => ({ label: sku, value: sku }));

      if (options.length === 0) {
        setPostRunPhase("primed");
        return [];
      }

      setSkuOptions(options);
      const seeded = options.map((o) => o.value);
      const shouldReseed = forceReseed || !selectedSku || selectedSku.length === 0;

      if (shouldReseed) {
        setSelectedSku(seeded);
      }
      return shouldReseed
        ? seeded
        : (Array.isArray(selectedSku) ? selectedSku : [selectedSku]);
    } catch (err) {
      setPostRunPhase("primed");
      return [];
    }
  };

  // Recompute KPIs & chart whenever outputs / SKU / type change
  useEffect(() => {
    const urls = outputUrls;

    if (!urls) return;

    if (postRunPhase === "idle" && justPrimedRef.current) {
      justPrimedRef.current = false;
      return;
    }

    if (postRunPhase === "seeding") {
      return;
    }

    const effectiveSkus = getEffectiveSkus(selectedSku, skuOptions);
    const demoSkus = getDemoSkus(effectiveSkus);
    if (!demoSkus || demoSkus.length === 0) {
      return;
    }

    if (postRunPhase === "primed") {

      if (!backendKpisRef.current || !kpis || Object.keys(kpis).length === 0) {
        runAllKpiUpdates(urls, demoSkus);
      }

      loadFilteredChart(urls, selectedOutputType || "inventory", demoSkus);

      justPrimedRef.current = true;
      setPostRunPhase("idle");
      return;
    }

    // Normal interactive recompute — but never overwrite already-correct
    // backend-sourced KPIs. This branch previously had no guard at all, so
    // ANY re-fire of this effect after the initial "primed" pass — a second
    // render, a dependency changing, React StrictMode's extra dev-mode
    // invocation — would unconditionally re-derive onTimeFulfillment/etc.
    // from raw CSV fetches and silently overwrite the correct values,
    // even on a freshly-completed run where they were already right.
    if (!backendKpisRef.current) {
      runAllKpiUpdates(urls, demoSkus);
    }
    loadFilteredChart(urls, selectedOutputType || "inventory", demoSkus);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputUrls, selectedSku, selectedOutputType, selectedFacility, postRunPhase]);

  const onReloadRun = async (entry) => {
    console.log("[FORC-DEBUG] onReloadRun called with entry:", entry);
    console.log("[FORC-DEBUG] entry.run_name:", entry?.run_name, "entry.kpis_json:", entry?.kpis_json);
    const openedRunId = entry?.run_id || entry?.id || null;
    setCurrentlyViewedRunId(openedRunId);
    console.log("[FORC-DEBUG] currentlyViewedRunId set to:", openedRunId);
    // Without this, the KPI-recompute useEffect (which watches outputUrls/
    // postRunPhase) sees backendKpisRef.current as falsy and redundantly
    // re-derives onTimeFulfillment/demandAtRiskUnits/timeToRecoverDays from
    // raw CSV fetches via runAllKpiUpdates — a completely separate
    // computation from the correct kpis_json data just merged above, and one
    // that silently produces wrong results whenever those CSV fetches fail
    // (e.g. expired presigned S3 URLs on an older run, exactly as seen here).
    backendKpisRef.current = true;
    const urls = entry.output_urls || entry.outputUrls || entry.urls || {};
    setChartData(null);

    setPostRunPhase("seeding");
    setOutputUrls(urls);
    setSimulationStatus("done");

    // Full replace, not merge, here specifically. Merge is correct for the
    // live-run flow (payload.kpis can legitimately be partial across
    // different stages), but wrong for reopening a historical run: kpis_json
    // never contains fields like peakBacklogUnits/demandAtRiskUnits/
    // timeToRecoverDays (confirmed via direct DB query — they're simply not
    // persisted), so a merge would correctly overwrite onTimeFulfillment
    // (which IS in kpis_json) while silently leaving those other fields as
    // stale leftovers from whatever run was previously being viewed. Opening
    // a different run means "show only this run's truth," not "blend this
    // run into whatever was already on screen."
    try {
      const entryKpis = entry?.kpis_json
        ? (typeof entry.kpis_json === "string" ? JSON.parse(entry.kpis_json) : entry.kpis_json)
        : null;
      console.log("[FORC-DEBUG] parsed entryKpis:", entryKpis);
      if (entryKpis) {
        console.log("[FORC-DEBUG] setKpis full replace (not merge) with:", entryKpis);
        setKpis(entryKpis);
      } else {
        console.log("[FORC-DEBUG] entryKpis was null/falsy — clearing kpis instead of leaving stale data");
        setKpis({});
      }
    } catch (e) {
      console.log("[FORC-DEBUG] onReloadRun kpis assignment threw:", e);
    }

    try {
      if (urls?.inventory_output_file_url) {
        await extractAndSetSkuOptions(urls.inventory_output_file_url);
      } else if (urls?.[`${selectedOutputType}_output_file_url`]) {
        await extractAndSetSkuOptions(urls[`${selectedOutputType}_output_file_url`]);
      }
    } catch (e) {
    }

    try {
      await parseSimulationPanels(urls);
    } catch (e) {
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
      // Only use the JWT for role (fast, low-stakes) — never for plan,
      // since the JWT may be stale after a Stripe upgrade. Plan comes
      // exclusively from /api/me below, which reads the live DB value.
      setUserRole(decoded.role || "user");

      if (isProPlusPlan(decoded.plan || "free")) {
        fetchSimulationHistory().then(() => {
          // After history loads, merge backend kpis_json into kpis state
          // so worstWeeklyServicePct and falseConfidenceDays are available —
          // but only if the user isn't actively viewing a specific older run.
          // This is the exact call site that was firing right after silent
          // token re-auth and clobbering a deliberately-opened run's KPIs
          // with the most-recent-run's numbers instead.
          try {
            const latest = simulationHistory?.[0];
            const latestId = latest?.run_id || latest?.id || null;
            const shouldBackfill = !currentlyViewedRunId || currentlyViewedRunId === latestId;
            console.log("[FORC-DEBUG] post-login kpis guard — currentlyViewedRunId:", currentlyViewedRunId, "latestId:", latestId, "shouldBackfill:", shouldBackfill);
            const backendKpis = shouldBackfill && latest?.kpis_json
              ? (typeof latest.kpis_json === "string" ? JSON.parse(latest.kpis_json) : latest.kpis_json)
              : null;
            if (backendKpis) {
              setKpis((prev) => ({
                ...prev,
                worstWeeklyServicePct: Number(backendKpis.worstWeeklyServicePct ?? prev?.worstWeeklyServicePct ?? 0),
                falseConfidenceDays: Number(backendKpis.falseConfidenceDays ?? prev?.falseConfidenceDays ?? 0),
                simulationStartDate: backendKpis.simulationStartDate ?? prev?.simulationStartDate ?? null,
                simulationEndDate: backendKpis.simulationEndDate ?? prev?.simulationEndDate ?? null,
                horizonWeeks: backendKpis.horizonWeeks ?? prev?.horizonWeeks ?? null,
                disruptionStartDate: backendKpis.disruptionStartDate ?? prev?.disruptionStartDate ?? null,
                firstServiceImpactDate: backendKpis.firstServiceImpactDate ?? prev?.firstServiceImpactDate ?? null,
              }));
            }
          } catch {}
        });
      } else {
      }
    } catch (e) {
    }
  };

  // Render
  return (
    <>
      {!isAuthenticated ? (
        <AuthPage onLogin={handleLogin} />
      ) : view === "simulation" ? (
        <SimulationDashboard
          lastRunScenarioData={lastRunScenarioData}
          executiveKpis={{
            serviceLevelPct: Number(kpis?.onTimeFulfillment ?? 0),
            demandAtRiskUnits: Number(kpis?.demandAtRiskUnits ?? kpis?.occurrenceUnfulfilledUnits ?? kpis?.lateFulfilledUnits ?? kpis?.peakBacklogUnits ?? 0),
            unfulfilledDemandUnits: Number(kpis?.peakBacklogUnits ?? 0),
            missedServiceDays: Number(kpis?.missedServiceDays ?? 0),
            timeToRecoverDays: Number(kpis?.ttrDays ?? kpis?.timeToRecoverDays ?? 0),
            timeToSurviveDays: Number(kpis?.ttsDays ?? kpis?.timeToSurviveDays ?? 0),
            revenueExposure: Number(kpis?.revenueExposure ?? kpis?.estimatedRevenueExposure ?? 0),
            worstWeeklyServicePct: Number(kpis?.worstWeeklyServicePct ?? (() => { try { const k = typeof simulationHistory?.[0]?.kpis_json === "string" ? JSON.parse(simulationHistory[0].kpis_json) : simulationHistory?.[0]?.kpis_json; return k?.worstWeeklyServicePct ?? 0; } catch { return 0; } })()),
            falseConfidenceDays: Number(kpis?.falseConfidenceDays ?? (() => { try { const k = typeof simulationHistory?.[0]?.kpis_json === "string" ? JSON.parse(simulationHistory[0].kpis_json) : simulationHistory?.[0]?.kpis_json; return k?.falseConfidenceDays ?? 0; } catch { return 0; } })()),
            simulationStartDate: kpis?.simulationStartDate ?? null,
            simulationEndDate: kpis?.simulationEndDate ?? null,
            horizonWeeks: kpis?.horizonWeeks ?? null,
            disruptionStartDate: kpis?.disruptionStartDate ?? null,
            firstServiceImpactDate: kpis?.firstServiceImpactDate ?? null,
          }}
          handleFileChange={handleFileChange}
          handleSubmit={handleSubmit}
          simulationStatus={simulationStatus}
          outputUrls={outputUrls}
          skuOptions={skuOptions || []}
          selectedSku={selectedSku || []}
          setSelectedSku={setSelectedSku}
          selectedOutputType={selectedOutputType}
          setSelectedOutputType={setSelectedOutputType}
          chartData={chartData}
          summaryStats={summaryStats}
          scenarioImpactSummary={scenarioImpactSummary}
          simulationHistory={simulationHistory || []}
          files={files}
          kpis={kpis}
          baselineKpis={baselineKpis}
          baselineOptions={baselineOptions}
          selectedBaselineRunId={selectedBaselineRunId}
          setSelectedBaselineRunId={setSelectedBaselineRunId}
          baselineLabel={baselineLabel}
          onLogout={handleLogout}
          switchView={setView}
          onReloadRun={onReloadRun}
          disruptionImpactData={disruptionImpactData || []}
          projectedImpactData={projectedImpactData || []}
          runoutRiskData={runoutRiskData || []}
          countermeasuresData={countermeasuresData || []}
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
        <Reports simulationHistory={simulationHistory} switchView={setView} apiBase={API_BASE} />
      ) : (
        <ControlTower
          onLogout={handleLogout}
          switchView={setView}
          view={view}
          userRole={userRole}
          userPlan={userPlan}
          simulationHistory={simulationHistory}
          onReloadRun={onReloadRun}
        />
      )}

      <UpgradeModal
        open={upgradeGate.open}
        required={upgradeGate.required}
        plan={upgradeGate.plan}
        limitMessage={upgradeGate.limitMessage || null}
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