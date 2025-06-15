import React, { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import Select from 'react-select';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function KpiCard({ value, label, risk, trend }) {
  const trendLabels = {
    up: 'Improving',
    down: 'Declining',
    neutral: 'Stable'
  };

  const trendColors = {
    up: 'bg-green-100 text-green-700',
    down: 'bg-orange-100 text-orange-700',
    neutral: 'bg-gray-100 text-gray-700'
  };

  const labelColor = {
    up: 'text-green-700',
    down: 'text-orange-700',
    neutral: 'text-gray-700'
  };

  const riskClass = risk === 'high' ? 'border-l-4 border-orange-400' : 'border-l-4 border-[#1D625B]';

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm relative ${riskClass}`}>
      <div className={`text-2xl font-extrabold ${labelColor[trend]}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded text-center ${trendColors[trend]}`}>
        <div className="font-semibold">Status:</div>
        <div>{trendLabels[trend]}</div>
      </div>
      {risk === 'high' && (
        <div className="absolute bottom-2 right-2 text-orange-500 animate-pulse text-lg">⚠️</div>
      )}
    </div>
  );
}

export default function ControlTower({ switchView, onLogout }) {
  const [userName, setUserName] = useState('');
  const [businessKpis, setBusinessKpis] = useState({});
  const [kpiRange, setKpiRange] = useState('month');
  const [chartType1, setChartType1] = useState('shipments');
  const [chartType2, setChartType2] = useState('utilization');

  const chartOptions = [
    { value: 'shipments', label: '📦 Shipments by Category' },
    { value: 'utilization', label: '🏭 Facility Utilization' },
    { value: 'inventory', label: '📦 Inventory Levels' },
    { value: 'leadTime', label: '📈 Lead Time Trends' },
    { value: 'revenue', label: '💰 Revenue at Risk' },
    { value: 'onTime', label: '🕒 Supplier On-Time Rate' },
    { value: 'expedite', label: '⚡ Expedited Orders' }
  ];

  const newsHeadlines = [
    "⛈️ Flooding in Vietnam disrupts key electronics supplier.",
    "🚢 Port congestion in LA delays shipments by 3–5 days.",
    "🔥 Fire at Tier-2 supplier in Mexico causes 12% output loss.",
    "⚠️ Political unrest in Thailand escalates supplier risk index.",
    "📈 Semiconductor prices expected to rise 8% this quarter."
  ];

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    setUserName(storedName || 'User');
  }, []);

  useEffect(() => {
    const mockData = {
      day: {
        totalFacilities: '32.5k',
        activeIncidents: '4',
        shipments: '1.2k',
        disruptionPercent: '2.8%',
        serviceLevel: '95.8%',
        avgLeadTime: '6.1',
        revenueAtRisk: '$820k',
        backorders: '240',
        capacityUtilization: '80.2%',
        supplierOnTime: '90.2%',
        expeditedOrders: '4.1%',
        cycleTime: '8.6'
      },
      week: {
        totalFacilities: '32.5k',
        activeIncidents: '32',
        shipments: '2.9k',
        disruptionPercent: '3.0%',
        serviceLevel: '96.0%',
        avgLeadTime: '5.9',
        revenueAtRisk: '$1.8M',
        backorders: '560',
        capacityUtilization: '81.3%',
        supplierOnTime: '91.7%',
        expeditedOrders: '4.4%',
        cycleTime: '8.5'
      },
      month: {
        totalFacilities: '32.5k',
        activeIncidents: '128',
        shipments: '6.8k',
        disruptionPercent: '3.1%',
        serviceLevel: '96.2%',
        avgLeadTime: '5.7',
        revenueAtRisk: '$4.3M',
        backorders: '1,120',
        capacityUtilization: '82.5%',
        supplierOnTime: '92.7%',
        expeditedOrders: '4.6%',
        cycleTime: '8.4'
      },
      ytd: {
        totalFacilities: '32.5k',
        activeIncidents: '820',
        shipments: '52.3k',
        disruptionPercent: '3.5%',
        serviceLevel: '95.4%',
        avgLeadTime: '6.3',
        revenueAtRisk: '$21.6M',
        backorders: '8,930',
        capacityUtilization: '83.1%',
        supplierOnTime: '89.3%',
        expeditedOrders: '5.2%',
        cycleTime: '8.9'
      }
    };

    setBusinessKpis(mockData[kpiRange]);
  }, [kpiRange]);

  const kpiMeta = [
    { key: 'totalFacilities', label: 'Total Facilities', trend: 'neutral' },
    { key: 'activeIncidents', label: 'Active Incidents', trend: 'down', risk: 'high' },
    { key: 'shipments', label: 'Shipments', trend: 'neutral' },
    { key: 'disruptionPercent', label: 'Disruption %', trend: 'down', risk: 'high' },
    { key: 'serviceLevel', label: 'Service Level', trend: 'up' },
    { key: 'avgLeadTime', label: 'Avg Lead Time (days)', trend: 'down', risk: 'high' },
    { key: 'revenueAtRisk', label: 'Revenue at Risk', trend: 'down', risk: 'high' },
    { key: 'backorders', label: 'Backorder Volume', trend: 'down', risk: 'high' },
    { key: 'capacityUtilization', label: 'Capacity Utilization', trend: 'up' },
    { key: 'supplierOnTime', label: 'Supplier On-Time Rate', trend: 'up' },
    { key: 'expeditedOrders', label: 'Expedited Orders', trend: 'down', risk: 'high' },
    { key: 'cycleTime', label: 'Order Cycle Time (days)', trend: 'down', risk: 'high' }
  ];

  const getChartData = (type) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const dataMap = {
      shipments: [10, 20, 15, 25, 18, 22, 30, 28],
      utilization: [72, 75, 78, 81, 79, 83, 85, 84],
      inventory: [480, 520, 500, 530, 510, 550, 560, 545],
      leadTime: [6.1, 6.0, 5.9, 5.7, 5.6, 5.8, 5.9, 6.0],
      revenue: [800, 900, 950, 990, 1030, 980, 960, 940],
      onTime: [88, 89, 90, 91, 92, 91, 90, 89],
      expedite: [5.2, 5.0, 4.8, 4.7, 4.6, 4.4, 4.3, 4.1]
    };
    return {
      labels: months,
      datasets: [
        {
          label: chartOptions.find(opt => opt.value === type)?.label || type,
          data: dataMap[type] || [],
          backgroundColor: '#1D625B'
        }
      ]
    };
  };

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans">
      <aside className="w-64 bg-[#1D625B] text-white p-6 space-y-6">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto" />
        </div>
        <div>
          <h2 className="text-sm uppercase text-gray-300 mb-2">Repository</h2>
          <ul className="space-y-2 text-sm">
            <li>🧪 Simulations</li>
            <li>📄 Reports</li>
            <li>
              <button onClick={() => switchView('dashboard')} className="hover:underline text-lime-300 block">
                🚀 Launch Simulation
              </button>
            </li>
            <li>
              <button onClick={() => alert('📰 News feed clicked (placeholder logic)')} className="hover:underline text-lime-300 block">
                📰 News Feed
              </button>
            </li>
            <li>
              <a href="/about" className="hover:underline text-lime-300 block">
                📘 About FOR-C
              </a>
            </li>
          </ul>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 bg-white text-[#1D625B] hover:bg-lime-300 font-bold py-2 px-3 rounded shadow"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#1D625B]">Control Tower</h1>
          <p className="text-lg text-gray-700 mt-1">Welcome back, <strong>{userName}</strong> 👋</p>
        </header>

        <div className="bg-[#1D625B] text-lime-300 font-semibold px-4 py-2 rounded mb-4 shadow-inner tracking-wide">
          <marquee behavior="scroll" direction="left" scrollamount="5">
            {newsHeadlines.join('  ⚡  ')}
          </marquee>
        </div>

        <section className="h-96 mb-6 rounded overflow-hidden shadow border border-gray-300">
          <MapView />
        </section>

        <div className="flex justify-end mb-4">
          <div className="space-x-2">
            {['day', 'week', 'month', 'ytd'].map((range) => (
              <button
                key={range}
                onClick={() => setKpiRange(range)}
                className={`px-3 py-1 rounded font-semibold text-sm ${
                  kpiRange === range ? 'bg-[#1D625B] text-white' : 'bg-white text-[#1D625B] border border-[#1D625B]'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <section className="grid grid-cols-3 gap-4 mb-6">
          {kpiMeta.map(
            (kpi) =>
              businessKpis?.[kpi.key] && (
                <KpiCard
                  key={kpi.key}
                  value={businessKpis[kpi.key]}
                  label={kpi.label}
                  trend={kpi.trend}
                  risk={kpi.risk}
                />
              )
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[chartType1, chartType2].map((type, index) => (
            <div key={index} className="bg-white p-4 rounded shadow">
              <Select
                options={chartOptions}
                value={chartOptions.find((opt) => opt.value === type)}
                onChange={(selected) =>
                  index === 0 ? setChartType1(selected.value) : setChartType2(selected.value)
                }
                className="mb-2"
              />
              <Bar data={getChartData(type)} />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
