import React, { useEffect, useState } from "react";
import ToastsHost from "./components/Toasts";
import AboutUs from "./pages/AboutUs";
import AuthPage from "./pages/AuthPage";
import SimulationDashboard from "./components/SimulationDashboard";
import ControlTower from "./components/ControlTower";
import axios from "axios";
import Papa from "papaparse";
import { jwtDecode } from "jwt-decode";
import Reports from "./Reports"; // ✅ Reports route
import { saveRun } from "./lib/runResultsStore"; // ✅ Save runs for Reports
import UpgradeModal from "./UpgradeModal.jsx";
import { api as apiClient, setUpgradeHandler } from "./apiClient";

// 🔐 Admin
import AdminPanel from "./components/ControlTowerEhancements/AdminPanel.jsx";

// ------------------------------------------------------------
// ✅ API base normalization (single source of truth)
// - Uses getApiBase()
// - NEVER falls back to localhost in production
// ------------------------------------------------------------
import { getApiBase } from "./config/apiBase";

const API_BASE = getApiBase();

// Root without trailing slash or `/api`
const API_ROOT = String(API_BASE || "")
  .trim()
  .replace(/\/$/, "")
  .replace(/\/api$/, "");

// ✅ dedicated axios instance for multipart + auth
const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: false, // bearer tokens only
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

// ✅ Auto-build Executive Report after each simulation run
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

// 🔧 KPI helper for Production & Disruption
const calculateProductionKpis = (filtered) => {
  let totalProduction = 0;
  const facilityRecovery = {};

  filtered.forEach((row) => {
    const produced = parseFloat(row.produced || 0);
    totalProduction += produced;

    const facility = row.facility_id || row.facility;
    const recovery = parseInt(row.recovery_days || 0, 10);
    if (produced > 0 && facility) {
      if (!facilityRecovery[facility]) facilityRecovery[facility] = recovery;
      else facilityRecovery[facility] = Math.max(facilityRecovery[facility], recovery);
    }
  });

  const impactedFacilities = Object.keys(facilityRecovery).length;
  const avgTimeToRecovery =
    impactedFacilities > 0
      ? Math.round(
          Object.values(facilityRecovery).reduce((a, b) => a + b, 0) / impactedFacilities
        )
      : 0;

  return {
    totalProduction: totalProduction.toFixed(0),
    impactedFacilities,
    avgTimeToRecovery,
  };
};

const normalizeSku = (sku) => sku?.toString().trim().toUpperCase();

// ====================================================================
// 📊 Generic CSV loader for disruption / panel data
// ====================================================================
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [upgradeGate, setUpgradeGate] = useState({
    open: false,
    required: ["pro"],
    plan: "free",
  });

  // ✅ Default to Control Tower
  const [view, setView] = useState("control");

  const [files, setFiles] = useState({});
  const [simulationStatus, setSimulationStatus] = useState("idle"); // idle | running | done | error
  const [outputUrls, setOutputUrls] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState([]); // normalize to array
  const [selectedOutputType, setSelectedOutputType] = useState("inventory");

  // 🏭 Facility selected on the map
  const [selectedFacility, setSelectedFacility] = useState(null);

  const [simulationHistory, setSimulationHistory] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [kpis, setKpis] = useState({});

  const [disruptionImpactData, setDisruptionImpactData] = useState([]);
  const [projectedImpactData, setProjectedImpactData] = useState([]);
  const [runoutRiskData, setRunoutRiskData] = useState([]);
  const [countermeasuresData, setCountermeasuresData] = useState([]);

  const [locationsUrl, setLocationsUrl] = useState(null);
  const [scenarioData, setScenarioData] = useState({});
  const [userRole, setUserRole] = useState("");
  const [userPlan, setUserPlan] = useState("");

  // ✅ Plan helpers (used to gate Pro-only endpoints like /api/simulations)
  const normalizePlan = (p) => (p || "").toString().trim().toLowerCase();
  const isProPlusPlan = (p) => ["pro", "enterprise", "admin"].includes(normalizePlan(p));


  // ------------------------------------------------------------------
  // 💳 Upgrade gate handler (opens modal on 402 upgrade_required)
  // ------------------------------------------------------------------
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

  useEffect(() => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("access_token");

  setIsAuthenticated(!!token);
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
        return; // don't assume free
      }

      const planFromDb = data?.plan || "free";
      const roleFromDb = data?.role || "user";

      setUserPlan(planFromDb);
      setUserRole(roleFromDb);

      // ✅ Pro+ only: avoid 401 spam for Free users
      if (isProPlusPlan(planFromDb)) {
        fetchSimulationHistory();
      } else {
        setSimulationHistory([]);
        console.log("🔒 Skipping /api/simulations on Free plan.");
      }
    } catch (err) {
      console.error("❌ Failed to fetch /api/me:", err);
    }
  };

  boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // Expose SPA router setter globally (used by Reports, etc.)
  useEffect(() => {
    window.__FORC_SWITCHVIEW = (v) => setView(v);
    return () => {
      delete window.__FORC_SWITCHVIEW;
    };
  }, []);

  // ✅ Keep view in sync after auth & URL path → default to Control Tower
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

  const fetchSimulationHistory = async () => {
    try {
      // NOTE: keep compatibility with your apiClient routing
      const res = await apiClient.get("/api/simulations");
      setSimulationHistory(res.data);
        } catch (err) {
      const status = err?.response?.status;

      // ✅ Expected when Free / unauthenticated — don't pollute console
      if (status === 401 || status === 403) {
        console.log("🔒 /api/simulations blocked (plan gating).");
        setSimulationHistory([]);
        return;
      }

      console.error("❌ Error fetching simulation history:", err);
    }
  };

  // ====================================================================
  // 📊 Robust chart data loader — SINGLE source of truth
  // ====================================================================
  const loadFilteredChart = async (urls, outputType, skuFilterRaw) => {
    try {
      console.log("📥 [Chart] Loading", outputType, "for", skuFilterRaw);

      const skuFilter = Array.isArray(skuFilterRaw)
        ? skuFilterRaw.filter(Boolean).map((s) => s.toString().trim().toLowerCase())
        : skuFilterRaw
        ? [skuFilterRaw.toString().trim().toLowerCase()]
        : [];

      const url =
        urls?.[`${outputType}_output_file_url`] ||
        urls?.[`${outputType}.csv`] ||
        Object.values(urls || {})[0];

      if (!url) {
        console.warn("⚠️ [Chart] No CSV URL for type:", outputType);
        return;
      }

      const response = await axios.get(url);
      const results = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;

      if (!results.length) {
        console.warn("⚠️ [Chart] CSV empty:", url);
        return;
      }

      const sample = results[0] || {};
      const headers = Object.keys(sample).map((h) => h.toLowerCase());

      const dateKey =
        headers.find((h) => /(date|day|period|time|timestamp)/i.test(h)) ||
        headers.find((h) => /(period_start|period_end)/i.test(h)) ||
        headers[0];

      const skuKey = headers.find((h) => /(sku|part|item|product|id)/i.test(h)) || headers[1];

      let valueKey;
      if (outputType === "inventory") valueKey = "inventory";
      else if (outputType === "production") valueKey = "produced";
      else if (outputType === "flow") valueKey = "flow";
      else if (outputType === "occurrence") valueKey = "event";

      valueKey = Object.keys(sample).find((k) => k.toLowerCase() === valueKey.toLowerCase()) || valueKey;

      const filtered = results.filter((row) => {
        const skuVal = (row[skuKey] || "").toString().trim().toLowerCase();
        const facilityVal =
          row.facility || row.Facility || row.facility_id || row.Location || row.location || "";

        const skuMatch = skuFilter.length === 0 || skuFilter.includes(skuVal);
        const facilityMatch =
          !selectedFacility ||
          facilityVal.toString().trim().toUpperCase() === selectedFacility.toString().trim().toUpperCase();

        return skuMatch && facilityMatch;
      });

      const dateSet = [...new Set(filtered.map((r) => r[dateKey]))].filter(Boolean).sort();

      const skuGroups = {};
      filtered.forEach((row) => {
        const skuVal = (row[skuKey] || "Unknown").toString().trim();
        const dateVal = row[dateKey];
        const numVal = parseFloat(row[valueKey]) || 0;
        if (!skuGroups[skuVal]) skuGroups[skuVal] = {};
        skuGroups[skuVal][dateVal] = numVal;
      });

      const datasets = Object.entries(skuGroups).map(([skuName, dateMap]) => ({
        label: skuName,
        data: dateSet.map((d) => dateMap[d] ?? null),
        fill: false,
        borderWidth: 2,
        tension: 0.25,
      }));

      setChartData({ labels: dateSet, datasets });

      const total = filtered.reduce((sum, r) => sum + (parseFloat(r[valueKey]) || 0), 0);
      const avg = (total / Math.max(filtered.length || 1, 1)).toFixed(2);
      const uniqueDates = [...new Set(filtered.map((r) => r[dateKey]))].length;
      const uniqueFacilities = new Set(
        filtered.map((r) => r.facility || r.Facility || r.Location || r.location)
      ).size;

      setSummaryStats({ total, avg, uniqueDates, uniqueFacilities });
    } catch (err) {
      console.error("❌ [Chart] Failed to load chart data:", err);
    }
  };

  // ====================================================================
  // 🧩 Parse simulation panels (impact, runout, countermeasures)
  // ====================================================================
  const parseSimulationPanels = async (urls) => {
    const fetchCsv = async (url) => {
      const response = await axios.get(url);
      return Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;
    };

    try {
      if (urls.projected_impact_output_file_url) {
        const rows = await fetchCsv(urls.projected_impact_output_file_url);
        setProjectedImpactData(rows);
      }
      if (urls.runout_risk_output_file_url) {
        const rows = await fetchCsv(urls.runout_risk_output_file_url);
        setRunoutRiskData(rows);
      }
      if (urls.countermeasures_output_file_url) {
        const rows = await fetchCsv(urls.countermeasures_output_file_url);
        setCountermeasuresData(rows);
      }
    } catch (err) {
      console.error("❌ Failed to parse simulation panel data:", err);
    }
  };

  // ====================================================================
  // 📊 KPI aggregation across all outputs
  // ====================================================================
  const runAllKpiUpdates = async () => {
    if (!outputUrls) return;
    const allKpis = {};

    const skuFilter = Array.isArray(selectedSku)
      ? selectedSku.map(normalizeSku)
      : selectedSku
      ? [normalizeSku(selectedSku)]
      : [];

    for (const type of ["inventory", "production", "flow", "occurrence"]) {
      const url = outputUrls[`${type}_output_file_url`];
      if (!url) continue;

      try {
        const response = await axios.get(url);
        const results = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;

        const filtered = results.filter((row) => {
          const sku = normalizeSku(row.sku || row.SKU || row.Sku || row.SkuID);
          const facility = row.facility || row.facility_id || row.Facility || "";

          const skuMatch = skuFilter.length === 0 || skuFilter.includes(sku);
          const facilityMatch =
            !selectedFacility ||
            facility.toString().trim().toUpperCase() === selectedFacility.toString().trim().toUpperCase();

          return skuMatch && facilityMatch;
        });

        if (type === "inventory") {
          const totalInventory = filtered.reduce((sum, r) => {
            const raw =
              r.initial_inventory ??
              r.Initial_Inventory ??
              r.INITIAL_INVENTORY ??
              r.inventory ??
              r.Inventory;
            const parsed = parseFloat(raw);
            return sum + (isNaN(parsed) ? 0 : parsed);
          }, 0);

          const avgInventory = filtered.length > 0 ? totalInventory / filtered.length : 0;

          const totalInventoryMovement = filtered.reduce((sum, r) => {
            const raw = parseFloat(r.initial_inventory ?? r.inventory ?? 0);
            return sum + (isNaN(raw) || raw <= 0 ? 0 : raw);
          }, 0);

          const inventoryTurns =
            avgInventory > 0 ? (totalInventoryMovement / avgInventory).toFixed(2) : "0.00";
          const onTimeFulfillment = totalInventoryMovement > 0 ? "100.0" : "0.0";

          allKpis.avgInventory = avgInventory.toFixed(1);
          allKpis.inventoryTurns = inventoryTurns;
          allKpis.onTimeFulfillment = `${onTimeFulfillment}%`;
        }

        if (type === "production") {
          const productionKpis = calculateProductionKpis(filtered);
          Object.assign(allKpis, productionKpis);
        }

        if (type === "flow") {
          const totalCost = filtered.reduce((sum, r) => {
            const quantity = parseFloat(r.quantity || r.flow || 0);
            const costPerUnit = parseFloat(r.cost_per_unit || 10);
            return sum + (isNaN(quantity) || isNaN(costPerUnit) ? 0 : quantity * costPerUnit);
          }, 0);

          const expediteCount = filtered.filter(
            (r) => r.expedited === "true" || r.expedited === "1" || r.expedited === "yes"
          ).length;

          const expediteRatio =
            filtered.length > 0 ? ((100 * expediteCount) / filtered.length).toFixed(1) : "0.0";

          allKpis.costToServe = `$${totalCost.toFixed(0)}`;
          allKpis.expediteRatio = `${expediteRatio}%`;
        }

        if (type === "occurrence") {
          const backorderVolume = filtered.reduce((sum, r) => {
            const eventVal = parseFloat(r.event);
            return sum + (isNaN(eventVal) ? 0 : eventVal);
          }, 0);

          allKpis.backorderVolume = backorderVolume.toFixed(0);
        }
      } catch (err) {
        console.error(`❌ Failed KPI calc for ${type}:`, err);
      }
    }

    setKpis(allKpis);
  };

  // ====================================================================
  // 🧪 Simulation submit (FormData)
  // ====================================================================
  const handleSubmit = async (maybeFormData) => {
    if (simulationStatus === "running") return;

    setSimulationStatus("running");
    setChartData(null);

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

          const scenarioRaw = localStorage.getItem("currentScenarioJSON");
          if (scenarioRaw) fd.append("scenario", scenarioRaw);

          // Debug keys (names only)
          console.log("🧾 [App] FormData keys:");
          for (const [k] of fd.entries()) console.log("  -", k);

          return fd;
        })();

      console.log("▶️ [App] Starting simulation run...");
      console.log("📡 [App] POST", `${API_ROOT}/api/run`);

      // IMPORTANT: do NOT set Content-Type; browser sets multipart boundaries
      const res = await apiClient.post("/api/run", formData);


      const urls = res.data.output_urls || res.data;
      console.log("✅ [App] Simulation complete:", urls);

      const locUrl =
        urls.locations_output_file_url ||
        urls.locations_Output_File_URL ||
        urls.locations_output ||
        urls.locations_url ||
        null;

      if (locUrl) {
        const cacheBusted = `${locUrl}?v=${Date.now()}`;
        console.log("🗺️ [App] Updating locationsUrl →", cacheBusted);
        setLocationsUrl(cacheBusted);
      } else {
        console.warn("⚠️ No dynamic locations URL found in simulation output.");
      }

      setOutputUrls(urls);
      await buildExecutiveReportAfterSim();

      // 🧭 Reset facility selection
      setSelectedFacility(null);

      // 🔗 Scenario metadata
      const scenarioName = localStorage.getItem("currentScenarioName") || res.data.scenarioName || "";
      const scenarioId = localStorage.getItem("currentScenarioId") || res.data.scenarioId || "";

      // ✅ Persist this run for Reports & baseline tracking
      try {
        const existing = JSON.parse(localStorage.getItem("reports") || "[]");

        const scenarioName2 = localStorage.getItem("currentScenarioName") || null;
        const scenarioId2 = localStorage.getItem("currentScenarioId") || null;
        const scenario = scenarioName2 ? { name: scenarioName2, id: scenarioId2 || undefined } : null;

        const nowId = Date.now();
        const report = {
          id: nowId,
          name: res.data.name || scenarioName || "Simulation Run",
          timestamp: new Date().toLocaleString(),
          urls,
          kpis: res.data.kpis || {},
          scenario,
        };

        localStorage.setItem("reports", JSON.stringify([report, ...existing]));
        if (!localStorage.getItem("baselineRunId")) localStorage.setItem("baselineRunId", String(nowId));
      } catch (e) {
        console.warn("⚠️ [App] Failed to save report to localStorage:", e);
      }

      // ✅ Save to in-memory runResultsStore
      saveRun({
        id: Date.now(),
        name: res.data.name || "Simulation Run",
        timestamp: new Date().toLocaleString(),
        urls,
        kpis: res.data.kpis || {},
        scenario: localStorage.getItem("currentScenarioName")
          ? {
              name: localStorage.getItem("currentScenarioName"),
              id: localStorage.getItem("currentScenarioId") || undefined,
            }
          : null,
      });
      window.dispatchEvent(new Event("runs-updated"));

      // ⏱ Sync history, panels, KPIs, and chart
      if (isProPlusPlan(userPlan)) {
        await fetchSimulationHistory();
      }

      await Promise.all([
        loadCsvToJson(urls.disruption_impact_output_file_url, setDisruptionImpactData),
        loadCsvToJson(urls.projected_impact_output_file_url, setProjectedImpactData),
        loadCsvToJson(urls.runout_risk_output_file_url, setRunoutRiskData),
        loadCsvToJson(urls.countermeasures_output_file_url, setCountermeasuresData),
      ]);

      await loadFilteredChart(urls, selectedOutputType || "inventory", selectedSku || []);
      extractAndSetSkuOptions(urls["inventory_output_file_url"]);
      await parseSimulationPanels(urls);

      setKpis(res.data.kpis ? res.data.kpis : {});
      await runAllKpiUpdates();

      setSimulationStatus("done");
      console.log("✅ [App] Simulation workflow finished successfully.");
      setTimeout(() => setSimulationStatus("idle"), 3000);
    } catch (error) {
      // ✅ Better diagnostics than “AxiosError”
      const status = error?.response?.status;
      const data = error?.response?.data;
            // ✅ If backend says "upgrade required", open the modal instead of alerting
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

  // ====================================================================
  // 🆔 Extract SKUs and build options
  // ====================================================================
  const extractAndSetSkuOptions = async (url) => {
    if (!url) return;
    try {
      const response = await axios.get(url);
      const results = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;

      const skus = [...new Set(results.map((r) => normalizeSku(r.sku || r.SKU)).filter(Boolean))];
      const options = skus.map((sku) => ({ label: sku, value: sku }));
      setSkuOptions(options);

      if (!selectedSku || selectedSku.length === 0) {
        setSelectedSku(options.map((o) => o.value));
      }
    } catch (err) {
      console.error("❌ Failed to extract SKUs:", err);
    }
  };

  // ====================================================================
  // 🔁 Recompute KPIs & chart whenever outputs / SKU / type change
  // ====================================================================
  useEffect(() => {
    if (!outputUrls) return;
    runAllKpiUpdates();
    loadFilteredChart(outputUrls, selectedOutputType || "inventory", selectedSku || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputUrls, selectedSku, selectedOutputType, selectedFacility]);

  const onReloadRun = async (entry) => {
    const urls = entry.output_urls || entry.urls || {};
    setOutputUrls(urls);

    setSimulationStatus("done");
    setChartData(null);

    await loadFilteredChart(urls, selectedOutputType || "inventory", selectedSku || []);
    extractAndSetSkuOptions(urls[selectedOutputType + "_output_file_url"]);
    parseSimulationPanels(urls);
    runAllKpiUpdates();

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

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token");

  if (!token) {
    setSimulationHistory([]);
    return;
  }

  try {
    const decoded = jwtDecode(token);
    const plan = decoded.plan || "free";
    setUserPlan(plan);
    setUserRole(decoded.role || "user");

    if (isProPlusPlan(plan)) {
      fetchSimulationHistory();
    } else {
      setSimulationHistory([]);
      console.log("🔒 Skipping /api/simulations on Free plan (login).");
    }
  } catch (e) {
    console.error("❌ Failed to decode JWT on login:", e);
    setSimulationHistory([]);
  }
};

  // ====================================================================
  // 🖼️ Render
  // ====================================================================
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
