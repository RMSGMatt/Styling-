import React, { useEffect, useState } from "react";
import MapView from "./MapView";
import Select from "react-select";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import AdminPanel from "./ControlTowerEhancements/AdminPanel.jsx";
import ScenarioLibrary from "./ControlTowerEhancements/ScenarioLibrary.jsx";
import BillingView from "./ControlTowerEhancements/BillingView.jsx"; // ← NEW

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function KpiCard({ value, label, risk, trend }) {
  const trendLabels = { up: "Improving", down: "Declining", neutral: "Stable" };
  const trendColors = {
    up: "bg-green-100 text-green-700",
    down: "bg-yellow-100 text-yellow-700",
    neutral: "bg-gray-100 text-gray-700",
  };
  const riskClass =
    risk === "high" ? "border-l-4 border-red-400" : "border-l-4 border-[#1D625B]";

  const iconMap = {
    shipments: "📦",
    "backorder volume": "📉",
    "service level": "📊",
    "disruption %": "🚧",
    "capacity utilization": "🏭",
    "avg lead time (days)": "⏱️",
    "order cycle time (days)": "🔁",
    "total facilities": "🏢",
  };
  const icon = iconMap[label?.toLowerCase?.()] || "📈";

  return (
    <div
      className={`bg-gradient-to-br from-white to-[#e8f8f5] p-4 rounded-xl shadow-sm relative transition duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-lg ${riskClass}`}
      title={`${label} - Click for details`}
    >
      <div className="text-2xl font-extrabold text-[#1D625B]" title={`Current value: ${value}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600 flex items-center gap-1" title={`Metric: ${label}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${trendColors[trend]}`}
        title={`Trend: ${trendLabels[trend]}`}
      >
        {trendLabels[trend]}
      </div>
      {risk === "high" && (
        <div className="absolute top-8 right-2 text-red-500 animate-pulse" title="High Risk KPI">
          ⚠️
        </div>
      )}
      <div
        className={`
          absolute bottom-0 left-0 w-full h-1.5 rounded-b-xl
          ${
            risk === "high"
              ? "bg-gradient-to-r from-red-500 via-red-400 to-red-300"
              : risk === "medium"
              ? "bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-200"
              : ""
          }`}
        style={{
          background:
            risk === "low" || !risk
              ? "linear-gradient(to right, #1D625B, #2e7c6f, #4ba392)"
              : undefined,
          opacity: 0.9,
          filter: "blur(0.2px)",
        }}
        title={`Severity: ${risk || "low"}`}
      />
    </div>
  );
}

export default function ControlTower({ switchView, simulationHistory, onLogout }) {
  // --- identity / display
  const [userName, setUserName] = useState("");

  // --- scenario state (synced via localStorage, used by Simulation view)
  const [scenario, setScenario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("currentScenario") || "{}");
    } catch {
      return {};
    }
  });
  const [scenarioName, setScenarioName] = useState(
    localStorage.getItem("currentScenarioName") || ""
  );

  function syncScenarioFromLocal() {
    try {
      const raw = localStorage.getItem("currentScenario");
      const name = localStorage.getItem("currentScenarioName") || "";
      setScenario(raw ? JSON.parse(raw) : {});
      setScenarioName(name);
    } catch {}
  }

  useEffect(() => {
    const storedName = localStorage.getItem("userName");
    setUserName(storedName || "User");
  }, []);

  useEffect(() => {
    syncScenarioFromLocal();
    const onStorage = (e) => {
      if (e.key === "currentScenario" || e.key === "currentScenarioName") {
        syncScenarioFromLocal();
      }
    };
    const onFocus = () => syncScenarioFromLocal();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  function applyScenario(data, name = "") {
    const clean = data || {};
    setScenario(clean);
    setScenarioName(name || "");
    try {
      localStorage.setItem("currentScenario", JSON.stringify(clean));
      localStorage.setItem("currentScenarioName", name || "");
    } catch {}
    console.log("[ControlTower] Applied scenario:", { name, data: clean });
    // hand off to the Simulation route (App.jsx uses this path)
    window.location.href = "/simulation";
  }

  // --- local navigation inside Control Tower
  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard' | 'scenario' | 'billing' | 'admin'

  // --- KPI & charts
  const [kpiRange, setKpiRange] = useState("month"); // 'day'|'week'|'month'|'ytd'
  const [businessKpis, setBusinessKpis] = useState(null);

  const [kpiSectionVisibility, setKpiSectionVisibility] = useState({
    fulfillment: true,
    production: true,
    cost: true,
  });
  const toggleKpiSection = (section) =>
    setKpiSectionVisibility((prev) => ({ ...prev, [section]: !prev[section] }));

  const [chartType1, setChartType1] = useState("shipments");
  const [chartType2, setChartType2] = useState("utilization");

  const chartOptions = [
    { value: "shipments", label: "📦 Shipments by Category" },
    { value: "utilization", label: "🏭 Facility Utilization" },
    { value: "inventory", label: "📦 Inventory Levels" },
    { value: "leadTime", label: "📈 Lead Time Trends" },
    { value: "revenue", label: "💰 Revenue at Risk" },
    { value: "onTime", label: "🕒 Supplier On-Time Rate" },
    { value: "expedite", label: "⚡ Expedited Orders" },
  ];

  useEffect(() => {
    const mockData = {
      day: {
        totalFacilities: "32.5k",
        activeIncidents: "135",
        shipments: "1.3k",
        disruptionPercent: "3.2%",
        serviceLevel: "95.8%",
        avgLeadTime: "6.0",
        revenueAtRisk: "$4.8M",
        backorders: "1,250",
        capacityUtilization: "80.0%",
        supplierOnTime: "91.2%",
        expeditedOrders: "5.1%",
        cycleTime: "9.3",
      },
      week: {
        totalFacilities: "32.5k",
        activeIncidents: "132",
        shipments: "2.9k",
        disruptionPercent: "3.0%",
        serviceLevel: "96.0%",
        avgLeadTime: "5.9",
        revenueAtRisk: "$4.6M",
        backorders: "1,200",
        capacityUtilization: "81.0%",
        supplierOnTime: "91.9%",
        expeditedOrders: "4.9%",
        cycleTime: "9.0",
      },
      month: {
        totalFacilities: "32.5k",
        activeIncidents: "128",
        shipments: "6.8k",
        disruptionPercent: "3.1%",
        serviceLevel: "96.2%",
        avgLeadTime: "5.7",
        revenueAtRisk: "$4.3M",
        backorders: "1,120",
        capacityUtilization: "82.5%",
        supplierOnTime: "92.7%",
        expeditedOrders: "4.6%",
        cycleTime: "8.4",
      },
      ytd: {
        totalFacilities: "32.5k",
        activeIncidents: "122",
        shipments: "48.1k",
        disruptionPercent: "2.9%",
        serviceLevel: "96.7%",
        avgLeadTime: "5.4",
        revenueAtRisk: "$3.9M",
        backorders: "980",
        capacityUtilization: "83.2%",
        supplierOnTime: "93.1%",
        expeditedOrders: "4.2%",
        cycleTime: "7.8",
      },
    };
    setBusinessKpis(mockData[kpiRange]);
  }, [kpiRange]);

  const kpiMeta = [
    { key: "totalFacilities", label: "Total Facilities", trend: "up" },
    { key: "activeIncidents", label: "Active Incidents", trend: "down", risk: "high" },
    { key: "shipments", label: "Shipments", trend: "neutral" },
    { key: "disruptionPercent", label: "Disruption %", trend: "up", risk: "high" },
    { key: "serviceLevel", label: "Service Level", trend: "up" },
    { key: "avgLeadTime", label: "Avg Lead Time (days)", trend: "down" },
    { key: "revenueAtRisk", label: "Revenue at Risk", trend: "up" },
    { key: "backorders", label: "Backorder Volume", trend: "down", risk: "high" },
    { key: "capacityUtilization", label: "Capacity Utilization", trend: "up" },
    { key: "supplierOnTime", label: "Supplier On-Time Rate", trend: "up" },
    { key: "expeditedOrders", label: "Expedited Orders", trend: "down" },
    { key: "cycleTime", label: "Order Cycle Time (days)", trend: "neutral" },
  ];

  const renderChart = (type) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    const chartConfigs = {
      shipments: { type: Bar, data: [2, 3, 5, 4, 3, 2, 2, 1], label: "Shipments", color: "#1D625B" },
      utilization: {
        type: Line,
        data: [
          { label: "East", data: [60, 75, 90, 85, 80, 95, 100, 110], color: "#1D625B" },
          { label: "West", data: [40, 55, 60, 65, 60, 70, 80, 90], color: "#F59E0B" },
        ],
      },
      inventory: {
        type: Bar,
        data: [100, 90, 80, 85, 75, 70, 65, 60],
        label: "Inventory",
        color: "#3B82F6",
      },
      leadTime: {
        type: Line,
        data: [6, 5.9, 5.7, 5.6, 5.5, 5.3, 5.2, 5.1],
        label: "Lead Time (days)",
        color: "#10B981",
      },
      revenue: {
        type: Bar,
        data: [4.8, 4.6, 4.5, 4.3, 4.2, 4.0, 3.9, 3.8],
        label: "Revenue at Risk ($M)",
        color: "#EF4444",
      },
      onTime: {
        type: Line,
        data: [91.2, 91.5, 92, 92.4, 92.7, 93, 93.1, 93.3],
        label: "On-Time Rate (%)",
        color: "#6366F1",
      },
      expedite: {
        type: Bar,
        data: [5.1, 5.0, 4.9, 4.7, 4.6, 4.4, 4.3, 4.2],
        label: "Expedited Orders (%)",
        color: "#F59E0B",
      },
    };

    const config = chartConfigs[type];
    if (!config) return null;

    const ChartComponent = config.type;
    const dataset = Array.isArray(config.data)
      ? [
          {
            label: config.label,
            data: config.data,
            backgroundColor: config.color,
            borderColor: config.color,
            fill: false,
            tension: 0.3,
          },
        ]
      : config.data.map((d) => ({
          ...d,
          borderColor: d.color,
          fill: false,
          tension: 0.3,
        }));

    return (
      <ChartComponent
        data={{ labels: months, datasets: dataset }}
        options={{ responsive: true, plugins: { legend: { position: "top" } } }}
      />
    );
  };

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans">
      {/* Sidebar (independent scroll) */}
      <aside className="w-64 bg-[#1D625B] text-white p-6 space-y-6 h-screen overflow-y-auto">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto rounded-lg" />
        </div>

        {/* Quick user badge */}
        <div className="flex flex-col items-center space-y-2">
          <img
            src="/mj_profile.jpg"
            alt="User Profile"
            className="h-20 w-20 rounded-full border-2 border-white shadow-md"
          />
          <div className="text-sm font-semibold text-white">{userName || "User"}</div>
          <div className="text-[11px] opacity-80 bg-white/10 rounded px-2 py-0.5">
            {(localStorage.getItem("plan") || "FREE").toUpperCase()}
          </div>
        </div>

        <div>
          <h2 className="text-sm uppercase text-gray-300 mb-2">News</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between items-center">
              📺 In the Media{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
            <li className="flex justify-between items-center">
              ✍️ Blog / Insights{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
            <li className="flex justify-between items-center">
              🏢 Company Updates{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
            <li className="flex justify-between items-center">
              🌐 Industry News{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
            <li className="flex justify-between items-center">
              📁 Case Studies{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
            <li className="flex justify-between items-center">
              📌 Saved Items{" "}
              <span className="text-white text-[10px] italic opacity-70 ml-2">Coming Soon</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm uppercase text-gray-300 mb-2">Repository</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                onClick={() => setActiveView("dashboard")}
                className={`block cursor-pointer ${
                  activeView === "dashboard" ? "text-lime-300" : "hover:underline"
                }`}
              >
                📊 Dashboard
              </a>
            </li>
            <li>
              <a
                onClick={() => {
                  syncScenarioFromLocal();
                  setActiveView("scenario");
                }}
                className={`block cursor-pointer ${
                  activeView === "scenario" ? "text-lime-300" : "hover:underline"
                }`}
              >
                🧪 Scenario Library
              </a>
            </li>
            <li>
              <a
                onClick={() => setActiveView("billing")}
                className={`block cursor-pointer ${
                  activeView === "billing" ? "text-lime-300" : "hover:underline"
                }`}
              >
                💸 Billing
              </a>
            </li>
            <li>
              <a onClick={() => switchView("reports")} className="block cursor-pointer hover:underline">
                📊 Reports
              </a>
            </li>
            <li>
              <a
                onClick={() => setActiveView("admin")}
                className={`block cursor-pointer ${
                  activeView === "admin" ? "text-lime-300" : "hover:underline"
                }`}
              >
                🛠 Admin
              </a>
            </li>
            
            <li>
              <a onClick={() => switchView("simulation")} className="hover:underline block cursor-pointer">
                🚀 Launch Simulation
              </a>
            </li>
            <li>
              <a onClick={() => switchView("about")} className="hover:underline block cursor-pointer">
                📘 About FOR-C
              </a>
            </li>
            <li>
              <a href="/signup" className="hover:underline block">
                📝 Signup
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main column: sticky header + scrollable content */}
      <main className="flex-1 min-h-0 flex flex-col">
        {/* Sticky header with Logout */}
        <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="flex items-center justify-between px-6 py-3">
            <h1 className="text-2xl font-bold text-[#1D625B]">Control Tower</h1>

            <button
              onClick={onLogout || (() => {})}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              title="Sign out"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v3" />
                <path d="M10 17l-5-5l5-5" />
                <path d="M21 12H5" />
                <path d="M15 21h4a2 2 0 0 0 2-2v-3" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeView === "dashboard" && (
            <>
              <div className="mb-2 text-lg text-gray-700">
                Welcome back, <strong>{userName}</strong> 👋
              </div>

              {scenarioName && (
                <div className="mt-1 mb-4 text-sm text-gray-600">
                  Active scenario: <span className="font-semibold">{scenarioName}</span>
                </div>
              )}

              <section className="h-96 mb-6 rounded overflow-hidden shadow border border-gray-300">
                <MapView locationsUrl="https://supply-chain-simulation-files.s3.us-east-2.amazonaws.com/locations.csv" />
              </section>

              <div className="flex justify-end mb-4">
                <div className="space-x-2">
                  {["day", "week", "month", "ytd"].map((range) => (
                    <button
                      key={range}
                      onClick={() => setKpiRange(range)}
                      className={`px-3 py-1 rounded font-semibold text-sm ${
                        kpiRange === range
                          ? "bg-[#1D625B] text-white"
                          : "bg-white text-[#1D625B] border border-[#1D625B]"
                      }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {businessKpis && (
                <section className="space-y-8 mb-6">
                  {/* Fulfillment & Inventory */}
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => toggleKpiSection("fulfillment")}
                    >
                      <h2 className="text-xl font-semibold text-[#1D625B] mb-2">
                        📦 Fulfillment & Inventory
                      </h2>
                      <span className="text-sm text-gray-500 group-hover:underline">
                        {kpiSectionVisibility.fulfillment ? "Hide" : "Show"}
                      </span>
                    </div>
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        kpiSectionVisibility.fulfillment
                          ? "max-h-[1000px] opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {["totalFacilities", "shipments", "backorders", "serviceLevel"].map((key) => (
                          <KpiCard
                            key={key}
                            value={businessKpis[key]}
                            label={kpiMeta.find((k) => k.key === key)?.label}
                            trend={kpiMeta.find((k) => k.key === key)?.trend}
                            risk={kpiMeta.find((k) => k.key === key)?.risk}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Production & Disruption */}
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => toggleKpiSection("production")}
                    >
                      <h2 className="text-xl font-semibold text-[#1D625B] mb-2">
                        🏭 Production & Disruption
                      </h2>
                      <span className="text-sm text-gray-500 group-hover:underline">
                        {kpiSectionVisibility.production ? "Hide" : "Show"}
                      </span>
                    </div>
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        kpiSectionVisibility.production
                          ? "max-h-[1000px] opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {["disruptionPercent", "capacityUtilization", "avgLeadTime", "cycleTime"].map(
                          (key) => (
                            <KpiCard
                              key={key}
                              value={businessKpis[key]}
                              label={kpiMeta.find((k) => k.key === key)?.label}
                              trend={kpiMeta.find((k) => k.key === key)?.trend}
                              risk={kpiMeta.find((k) => k.key === key)?.risk}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cost & Service Metrics */}
                  <div>
                    <div
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => toggleKpiSection("cost")}
                    >
                      <h2 className="text-xl font-semibold text-[#1D625B] mb-2">
                        💰 Cost & Service Metrics
                      </h2>
                      <span className="text-sm text-gray-500 group-hover:underline">
                        {kpiSectionVisibility.cost ? "Hide" : "Show"}
                      </span>
                    </div>
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        kpiSectionVisibility.cost ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {["revenueAtRisk", "supplierOnTime", "expeditedOrders", "activeIncidents"].map(
                          (key) => (
                            <KpiCard
                              key={key}
                              value={businessKpis[key]}
                              label={kpiMeta.find((k) => k.key === key)?.label}
                              trend={kpiMeta.find((k) => k.key === key)?.trend}
                              risk={kpiMeta.find((k) => k.key === key)?.risk}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Charts */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[chartType1, chartType2].map((type, i) => (
                  <div key={i} className="bg-white p-4 rounded shadow">
                    <Select
                      options={chartOptions}
                      value={chartOptions.find((opt) => opt.value === type)}
                      onChange={(sel) => (i === 0 ? setChartType1(sel.value) : setChartType2(sel.value))}
                      className="mb-2"
                    />
                    {renderChart(type)}
                  </div>
                ))}
              </section>
            </>
          )}

          {activeView === "scenario" && (
            <section className="mt-10">
              <ScenarioLibrary
                userPlan={localStorage.getItem("plan")}
                getCurrentScenario={() => scenario}
                onApplyScenario={(data, meta) => applyScenario(data, meta?.name)}
              />
            </section>
          )}

          {activeView === "billing" && (
            <section className="mt-10">
              <BillingView switchView={switchView} />
            </section>
          )}

          {activeView === "admin" && (
            <section className="mt-10">
              <AdminPanel />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
