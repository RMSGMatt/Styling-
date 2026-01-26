// src/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import UpgradeModal from "./UpgradeModal";

/**
 * Reports – Full page (Revenue-ready)
 * - Fetches simulation history from backend (/api/simulations) using localStorage.token
 * - Executive Report panel:
 *    - GET  /api/executive-report/latest
 *    - POST /api/executive-report/build
 * - NO window.location.reload(); everything refreshes via fetches + state
 *
 * Step 3C: Free user executive report gate
 * - Backend returns 402 + { error:"upgrade_required", plan:"free", required:[...] }
 * - Frontend shows Upgrade UI + opens UpgradeModal
 */

export default function Reports() {
  // -----------------------------
  // API helpers
  // -----------------------------
  const API_BASE = (import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000").replace(
    /\/$/,
    ""
  );

  const getToken = () => localStorage.getItem("token");

  const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // -----------------------------
  // Upgrade modal state (shared)
  // -----------------------------
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(["pro", "enterprise"]);
  const [upgradePlan, setUpgradePlan] = useState("free");

  const openUpgrade = (data) => {
    const plan = data?.plan || data?.current_plan || "free";

    const req =
      data?.required ||
      (Array.isArray(data?.required_plan) ? data.required_plan : null) ||
      (typeof data?.required_plan === "string" ? [data.required_plan] : null) ||
      ["pro", "enterprise"];

    setUpgradePlan(plan);
    setUpgradeRequired(Array.isArray(req) ? req : [String(req)]);
    setUpgradeOpen(true);
  };

  // -----------------------------
  // Simulation History state
  // -----------------------------
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [simLoading, setSimLoading] = useState(true);
  const [simError, setSimError] = useState("");
  const [simLastRefreshedAt, setSimLastRefreshedAt] = useState(null);

  const fetchSimulationHistory = async () => {
    setSimLoading(true);
    setSimError("");

    try {
      const token = getToken();
      if (!token) {
        setSimulationHistory([]);
        setSimError("You are not logged in (missing token). Please log in again.");
        setSimLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/simulations`, {
        method: "GET",
        headers: { ...authHeaders() },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.msg || data?.error || `Failed to load simulations (HTTP ${res.status}).`;
        setSimError(msg);
        setSimulationHistory([]);
        setSimLoading(false);
        return;
      }

      // Accept either {simulations:[...]} or bare array
      const sims = Array.isArray(data?.simulations)
        ? data.simulations
        : Array.isArray(data)
        ? data
        : [];

      setSimulationHistory(sims);
      setSimLastRefreshedAt(new Date().toLocaleTimeString());
      setSimLoading(false);
    } catch (e) {
      setSimError(String(e?.message || e));
      setSimulationHistory([]);
      setSimLoading(false);
    }
  };

  // -----------------------------
  // Executive Report state
  // -----------------------------
  const [execReport, setExecReport] = useState(null);
  const [execLoading, setExecLoading] = useState(true);
  const [execError, setExecError] = useState("");
  const [execBuilding, setExecBuilding] = useState(false);
  const [execLastRefreshedAt, setExecLastRefreshedAt] = useState(null);

  // Gate UX state (we still show an on-page banner even though we also open modal)
  const [showExecUpgrade, setShowExecUpgrade] = useState(false);
  const [execGate, setExecGate] = useState({
    plan: "free",
    required: ["pro", "enterprise"],
    message: "Upgrade to Pro to access the Executive Report.",
  });

  const isUpgradeResponse = (res, data) =>
    res?.status === 402 && (data?.error === "upgrade_required" || data?.code === "upgrade_required");

  const fetchLatestExecutiveReport = async () => {
    setExecLoading(true);
    setExecError("");
    setShowExecUpgrade(false);

    try {
      const token = getToken();
      if (!token) {
        setExecReport(null);
        setExecError("You are not logged in (missing token). Please log in again.");
        setExecLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/executive-report/latest`, {
        method: "GET",
        headers: { ...authHeaders() },
      });

      const data = await res.json().catch(() => ({}));

      // ✅ 402 gate => show upgrade UX + open modal
      if (isUpgradeResponse(res, data)) {
        setExecReport(null);

        setShowExecUpgrade(true);
        setExecGate({
          plan: data?.plan || data?.current_plan || "free",
          required: data?.required || data?.required_plan || ["pro", "enterprise"],
          message:
            data?.message ||
            "Upgrade to Pro to access the Executive Report (BBI + KPIs + narrative).",
        });

        openUpgrade(data);
        setExecLoading(false);
        return;
      }

      if (!res.ok) {
        const msg =
          data?.msg || data?.error || `Failed to load executive report (HTTP ${res.status}).`;
        setExecError(msg);
        setExecReport(null);
        setExecLoading(false);
        return;
      }

      setExecReport(data?.report || null);
      setExecLastRefreshedAt(new Date().toLocaleTimeString());
      setExecLoading(false);
    } catch (e) {
      setExecError(String(e?.message || e));
      setExecReport(null);
      setExecLoading(false);
    }
  };

  const buildExecutiveReport = async () => {
    setExecBuilding(true);
    setExecError("");
    setShowExecUpgrade(false);

    try {
      const token = getToken();
      if (!token) {
        setExecError("You are not logged in (missing token). Please log in again.");
        setExecBuilding(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/executive-report/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ source: "simulation", force: true }),
      });

      const data = await res.json().catch(() => ({}));

      // ✅ 402 gate => show upgrade UX + open modal
      if (isUpgradeResponse(res, data)) {
        setShowExecUpgrade(true);
        setExecGate({
          plan: data?.plan || data?.current_plan || "free",
          required: data?.required || data?.required_plan || ["pro", "enterprise"],
          message:
            data?.message ||
            "Upgrade to Pro to generate Executive Reports (BBI + KPIs + narrative).",
        });

        openUpgrade(data);
        setExecBuilding(false);
        return;
      }

      if (!res.ok) {
        const msg =
          data?.msg || data?.error || `Failed to build executive report (HTTP ${res.status}).`;
        setExecError(msg);
        setExecBuilding(false);
        return;
      }

      if (data?.report) setExecReport(data.report);

      await fetchLatestExecutiveReport();
      setExecBuilding(false);
    } catch (e) {
      setExecError(String(e?.message || e));
      setExecBuilding(false);
    }
  };

  // -----------------------------
  // On mount: load both
  // -----------------------------
  useEffect(() => {
    fetchSimulationHistory();
    fetchLatestExecutiveReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Existing Simulation Report helpers
  // -----------------------------
  const hasReports = Array.isArray(simulationHistory) && simulationHistory.length > 0;

  const getOutputs = (sim) => sim?.output_urls || sim?.outputUrls || sim?.outputURLs || {};
  const pickUrl = (outputs, snakeKey, camelKey) => outputs?.[snakeKey] || outputs?.[camelKey] || null;

  const formatTimestamp = (ts) => {
    if (!ts) return "Unknown date";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      return d.toLocaleString();
    } catch {
      return String(ts);
    }
  };

  const latestRun = useMemo(() => {
    if (!hasReports) return null;
    return simulationHistory[0];
  }, [hasReports, simulationHistory]);

  const latestTs = latestRun?.timestamp ? formatTimestamp(latestRun.timestamp) : "—";
  const latestStatus = latestRun?.status || "done";

  const statusStyles = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("error") || s.includes("fail")) return "bg-red-50 text-red-700 border-red-200";
    if (s.includes("run") || s.includes("process") || s.includes("pending"))
      return "bg-amber-50 text-amber-800 border-amber-200";
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  };

  const tileBase =
    "group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all " +
    "hover:shadow-md hover:-translate-y-[1px] active:translate-y-0";

  const tilePrimary = tileBase + " bg-[#1D625B] border-[#1D625B] text-white hover:bg-[#174F47]";
  const tileSecondary = tileBase + " bg-white border-[#D8E5DD] text-[#1D625B] hover:bg-[#F2F6F3]";
  const tileMuted =
    "flex items-center gap-3 rounded-xl border border-dashed border-[#D8E5DD] px-4 py-3 text-sm text-gray-400 bg-white";

  const SectionTitle = ({ icon, title, subtitle }) => (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#F2F6F3] border border-[#D8E5DD] flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#1D625B]">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
      </div>
    </div>
  );

  const Chip = ({ label, value }) => (
    <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/20">
      <div className="text-[11px] uppercase tracking-wide opacity-90">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );

  // -----------------------------
  // Executive Report view helpers
  // -----------------------------
  const execCreatedAt = execReport?.createdAt ? formatTimestamp(execReport.createdAt) : "—";
  const bbi = execReport?.metrics?.bbi;
  const highlights = Array.isArray(execReport?.metrics?.highlights) ? execReport.metrics.highlights : [];
  const kpis = execReport?.metrics?.kpis || {};
  const sections = Array.isArray(execReport?.narrative?.sections) ? execReport.narrative.sections : [];

  const KPIBox = ({ label, value, hint }) => (
    <div className="rounded-2xl border border-[#E5ECE7] bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-widest text-gray-400">{label}</div>
      <div className="text-xl font-bold text-[#1D625B] mt-1">{value}</div>
      {hint ? <div className="text-xs text-gray-500 mt-1">{hint}</div> : null}
    </div>
  );

  const formatNumber = (n, decimals = 0) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n ?? "—");
    return x.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  // ✅ inputs are fractions (0–1). Multiply by 100 for display.
  const formatPercent = (n, decimals = 1) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return `${(x * 100).toFixed(decimals)}%`;
  };

  const execLocked = showExecUpgrade === true;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="min-h-screen bg-[#F9FAF9] p-8 space-y-6">
      {/* Upgrade modal (global for this page) */}
      <UpgradeModal
        open={upgradeOpen}
        required={upgradeRequired}
        plan={upgradePlan}
        onClose={() => setUpgradeOpen(false)}
        onBackToControlTower={() => {
          setUpgradeOpen(false);
          // Replace with your real navigation if you have switchView/router
          window.location.href = "/control-tower";
        }}
      />

      {/* Hero Header */}
      <div className="rounded-3xl overflow-hidden shadow-md border border-[#E5ECE7]">
        <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white p-7">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-80">FOR-C • Reports</div>
              <h1 className="text-3xl font-bold mt-2">📊 Simulation Reports</h1>
              <p className="text-sm opacity-90 mt-2 max-w-2xl">
                Download complete report packs from your simulation runs—core outputs, risk insights, and supporting
                datasets. Executive Report is generated from your latest run (BBI + KPIs + narrative).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex gap-3 flex-wrap">
                <Chip label="Runs" value={hasReports ? simulationHistory.length : "0"} />
                <Chip label="Latest Run" value={latestTs} />
                <Chip label="Run Status" value={latestStatus} />
                <Chip label="Exec Report" value={execCreatedAt} />
              </div>

              <button
                onClick={async () => {
                  await fetchSimulationHistory();
                  await fetchLatestExecutiveReport();
                }}
                className="bg-[#ABFA7D] hover:bg-[#93EB6C] text-[#1D625B] font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                title="Refresh reports (no page reload)"
                disabled={simLoading || execLoading || execBuilding}
              >
                {simLoading || execLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Subheader strip */}
        <div className="bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold text-[#1D625B]">Tip:</span> Use “Download Full Pack” for the fastest export,
            or grab individual files below.
          </div>
          <div className="text-xs text-gray-500">
            {simLastRefreshedAt ? `Simulation list refreshed: ${simLastRefreshedAt}` : ""}
            {execLastRefreshedAt ? ` • Executive refreshed: ${execLastRefreshedAt}` : ""}
          </div>
        </div>
      </div>

      {/* Executive Report Panel */}
      <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E5ECE7] flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-gray-400">Executive Report</div>
            <div className="text-xl font-bold text-[#1D625B]">📘 BBI + KPI Summary</div>
            <div className="text-sm text-gray-600">
              Stored on the backend and returned via <span className="font-semibold">/api/executive-report/latest</span>.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={fetchLatestExecutiveReport}
              className="px-4 py-2 rounded-xl border border-[#D8E5DD] bg-white text-[#1D625B] hover:bg-[#F2F6F3] font-semibold transition"
              disabled={execLoading || execBuilding}
              title="Reload latest report"
            >
              {execLoading ? "Reloading…" : "Reload"}
            </button>

            <button
              onClick={buildExecutiveReport}
              className={
                "px-4 py-2 rounded-xl font-semibold shadow-sm transition " +
                (execLocked
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#1D625B] hover:bg-[#174F47] text-white")
              }
              disabled={execBuilding || execLocked}
              title={
                execLocked ? "Upgrade required to generate Executive Reports" : "Generate a fresh executive report"
              }
            >
              {execBuilding ? "Generating…" : execLocked ? "Upgrade to Generate" : "Generate Executive Report"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Gate banner (friendly) */}
          {showExecUpgrade ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-900">🔒 Executive Report is a Pro feature</div>
              <div className="text-sm text-amber-900/80 mt-1">
                {execGate?.message || "Upgrade to Pro to access the Executive Report."}
              </div>
              <div className="text-xs text-amber-900/70 mt-3">
                Current plan: <span className="font-semibold">{execGate?.plan || "free"}</span> • Required:{" "}
                <span className="font-semibold">
                  {Array.isArray(execGate?.required) ? execGate.required.join(" / ") : "pro"}
                </span>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                  className="px-4 py-2 rounded-xl bg-[#1D625B] hover:bg-[#174F47] text-white font-semibold shadow-sm transition"
                  onClick={() => openUpgrade({ plan: execGate?.plan, required: execGate?.required })}
                >
                  Upgrade
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-amber-200 bg-white text-amber-900 font-semibold hover:bg-amber-100 transition"
                  onClick={fetchLatestExecutiveReport}
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : null}

          {/* Normal errors (non-402) */}
          {execError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm">{execError}</div>
          ) : null}

          {!execLoading && !execReport && !showExecUpgrade ? (
            <div className="rounded-2xl border border-[#E5ECE7] bg-[#F9FAF9] p-5 text-sm text-gray-600">
              No executive report found yet. Click <span className="font-semibold">Generate Executive Report</span>.
            </div>
          ) : null}

          {execReport ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPIBox
                  label="BBI"
                  value={bbi === null || bbi === undefined ? "—" : `${formatNumber(bbi, 1)}/100`}
                  hint="Business Balance Index"
                />
                <KPIBox
                  label="On-time Fulfillment"
                  value={formatPercent(kpis.onTimeFulfillment, 1)}
                  hint="(Proxy until demand totals are wired)"
                />
                <KPIBox label="Unfulfilled Qty" value={formatNumber(kpis.unfulfilledQty, 0)} hint="Shortfall signal" />
                <KPIBox label="Avg Inventory" value={formatNumber(kpis.avgInventory, 0)} hint="Across run horizon" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-3xl border border-[#E5ECE7] bg-white p-5">
                  <SectionTitle icon="✨" title="Highlights" subtitle="Top signals from the latest run" />
                  <div className="mt-4 space-y-2">
                    {highlights.length ? (
                      highlights.map((h, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-[#E5ECE7] bg-[#F9FAF9] px-4 py-3 text-sm text-gray-700"
                        >
                          {h}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No highlights yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#E5ECE7] bg-white p-5">
                  <SectionTitle icon="🧠" title="Narrative" subtitle="Backend-generated sections for the Executive Report" />
                  <div className="mt-4 space-y-3">
                    {sections.length ? (
                      sections.map((s) => (
                        <div key={s.id || s.title} className="rounded-2xl border border-[#E5ECE7] bg-white p-4">
                          <div className="text-sm font-bold text-[#1D625B]">{s.title || s.id}</div>
                          <div className="text-sm text-gray-700 whitespace-pre-line mt-2">{s.body || ""}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No narrative sections yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Simulation Report Packs */}
      {simError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm">{simError}</div>
      ) : null}

      {simLoading ? (
        <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm p-7 text-sm text-gray-600">
          Loading simulation history…
        </div>
      ) : hasReports ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {simulationHistory.map((sim, idx) => {
            const outputs = getOutputs(sim);

            const flowUrl = pickUrl(outputs, "flow_output_file_url", "flow_output_file_url");
            const inventoryUrl = pickUrl(outputs, "inventory_output_file_url", "inventory_output_file_url");
            const productionUrl = pickUrl(outputs, "production_output_file_url", "production_output_file_url");
            const occurrenceUrl = pickUrl(outputs, "occurrence_output_file_url", "occurrence_output_file_url");

            const disruptionImpactUrl =
              pickUrl(outputs, "disruption_impact_url", "disruptionImpactUrl") || sim?.disruption_impact_url;
            const projectedImpactUrl =
              pickUrl(outputs, "projected_impact_url", "projectedImpactUrl") || sim?.projected_impact_url;
            const runoutRiskUrl = pickUrl(outputs, "runout_risk_url", "runoutRiskUrl") || sim?.runout_risk_url;
            const countermeasuresUrl =
              pickUrl(outputs, "countermeasures_url", "countermeasuresUrl") || sim?.countermeasures_url;

            const locationsUrl =
              outputs?.locations_url || outputs?.locationsUrl || sim?.locations_url || sim?.locationsUrl || null;

            const bundleUrl =
              outputs?.report_bundle_url || outputs?.bundle_url || sim?.report_bundle_url || sim?.bundle_url || null;

            const status = sim?.status || "done";
            const timestamp = formatTimestamp(sim?.timestamp);

            const anyCore = flowUrl || inventoryUrl || productionUrl || occurrenceUrl;
            const anyInsights =
              disruptionImpactUrl || projectedImpactUrl || runoutRiskUrl || countermeasuresUrl || locationsUrl;

            const anyUrl = bundleUrl || anyCore || anyInsights;

            return (
              <div
                key={idx}
                className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-6 border-b border-[#E5ECE7] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gray-400">Report Pack</div>
                    <div className="flex items-center gap-3 mt-2">
                      <h2 className="text-xl font-bold text-[#1D625B]">Run {idx + 1}</h2>
                      <span className={"text-xs font-semibold px-2.5 py-1 rounded-full border " + statusStyles(status)}>
                        {status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{timestamp}</div>
                  </div>

                  {/* Primary CTA */}
                  {bundleUrl ? (
                    <a
                      href={bundleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#1D625B] hover:bg-[#174F47] text-white font-semibold px-4 py-2 rounded-xl shadow-sm transition w-full sm:w-auto"
                      title="Download full bundled report pack"
                    >
                      ⬇️ Download Full Pack
                    </a>
                  ) : (
                    <div className="text-xs text-gray-400 sm:text-right">
                      {anyUrl ? "Full pack not available (download individual files)." : "No files available yet."}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {/* Core Outputs */}
                  <div className="space-y-3">
                    <SectionTitle icon="🧾" title="Core Outputs" subtitle="Simulation output CSVs" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {flowUrl ? (
                        <a className={tilePrimary} href={flowUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">🌊</span>
                          <div className="flex-1">
                            <div className="font-semibold">Flow Output</div>
                            <div className="text-xs opacity-90">flow_output.csv</div>
                          </div>
                          <span className="opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>🌊 Flow Output (missing)</div>
                      )}

                      {inventoryUrl ? (
                        <a className={tilePrimary} href={inventoryUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">📦</span>
                          <div className="flex-1">
                            <div className="font-semibold">Inventory Output</div>
                            <div className="text-xs opacity-90">inventory_output.csv</div>
                          </div>
                          <span className="opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>📦 Inventory Output (missing)</div>
                      )}

                      {productionUrl ? (
                        <a className={tileSecondary} href={productionUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">🏭</span>
                          <div className="flex-1">
                            <div className="font-semibold">Production Output</div>
                            <div className="text-xs text-gray-500">production_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>🏭 Production Output (missing)</div>
                      )}

                      {occurrenceUrl ? (
                        <a className={tileSecondary} href={occurrenceUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">⚠️</span>
                          <div className="flex-1">
                            <div className="font-semibold">Occurrence Output</div>
                            <div className="text-xs text-gray-500">occurrence_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>⚠️ Occurrence Output (missing)</div>
                      )}
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="space-y-3">
                    <SectionTitle icon="🧠" title="Insights" subtitle="Risk, impact, and recommended actions" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {disruptionImpactUrl ? (
                        <a className={tileSecondary} href={disruptionImpactUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">🧯</span>
                          <div className="flex-1">
                            <div className="font-semibold">Disruption Impact</div>
                            <div className="text-xs text-gray-500">disruption_impact_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>🧯 Disruption Impact (missing)</div>
                      )}

                      {projectedImpactUrl ? (
                        <a className={tileSecondary} href={projectedImpactUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">📈</span>
                          <div className="flex-1">
                            <div className="font-semibold">Projected Impact</div>
                            <div className="text-xs text-gray-500">projected_impact_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>📈 Projected Impact (missing)</div>
                      )}

                      {runoutRiskUrl ? (
                        <a className={tileSecondary} href={runoutRiskUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">⛔</span>
                          <div className="flex-1">
                            <div className="font-semibold">SKU Runout Risk</div>
                            <div className="text-xs text-gray-500">sku_runout_risk_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>⛔ SKU Runout Risk (missing)</div>
                      )}

                      {countermeasuresUrl ? (
                        <a className={tileSecondary} href={countermeasuresUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">🛠️</span>
                          <div className="flex-1">
                            <div className="font-semibold">Countermeasures</div>
                            <div className="text-xs text-gray-500">countermeasures_output.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>🛠️ Countermeasures (missing)</div>
                      )}

                      {locationsUrl ? (
                        <a className={tileSecondary} href={locationsUrl} target="_blank" rel="noopener noreferrer">
                          <span className="text-xl">🗺️</span>
                          <div className="flex-1">
                            <div className="font-semibold">Locations</div>
                            <div className="text-xs text-gray-500">locations_input.csv</div>
                          </div>
                          <span className="text-[#1D625B] opacity-90">↗</span>
                        </a>
                      ) : (
                        <div className={tileMuted}>🗺️ Locations (missing)</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm p-7">
          <div className="text-sm text-gray-600">
            No simulation history found yet. Run a simulation to generate report packs and an executive report.
          </div>
        </div>
      )}
    </div>
  );
}
