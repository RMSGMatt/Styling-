import ToastsHost from "./components/Toasts";
import AboutUs from "./pages/AboutUs";
import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import SimulationDashboard from './components/SimulationDashboard';
import ControlTower from './components/ControlTower';
import axios from 'axios';
import Papa from 'papaparse';
import { jwtDecode } from 'jwt-decode';
import Reports from "./Reports";   // ✅ Reports route
import { saveRun } from "./lib/runResultsStore"; // ✅ Save runs for Reports

// 🔐 Admin
import AdminPanel from "./components/ControlTowerEhancements/AdminPanel.jsx";

// ✅ Unified environment handling (removed all 127.0.0.1 fallbacks)
const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: false, // bearer tokens only
});

// ✅ Attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔧 KPI helper for Production & Disruption
const calculateProductionKpis = (filtered) => {
  let totalProduction = 0;
  const facilityRecovery = {};
  filtered.forEach(row => {
    const produced = parseFloat(row.produced || 0);
    totalProduction += produced;

    const facility = row.facility_id || row.facility;
    const recovery = parseInt(row.recovery_days || 0);
    if (produced > 0 && facility) {
      if (!facilityRecovery[facility]) {
        facilityRecovery[facility] = recovery;
      } else {
        facilityRecovery[facility] = Math.max(facilityRecovery[facility], recovery);
      }
    }
  });

  const impactedFacilities = Object.keys(facilityRecovery).length;
  const avgTimeToRecovery = impactedFacilities > 0
    ? Math.round(Object.values(facilityRecovery).reduce((a, b) => a + b, 0) / impactedFacilities)
    : 0;

  return {
    totalProduction: totalProduction.toFixed(0),
    impactedFacilities,
    avgTimeToRecovery
  };
};

const normalizeSku = sku => sku?.toString().trim().toUpperCase();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // ✅ Default to Control Tower (not Simulation)
  const [view, setView] = useState('control');

  const [files, setFiles] = useState({});
  const [simulationStatus, setSimulationStatus] = useState('idle'); // idle | running | done | error
  const [outputUrls, setOutputUrls] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState([]);
  const [selectedOutputType, setSelectedOutputType] = useState('inventory');
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [kpis, setKpis] = useState({});
  const [disruptionImpactData, setDisruptionImpactData] = useState({});
  const [runoutRiskData, setRunoutRiskData] = useState([]);
  const [countermeasuresData, setCountermeasuresData] = useState([]);
  const [locationsUrl, setLocationsUrl] = useState(null);
  const [scenarioData, setScenarioData] = useState({});
  const [userRole, setUserRole] = useState('');
  const [userPlan, setUserPlan] = useState('');

  // On mount: check token and load history
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserRole(decoded.role || 'user');
        setUserPlan(decoded.plan || 'Free');
        fetchSimulationHistory();
      } catch (e) {
        console.error("❌ Failed to decode JWT:", e);
      }
    }
  }, []);

  // Expose SPA router setter for other components (e.g., Reports back button)
  useEffect(() => {
    window.__FORC_SWITCHVIEW = (v) => setView(v);
    return () => { delete window.__FORC_SWITCHVIEW; };
  }, []);

  // ✅ Keep view in sync after auth & URL path → default to Control Tower
  useEffect(() => {
    if (!isAuthenticated) return;
    const path = window.location.pathname;

    if (path === '/about') setView('about');
    else if (path === '/reports') setView('reports');
    else if (path === '/repository') setView('repository');
    else if (path === '/admin') setView('admin');
    else if (path === '/simulation') setView('simulation');
    else if (path === '/' || path === '/control' || path === '/control-tower') {
      setView('control');
      // keep URL clean
      if (path !== '/control-tower') {
        window.history.replaceState(null, '', '/control-tower');
      }
    }
  }, [isAuthenticated]);

  const handleFileChange = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const fetchSimulationHistory = async () => {
    try {
      const res = await api.get('/api/simulations');
      setSimulationHistory(res.data);
    } catch (err) {
      console.error("❌ Error fetching simulation history:", err);
    }
  };

  // ⬇️ accepts optional FormData from SimulationDashboard
  const handleSubmit = async (maybeFormData) => {
    if (simulationStatus === 'running') return;
    setSimulationStatus('running');
    setChartData(null);

    try {
      const formData = maybeFormData || (() => {
        const fd = new FormData();
        Object.entries(files).forEach(([key, file]) => file && fd.append(key, file));
        return fd;
      })();

      const res = await api.post('/api/run', formData);
      const urls = res.data.output_urls || res.data;

      setOutputUrls(urls);
      if (urls.locations_output_file_url) {
        setLocationsUrl(urls.locations_output_file_url);
      }

      // 🔗 OPTIONAL: capture scenario linkage (name/id) if available
      const scenarioName = localStorage.getItem("currentScenarioName") || res.data.scenarioName || "";
      const scenarioId = localStorage.getItem("currentScenarioId") || res.data.scenarioId || "";

      // ✅ Persist this run so Reports can show it
      try {
        const existing = JSON.parse(localStorage.getItem("reports") || "[]");

        // pull current scenario metadata if any
        const scenarioName2 = localStorage.getItem("currentScenarioName") || null;
        const scenarioId2 = localStorage.getItem("currentScenarioId") || null; // optional if you store it
        const scenario = scenarioName2 ? { name: scenarioName2, id: scenarioId2 || undefined } : null;

        const nowId = Date.now();
        const report = {
          id: nowId,
          name: res.data.name || scenarioName || "Simulation Run",
          timestamp: new Date().toLocaleString(),
          urls,                 // output file urls from the API
          kpis: res.data.kpis || {},
          scenario,             // 🔗 attach scenario
        };
        localStorage.setItem("reports", JSON.stringify([report, ...existing]));

        // If no baseline is set, set this run as baseline by default (first ever)
        if (!localStorage.getItem("baselineRunId")) {
          localStorage.setItem("baselineRunId", String(nowId));
        }
      } catch (e) {
        console.warn("Failed to save report to localStorage:", e);
      }

      // ✅ Save to local runResultsStore for Reports (and anything else using it)
      saveRun({
        id: Date.now(),
        name: res.data.name || "Simulation Run",
        timestamp: new Date().toLocaleString(),
        urls,
        kpis: res.data.kpis || {},
        scenario: (localStorage.getItem("currentScenarioName") ? {
          name: localStorage.getItem("currentScenarioName"),
          id: localStorage.getItem("currentScenarioId") || undefined
        } : null)
      });
      // 🔔 notify Reports to refresh if already mounted
      window.dispatchEvent(new Event('runs-updated'));

      await fetchSimulationHistory();
      await loadFilteredChart(urls, selectedOutputType, selectedSku);
      extractAndSetSkuOptions(urls[selectedOutputType + '_output_file_url']);
      parseSimulationPanels(urls);

      if (res.data.kpis) setKpis(res.data.kpis);
      else setKpis({});

      setSimulationStatus('done');
      setTimeout(() => setSimulationStatus('idle'), 3000);
    } catch (error) {
      console.error("❌ Simulation API call failed:", error);
      alert("Simulation failed. Check console for error details.");
      setSimulationStatus('error');
      setTimeout(() => setSimulationStatus('idle'), 3000);
    }
  };

  const parseSimulationPanels = async (urls) => {
    const fetchCsv = async (url) => {
      const response = await axios.get(url);
      const parsed = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;
      return parsed;
    };

    try {
      if (urls.projected_impact_output_file_url) {
        const rows = await fetchCsv(urls.projected_impact_output_file_url);
        const impact = {};
        rows.forEach(row => {
          const metric = row.metric?.toLowerCase();
          if (metric && row.value) impact[metric] = row.value;
        });
        setDisruptionImpactData(impact);
      }

      // 🔑 matches backend key: "runout_risk"
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

  const loadFilteredChart = async (urls, type, skus) => {
    const url = urls?.[`${type}_output_file_url`];
    if (!url) return;

    try {
      const response = await axios.get(url);
      const results = Papa.parse(response.data, { header: true }).data;

      const filtered = results.filter(row => {
        const sku = normalizeSku(row.sku || row.SKU || row.Sku || row.SkuID);
        return skus.length === 0 || skus.map(normalizeSku).includes(sku);
      });

      const dateSet = [...new Set(filtered.map(row => row.date))].sort();
      const datasets = [];
      const colorMap = {};
      const skuSet = new Set();

      const colors = ['#1D625B', '#ABFA7D', '#F59E0B', '#3B82F6', '#FACC15', '#9CA3AF', '#EF4444', '#10B981', '#6366F1', '#EC4899'];

      filtered.forEach(row => {
        const sku = normalizeSku(row.sku || row.SKU || row.Sku || row.SkuID);
        if (sku) skuSet.add(sku);
      });

      Array.from(skuSet).forEach((sku, index) => {
        colorMap[sku] = colors[index % colors.length];
      });

      const datasetsPerSku = {};
      skuSet.forEach(sku => {
        datasetsPerSku[sku] = dateSet.map(date => {
          const matches = filtered.filter(r => normalizeSku(r.sku || r.SKU || r.Sku || r.SkuID) === sku && r.date === date);

          let value = 0;
          if (type === 'inventory') {
            value = matches.reduce((sum, r) => {
              const raw = r.initial_inventory ?? r.Initial_Inventory ?? r.INITIAL_INVENTORY ?? r.inventory ?? r.Inventory;
              const parsed = parseFloat(raw);
              return sum + (isNaN(parsed) ? 0 : parsed);
            }, 0);
          } else if (type === 'flow') {
            value = matches.reduce((sum, r) => sum + parseFloat(r.quantity || 0), 0);
          } else if (type === 'production') {
            value = matches.reduce((sum, r) => sum + parseFloat(r.produced || 0), 0);
          } else if (type === 'occurrence') {
            value = matches.reduce((sum, r) => sum + parseFloat(r.event || 0), 0);
          }

          return value;
        });
      });

      for (const sku of skuSet) {
        datasets.push({
          label: sku,
          data: datasetsPerSku[sku],
          borderColor: colorMap[sku],
          backgroundColor: colorMap[sku],
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 3,
        });
      }

      setChartData({ labels: dateSet, datasets });

      if (type === 'inventory') {
        const totalInventory = filtered.reduce((sum, r) => {
          const raw = r.initial_inventory ?? r.Initial_Inventory ?? r.INITIAL_INVENTORY ?? r.inventory ?? r.Inventory;
          const parsed = parseFloat(raw);
          return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);

        const avgInventory = filtered.length > 0 ? (totalInventory / filtered.length) : 0;

        const totalInventoryMovement = filtered.reduce((sum, r) => {
          const raw = parseFloat(r.initial_inventory ?? r.inventory ?? 0);
          return sum + (isNaN(raw) || raw <= 0 ? 0 : raw);
        }, 0);

        const inventoryTurns = avgInventory > 0 ? (totalInventoryMovement / avgInventory).toFixed(2) : "0.00";
        const onTimeFulfillment = totalInventoryMovement > 0 ? "100.0" : "0.0";

        setKpis(prev => ({
          ...prev,
          avgInventory: avgInventory.toFixed(1),
          inventoryTurns,
          onTimeFulfillment: `${onTimeFulfillment}%`
        }));
      }

      if (type === 'production') {
        const kpiResult = calculateProductionKpis(filtered);
        setKpis(prev => ({ ...prev, ...kpiResult }));
      }

      if (type === 'flow') {
        const totalCost = filtered.reduce((sum, r) => {
          const quantity = parseFloat(r.quantity || 0);
          const costPerUnit = parseFloat(r.cost_per_unit || 10);
          return sum + (isNaN(quantity) || isNaN(costPerUnit) ? 0 : quantity * costPerUnit);
        }, 0);

        const expediteCount = filtered.filter(r =>
          r.expedited === 'true' || r.expedited === '1' || r.expedited === 'yes'
        ).length;
        const expediteRatio = filtered.length > 0 ? (100 * expediteCount / filtered.length).toFixed(1) : "0.0";

        setKpis(prev => ({
          ...prev,
          costToServe: `$${totalCost.toFixed(0)}`,
          expediteRatio: `${expediteRatio}%`
        }));
      }

      if (type === 'occurrence') {
        const backorderVolume = filtered.reduce((sum, r) => {
          const eventVal = parseFloat(r.event);
          return sum + (isNaN(eventVal) ? 0 : eventVal);
        }, 0);
        setKpis(prev => ({ ...prev, backorderVolume: backorderVolume.toFixed(0) }));
      }

    } catch (err) {
      console.error("❌ Failed to load chart data:", err);
    }
  };

  const extractAndSetSkuOptions = async (url) => {
    if (!url) return;
    try {
      const response = await axios.get(url);
      const results = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;
      const skus = [...new Set(results.map(r => normalizeSku(r.sku || r.SKU)).filter(Boolean))];
      const options = skus.map(sku => ({ label: sku, value: sku }));
      setSkuOptions(options);
    } catch (err) {
      console.error("❌ Failed to extract SKUs:", err);
    }
  };

  const runAllKpiUpdates = async () => {
    if (!outputUrls) return;
    const allKpis = {};

    for (const type of ['inventory', 'production', 'flow', 'occurrence']) {
      const url = outputUrls[`${type}_output_file_url`];
      if (!url) continue;

      try {
        const response = await axios.get(url);
        const results = Papa.parse(response.data, { header: true }).data;

        const filtered = results.filter(row => {
          const sku = normalizeSku(row.sku || row.SKU || row.Sku || row.SkuID);
          return selectedSku.length === 0 || selectedSku.map(normalizeSku).includes(sku);
        });

        if (type === 'inventory') {
          const totalInventory = filtered.reduce((sum, r) => {
            const raw = r.initial_inventory ?? r.Initial_Inventory ?? r.INITIAL_INVENTORY ?? r.inventory ?? r.Inventory;
            const parsed = parseFloat(raw);
            return sum + (isNaN(parsed) ? 0 : parsed);
          }, 0);

          const avgInventory = filtered.length > 0 ? (totalInventory / filtered.length) : 0;

          const totalInventoryMovement = filtered.reduce((sum, r) => {
            const raw = parseFloat(r.initial_inventory ?? r.inventory ?? 0);
            return sum + (isNaN(raw) || raw <= 0 ? 0 : raw);
          }, 0);

          const inventoryTurns = avgInventory > 0 ? (totalInventoryMovement / avgInventory).toFixed(2) : "0.00";
          const onTimeFulfillment = totalInventoryMovement > 0 ? "100.0" : "0.0";

          allKpis.avgInventory = avgInventory.toFixed(1);
          allKpis.inventoryTurns = inventoryTurns;
          allKpis.onTimeFulfillment = `${onTimeFulfillment}%`;
        }

        if (type === 'production') {
          const productionKpis = calculateProductionKpis(filtered);
          Object.assign(allKpis, productionKpis);
        }

        if (type === 'flow') {
          const totalCost = filtered.reduce((sum, r) => {
            const quantity = parseFloat(r.quantity || 0);
            const costPerUnit = parseFloat(r.cost_per_unit || 10);
            return sum + (isNaN(quantity) || isNaN(costPerUnit) ? 0 : quantity * costPerUnit);
          }, 0);

          const expediteCount = filtered.filter(r =>
            r.expedited === 'true' || r.expedited === '1' || r.expedited === 'yes'
          ).length;
          const expediteRatio = filtered.length > 0 ? (100 * expediteCount / filtered.length).toFixed(1) : "0.0";

          allKpis.costToServe = `$${totalCost.toFixed(0)}`;
          allKpis.expediteRatio = `${expediteRatio}%`;
        }

        if (type === 'occurrence') {
          const backorderVolume = filtered.reduce((sum, r) => {
            const eventVal = parseFloat(r.event);
            return sum + (isNaN(eventVal) ? 0 : eventVal);
          }, 0);
          allKpis.backorderVolume = backorderVolume.toFixed(0);
        }

        // Only update chartData for the selected type
        if (type === selectedOutputType) {
          const dateSet = [...new Set(filtered.map(row => row.date))].sort();
          const colorMap = {};
          const skuSet = new Set();
          const colors = ['#1D625B', '#ABFA7D', '#F59E0B', '#3B82F6', '#FACC15', '#9CA3AF', '#EF4444', '#10B981', '#6366F1', '#EC4899'];

          filtered.forEach(row => {
            const sku = normalizeSku(row.sku || row.SKU || row.Sku || row.SkuID);
            if (sku) skuSet.add(sku);
          });

          Array.from(skuSet).forEach((sku, index) => {
            colorMap[sku] = colors[index % colors.length];
          });

          const datasetsPerSku = {};
          skuSet.forEach(sku => {
            datasetsPerSku[sku] = dateSet.map(date => {
              const matches = filtered.filter(r => normalizeSku(r.sku || r.SKU || r.Sku || r.SkuID) === sku && r.date === date);

              let value = 0;
              if (type === 'inventory') {
                value = matches.reduce((sum, r) => {
                  const raw = r.initial_inventory ?? r.Initial_Inventory ?? r.INITIAL_INVENTORY ?? r.inventory ?? r.Inventory;
                  const parsed = parseFloat(raw);
                  return sum + (isNaN(parsed) ? 0 : parsed);
                }, 0);
              } else if (type === 'flow') {
                value = matches.reduce((sum, r) => sum + parseFloat(r.quantity || 0), 0);
              } else if (type === 'production') {
                value = matches.reduce((sum, r) => sum + parseFloat(r.produced || 0), 0);
              } else if (type === 'occurrence') {
                value = matches.reduce((sum, r) => sum + parseFloat(r.event || 0), 0);
              }

              return value;
            });
          });

          const datasetsLocal = Array.from(skuSet).map((sku, i) => ({
            label: sku,
            data: datasetsPerSku[sku],
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length],
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 3,
          }));

          setChartData({ labels: dateSet, datasets: datasetsLocal });
        }
      } catch (err) {
        console.error(`❌ Failed KPI calc for ${type}:`, err);
      }
    }

    setKpis(allKpis);
  };

  const onReloadRun = async (entry) => {
    const urls = entry.output_urls || entry.urls || {};
    setOutputUrls(urls);

    setSimulationStatus('done');
    setChartData(null);

    await loadFilteredChart(urls, selectedOutputType, selectedSku);
    extractAndSetSkuOptions(urls[selectedOutputType + '_output_file_url']);
    parseSimulationPanels(urls);
    runAllKpiUpdates();

    setView('simulation');
    // keep URL in sync when user jumps into a run
    window.history.pushState(null, '', '/simulation');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setView('auth');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setView('control'); // redirect after login
    // ✅ reflect in URL
    window.history.replaceState(null, '', '/control-tower');
    fetchSimulationHistory();
  };

  useEffect(() => {
    if (!outputUrls) return;
    runAllKpiUpdates();
  }, [outputUrls, selectedSku, selectedOutputType]); // re-run KPIs/chart on changes

  return (
    <>
      {!isAuthenticated ? (
        <AuthPage onLogin={handleLogin} />
      ) : view === "simulation" ? (
        <SimulationDashboard
          handleFileChange={handleFileChange}
          handleSubmit={handleSubmit}      // now accepts optional FormData
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
          runoutRiskData={runoutRiskData}
          countermeasuresData={countermeasuresData}
          locationsUrl={locationsUrl}
          scenarioData={scenarioData}
          setScenarioData={setScenarioData}
        />
      ) : view === "admin" ? (
        userRole === "admin" ? (
          <AdminPanel
            switchView={setView}
            onLogout={handleLogout}
            userRole={userRole}
          />
        ) : (
          <ControlTower
            onLogout={handleLogout}
            switchView={setView}
            view={view}
            userRole={userRole}
            userPlan={userPlan}
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
        />
      )}

      {/* Mount toasts once at root */}
      <ToastsHost />
    </>
  );
}
