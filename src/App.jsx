import { downloadCSV } from './utils/downloadCSV';
import React, { useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
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
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedOutputType, setSelectedOutputType] = useState('inventory');
  const [filteredRows, setFilteredRows] = useState([]);

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
      const res = await axios.post("https://forc-backend.onrender.com/api/run", formData);
      setOutputUrls(res.data);
      await loadFilteredChart('inventory', ''); // Default load
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredChart = async (type, sku) => {
    const url = outputUrls?.[`${type}_output_file_url`];
    if (!url) return;

    const response = await fetch(url);
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true });
    let rows = parsed.data.filter(row => row.Date && !isNaN(Date.parse(row.Date)));

    if (sku) {
      rows = rows.filter(row => row.SKU === sku);
    }

    setFilteredRows(rows);

    const labels = rows.map(row => row.Date);
    const values = rows.map(row =>
      Number(row['Inventory Snapshot'] || row['Flow Quantity'] || row['Production Output'] || row['Occurrence Count']) || 0
    );

    setChartData({
      labels,
      datasets: [
        {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Snapshot`,
          data: values,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.3)',
          fill: true,
          tension: 0.3
        }
      ]
    });
  };

  const getSummaryStats = () => {
    if (!filteredRows.length) return null;

    const dates = filteredRows.map(row => row.Date);
    const values = filteredRows.map(row =>
      Number(row['Inventory Snapshot'] || row['Flow Quantity'] || row['Production Output'] || row['Occurrence Count']) || 0
    );
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const uniqueFacilities = new Set(filteredRows.map(row => row.Facility)).size;

    return {
      dateRange: `${dates[0]} to ${dates[dates.length - 1]}`,
      total,
      avg: avg.toFixed(2),
      uniqueFacilities
    };
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-emerald-900 text-white p-6 space-y-4">
        <div className="text-2xl font-bold mb-6">FOR-C</div>
        {['Disruption', 'Demand', 'Location Path', 'Location Materials', 'Information Process', 'BOM'].map(label => (
          <button key={label} className="w-full text-left px-4 py-2 bg-emerald-800 hover:bg-emerald-700 rounded">
            {label}
          </button>
        ))}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded"
        >
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
        <button className="w-full mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded">
          Reset Simulation
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-8 overflow-auto">
        <h1 className="text-3xl font-semibold mb-6 text-emerald-900">FOR-C Simulation Dashboard</h1>

        {/* File Uploads */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].map(key => (
            <div key={key}>
              <label className="block font-medium text-gray-700 mb-1 capitalize">{key}.csv</label>
              <input type="file" name={key} onChange={handleFileChange} className="block w-full border border-gray-300 rounded px-2 py-1" />
            </div>
          ))}
        </div>

        {/* Output Downloads */}
        {outputUrls && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">📄 Output Downloads</h2>
            <ul className="space-y-1 text-blue-700">
              {['flow', 'inventory', 'production', 'occurrence'].map(type => (
                <li key={type}>
                  <a href={outputUrls[`${type}_output_file_url`]} target="_blank" rel="noreferrer" className="underline">
                    Download {type}.csv
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Chart Filters */}
        {outputUrls && (
          <div className="flex gap-4 mb-6">
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All SKUs</option>
              <option value="SKU-001">SKU-001</option>
              <option value="SKU-002">SKU-002</option>
            </select>

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

            <button
              onClick={() => loadFilteredChart(selectedOutputType, selectedSku)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Chart Display */}
        {chartData && (
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Inventory Trend</h2>
            <div className="bg-white shadow rounded p-4">
              <Line data={chartData} />
            </div>

            <div className="mt-4 bg-gray-100 rounded p-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Summary Statistics</h3>
              {(() => {
                const stats = getSummaryStats();
                return stats ? (
                  <ul className="text-gray-800 space-y-1">
                    <li><strong>📆 Date Range:</strong> {stats.dateRange}</li>
                    <li><strong>📦 Total Quantity:</strong> {stats.total}</li>
                    <li><strong>📊 Daily Average:</strong> {stats.avg}</li>
                    <li><strong>🏭 Unique Facilities:</strong> {stats.uniqueFacilities}</li>
                  </ul>
                ) : (
                  <p>No data available</p>
                );
              })()}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
