import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Select from 'react-select';
import MapView from './MapView';
import ScenarioBuilder from './ScenarioBuilder';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

console.log('🧩 SimulationDashboard loaded (with scenario transforms)');

// ---------------- helpers: csv I/O + transforms ----------------
const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsText(file);
  });

const csvToRows = (csvText) => Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
const rowsToCsv = (rows) => Papa.unparse(rows || [], { header: true });

const inDateWindow = (isoDate, start, end) => {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(d.getTime()) || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return d >= s && d <= e;
};

// demand: multiply quantity-like column within window
function transformDemandRows(rows, { startDate, endDate }, multiplier) {
  if (!Array.isArray(rows) || !rows.length || !startDate || !endDate || !multiplier) return rows;

  const qtyCols = ['quantity', 'demand', 'qty', 'forecast_qty', 'qty_units'];
  const dateCols = ['date', 'Date', 'DATE'];

  const pickQtyCol = (row) =>
    qtyCols.find((c) => row[c] !== undefined && row[c] !== '') ||
    Object.keys(row).find((k) => /qty|demand/i.test(k));

  const pickDateCol = (row) =>
    dateCols.find((c) => row[c] !== undefined && row[c] !== '') ||
    Object.keys(row).find((k) => /date/i.test(k));

  return rows.map((r) => {
    const dcol = pickDateCol(r);
    const qcol = pickQtyCol(r);
    if (!dcol || !qcol) return r;

    const dateStr = (r[dcol] || '').toString().slice(0, 10);
    if (!inDateWindow(dateStr, startDate, endDate)) return r;

    const base = parseFloat(r[qcol]);
    if (Number.isNaN(base)) return r;

    const newVal = base * multiplier;
    return { ...r, [qcol]: String(newVal) };
  });
}

// disruptions: append rows ensuring a standard header
function appendDisruptionsRows(existingRows, disruptionSpecs) {
  const rows = Array.isArray(existingRows) ? [...existingRows] : [];
  const specs = Array.isArray(disruptionSpecs) ? disruptionSpecs : [];

  for (const spec of specs) {
    rows.push({
      type: spec.type,
      start_date: spec.startDate,
      end_date: spec.endDate,
      facility_id: spec.facility,
      severity: spec.severity, // 0–100
    });
  }
  return rows;
}

// supply/location_materials: scale capacity for facility within window (when date col exists)
function transformSupplyRows(rows, { startDate, endDate, facility }, capacityMultiplier) {
  if (!Array.isArray(rows) || !rows.length || !facility || !capacityMultiplier) return rows;

  const capCols = ['capacity', 'daily_capacity', 'max_capacity', 'Cap', 'CAPACITY'];
  const dateCols = ['date', 'effective_date', 'Date'];
  const facCols = ['facility_id', 'facility', 'site', 'plant'];

  const pickCapCol = (row) =>
    capCols.find((c) => row[c] !== undefined && row[c] !== '') ||
    Object.keys(row).find((k) => /capacity/i.test(k));

  const pickDateCol = (row) =>
    dateCols.find((c) => row[c] !== undefined && row[c] !== '') ||
    Object.keys(row).find((k) => /date/i.test(k));

  const pickFacCol = (row) =>
    facCols.find((c) => row[c] !== undefined && row[c] !== '') ||
    Object.keys(row).find((k) => /facility|plant|site/i.test(k));

  return rows.map((r) => {
    const facCol = pickFacCol(r);
    if (!facCol) return r;
    const matchFacility =
      String(r[facCol] || '').trim().toLowerCase() === String(facility).trim().toLowerCase();
    if (!matchFacility) return r;

    const capCol = pickCapCol(r);
    if (!capCol) return r;

    const dateCol = pickDateCol(r); // optional
    const withinWindow = dateCol
      ? inDateWindow(String(r[dateCol] || '').slice(0, 10), startDate, endDate)
      : true;

    if (!withinWindow) return r;

    const base = parseFloat(r[capCol]);
    if (Number.isNaN(base)) return r;

    const newVal = base * capacityMultiplier;
    return { ...r, [capCol]: String(newVal) };
  });
}

// Build FormData with scenario transforms applied where possible
async function buildTransformedFormData(files, scenarioData) {
  const fd = new FormData();

  const maybeAppendOriginal = (key) => {
    const f = files?.[key];
    if (f instanceof File) fd.append(key, f, f.name);
  };

  // include originals first
  ['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].forEach(
    maybeAppendOriginal
  );

  if (!scenarioData || !scenarioData.transforms || !scenarioData.scope) {
    console.log('ℹ️ No scenarioData — sending originals.');
    return fd;
  }

  const { scope, transforms } = scenarioData;
  const { startDate, endDate, facility } = scope;

  // demand
  try {
    if (files?.demand && transforms?.demand?.multiplier) {
      const text = await readFileAsText(files.demand);
      const rows = csvToRows(text);
      const newRows = transformDemandRows(rows, { startDate, endDate }, transforms.demand.multiplier);
      const csv = rowsToCsv(newRows);
      const blob = new Blob([csv], { type: 'text/csv' });
      fd.set('demand', blob, 'demand.csv');
      console.log('✅ demand.csv transformed');
    }
  } catch (e) {
    console.warn('⚠️ Demand transform failed, sending original:', e);
  }

  // disruptions
  try {
    if (files?.disruptions && Array.isArray(transforms?.disruptions)) {
      const text = await readFileAsText(files.disruptions);
      const rows = csvToRows(text);
      const newRows = appendDisruptionsRows(rows, transforms.disruptions);
      const csv = rowsToCsv(newRows);
      const blob = new Blob([csv], { type: 'text/csv' });
      fd.set('disruptions', blob, 'disruptions.csv');
      console.log('✅ disruptions.csv appended');
    }
  } catch (e) {
    console.warn('⚠️ Disruptions transform failed, sending original:', e);
  }

  // supply (location_materials)
  try {
    if (files?.location_materials && transforms?.supply?.capacityMultiplier) {
      const text = await readFileAsText(files.location_materials);
      const rows = csvToRows(text);
      const newRows = transformSupplyRows(
        rows,
        { startDate, endDate, facility },
        transforms.supply.capacityMultiplier
      );
      const csv = rowsToCsv(newRows);
      const blob = new Blob([csv], { type: 'text/csv' });
      fd.set('location_materials', blob, 'location_materials.csv');
      console.log('✅ location_materials.csv transformed');
    }
  } catch (e) {
    console.warn('⚠️ Supply transform failed, sending original:', e);
  }

  return fd;
}

// ---------------- component ----------------
export default function SimulationDashboard({
  handleFileChange,
  handleSubmit,             // will be called as handleSubmit(formData)
  simulationStatus,
  outputUrls,
  skuOptions,
  selectedSku,
  setSelectedSku,
  selectedOutputType,
  setSelectedOutputType,
  chartData,
  summaryStats,
  simulationHistory,
  files,
  onLogout,
  switchView,
  onReloadRun,
  kpis,
  handleFacilityClick,
  disruptionImpactData,
  runoutRiskData,
  countermeasuresData,
  locationsUrl,
  scenarioData,
  setScenarioData,
}) {
  const fallbackKpis = {
    onTimeFulfillment: 'N/A',
    avgInventory: 'N/A',
    inventoryTurns: 'N/A',
    daysOfInventory: 'N/A',
    totalProduction: 'N/A',
    impactedFacilities: 'N/A',
    recoveryTime: 'N/A',
    costToServe: 'N/A',
    expediteRatio: 'N/A',
    backorderVolume: 'N/A',
    forecastAccuracy: 'N/A',
  };

  const safeKpis = { ...fallbackKpis, ...(kpis || {}) };
  const [showFulfillmentKpis, setShowFulfillmentKpis] = useState(true);
  const [showProductionKpis, setShowProductionKpis] = useState(true);
  const [showCostKpis, setShowCostKpis] = useState(true);
  const [duration, setDuration] = useState(20);
  const [showHistory, setShowHistory] = useState(true);
  const [localRunStatus, setLocalRunStatus] = useState('idle'); // idle | transforming | posting

  // show the name saved by Control Tower (optional, for UX)
const [activeScenarioName, setActiveScenarioName] = useState(
  (typeof window !== 'undefined' && localStorage.getItem('currentScenarioName')) || ''
);


  const chartColors = ['#1D625B', '#ABFA7D', '#F59E0B', '#3B82F6', '#FACC15', '#9CA3AF', '#EF4444'];

  const fallbackSkuOptions = [
    { value: 'SKU-01', label: 'SKU-01' },
    { value: 'SKU-02', label: 'SKU-02' },
  ];
  const finalSkuOptions = skuOptions && skuOptions.length > 0 ? skuOptions : fallbackSkuOptions;

  const runWithScenario = async () => {
    try {
      setLocalRunStatus('transforming');
      const formData = await buildTransformedFormData(files, scenarioData);
      setLocalRunStatus('posting');

      if (typeof handleSubmit === 'function') {
        await handleSubmit(formData);
      } else {
        alert('No handleSubmit provided from parent.');
      }
    } catch (e) {
      console.error('❌ Failed to run with scenario:', e);
      alert('Run failed while applying scenario. Check console for details.');
    } finally {
      setLocalRunStatus('idle');
    }
  };

  const runButtonLabel =
    localRunStatus === 'transforming'
      ? 'Applying Scenario…'
      : localRunStatus === 'posting'
      ? 'Submitting…'
      : simulationStatus === 'running'
      ? 'Running…'
      : simulationStatus === 'done'
      ? '✅ Done'
      : simulationStatus === 'error'
      ? '❌ Failed'
      : '🚀 Run Simulation';

  const runDisabled = localRunStatus !== 'idle' || simulationStatus === 'running';

  // On mount, pull the scenario saved by Control Tower and apply it
useEffect(() => {
  try {
    const raw = localStorage.getItem('currentScenario');
    const name = localStorage.getItem('currentScenarioName') || '';
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof setScenarioData === 'function') {
        setScenarioData(obj);
      }
      // If you added the optional state from Step 2:
      if (typeof setActiveScenarioName === 'function') {
        setActiveScenarioName(name);
      }
      console.log('✅ Applied scenario from Control Tower:', { name, obj });
    }
  } catch (e) {
    console.warn('⚠️ Failed to apply saved scenario from localStorage:', e);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Keep localStorage in sync whenever scenarioData changes
useEffect(() => {
  try {
    if (scenarioData && typeof scenarioData === 'object' && Object.keys(scenarioData).length) {
      localStorage.setItem('currentScenario', JSON.stringify(scenarioData));
      if (!localStorage.getItem('currentScenarioName')) {
        localStorage.setItem('currentScenarioName', 'Unsaved Scenario');
      }
    }
  } catch {}
}, [scenarioData]);

  return (
    <div className="min-h-screen font-sans bg-[#FCFDF8]">
      <header className="bg-[#1D625B] text-white flex justify-between items-center px-6 py-4 shadow">
        <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto rounded-xl shadow-sm" />
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
          <MapView
            onFacilityClick={handleFacilityClick}
            locationsUrl="https://supply-chain-simulation-files.s3.us-east-2.amazonaws.com/locations.csv"
          />
        </div>

        {/* --- Scenario Presets + Builder --- */}
        <div className="bg-white border border-gray-300 rounded-xl p-4 mb-6 shadow-md">
          <h2 className="text-lg font-semibold text-[#1D625B] mb-2">📋 Scenario Presets</h2>
          {activeScenarioName && (
  <div className="text-xs text-gray-600 mb-2">
    Active scenario: <span className="font-semibold">{activeScenarioName}</span>
  </div>
)}

          <p className="text-sm text-gray-600 mb-3">
            Apply disruption, demand, and capacity adjustments before running the simulation.
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              className="bg-[#1D625B] text-white text-sm px-4 py-1 rounded shadow"
              onClick={() =>
                setScenarioData({
                  meta: { createdAt: new Date().toISOString(), notes: 'Normal Ops' },
                  scope: {
                    facility: 'VN-Facility-1',
                    startDate: '2025-08-01',
                    endDate: '2025-08-15',
                    durationDays: 14,
                    types: [],
                    sourcing: 'none',
                    severity: 0,
                  },
                  transforms: {
                    demand: { multiplier: 1 },
                    disruptions: [],
                    supply: { facility: 'VN-Facility-1', capacityMultiplier: 1 },
                    sourcing: { mode: 'none' },
                  },
                })
              }
            >
              ✅ Normal Operating Conditions
            </button>
            <button
              className="bg-[#1D625B] text-white text-sm px-4 py-1 rounded shadow"
              onClick={() =>
                setScenarioData({
                  meta: { createdAt: new Date().toISOString(), notes: 'Regional disruption' },
                  scope: {
                    facility: 'VN-Facility-1',
                    startDate: '2025-08-01',
                    endDate: '2025-08-21',
                    durationDays: 20,
                    types: ['natural_disaster'],
                    sourcing: 'enable_backup',
                    severity: 70,
                  },
                  transforms: {
                    demand: { multiplier: 1.15 },
                    disruptions: [
                      {
                        type: 'natural_disaster',
                        facility: 'VN-Facility-1',
                        startDate: '2025-08-01',
                        endDate: '2025-08-21',
                        severity: 70,
                      },
                    ],
                    supply: { facility: 'VN-Facility-1', capacityMultiplier: 0.8 },
                    sourcing: { mode: 'enable_backup' },
                  },
                })
              }
            >
              ⚠️ Regional Disruption Scenario
            </button>
            <button
  className="bg-gray-300 text-gray-800 text-sm px-4 py-1 rounded shadow"
  onClick={() => {
    setScenarioData(null);
    try {
      localStorage.removeItem('currentScenario');
      localStorage.removeItem('currentScenarioName');
    } catch {}
    if (typeof setActiveScenarioName === 'function') setActiveScenarioName('');
  }}
>
  ♻️ Reset
</button>

          </div>

          <ScenarioBuilder setScenarioData={setScenarioData} onClear={() => setScenarioData(null)} />

          <div className="mt-3">
            {scenarioData ? (
              <div className="text-xs bg-[#F0FDF4] border border-[#C6F6D5] text-[#1D625B] rounded px-3 py-2">
                Scenario active: {scenarioData?.scope?.facility} · {scenarioData?.scope?.startDate} →{' '}
                {scenarioData?.scope?.endDate} · Sev {scenarioData?.scope?.severity}% · Demand×
                {scenarioData?.transforms?.demand?.multiplier || 1} · Capacity×
                {scenarioData?.transforms?.supply?.capacityMultiplier || 1}
              </div>
            ) : (
              <div className="text-xs text-gray-500">No scenario applied.</div>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-semibold text-[#1D625B] mb-6">Simulation Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {['demand', 'disruptions', 'locations', 'bom', 'processes', 'location_materials'].map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{key}.csv</label>
              <input type="file" name={key} onChange={(e) => handleFileChange(key, e.target.files[0])} />
            </div>
          ))}
        </div>

        {/* ✅ Dynamic Simulation Button (now applies scenario transforms) */}
        <div className="mb-8">
          <button
            onClick={runWithScenario}
            disabled={runDisabled}
            className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 shadow-md ${
              runDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : simulationStatus === 'done'
                ? 'bg-gradient-to-r from-green-400 to-green-600 text-white hover:shadow-lg hover:scale-[1.02]'
                : simulationStatus === 'error'
                ? 'bg-gradient-to-r from-red-500 to-red-700 text-white hover:shadow-lg hover:scale-[1.02]'
                : 'bg-gradient-to-r from-[#FFA856] to-[#FF6A00] text-white hover:shadow-lg hover:scale-[1.02]'
            }`}
          >
            {runButtonLabel}
          </button>
        </div>

        {outputUrls && (
          <>
            {/* Downloads */}
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                {
                  title: '📦 Core Outputs',
                  items: [
                    { type: 'inventory', icon: '📦' },
                    { type: 'flow', icon: '🔄' },
                    { type: 'production', icon: '🏭' },
                    { type: 'occurrence', icon: '⚠️' },
                  ],
                },
                {
                  title: '📊 Impact Analysis',
                  items: [
                    { type: 'disruption_impact', icon: '🌪️' },
                    { type: 'projected_impact', icon: '📈' },
                  ],
                },
                {
                  title: '🛠️ Risk & Response',
                  items: [
                    { type: 'sku_runout_risk', icon: '⏳' },
                    { type: 'countermeasures', icon: '🛠️' },
                  ],
                },
              ].map((group, index) => (
                <div key={index} className="flex-1 min-w-[280px] bg-white border border-[#C6F6D5] rounded-xl p-5 shadow-md">
                  <h4 className="text-[#1D625B] font-bold text-base mb-3">{group.title}</h4>
                  <div className="space-y-3">
                    {group.items.map(({ type, icon }) => {
                      const fileUrl = outputUrls?.[`${type}_output_file_url`];
                      const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

                      return (
                        <a
                          key={type}
                          href={fileUrl || '#'}
                          download
                          onClick={(e) => {
                            if (!fileUrl) {
                              e.preventDefault();
                              alert(`No file available for ${label}`);
                            }
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm justify-center transition-transform duration-200 ${
                            fileUrl
                              ? 'bg-gradient-to-r from-[#ABFA7D] to-[#9DEFA1] text-[#1D625B] hover:scale-[1.03] hover:shadow'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <span className="text-lg">{icon}</span>
                          {label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* KPI Panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
              <KpiPanel
                title="📦 Fulfillment & Inventory"
                toggled={showFulfillmentKpis}
                toggle={() => setShowFulfillmentKpis(!showFulfillmentKpis)}
                items={[
                  ['✅ On-Time Fulfillment', safeKpis.onTimeFulfillment],
                  ['📦 Avg Inventory per SKU', safeKpis.avgInventory],
                  ['🔁 Inventory Turns', safeKpis.inventoryTurns],
                  ['📅 Days of Inventory', safeKpis.daysOfInventory],
                ]}
              />
              <KpiPanel
                title="🏭 Production & Disruption"
                toggled={showProductionKpis}
                toggle={() => setShowProductionKpis(!showProductionKpis)}
                items={[
                  ['🏭 Total Production', safeKpis.totalProduction],
                  ['🔥 Impacted Facilities', safeKpis.impactedFacilities],
                  ['🕒 Avg Time to Recovery', safeKpis.recoveryTime],
                ]}
              />
              <KpiPanel
                title="💰 Cost & Service Metrics"
                toggled={showCostKpis}
                toggle={() => setShowCostKpis(!showCostKpis)}
                items={[
                  ['📉 Cost to Serve', safeKpis.costToServe],
                  ['🚚 Expedite Ratio', safeKpis.expediteRatio],
                  ['🛒 Backorder Volume', safeKpis.backorderVolume],
                  ['📈 Forecast Accuracy', safeKpis.forecastAccuracy],
                ]}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="w-full md:w-1/2">
                <label className="block font-medium text-gray-700 mb-1">Select SKUs</label>
                <Select
                  isMulti
                  options={finalSkuOptions}
                  value={finalSkuOptions.filter((opt) => selectedSku.includes(opt.value))}
                  onChange={(selectedOptions) => {
                    const selectedValues = (selectedOptions || []).map((opt) => opt.value);
                    setSelectedSku(selectedValues);
                  }}
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

            {/* Chart */}
            <div className="bg-white shadow rounded p-4 mb-10">
              {chartData && chartData.datasets && chartData.datasets.length > 0 ? (
                <Line
                  key={selectedSku.join(',') + selectedOutputType}
                  data={{
                    ...chartData,
                    datasets: chartData.datasets.map((ds, i) => ({
                      ...ds,
                      borderColor: chartColors[i % chartColors.length],
                      backgroundColor: chartColors[i % chartColors.length],
                      borderWidth: 2,
                      tension: 0.4,
                      pointRadius: 3,
                    })),
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: { color: '#1D625B' },
                      },
                    },
                    scales: {
                      x: { ticks: { color: '#4B5563' }, grid: { color: '#E5E7EB' } },
                      y: { ticks: { color: '#4B5563' }, grid: { color: '#E5E7EB' } },
                    },
                  }}
                />
              ) : (
                <div className="text-center text-gray-500 text-sm italic">
                  No chart data available for this filter.
                </div>
              )}
            </div>

            {/* Disruption Panels */}
            <DisruptionPanels
              duration={duration}
              setDuration={setDuration}
              runoutRiskData={runoutRiskData}
              countermeasuresData={countermeasuresData}
            />
          </>
        )}

        {/* History */}
        {simulationHistory?.length > 0 && (
          <div className="mb-10">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-lg font-semibold text-[#1D625B] mb-2 flex items-center justify-between w-full"
            >
              📜 Simulation History
              <span className="text-sm">{showHistory ? '▲' : '▼'}</span>
            </button>

            {showHistory && (
              <ul className="bg-white border border-gray-300 rounded-lg shadow divide-y divide-gray-200">
                {simulationHistory.map((entry, index) => (
                  <li key={index} className="p-4 flex justify-between items-center hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-[#1D625B]">Run {simulationHistory.length - index}</p>
                      <p className="text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => onReloadRun(entry)}
                      className="bg-[#1D625B] text-white px-3 py-1 rounded shadow hover:bg-[#144e48]"
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function KpiPanel({ title, toggled, toggle, items }) {
  return (
    <div className="bg-[#1D625B] text-white p-4 rounded-xl shadow border border-[#ABFA7D]">
      <button onClick={toggle} className="text-lg font-bold text-[#ABFA7D] mb-2 flex items-center w-full justify-between">
        {title}
        <span className="text-white text-sm">{toggled ? '▲' : '▼'}</span>
      </button>
      {toggled && (
        <div className="space-y-2 text-sm">
          {items.map(([label, val], idx) => (
            <p key={idx}>
              {label}: <strong>{val}</strong>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function DisruptionPanels({ duration, setDuration, runoutRiskData, countermeasuresData }) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-6 mt-10">
        <div className="md:w-1/2 bg-white shadow rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">📊 Disruption Impact Analysis</h2>
          <label className="block mb-1 text-sm">Scenario Duration (Days)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="border px-2 py-1 rounded mb-3 text-sm"
          >
            {[10, 20, 30, 40].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Line
            data={{
              labels: ['0', '10', '20', '30', '40'],
              datasets: [
                { label: 'Expedite Fees', data: [0.1, 0.5, 1.0, 1.7, 2.3], borderColor: '#2563EB' },
                { label: 'Line Downtime', data: [0.2, 0.6, 1.2, 1.9, 2.5], borderColor: '#3B82F6' },
                { label: 'Revenue at Risk', data: [0.3, 0.7, 1.5, 2.2, 2.8], borderColor: '#F97316' },
              ],
            }}
            options={{
              responsive: true,
              scales: {
                y: {
                  ticks: {
                    callback: (value) => `$${value.toFixed(1)}M`,
                  },
                },
              },
            }}
          />
        </div>

        <div className="md:w-1/2 bg-white shadow rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">📅 Projected Disruption Impacts</h2>
          <label className="block mb-1 text-sm">Disruption Duration: {duration} days</label>
          <input
            type="range"
            min="10"
            max="40"
            step="1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full mb-3"
          />
          <table className="w-full text-left text-sm border-t border-gray-200">
            <thead className="text-gray-600">
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td>Expedite Fees</td>
                <td>${(duration * 15000).toLocaleString()}</td>
              </tr>
              <tr className="border-t">
                <td>Line Downtime</td>
                <td>{(duration * 2.25).toFixed(1)} hrs</td>
              </tr>
              <tr className="border-t">
                <td>Revenue at Risk</td>
                <td>${(duration * 50000).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Runout Risk Table */}
      <div className="bg-white shadow rounded-xl p-6 mt-6">
        <h2 className="text-lg font-semibold mb-3">🚨 SKU Runout Risk</h2>
        <table className="w-full text-left text-sm border-t border-gray-200">
          <thead className="text-gray-600">
            <tr>
              <th>SKU</th>
              <th>Runout Date</th>
              <th>Facility</th>
              <th>Expedite</th>
              <th>Downtime</th>
              <th>Revenue Risk</th>
              <th>Customer Impact</th>
            </tr>
          </thead>
          <tbody>
            {runoutRiskData && runoutRiskData.length > 0 ? (
              runoutRiskData.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td>{row.sku}</td>
                  <td>{row.runout_date}</td>
                  <td>{row.facility}</td>
                  <td>{row.expedite_cost}</td>
                  <td>{row.downtime}</td>
                  <td>{row.revenue_risk}</td>
                  <td>{row.customer_impact}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="py-2 italic text-gray-500">
                  No runout risks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Suggested Countermeasures */}
      <div className="bg-white shadow rounded-xl p-6 mt-6 mb-10">
        <h2 className="text-lg font-semibold mb-3">🛡️ Suggested Countermeasures</h2>
        <table className="w-full text-left text-sm border-t border-gray-200">
          <thead className="text-gray-600">
            <tr>
              <th>SKU</th>
              <th>Risk Type</th>
              <th>Action</th>
              <th>Cost</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {countermeasuresData && countermeasuresData.length > 0 ? (
              countermeasuresData.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td>{row.sku}</td>
                  <td>{row.risk_type}</td>
                  <td>{row.action}</td>
                  <td>{row.cost}</td>
                  <td>{row.roi}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-2 italic text-gray-500">
                  No countermeasures found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
