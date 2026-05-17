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
import BillingView from "./ControlTowerEhancements/BillingView.jsx";

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

const normalizePlan = (p) => (p || "").toString().trim().toLowerCase();
const isProPlusPlan = (p) => ["pro", "enterprise", "admin"].includes(normalizePlan(p));

function UpgradeCtaCard({ plan, onUpgrade }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        padding: 18,
        background: "rgba(255,255,255,0.06)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
        🔒 Simulation Repository is Pro+
      </div>

      <div style={{ opacity: 0.85, lineHeight: 1.4, marginBottom: 12 }}>
        Upgrade to view past runs, download outputs, and access reporting features.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onUpgrade}
          style={{
            background: "#0f5e4a",
            color: "white",
            border: "none",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Upgrade to Pro →
        </button>

        <button
          onClick={onUpgrade}
          style={{
            background: "transparent",
            color: "#b7f7d8",
            border: "1px solid rgba(183,247,216,0.35)",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          See plans
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Current plan: <b>{normalizePlan(plan) || "free"}</b>
      </div>
    </div>
  );
}

// 🌍 Global facility dataset for Control Tower map
const GLOBAL_LOCATIONS_URL =
  "https://supply-chain-simulation-files.s3.us-east-2.amazonaws.com/locations.csv";

function KpiCard({ value, label, risk, trend, deltaText }) {
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
      className={`bg-gradient-to-br from-white to-[#e8f8f5] p-3.5 rounded-xl shadow-sm relative transition duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-lg ${riskClass}`}
      title={`${label} - Click for details`}
    >
      <div className="text-[2.25rem] leading-none font-extrabold text-[#1D625B]" title={`Current value: ${value}`}>
        {value}
      </div>
      <div className="text-[13px] text-gray-600 flex items-center gap-1 mt-1" title={`Metric: ${label}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {deltaText && (
        <div className="mt-1.5 text-[11px] font-medium text-gray-500">
          {deltaText}
        </div>
      )}
      <div
        className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${trendColors[trend]}` }
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

export default function ControlTower({
  switchView,
  simulationHistory,
  onLogout,
  userPlan, // ✅ allow App.jsx to pass this; fallback to localStorage below
}) {
  // --------------------------------------
  // 🔒 Stable handler so MapView never remounts
  // --------------------------------------
  const handleFacilitySelect = React.useCallback((facility) => {
    console.log("📍 [ControlTower] Facility clicked:", facility);
  }, []);

  // --- identity / display
  const [userName, setUserName] = useState("");
  const [newsHeadlines, setNewsHeadlines] = useState([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";
        const res = await fetch(`${API_BASE}/api/news-feed`);
        const data = await res.json();
        if (data.status === "success" && data.headlines?.length) {
          setNewsHeadlines(data.headlines);
        }
      } catch (e) {
        console.error("❌ News feed failed:", e);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    window.location.href = "/simulation";
  }

  // ✅ Resolve plan from props OR localStorage for backward compatibility
  const resolvedPlan =
    normalizePlan(userPlan) || normalizePlan(localStorage.getItem("plan")) || "free";
  const proPlus = isProPlusPlan(resolvedPlan);

  // ✅ Role gate (Admin: B = hidden unless role=admin)
  const resolvedRole = (localStorage.getItem("role") || "").toString().trim().toLowerCase();
  const isAdmin = resolvedRole === "admin";


  // --- local navigation inside Control Tower
  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard' | 'scenario' | 'billing' | 'admin' | 'simulations'

  // --- KPI & charts
  const [kpiRange, setKpiRange] = useState("month");
  const [businessKpis, setBusinessKpis] = useState(null);

  const [kpiSectionVisibility, setKpiSectionVisibility] = useState({
    fulfillment: true,
    production: true,
    cost: true,
  });
  const toggleKpiSection = (section) =>
    setKpiSectionVisibility((prev) => ({ ...prev, [section]: !prev[section] }));

  const [chartType1, setChartType1] = useState("revenue");
  const [chartType2, setChartType2] = useState("onTime");

  const chartOptions = [
    { value: "shipments", label: "📦 Outbound Shipments" },
    { value: "utilization", label: "🏭 Facility Utilization" },
    { value: "inventory", label: "📦 Inventory Levels" },
    { value: "leadTime", label: "📈 Lead Time Trends" },
    { value: "revenue", label: "💰 Revenue at Risk" },
    { value: "onTime", label: "🕒 Supplier On-Time Rate" },
    { value: "expedite", label: "⚡ Expedited Orders" },
  ];

  const chartMeta = {
    shipments: {
      title: "Outbound Throughput Trend",
      subtitle: "Network shipment activity across the selected horizon",
      footer: "Basis: monitored outbound volume",
    },
    utilization: {
      title: "Facility Utilization Trend",
      subtitle: "Capacity pressure across key operating regions",
      footer: "Basis: blended facility utilization",
    },
    inventory: {
      title: "Inventory Position Trend",
      subtitle: "Overall inventory movement across the network",
      footer: "Basis: monitored inventory levels",
    },
    leadTime: {
      title: "Lead Time Trend",
      subtitle: "Transit and supplier response timing over time",
      footer: "Basis: average end-to-end lead time",
    },
    revenue: {
      title: "Revenue at Risk Trend",
      subtitle: "Estimated business exposure from current network conditions",
      footer: "Basis: exposure estimate from monitored disruptions",
    },
    onTime: {
      title: "Supplier Reliability Trend",
      subtitle: "Inbound supplier on-time performance over time",
      footer: "Basis: supplier on-time delivery rate",
    },
    expedite: {
      title: "Expedite Pressure Trend",
      subtitle: "Operational stress indicated by expedited order activity",
      footer: "Basis: expedited order share",
    },
  };

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
    {
      key: "totalFacilities",
      label: "Network Facilities",
      trend: "up",
      delta: {
        day: "Network scope unchanged vs yesterday",
        week: "Network scope unchanged vs last week",
        month: "Network scope unchanged vs last month",
        ytd: "Network scope unchanged vs start of year",
      },
    },
    {
      key: "activeIncidents",
      label: "Active Incidents",
      trend: "down",
      risk: "high",
      delta: {
        day: "↓ 3 vs yesterday",
        week: "↓ 4 vs last week",
        month: "↓ 7 vs last month",
        ytd: "↓ 13 vs start of year",
      },
    },
    {
      key: "shipments",
      label: "Outbound Shipments",
      trend: "neutral",
      delta: {
        day: "Flat vs yesterday",
        week: "↑ 4% vs last week",
        month: "↑ 7% vs last month",
        ytd: "↑ 12% vs start of year",
      },
    },
    {
      key: "disruptionPercent",
      label: "Disruption %",
      trend: "up",
      risk: "high",
      delta: {
        day: "↑ 0.1 pts vs yesterday",
        week: "Flat vs last week",
        month: "↑ 0.2 pts vs last month",
        ytd: "↓ 0.3 pts vs start of year",
      },
    },
    {
      key: "serviceLevel",
      label: "Service Level",
      trend: "up",
      delta: {
        day: "↑ 0.2 pts vs yesterday",
        week: "↑ 0.1 pts vs last week",
        month: "↑ 0.4 pts vs last month",
        ytd: "↑ 0.9 pts vs start of year",
      },
    },
    {
      key: "avgLeadTime",
      label: "Avg Lead Time (days)",
      trend: "down",
      delta: {
        day: "↓ 0.1 days vs yesterday",
        week: "↓ 0.1 days vs last week",
        month: "↓ 0.3 days vs last month",
        ytd: "↓ 0.6 days vs start of year",
      },
    },
    {
      key: "revenueAtRisk",
      label: "Revenue at Risk",
      trend: "up",
      delta: {
        day: "↓ $0.2M vs yesterday",
        week: "↓ $0.2M vs last week",
        month: "↓ $0.5M vs last month",
        ytd: "↓ $0.9M vs start of year",
      },
    },
    {
      key: "backorders",
      label: "Backorder Volume",
      trend: "down",
      risk: "high",
      delta: {
        day: "↓ 50 vs yesterday",
        week: "↓ 80 vs last week",
        month: "↓ 130 vs last month",
        ytd: "↓ 270 vs start of year",
      },
    },
    {
      key: "capacityUtilization",
      label: "Capacity Utilization",
      trend: "up",
      delta: {
        day: "↑ 0.4 pts vs yesterday",
        week: "↑ 1.5 pts vs last week",
        month: "↑ 2.5 pts vs last month",
        ytd: "↑ 3.2 pts vs start of year",
      },
    },
    {
      key: "supplierOnTime",
      label: "Supplier On-Time Rate",
      trend: "up",
      delta: {
        day: "↑ 0.2 pts vs yesterday",
        week: "↑ 0.7 pts vs last week",
        month: "↑ 1.1 pts vs last month",
        ytd: "↑ 1.9 pts vs start of year",
      },
    },
    {
      key: "expeditedOrders",
      label: "Expedited Orders",
      trend: "down",
      delta: {
        day: "↓ 0.1 pts vs yesterday",
        week: "↓ 0.2 pts vs last week",
        month: "↓ 0.5 pts vs last month",
        ytd: "↓ 0.9 pts vs start of year",
      },
    },
    {
      key: "cycleTime",
      label: "Order Cycle Time (days)",
      trend: "neutral",
      delta: {
        day: "Flat vs yesterday",
        week: "↓ 0.3 days vs last week",
        month: "↓ 0.6 days vs last month",
        ytd: "↓ 1.5 days vs start of year",
      },
    },
  ];

  const executiveKpiKeys = [
    "activeIncidents",
    "serviceLevel",
    "revenueAtRisk",
    "backorders",
    "avgLeadTime",
    "supplierOnTime",
  ];

  const networkContext = {
    monitoredRegions: 12,
    activeFeeds: ["USGS", "NOAA", "GDACS", "Internal Alerts"],
    refreshCadence: "15 min",
    timezoneLabel: "ET",
  };

  const renderChart = (type) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    const chartConfigs = {
      shipments: { type: Bar, data: [2, 3, 5, 4, 3, 4, 2, 1], label: "Outbound Shipments", color: "#1D625B" },
      utilization: {
        type: Line,
        data: [
          { label: "East", data: [61, 74, 92, 86, 81, 96, 98, 108], color: "#1D625B" },
          { label: "West", data: [42, 56, 61, 66, 62, 71, 79, 88], color: "#F59E0B" },
        ],
      },
      inventory: {
        type: Bar,
        data: [100, 92, 81, 86, 77, 71, 67, 62],
        label: "Inventory",
        color: "#3B82F6",
      },
      leadTime: {
        type: Line,
        data: [6.0, 5.9, 5.7, 5.8, 5.5, 5.4, 5.2, 5.1],
        label: "Lead Time (days)",
        color: "#10B981",
      },
      revenue: {
        type: Bar,
        data: [4.8, 4.7, 4.5, 4.4, 4.1, 4.0, 3.9, 3.85],
        label: "Revenue at Risk ($M)",
        color: "#1D625B",
      },
      onTime: {
        type: Line,
        data: [91.2, 91.4, 92.0, 92.3, 92.7, 92.9, 93.1, 93.2],
        label: "On-Time Rate (%)",
        color: "#6366F1",
      },
      expedite: {
        type: Bar,
        data: [5.1, 5.0, 4.85, 4.7, 4.65, 4.45, 4.35, 4.2],
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
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
          },
        }}
      />
    );
  };

  // ✅ CTA action: route inside Control Tower (billing tab)
  const goToBilling = () => setActiveView("billing");

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a2e22] text-white p-6 space-y-6 h-screen overflow-y-auto">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto rounded-lg" />
        </div>

        {/* User badge */}
        <div className="flex flex-col items-center space-y-2">
          <img
            src="/mj_profile.jpg"
            alt="User Profile"
            className="h-20 w-20 rounded-full border-2 border-white shadow-md"
          />
          <div className="text-sm font-semibold text-white">{userName || "User"}</div>
          <div className="text-[11px] opacity-80 bg-white/10 rounded px-2 py-0.5">
            {(resolvedPlan || "FREE").toUpperCase()}
          </div>
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

            {/* ✅ NEW: Simulations view */}
            <li>
              <a
                onClick={() => setActiveView("simulations")}
                className={`block cursor-pointer ${
                  activeView === "simulations" ? "text-lime-300" : "hover:underline"
                }`}
              >
                🧪 Simulations
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

            {isAdmin && (
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
            )}


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
          </ul>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Sticky header */}
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

        {/* Scrollable content */}
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

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2 h-96 rounded overflow-hidden shadow border border-gray-300">
                  <MapView
                    locationsUrl={simulationHistory?.[0]?.locations_url || GLOBAL_LOCATIONS_URL}
                    onFacilitySelect={handleFacilitySelect}
                  />
                </div>

                <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-[#1D625B] mb-2">
                    Network Health Summary
                  </h2>

                  <div className="text-sm text-gray-600 mb-3">
                    Executive overview of current supply chain performance and disruption exposure.
                  </div>

                  <ul className="space-y-3">
                    <li className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Active Incidents</span>
                      <span className="text-base font-extrabold text-red-500">{businessKpis?.activeIncidents}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Service Level</span>
                      <span className="text-base font-extrabold text-[#1D625B]">{businessKpis?.serviceLevel}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Revenue Exposure</span>
                      <span className="text-base font-extrabold text-amber-600">{businessKpis?.revenueAtRisk}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Backorders</span>
                      <span className="text-base font-extrabold text-red-400">{businessKpis?.backorders}</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mb-5">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Regions Monitored</div>
                      <div className="font-semibold text-gray-800">{networkContext.monitoredRegions}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Active Feeds</div>
                      <div className="font-semibold text-gray-800">{networkContext.activeFeeds.join(" • ")}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Network Scope</div>
                      <div className="font-semibold text-gray-800">{businessKpis?.totalFacilities || "—"} facilities</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Refresh Cadence</div>
                      <div className="font-semibold text-gray-800">{networkContext.refreshCadence}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Last Refresh</div>
                      <div className="font-semibold text-gray-800">{new Date().toLocaleTimeString()} {networkContext.timezoneLabel}</div>
                    </div>
                  </div>
                </div>
              </section>
              {newsHeadlines.length > 0 && (
                <div className="rounded-xl overflow-hidden mb-2" style={{ background: "#111B21", border: "1px solid #1f3a2e" }}>
                  <div className="flex items-center">
                    <div className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase whitespace-nowrap flex-shrink-0" style={{ background: "#9FD63A", color: "#111B21" }}>
                      LIVE INTEL
                    </div>
                    <div className="overflow-hidden flex-1 relative">
                      <div className="flex gap-12 py-2 px-4 whitespace-nowrap" style={{ animation: "ticker-scroll 60s linear infinite", display: "inline-flex" }}>
                        {[...newsHeadlines, ...newsHeadlines].map((h, idx) => (
                          <a key={idx} href={h.link} target="_blank" rel="noreferrer" className="text-[11px] hover:underline flex-shrink-0" style={{ color: "#e2e8e0" }}>
                            <span style={{ color: "#2EC4A6", marginRight: 6 }}>{h.source}</span>
                            {h.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  <style>{`@keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
                </div>
              )}

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

              <div className="text-xs text-gray-500 mb-3">
                Last updated: {new Date().toLocaleString()}
              </div>

              <div className="rounded-xl mb-5 px-5 py-4 flex items-center justify-between gap-4" style={{ background: "linear-gradient(90deg, #0d3d2e 0%, #1D625B 100%)", border: "1px solid rgba(156,247,0,0.2)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚡</span>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-lime-300/70 mb-0.5">Recommended Action</p>
                    <p className="text-sm font-semibold text-white">Supplier disruption affecting {businessKpis?.activeIncidents} facilities — expedite constrained component path before backlog accelerates.</p>
                  </div>
                </div>
                <button onClick={() => switchView("simulation")} className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition" style={{ background: "#9CF700", color: "#020617" }}>Run Simulation →</button>
              </div>

              {businessKpis && (
                <>
                  <section className="mb-6">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <h2 className="text-xl font-semibold text-[#1D625B]">
                          Executive KPIs
                        </h2>
                        <div className="text-sm text-gray-500">
                          Highest-signal network metrics for leadership review
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {executiveKpiKeys.map((key) => (
                        <KpiCard
                          key={key}
                          value={businessKpis[key]}
                          label={kpiMeta.find((k) => k.key === key)?.label}
                          trend={kpiMeta.find((k) => k.key === key)?.trend}
                          risk={kpiMeta.find((k) => k.key === key)?.risk}
                          deltaText={kpiMeta.find((k) => k.key === key)?.delta?.[kpiRange]}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-8 mb-6">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                </>
              )}

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[chartType1, chartType2].map((type, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden"
                  >
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-base font-semibold text-[#1D625B]">
                            {chartMeta[type]?.title || "Trend View"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {chartMeta[type]?.subtitle || "Operational performance trend"}
                          </div>
                        </div>
                      </div>

                      <Select
                        options={chartOptions}
                        value={chartOptions.find((opt) => opt.value === type)}
                        onChange={(sel) => (i === 0 ? setChartType1(sel.value) : setChartType2(sel.value))}
                        className="mb-0"
                      />
                    </div>

                    <div className="p-4">
                      <div className="h-[320px]">
                        {renderChart(type)}
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                      <span>{chartMeta[type]?.footer || "Basis: monitored performance"}</span>
                      <span>Period: Jan–Aug</span>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {/* ✅ NEW: Simulations view with Upgrade CTA */}
          {activeView === "simulations" && (
            <section className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-[#1D625B]">🧪 Simulation Repository</h2>
                {!proPlus && (
                  <button
                    onClick={goToBilling}
                    className="rounded-xl border px-3 py-1.5 text-sm font-semibold text-[#1D625B] hover:bg-gray-50"
                  >
                    Upgrade
                  </button>
                )}
              </div>

              {!proPlus ? (
                <div className="rounded-2xl bg-[#1D625B] text-white p-5">
                  <UpgradeCtaCard plan={resolvedPlan} onUpgrade={goToBilling} />
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(simulationHistory) && simulationHistory.length > 0 ? (
                    simulationHistory.map((run, idx) => (
                      <div
                        key={run.id || run.created_at || idx}
                        className="bg-white border rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[#1D625B]">
                              {run.name || `Simulation Run #${idx + 1}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {run.created_at || run.timestamp || ""}
                            </div>
                          </div>

                          <button
                            onClick={() => switchView?.("simulation")}
                            className="rounded-xl border px-3 py-1.5 text-sm font-semibold text-[#1D625B] hover:bg-gray-50"
                            title="Open Simulation Dashboard"
                          >
                            Open →
                          </button>
                        </div>

                        <div className="mt-3 text-sm text-gray-600">
                          Outputs:{" "}
                          <span className="font-mono">
                            {Object.keys(run.output_urls || run.urls || {}).length} files
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white border rounded-xl p-4 text-gray-600">
                      No runs yet.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeView === "scenario" && (
            <section className="mt-10">
              <ScenarioLibrary
                userPlan={resolvedPlan}
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

          {activeView === "admin" && isAdmin && (
            <section className="mt-10">
              <AdminPanel />
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
