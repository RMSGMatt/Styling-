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
  const [inventoryData, setInventoryData] = useState(null);

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
      const res = await axios.post('http://127.0.0.1:5000/api/run', formData);
      setOutputUrls(res.data);
      loadInventoryChart(res.data.inventory_output_file_url);
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryChart = async (url) => {
    const response = await fetch(url);
    const text = await response.text();
    const parsed = Papa.parse(text, { header: true });
    const rows = parsed.data.filter(row => row.Date && !isNaN(Date.parse(row.Date)));
    const labels = rows.map(row => row.Date);
    const values = rows.map(row => Number(row['Inventory Snapshot']) || 0);

    setInventoryData({
      labels,
      datasets: [{
        label: 'Inventory Snapshot',
        data: values,
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.3)',
        fill: true,
        tension: 0.3
      }]
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">FOR-C Simulation Dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        {['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].map((key) => (
          <div key={key}>
            <label className="block font-semibold mb-1">{key}.csv</label>
            <input type="file" name={key} onChange={handleFileChange} className="border p-2 w-full" />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        {loading ? 'Running Simulation...' : 'Run Simulation'}
      </button>

      {outputUrls && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">📄 Output Downloads</h2>
          <ul className="list-disc list-inside text-blue-700">
            {['flow', 'inventory', 'production', 'occurrence'].map((type) => (
              <li key={type}>
                <a href={outputUrls[`${type}_output_file_url`]} target="_blank" rel="noreferrer" className="underline">
                  Download {type}.csv
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inventoryData && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">📊 Inventory Trend</h2>
          <Line data={inventoryData} />
        </div>
      )}
    </div>
  );
}
