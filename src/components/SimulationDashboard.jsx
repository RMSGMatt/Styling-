console.log("🧪 LOADED SimulationDashboard");
import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import Select from 'react-select';
import MapView from './MapView';

export default function SimulationDashboard({
  handleFileChange,
  handleSubmit,
  loading,
  outputUrls,
  skuOptions,
  selectedSku,
  setSelectedSku,
  selectedOutputType,
  setSelectedOutputType,
  chartData,
  kpis,
  summaryStats,
  simulationHistory,
  files,
  handleFacilityClick,
  onLogout,
  switchView,
  onReloadRun
}) {
  const [showFulfillmentKpis, setShowFulfillmentKpis] = useState(true);
  const [showProductionKpis, setShowProductionKpis] = useState(true);
  const [showCostKpis, setShowCostKpis] = useState(true);

  const chartColors = [
    '#1D625B', '#ABFA7D', '#F59E0B', '#3B82F6', '#FACC15', '#9CA3AF', '#EF4444'
  ];

  const fallbackKpis = {
    onTimeFulfillment: 'N/A',
    avgInventory: 'N/A',
    inventoryTurns: 'N/A',
    daysOfInventory: 'N/A',
    totalProduction: 'N/A',
    impactedFacilities: 'N/A',
    recoveryTime: 'N/A'
  };
  const safeKpis = kpis || fallbackKpis;

  return (
    <div className="min-h-screen font-sans bg-[#FCFDF8]">
      <header className="bg-[#1D625B] text-white flex justify-between items-center px-6 py-4 shadow">
        <img src="/logo.png" alt="FOR-C Logo" className="h-10 w-auto" />
        <div className="flex gap-4 items-center">
          <button
            onClick={() => switchView('control-tower')}
            className="bg-[#ABFA7D] text-[#1D625B] px-3 py-1.5 rounded-lg shadow hover:bg-lime-300 font-semibold text-sm"
          >
            🛰️ Control Tower
          </button>
          <button
            onClick={onLogout}
            className="bg-green-700 hover:bg-green-800 text-white font-semibold px-4 py-2 rounded-lg shadow"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="bg-[#FCFDF8] p-8">
        <div className="mb-8 h-[400px] rounded overflow-hidden shadow border border-gray-300">
          <MapView onFacilityClick={handleFacilityClick} locationsUrl={files?.locations ? URL.createObjectURL(files.locations) : null} />
        </div>

        <h1 className="text-3xl font-semibold text-[#1D625B] mb-6">Simulation Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].map(key => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{key}.csv</label>
              <input
                type="file"
                name={key}
                onChange={handleFileChange}
                className="block w-full border border-gray-300 rounded px-2 py-1"
              />
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
                <>
                  <Line
                    data={{
                      ...chartData,
                      datasets: chartData.datasets.map((ds, i) => ({
                        ...ds,
                        borderColor: chartColors[i % chartColors.length],
                        backgroundColor: chartColors[i % chartColors.length],
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3
                      }))
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: { color: '#1D625B' }
                        }
                      },
                      scales: {
                        x: {
                          ticks: { color: '#4B5563' },
                          grid: { color: '#E5E7EB' }
                        },
                        y: {
                          ticks: { color: '#4B5563' },
                          grid: { color: '#E5E7EB' }
                        }
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-[#1D625B] text-white p-4 rounded-xl shadow border border-[#ABFA7D]">
                      <button
                        onClick={() => setShowFulfillmentKpis(!showFulfillmentKpis)}
                        className="text-lg font-bold text-[#ABFA7D] mb-2 flex items-center w-full justify-between"
                      >
                        📦 Fulfillment & Inventory
                        <span className="text-white text-sm">{showFulfillmentKpis ? '▲' : '▼'}</span>
                      </button>
                      {showFulfillmentKpis && (
                        <div className="space-y-2 text-sm">
                          <p>✅ On-Time Fulfillment: <strong>{safeKpis.onTimeFulfillment}%</strong></p>
                          <p>📦 Avg Inventory per SKU: <strong>{safeKpis.avgInventory}</strong></p>
                          <p>🔁 Inventory Turns: <strong>{safeKpis.inventoryTurns}</strong></p>
                          <p>📅 Days of Inventory: <strong>{safeKpis.daysOfInventory}</strong></p>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#1D625B] text-white p-4 rounded-xl shadow border border-[#ABFA7D]">
                      <button
                        onClick={() => setShowProductionKpis(!showProductionKpis)}
                        className="text-lg font-bold text-[#ABFA7D] mb-2 flex items-center w-full justify-between"
                      >
                        🏭 Production & Disruption
                        <span className="text-white text-sm">{showProductionKpis ? '▲' : '▼'}</span>
                      </button>
                      {showProductionKpis && (
                        <div className="space-y-2 text-sm">
                          <p>🏭 Total Production: <strong>{safeKpis.totalProduction}</strong></p>
                          <p>🔥 Impacted Facilities: <strong>{safeKpis.impactedFacilities}</strong></p>
                          <p>🕒 Avg Time to Recovery: <strong>{safeKpis.recoveryTime} days</strong></p>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#1D625B] text-white p-4 rounded-xl shadow border border-[#ABFA7D]">
                      <button
                        onClick={() => setShowCostKpis(!showCostKpis)}
                        className="text-lg font-bold text-[#ABFA7D] mb-2 flex items-center w-full justify-between"
                      >
                        💰 Cost & Service Metrics
                        <span className="text-white text-sm">{showCostKpis ? '▲' : '▼'}</span>
                      </button>
                      {showCostKpis && (
                        <div className="space-y-2 text-sm">
                          <p>📉 Cost to Serve: <strong>$128/unit</strong></p>
                          <p>🚚 Expedite Ratio: <strong>6.3%</strong></p>
                          <p>🛒 Backorder Volume: <strong>1,100</strong></p>
                          <p>📈 Forecast Accuracy: <strong>92%</strong></p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 text-sm italic">
                  No chart data yet. Run a simulation to view results.
                </div>
              )}
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-bold text-[#1D625B] mb-2">📁 Simulation History</h2>
              <ul className="space-y-2">
                {simulationHistory.map((run, idx) => (
                  <li key={idx} className="border p-3 rounded shadow-sm bg-white flex flex-col md:flex-row md:items-center justify-between">
                    <div className="text-sm text-gray-700 mb-2 md:mb-0 cursor-pointer" onClick={() => onReloadRun(run.outputUrls)}>
                      {run.timestamp}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['inventory', 'flow', 'production', 'occurrence'].map(type => (
                        run.outputUrls?.[`${type}_output_file_url`] && (
                          <a
                            key={type}
                            href={run.outputUrls[`${type}_output_file_url`]}
                            download
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Download {type}
                          </a>
                        )
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
