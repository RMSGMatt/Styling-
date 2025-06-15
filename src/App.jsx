// ✅ App.jsx (with dynamic KPI updates based on filters)
import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import ControlTower from './pages/ControlTower';
import SimulationDashboard from './components/SimulationDashboard';
import { downloadCSV } from './utils/downloadCSV';
import axios from 'axios';
import Papa from 'papaparse';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('control-tower');
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [outputUrls, setOutputUrls] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSku, setSelectedSku] = useState([]);
  const [selectedOutputType, setSelectedOutputType] = useState('inventory');
  const [kpis, setKpis] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [simulationHistory, setSimulationHistory] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      setView('control-tower');
      fetchSimulationHistory(token);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const fetchSimulationHistory = async (token) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE}/api/simulations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSimulationHistory(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch simulation history:", err);
    }
  };

  const handleLogin = (initialView = 'control-tower') => {
    setIsAuthenticated(true);
    setView(initialView);
    const token = localStorage.getItem('token');
    if (token) fetchSimulationHistory(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    setIsAuthenticated(false);
    setView('control-tower');
  };

  const handleFileChange = (event) => {
    const { name, files: selectedFiles } = event.target;
    setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("❌ You must be logged in to run the simulation.");
      return;
    }

    const requiredFields = ['disruptions', 'demand', 'locations', 'location_materials', 'processes', 'bom'];
    const formData = new FormData();

    for (let field of requiredFields) {
      if (!files[field]) {
        alert(`❌ Missing required file: ${field}.csv`);
        return;
      }
      formData.append(field, files[field]);
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE}/api/run`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.status === 200 && response.data.status === 'success') {
        setOutputUrls(response.data);

        const inventoryRes = await axios.get(response.data.inventory_output_file_url, { responseType: 'text' });
        const parsed = Papa.parse(inventoryRes.data, {
          header: true,
          skipEmptyLines: true,
          transformHeader: h => h.trim().toLowerCase()
        });
        const skus = [...new Set(parsed.data.map(row => row.sku).filter(Boolean))];
        setSkuOptions(skus.map(sku => ({ value: sku, label: sku })));
        setSelectedSku(skus.slice(0, 2));
      } else {
        throw new Error(response.data?.message || 'Simulation failed');
      }

    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.error("❌ Simulation error:", msg);
      alert(`Simulation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateKpisFromRows = (rows) => {
    if (!rows || rows.length === 0) return null;
    const totalInventory = rows.reduce((sum, r) => sum + (parseFloat(r['initial inventory']) || 0), 0);
    const totalProduction = rows.reduce((sum, r) => sum + (parseFloat(r['quantity produced']) || 0), 0);
    const totalUnmet = rows.reduce((sum, r) => sum + (parseFloat(r['quantity unmet']) || 0), 0);

    return {
      avgInventory: totalInventory / rows.length,
      totalProduction,
      backorderVolume: totalUnmet
    };
  };

  const loadFilteredChart = async () => {
    const fileUrl = outputUrls?.[`${selectedOutputType}_output_file_url`];
    if (!fileUrl || selectedSku.length === 0) return;

    try {
      const response = await axios.get(fileUrl, { responseType: 'text' });
      const parsed = Papa.parse(response.data, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase()
      });

      const valueField = selectedOutputType === 'inventory' ? 'initial inventory'
                        : selectedOutputType === 'flow' ? 'quantity fulfilled'
                        : selectedOutputType === 'production' ? 'quantity produced'
                        : 'quantity unmet';

      const selectedSkuValues = selectedSku.map(s => typeof s === 'string' ? s.toLowerCase() : s.value.toLowerCase());

      const grouped = {};
      const allDates = new Set();
      const filteredRows = [];

      parsed.data.forEach(row => {
        const sku = row.sku?.toLowerCase();
        const date = row.date;
        const value = parseFloat(row[valueField] || 0);

        if (!sku || !date || !selectedSkuValues.includes(sku)) return;

        filteredRows.push(row);
        allDates.add(date);
        if (!grouped[sku]) grouped[sku] = {};
        if (!grouped[sku][date]) grouped[sku][date] = 0;
        grouped[sku][date] += value;
      });

      const sortedDates = Array.from(allDates).sort();

      const datasets = selectedSkuValues.map(sku => ({
        label: sku,
        data: sortedDates.map(date => grouped[sku]?.[date] || 0),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 2,
        fill: false
      }));

      setChartData({ labels: sortedDates, datasets });
      setKpis(calculateKpisFromRows(filteredRows));

    } catch (error) {
      console.error("❌ Chart load error:", error.message);
    }
  };

  useEffect(() => {
    if (outputUrls && selectedSku.length > 0) {
      loadFilteredChart();
    }
  }, [outputUrls, selectedSku, selectedOutputType]);

  const handleFacilityClick = (facilityName) => {
    console.log('📍 Facility clicked:', facilityName);
  };

  if (!isAuthenticated) return <AuthPage onLogin={handleLogin} />;

  if (view === 'dashboard') {
    return (
      <SimulationDashboard
        handleFileChange={handleFileChange}
        handleSubmit={handleSubmit}
        loading={loading}
        outputUrls={outputUrls}
        skuOptions={skuOptions}
        selectedSku={selectedSku}
        setSelectedSku={setSelectedSku}
        selectedOutputType={selectedOutputType}
        setSelectedOutputType={setSelectedOutputType}
        chartData={chartData}
        kpis={kpis}
        summaryStats={summaryStats}
        simulationHistory={simulationHistory}
        files={files}
        handleFacilityClick={handleFacilityClick}
        onLogout={handleLogout}
        switchView={setView}
      />
    );
  }

  return <ControlTower switchView={setView} onLogout={handleLogout} />;
}
