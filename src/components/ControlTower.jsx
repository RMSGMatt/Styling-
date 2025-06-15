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
    down: 'bg-yellow-100 text-yellow-700',
    neutral: 'bg-gray-100 text-gray-700'
  };

  const riskClass = risk === 'high' ? 'border-l-4 border-red-400' : 'border-l-4 border-[#1D625B]';

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm relative ${riskClass}`}>
      <div className="text-2xl font-extrabold text-[#1D625B]">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${trendColors[trend]}`}>
        {trendLabels[trend]}
      </div>
      {risk === 'high' && (
        <div className="absolute -left-3 top-3 text-red-500 animate-pulse">⚠️</div>
      )}
    </div>
  );
}

export default function ControlTower() {
  const [userName, setUserName] = useState('');
  const [businessKpis, setBusinessKpis] = useState(null);
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

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    setUserName(storedName || 'User');
  }, []);

  useEffect(() => {
    const mockData = {
      day: {
        totalFacilities: '32.5k',
        activeIncidents: '135',
        shipments: '1.3k',
        disruptionPercent: '3.2%',
        serviceLevel: '95.8%',
        avgLeadTime: '6.0',
        revenueAtRisk: '$4.8M',
        backorders: '1,250',
        capacityUtilization: '80.0%',
        supplierOnTime: '91.2%',
        expeditedOrders: '5.1%',
        cycleTime: '9.3'
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
        activeIncidents: '122',
        shipments: '48.1k',
        disruptionPercent: '2.9%',
        serviceLevel: '96.7%',
        avgLeadTime: '5.4',
        revenueAtRisk: '$3.9M',
        backorders: '980',
        capacityUtilization: '83.2%',
        supplierOnTime: '93.1%',
        expeditedOrders: '4.2%',
        cycleTime: '7.8'
      }
    };
    setBusinessKpis(mockData[kpiRange]);
  }, [kpiRange]);

  const kpiMeta = [
    { key: 'totalFacilities', label: 'Total Facilities', trend: 'up' },
    { key: 'activeIncidents', label: 'Active Incidents', trend: 'down', risk: 'high' },
    { key: 'shipments', label: 'Shipments', trend: 'neutral' },
    { key: 'disruptionPercent', label: 'Disruption %', trend: 'up', risk: 'high' },
    { key: 'serviceLevel', label: 'Service Level', trend: 'up' },
    { key: 'avgLeadTime', label: 'Avg Lead Time (days)', trend: 'down' },
    { key: 'revenueAtRisk', label: 'Revenue at Risk', trend: 'up' },
    { key: 'backorders', label: 'Backorder Volume', trend: 'down', risk: 'high' },
    { key: 'capacityUtilization', label: 'Capacity Utilization', trend: 'up' },
    { key: 'supplierOnTime', label: 'Supplier On-Time Rate', trend: 'up' },
    { key: 'expeditedOrders', label: 'Expedited Orders', trend: 'down' },
    { key: 'cycleTime', label: 'Order Cycle Time (days)', trend: 'neutral' }
  ];

  const renderChart = (type) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const chartConfigs = {
      shipments: {
        type: Bar,
        data: [2, 3, 5, 4, 3, 2, 2, 1],
        label: 'Shipments',
        color: '#1D625B'
      },
      utilization: {
        type: Line,
        data: [
          { label: 'East', data: [60, 75, 90, 85, 80, 95, 100, 110], color: '#1D625B' },
          { label: 'West', data: [40, 55, 60, 65, 60, 70, 80, 90], color: '#F59E0B' }
        ]
      },
      inventory: {
        type: Bar,
        data: [100, 90, 80, 85, 75, 70, 65, 60],
        label: 'Inventory',
        color: '#3B82F6'
      },
      leadTime: {
        type: Line,
        data: [6, 5.9, 5.7, 5.6, 5.5, 5.3, 5.2, 5.1],
        label: 'Lead Time (days)',
        color: '#10B981'
      },
      revenue: {
        type: Bar,
        data: [4.8, 4.6, 4.5, 4.3, 4.2, 4.0, 3.9, 3.8],
        label: 'Revenue at Risk ($M)',
        color: '#EF4444'
      },
      onTime: {
        type: Line,
        data: [91.2, 91.5, 92, 92.4, 92.7, 93, 93.1, 93.3],
        label: 'On-Time Rate (%)',
        color: '#6366F1'
      },
      expedite: {
        type: Bar,
        data: [5.1, 5.0, 4.9, 4.7, 4.6, 4.4, 4.3, 4.2],
        label: 'Expedited Orders (%)',
        color: '#F59E0B'
      }
    };

    const config = chartConfigs[type];
    if (!config) return null;

    const ChartComponent = config.type;
    const dataset = Array.isArray(config.data)
      ? [{ label: config.label, data: config.data, backgroundColor: config.color, borderColor: config.color, fill: false, tension: 0.3 }]
      : config.data.map(d => ({ ...d, borderColor: d.color, fill: false, tension: 0.3 }));

    return (
      <ChartComponent
        data={{ labels: months, datasets: dataset }}
        options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
      />
    );
  };

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans">
      <aside className="w-64 bg-[#1D625B] text-white p-6 space-y-6">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto" />
        </div>
        <div>
          <h2 className="text-sm uppercase text-gray-300 mb-2">News</h2>
          <ul className="space-y-2 text-sm">
            <li>📺 In the Media</li>
            <li>✍️ Blog / Insights</li>
            <li>🏢 Company Updates</li>
            <li>🌐 Industry News</li>
            <li>📁 Case Studies</li>
            <li>📌 Saved Items</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm uppercase text-gray-300 mb-2">Repository</h2>
          <ul className="space-y-2 text-sm">
            <li>🧪 Simulations</li>
            <li>📄 Reports</li>
            <li>💬 Messages</li>
            <li><a href="/simulation" className="hover:underline text-lime-300 block">🚀 Launch Simulation</a></li>
            <li><a href="/about" className="hover:underline text-lime-300 block">📘 About FOR-C</a></li>
            <li><a href="/signup" className="hover:underline text-lime-300 block">📝 Signup</a></li>
          </ul>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        <header className="flex flex-col justify-between items-start mb-6">
          <h1 className="text-2xl font-bold text-[#1D625B]">Control Tower</h1>
          <p className="text-lg text-gray-700 mt-1">Welcome back, <strong>{userName}</strong> 👋</p>
        </header>
        <section className="h-96 mb-6 rounded overflow-hidden shadow border border-gray-300">
          <MapView />
        </section>
        <div className="flex justify-end mb-4">
          <div className="space-x-2">
            {['day', 'week', 'month', 'ytd'].map(range => (
              <button
                key={range}
                onClick={() => setKpiRange(range)}
                className={`px-3 py-1 rounded font-semibold text-sm ${
                  kpiRange === range
                    ? 'bg-[#1D625B] text-white'
                    : 'bg-white text-[#1D625B] border border-[#1D625B]'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {businessKpis && (
          <section className="space-y-8 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[#1D625B] mb-2">📦 Fulfillment & Inventory</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['totalFacilities','shipments','backorders','serviceLevel'].map(key => (
                  <KpiCard key={key} value={businessKpis[key]} label={kpiMeta.find(k => k.key === key)?.label} trend={kpiMeta.find(k => k.key === key)?.trend} risk={kpiMeta.find(k => k.key === key)?.risk} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1D625B] mb-2">🏭 Production & Disruption</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {['disruptionPercent','capacityUtilization','avgLeadTime','cycleTime'].map(key => (
                  <KpiCard key={key} value={businessKpis[key]} label={kpiMeta.find(k => k.key === key)?.label} trend={kpiMeta.find(k => k.key === key)?.trend} risk={kpiMeta.find(k => k.key === key)?.risk} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1D625B] mb-2">💰 Cost & Service Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['revenueAtRisk','supplierOnTime','expeditedOrders','activeIncidents'].map(key => (
                  <KpiCard key={key} value={businessKpis[key]} label={kpiMeta.find(k => k.key === key)?.label} trend={kpiMeta.find(k => k.key === key)?.trend} risk={kpiMeta.find(k => k.key === key)?.risk} />
                ))}
              </div>
            </div>
          </section>
        )}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[chartType1, chartType2].map((type, index) => (
            <div key={index} className="bg-white p-4 rounded shadow">
              <Select
                options={chartOptions}
                value={chartOptions.find(opt => opt.value === type)}
                onChange={(selected) => index === 0 ? setChartType1(selected.value) : setChartType2(selected.value)}
                className="mb-2"
              />
              {renderChart(type)}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}