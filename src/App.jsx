// ✅ Final combined App.jsx with working summary panel, sidebar KPIs, download buttons, and interactive map

import React, { useState, useEffect } from 'react';
import { downloadCSV } from './utils/downloadCSV';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
import Select from 'react-select';
import MapView from './components/MapView';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function App() {
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [outputUrls, setOutputUrls] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [selectedSku, setSelectedSku] = useState([]);
  const [selectedOutputType, setSelectedOutputType] = useState('inventory');
  const [filteredRows, setFilteredRows] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    for (const key of ['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials']) {
      if (!files[key]) {
        alert(`Missing file: ${key}`);
        return;
      }
      formData.append(key, files[key]);
    }

    try {
      setLoading(true);
      const res = await axios.post("http://127.0.0.1:5000/api/run", formData);
      setOutputUrls(res.data);
      setSelectedOutputType('inventory');
      setSelectedSku([]);
      setSelectedFacility(null);
      addSimulationHistory();
      await loadFilteredChart('inventory', [], null);
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const addSimulationHistory = () => {
    const timestamp = new Date().toLocaleString();
    setSimulationHistory(prev => [timestamp, ...prev.slice(0, 9)]);
  };

  const calculateStats = (rows, valueColumn) => {
    const values = rows.map(row => Number(row?.[valueColumn]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const uniqueFacilities = new Set(rows.map(row => row.Facility)).size;
    return { total, avg: avg.toFixed(2), uniqueFacilities };
  };

  const loadAllSummaries = async () => {
    const types = [
      { key: 'inventory', column: 'Initial Inventory' },
      { key: 'flow', column: 'Quantity Fulfilled' },
      { key: 'production', column: 'Quantity Produced' },
      { key: 'occurrence', column: 'Quantity Unmet' }
    ];
    const stats = {};
    for (const { key, column } of types) {
      const url = outputUrls?.[`${key}_output_file_url`];
      if (!url) continue;
      const text = await (await fetch(url)).text();
      const parsed = Papa.parse(text, { header: true });
      const rows = parsed.data.filter(row => row.Date && !isNaN(Date.parse(row.Date)));
      stats[key] = calculateStats(rows, column);
    }
    setSummaryStats(stats);
  };

  const loadFilteredChart = async (type, sku, facility = null) => {
    const url = outputUrls?.[`${type}_output_file_url`];
    if (!url) return;
    const text = await (await fetch(url)).text();
    const parsed = Papa.parse(text, { header: true });
    let rows = parsed.data.filter(row => row.Date && !isNaN(Date.parse(row.Date)));

    if (sku.length > 0) rows = rows.filter(row => sku.includes(row.SKU));
    if (facility) rows = rows.filter(row => row.Facility === facility);

    setFilteredRows(rows);
    const uniqueSkus = [...new Set(rows.map(row => row.SKU).filter(Boolean))];
    setSkuList(uniqueSkus);

    const valueColumn =
      type === 'inventory' ? 'Initial Inventory' :
      type === 'flow' ? 'Quantity Fulfilled' :
      type === 'production' ? 'Quantity Produced' :
      type === 'occurrence' ? 'Quantity Unmet' : null;

    const datasets = (sku.length > 0 ? sku : uniqueSkus).map((skuValue, idx) => {
      const skuRows = rows.filter(row => row.SKU === skuValue);
      return {
        label: skuValue,
        data: skuRows.map(row => Number(row?.[valueColumn]) || 0),
        borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
        backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 80%)`,
        fill: false,
        tension: 0.3
      };
    });

    const labels = rows.filter(row => sku.includes(row.SKU) || sku.length === 0).map(row => row.Date);
    setChartData({ labels, datasets });
  };

  useEffect(() => {
    if (outputUrls) loadFilteredChart(selectedOutputType, selectedSku, selectedFacility);
  }, [selectedOutputType, selectedSku, selectedFacility]);

  useEffect(() => {
    if (outputUrls) loadAllSummaries();
  }, [outputUrls]);

  const handleFacilityClick = (facilityName) => setSelectedFacility(facilityName);
  const skuOptions = skuList.map(sku => ({ value: sku, label: sku }));

  return (
    <div className="min-h-screen font-sans bg-[#FCFDF8]">
      <header className="bg-[#1D625B] text-white flex justify-between items-center px-6 py-4 shadow">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-10 w-auto" />
          <span className="text-xl font-bold">FOR-C</span>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="w-64 bg-[#1D625B] text-white p-6 space-y-6 flex flex-col">
          <div className="text-lg font-semibold">Simulation KPIs</div>
          {(() => {
            const stats = summaryStats?.[selectedOutputType];
            return stats ? (
              <ul className="space-y-1 text-sm">
                <li><strong>📦 Total:</strong> {stats.total}</li>
                <li><strong>📊 Avg/Day:</strong> {stats.avg}</li>
                <li><strong>🏭 Facilities:</strong> {stats.uniqueFacilities}</li>
              </ul>
            ) : <p className="text-sm italic">No data</p>;
          })()}
        </aside>

        <main className="flex-1 bg-[#FCFDF8] p-8">
          <h1 className="text-3xl font-semibold text-[#1D625B] mb-6">Simulation Dashboard</h1>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{key}.csv</label>
                <input type="file" name={key} onChange={handleFileChange} className="block w-full border border-gray-300 rounded px-2 py-1" />
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading} className="mb-6 px-4 py-2 bg-[#ABFA7D] hover:bg-lime-400 text-black font-semibold rounded">
            {loading ? 'Running...' : 'Run Simulation'}
          </button>

          {outputUrls && (
            <>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="w-full md:w-1/2">
                  <label className="block font-medium text-gray-700 mb-1">Select SKUs</label>
                  <Select
                    isMulti
                    options={skuOptions}
                    value={skuOptions.filter(opt => selectedSku.includes(opt.value))}
                    onChange={(selected) => setSelectedSku((selected || []).map(opt => opt.value))}
                    className="w-full"
                    placeholder="Select SKUs..."
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Output Type</label>
                  <select
                    value={selectedOutputType}
                    onChange={(e) => setSelectedOutputType(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="inventory">Inventory</option>
                    <option value="flow">Flow</option>
                    <option value="production">Production</option>
                    <option value="occurrence">Occurrence</option>
                  </select>
                </div>
              </div>

              <div className="bg-white shadow rounded p-4">
                {chartData ? (
                  <Line data={chartData} />
                ) : (
                  <div className="text-center text-gray-500 text-sm italic">
                    No chart data yet. Run a simulation to view results.
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-bold text-[#1D625B] mb-2">📊 Simulation Summary Panel</h2>
                {summaryStats ? (
                  <table className="min-w-full table-auto border-collapse">
                    <thead className="bg-[#1D625B] text-white">
                      <tr>
                        <th className="p-2 border">Output Type</th>
                        <th className="p-2 border">Total Quantity</th>
                        <th className="p-2 border">Daily Avg</th>
                        <th className="p-2 border">Facilities</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {['inventory', 'flow', 'production', 'occurrence'].map(type => (
                        <tr key={type} className="text-center">
                          <td className="border px-2 py-1 capitalize">{type}</td>
                          <td className="border px-2 py-1">{summaryStats[type]?.total ?? '-'}</td>
                          <td className="border px-2 py-1">{summaryStats[type]?.avg ?? '-'}</td>
                          <td className="border px-2 py-1">{summaryStats[type]?.uniqueFacilities ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm italic text-gray-500">No summary available. Run a simulation.</p>
                )}
              </div>

              <div className="mt-6 space-y-2">
                {['flow', 'inventory', 'production', 'occurrence'].map(type => (
                  outputUrls[`${type}_output_file_url`] && (
                    <a key={type} href={outputUrls[`${type}_output_file_url`]} download className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      ⬇ Download {type.charAt(0).toUpperCase() + type.slice(1)} CSV
                    </a>
                  )
                ))}
              </div>

              <div className="mt-6 h-[400px] rounded overflow-hidden shadow border border-gray-300">
                <MapView
                  onFacilityClick={handleFacilityClick}
                  locationsUrl={files?.locations ? URL.createObjectURL(files.locations) : null}
                />

              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
