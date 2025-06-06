import { downloadCSV } from './utils/downloadCSV';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
import Select from 'react-select';
import MapView from './components/MapView'; // Includes marker interactivity

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
  const [selectedFacility, setSelectedFacility] = useState(null); // ✅ NEW

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

  const loadFilteredChart = async (type, sku, facility = null) => {
    const url = outputUrls?.[`${type}_output_file_url`];
    if (!url) return;

    const response = await fetch(url);
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true });
    let rows = parsed.data.filter(row => row.Date && !isNaN(Date.parse(row.Date)));

    if (sku.length > 0) {
      rows = rows.filter(row => sku.includes(row.SKU));
    }

    if (facility) {
      rows = rows.filter(row => row.Facility === facility);
    }

    setFilteredRows(rows);
    const uniqueSkus = [...new Set(rows.map(row => row.SKU).filter(Boolean))];
    setSkuList(uniqueSkus);

    const valueColumn =
      type === 'inventory' ? 'Initial Inventory' :
      type === 'flow' ? 'Quantity Fulfilled' :
      type === 'production' ? 'Quantity Produced' :
      type === 'occurrence' ? 'Quantity Unmet' :
      null;

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

    const labels = rows
      .filter(row => sku.includes(row.SKU) || sku.length === 0)
      .map(row => row.Date);

    setChartData({ labels, datasets });
  };

  useEffect(() => {
    if (outputUrls) loadFilteredChart(selectedOutputType, selectedSku, selectedFacility);
  }, [selectedOutputType, selectedSku, selectedFacility]);

  useEffect(() => {
    if (selectedSku.some(sku => !skuList.includes(sku))) {
      setSelectedSku([]);
    }
  }, [skuList]);

  const getSummaryStats = () => {
    if (!filteredRows.length) return null;
    const dates = filteredRows.map(row => row.Date);
    const valueColumn =
      selectedOutputType === 'inventory' ? 'Initial Inventory' :
      selectedOutputType === 'flow' ? 'Quantity Fulfilled' :
      selectedOutputType === 'production' ? 'Quantity Produced' :
      selectedOutputType === 'occurrence' ? 'Quantity Unmet' :
      null;
    const values = filteredRows.map(row => Number(row?.[valueColumn]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const uniqueFacilities = new Set(filteredRows.map(row => row.Facility)).size;
    return { dateRange: `${dates[0]} to ${dates[dates.length - 1]}`, total, avg: avg.toFixed(2), uniqueFacilities };
  };

  const handleFacilityClick = (facilityName) => {
    setSelectedFacility(facilityName);
  };

  const skuOptions = skuList.map(sku => ({ value: sku, label: sku }));

  return (
    <div className="min-h-screen font-sans bg-[#FCFDF8]">
      <header className="bg-[#1D625B] text-white flex justify-between items-center px-6 py-4 shadow">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-10 w-auto" />
          <span className="text-xl font-bold">FOR-C</span>
        </div>
        <div className="space-x-4">
          <button className="hover:underline">FAQs</button>
          <button className="hover:underline">Settings</button>
          <button className="hover:underline">Sign Out</button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="w-64 bg-[#1D625B] text-white p-6 space-y-6 flex flex-col">
          <div className="text-lg font-semibold">Simulation KPIs</div>
          {(() => {
            const stats = getSummaryStats();
            return stats ? (
              <ul className="space-y-1 text-sm">
                <li><strong>📆 Range:</strong> {stats.dateRange}</li>
                <li><strong>📦 Total:</strong> {stats.total}</li>
                <li><strong>📊 Avg/Day:</strong> {stats.avg}</li>
                <li><strong>🏭 Facilities:</strong> {stats.uniqueFacilities}</li>
              </ul>
            ) : (
              <p className="text-sm italic">No data</p>
            );
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

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mb-6 px-4 py-2 bg-[#ABFA7D] hover:bg-lime-400 text-black font-semibold rounded"
          >
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
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 10 }
                          }
                        }
                      },
                      scales: {
                        x: { title: { display: true, text: 'Date' } },
                        y: { title: { display: true, text: 'Quantity' } }
                      }
                    }}
                  />
                ) : (
                  <div className="text-center text-gray-500 text-sm italic">
                    No chart data yet. Run a simulation to view results.
                  </div>
                )}
              </div>

              <div className="mt-6 h-[400px] rounded overflow-hidden shadow border border-gray-300">
                <MapView onFacilityClick={handleFacilityClick} />
              </div>

              <div className="mt-6">
                <h2 className="text-lg font-semibold text-[#1D625B] mb-2">🕒 Simulation History</h2>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {simulationHistory.map((time, idx) => (
                    <li key={idx}>{time}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
