import React, { useEffect, useMemo, useState } from "react";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

function formatNumber(value, digits = 0) {
  if (isMissing(value)) return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value, digits = 1) {
  if (isMissing(value)) return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(digits)}%`;
}

function formatCurrency(value) {
  if (isMissing(value)) return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function getRunId(run) {
  return (
    run?.run_id ||
    run?.runId ||
    run?.id ||
    run?.timestamp ||
    run?.created_at ||
    null
  );
}

function getRunCreatedAt(run) {
  return (
    run?.created_at ||
    run?.createdAt ||
    run?.timestamp ||
    run?.run_id ||
    null
  );
}

function getRunLabel(run, index = 0) {
  const runId = getRunId(run);
  const shortId = runId ? runId.slice(-8) : null;
  const createdAt = getRunCreatedAt(run);
  const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString() : null;
  return (
    run?.scenario_name ||
    run?.scenarioName ||
    run?.name ||
    run?.title ||
    (shortId && dateLabel ? `${dateLabel} — ${shortId}` : null) ||
    `Run ${index + 1}`
  );
}

function getAttachedExecutiveReport(run) {
  return (
    run?.report ||
    run?.executiveReport ||
    run?.executive_report ||
    null
  );
}

function normalizeRuns(simulationHistory) {
  if (!Array.isArray(simulationHistory)) return [];

  return simulationHistory
    .map((run, index) => {
      const runId = getRunId(run);
      const createdAt = getRunCreatedAt(run);

      return {
        raw: run,
        runId,
        createdAt,
        label: getRunLabel(run, index),
        report: getAttachedExecutiveReport(run),
      };
    })
    .filter((run) => run.runId)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
}

function pickArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function normalizeExecutiveReport(report, selectedRun) {
  if (!report || typeof report !== "object") return null;

  const narrative = report?.narrative || {};
  const inputSource = report?.inputs || {};

  const sections = pickArray(narrative.sections).map((section, index) => ({
    id: section?.id || `section-${index}`,
    title: pickText(section?.title, section?.heading, `Section ${index + 1}`),
    body: pickText(section?.body, section?.text, section?.content),
    bullets: pickArray(section?.bullets, section?.items),
  }));

  return {
    title: pickText(
      narrative.title,
      report.title,
      "Executive Report"
    ),
    subtitle: pickText(
      narrative.summary,
      report.summary,
      report.executive_summary
    ),
    generatedAt: pickValue(
      report.createdAt,
      report.generatedAt,
      report.generated_at,
      report.created_at
    ),
    scenarioName: pickText(
      selectedRun?.raw?.scenario_name,
      selectedRun?.raw?.scenarioName,
      selectedRun?.label
    ),
    dateRangeStart: pickValue(
      inputSource.startDate,
      inputSource.start_date,
      inputSource.sim_start
    ),
    dateRangeEnd: pickValue(
      inputSource.endDate,
      inputSource.end_date,
      inputSource.sim_end
    ),
    sections,
    risks: [],
    actions: [],
  };
}




function getBbiHealth(score) {
  const value = Number(score || 0);
  if (value >= 90) return "healthy";
  if (value >= 72) return "watch";
  return "stressed";
}

function getBbiTone(score) {
  const health = getBbiHealth(score);

  if (health === "healthy") {
    return {
      label: "Healthy",
      valueClass: "text-emerald-300",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
      borderColor: "rgba(16,185,129,0.30)",
      background: "linear-gradient(145deg, rgba(6,78,59,0.28), rgba(15,23,42,0.96))",
      shadow: "0 14px 30px rgba(16,185,129,0.12)",
    };
  }

  if (health === "watch") {
    return {
      label: "Watch",
      valueClass: "text-amber-300",
      badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-400/20",
      borderColor: "rgba(245,158,11,0.30)",
      background: "linear-gradient(145deg, rgba(120,53,15,0.22), rgba(15,23,42,0.96))",
      shadow: "0 14px 30px rgba(245,158,11,0.10)",
    };
  }

  return {
    label: "Stressed",
    valueClass: "text-rose-300",
    badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-400/20",
    borderColor: "rgba(244,63,94,0.30)",
    background: "linear-gradient(145deg, rgba(127,29,29,0.24), rgba(15,23,42,0.96))",
    shadow: "0 14px 30px rgba(244,63,94,0.10)",
  };
}

function getKpiValueClass(kind, value) {
  const num = Number(value || 0);

  switch (kind) {
    case "serviceLevel":
      if (num >= 90) return "text-emerald-300";
      if (num >= 75) return "text-amber-300";
      return "text-rose-300";

    case "demandAtRisk":
    case "unfulfilledDemand":
    case "revenueExposure":
      if (num <= 0) return "text-emerald-300";
      if (num < 100) return "text-amber-300";
      return "text-rose-300";

    case "ttrDays":
      if (num <= 1) return "text-emerald-300";
      if (num <= 3) return "text-amber-300";
      return "text-rose-300";

    default:
      return "text-white";
  }
}


function kpiNum(...values) {
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Stored run KPIs when present, else the ones computed from the run's saved output files.
function kpisOf(run, live) {
  const raw = run?.raw || {};
  if (raw.kpis && typeof raw.kpis === "object" && Object.keys(raw.kpis).length) return raw.kpis;
  if (typeof raw.kpis_json === "string") {
    try {
      const parsed = JSON.parse(raw.kpis_json);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) return parsed;
    } catch {
      /* fall through */
    }
  } else if (raw.kpis_json && typeof raw.kpis_json === "object" && Object.keys(raw.kpis_json).length) {
    return raw.kpis_json;
  }
  return live?.kpis || {};
}

function scorecardRow(scorecard, key) {
  for (const g of scorecard?.groups || []) {
    for (const r of g.rows || []) if (r.key === key) return r;
  }
  return null;
}

// Number of days, Infinity when the network never recovers, null when unknown.
function recoveryDays(live, kpis) {
  const r = scorecardRow(live?.scorecard, "ttr");
  if (r) {
    if (r.state === "not_recovered") return Infinity;
    if (typeof r.during === "number") return r.during;
  }
  return kpiNum(kpis?.ttrDays, kpis?.timeToRecoverDays, kpis?.timeToRecovery);
}

// Weighted score over the inputs that exist. Missing inputs are left out, never counted as perfect.
function computeFrontendBbi(selectedRun, live) {
  const kpis = kpisOf(selectedRun, live);
  const onTime = kpiNum(kpis.onTimeFulfillment);
  if (onTime === null) return null;

  const parts = [[0.55, onTime]];

  const peak = kpiNum(kpis.peakBacklogUnits, kpis.peakBacklog);
  const total = kpiNum(kpis.serviceTruth?.totalDemand);
  if (peak !== null && total !== null && total > 0) {
    parts.push([0.2, 100 - Math.min((peak / total) * 100, 100)]);
  }

  const missed = kpiNum(kpis.missedServiceDays, kpis.serviceTruth?.daysWithMissedService);
  if (missed !== null) parts.push([0.15, 100 - Math.min((missed / 90) * 100, 100)]);

  const ttr = recoveryDays(live, kpis);
  if (ttr === Infinity) parts.push([0.1, 0]);
  else if (ttr !== null) parts.push([0.1, 100 - Math.min((ttr / 30) * 100, 100)]);

  const weight = parts.reduce((t, [w]) => t + w, 0);
  const score = parts.reduce((t, [w, v]) => t + w * v, 0) / weight;
  return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}

function normalizeRunKpis(selectedRun, live) {
  const source = kpisOf(selectedRun, live);
  const rev = live?.scorecard?.revenue_at_risk;

  return {
    serviceLevel: kpiNum(source.onTimeFulfillment, source.onTimeFill),
    demandAtRisk: kpiNum(source.unitsAtRisk, source.lateFulfilledUnits, source.occurrenceUnfulfilledUnits),
    unfulfilledDemand: kpiNum(source.peakBacklog, source.peakBacklogUnits, source.backorderVolume, source.endingBacklogExposure),
    ttrDays: recoveryDays(live, source),
    revenueExposure: typeof rev === "number" ? rev : null,
  };
}

function MetricCard({ label, value }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: "rgba(94,234,212,0.12)",
        background: "linear-gradient(145deg, rgba(17,24,39,0.96), rgba(30,41,59,0.92))",
        boxShadow: "0 12px 28px rgba(2,6,23,0.28)",
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
        {label}
      </div>
      <div className="text-[2rem] font-semibold text-white tracking-tight">
        {value}
      </div>
    </div>
  );
}

export default function Reports(props) {
  const {
    simulationHistory = [],
    switchView,
    apiBase = "https://supply-chain-simulator-v2.onrender.com",
  } = props || {};

  const activeScenarioName = (() => {
    try {
      return localStorage.getItem("currentScenarioName") || "No active scenario";
    } catch {
      return "No active scenario";
    }
  })();

  const runs = useMemo(() => normalizeRuns(simulationHistory), [simulationHistory]);

  const [selectedRunId, setSelectedRunId] = useState("");

  useEffect(() => {
    if (!runs.length) {
      setSelectedRunId("");
      return;
    }

    const stillExists = runs.some((run) => run.runId === selectedRunId);
    if (!selectedRunId || !stillExists) {
      setSelectedRunId(runs[0].runId);
    }
  }, [runs, selectedRunId]);

  const selectedRun = useMemo(() => {
    return runs.find((run) => run.runId === selectedRunId) || null;
  }, [runs, selectedRunId]);

  const [live, setLive] = useState(null);

  useEffect(() => {
    setLive(null);
    if (!selectedRunId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const res = await fetch(`${apiBase}/api/run-kpis/${encodeURIComponent(selectedRunId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && body?.scorecard?.ok) {
          setLive({ kpis: body.kpis || {}, scorecard: body.scorecard });
        }
      } catch {
        /* the report still renders from the stored run */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, apiBase]);

  const selectedRunReport = useMemo(() => {
    if (!selectedRun) return null;

    const base =
      normalizeExecutiveReport(selectedRun.report, selectedRun) || {
        title: selectedRun.label || "Run summary",
        subtitle: "Scorecard summary for this run. No written narrative was generated for it.",
        generatedAt: null,
        scenarioName: selectedRun.label || "",
        dateRangeStart: null,
        dateRangeEnd: null,
        sections: [],
        risks: [],
        actions: [],
      };
    const kpis = kpisOf(selectedRun, live);

    const onTimePct = kpiNum(kpis.onTimeFulfillment);
    const totalDemand = kpiNum(kpis.serviceTruth?.totalDemand);
    const peakBacklogUnits = kpiNum(kpis.peakBacklogUnits, kpis.peakBacklog);
    const backlogRatePct =
      totalDemand !== null && totalDemand > 0 && peakBacklogUnits !== null
        ? (peakBacklogUnits / totalDemand) * 100
        : null;
    const frontendBbi = computeFrontendBbi(selectedRun, live);

    const rewriteText = (text) => {
      if (!text || typeof text !== "string") return text;
      let out = text;
      if (frontendBbi !== null) {
        out = out.replace(/Network Resilience Score \(NRS\) \d+(\.\d+)?\/100/gi, `BBI Interpretation ${frontendBbi}/100`);
        out = out.replace(/Network Resilience Score:\s*\d+(\.\d+)?\/100/gi, `Network Resilience Score: ${frontendBbi}/100`);
        out = out.replace(/BBI \d+(\.\d+)?\/100/gi, `BBI ${frontendBbi}/100`);
      }
      if (onTimePct !== null) {
        out = out.replace(/On-time fulfillment:\s*\d+(\.\d+)?%/gi, `On-time fulfillment: ${onTimePct.toFixed(1)}%`);
      }
      if (backlogRatePct !== null) {
        out = out.replace(/Backorder rate:\s*\d+(\.\d+)?%/gi, `Backorder rate: ${backlogRatePct.toFixed(1)}%`);
      }
      return out;
    };

    return {
      ...base,
      title: rewriteText(base.title),
      subtitle: rewriteText(base.subtitle),
      summary: rewriteText(base.summary),
      sections: Array.isArray(base.sections)
        ? base.sections.map((section) => ({
            ...section,
            title: rewriteText(section.title),
            body: rewriteText(section.body),
          }))
        : base.sections,
    };
  }, [selectedRun, live]);

  const selectedRunKpis = useMemo(() => {
    if (!selectedRun) return null;
    return normalizeRunKpis(selectedRun, live);
  }, [selectedRun, live]);

  const selectedRunBbi = useMemo(() => {
    if (!selectedRun) return null;
    return computeFrontendBbi(selectedRun, live);
  }, [selectedRun, live]);

  const selectedRunBbiTone = useMemo(() => {
    return getBbiTone(selectedRunBbi);
  }, [selectedRunBbi]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="w-full border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            <span className="text-emerald-400">FOR-C</span>{" "}
            <span className="text-white">Executive Reports</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Review simulation outcomes, KPIs, and recommended actions
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => switchView && switchView("control")}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:border-emerald-400/40 hover:text-emerald-300 transition"
          >
            ← Back to Control Tower
          </button>

          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.reload();
            }}
            className="px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div
      className="w-full text-white rounded-[32px] p-2 md:p-3"
      style={{
        background: "linear-gradient(180deg, rgba(241,245,249,0.22), rgba(226,232,240,0.10))",
      }}
    >
      <div className="mb-5 rounded-3xl border px-5 py-4"
        style={{
          borderColor: "rgba(94,234,212,0.14)",
          background: "linear-gradient(145deg, rgba(15,23,42,0.94), rgba(30,41,59,0.88))",
          boxShadow: "0 18px 40px rgba(2,6,23,0.24)",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-300/90 mb-2">
          Executive Reporting
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Executive Reports
        </h1>
        <p className="text-sm md:text-base text-slate-300 mt-3 max-w-3xl leading-6">
          Select a simulation run and review its executive decision summary, KPI snapshot, and recommended actions.
        </p>
      </div>

      {!runs.length ? (
        <div
          className="rounded-3xl border p-8"
          style={{
            borderColor: "rgba(148,163,184,0.18)",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.78), rgba(15,23,42,0.58))",
            boxShadow: "0 12px 36px rgba(2,6,23,0.28)",
          }}
        >
          <p className="text-lg font-medium text-white">No simulation runs found</p>
          <p className="text-sm text-slate-300 mt-1">
            Run a simulation first, then return here to review its executive report.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-3 items-start">
          <aside
            className="rounded-3xl border border-white/10 px-4 py-3 h-fit lg:sticky lg:top-4 self-start max-h-[calc(100vh-96px)] overflow-y-auto"
            style={{
              borderColor: "rgba(148,163,184,0.18)",
              background:
                "linear-gradient(145deg, rgba(17,24,39,0.96), rgba(30,41,59,0.92))",
              boxShadow: "0 18px 42px rgba(2,6,23,0.34)",
            }}
          >
            <div className="mb-3">
              <h2 className="text-sm uppercase tracking-[0.22em] text-slate-400">
                Simulation Runs
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {runs.length} total
              </p>
            </div>

            <div className="space-y-3">
              {runs.map((run, index) => {
                const isActive = run.runId === selectedRunId;
                const hasReport = !!run.report;

                return (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => setSelectedRunId(run.runId)}
                    className="w-full text-left rounded-2xl border border-white/10 px-4 py-3 transition"
                    style={{
                      borderColor: isActive
                        ? "rgba(52,211,153,0.55)"
                        : "rgba(148,163,184,0.12)",
                      background: isActive
                        ? "linear-gradient(145deg, rgba(6,78,59,0.34), rgba(15,23,42,0.92))"
                        : "linear-gradient(145deg, rgba(30,41,59,0.88), rgba(15,23,42,0.82))",
                      boxShadow: isActive
                        ? "0 14px 28px rgba(16,185,129,0.16)"
                        : "0 8px 18px rgba(2,6,23,0.18)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {run.label}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDateTime(run.createdAt)}
                        </p>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasReport ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                          Report ready
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-500/15 text-slate-300 border border-slate-400/20">
                          Scorecard only
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section
            className="rounded-3xl border border-white/10 px-4 py-3 md:p-5"
            style={{
              borderColor: "rgba(94,234,212,0.14)",
              background:
                "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,41,59,0.94))",
              boxShadow: "0 20px 48px rgba(2,6,23,0.36)",
            }}
          >
            {selectedRun && (
              <>
                <div
                  className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-3 rounded-2xl border border-white/10 px-4 py-3"
                  style={{
                    borderColor: "rgba(94,234,212,0.12)",
                    background: "linear-gradient(145deg, rgba(15,23,42,0.55), rgba(30,41,59,0.36))",
                  }}
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-300 mb-2">
                      Selected Run
                    </div>
                    <h2 className="text-3xl font-semibold text-white">
                      {selectedRun.label}
                    </h2>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-500">Run ID:</span>{" "}
                        <span className="break-all text-slate-100">{selectedRun.runId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Created:</span>{" "}
                        <span className="text-slate-100">{formatDateTime(selectedRun.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {!selectedRunReport ? (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6">
                    <p className="text-lg font-medium text-white">
                      No executive report attached to this run
                    </p>
                    <p className="text-sm text-slate-300 mt-2">
                      This view now only reads the report already attached to the run.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-2xl border px-4 py-3"
                          style={{
                            borderColor: "rgba(148,163,184,0.14)",
                            background: "linear-gradient(145deg, rgba(17,24,39,0.94), rgba(30,41,59,0.88))",
                            boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
                          }}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                            Executive Report
                          </p>
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedRunReport.title}
                          </h3>
                          {selectedRunReport.subtitle ? (
                            <p className="text-sm text-slate-300 mt-3 max-w-3xl leading-6">
                              {selectedRunReport.subtitle}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-sm text-slate-300 space-y-1">
                          <div>
                            <span className="text-slate-500">Scenario:</span>{" "}
                            {selectedRunReport.scenarioName || "—"}
                          </div>
                          <div>
                            <span className="text-slate-500">Generated:</span>{" "}
                            {formatDateTime(selectedRunReport.generatedAt)}
                          </div>
                          <div>
                            <span className="text-slate-500">Window:</span>{" "}
                            {formatDateOnly(selectedRunReport.dateRangeStart)} -{" "}
                            {formatDateOnly(selectedRunReport.dateRangeEnd)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-2xl border border-white/10 px-4 py-3 mb-3"
                      style={{
                        borderColor: selectedRunBbiTone.borderColor,
                        background: selectedRunBbiTone.background,
                        boxShadow: selectedRunBbiTone.shadow,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                          Network Resilience Score
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full ${selectedRunBbiTone.badgeClass}`}>
                          {selectedRunBbiTone.label}
                        </span>
                      </div>
                      <div className={`text-6xl font-semibold tracking-tight ${selectedRunBbiTone.valueClass}`}>
                        {selectedRunBbi !== null && selectedRunBbi !== undefined ? `${selectedRunBbi}/100` : "n/a"}
                      </div>
                      <div className="text-sm text-slate-300 mt-2">
                        Derived from service level, backlog severity, missed service days, and TTR.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                      <MetricCard
                        label="Service Level"
                        value={formatPercent(selectedRunKpis?.serviceLevel)}
                        valueClassName={getKpiValueClass("serviceLevel", selectedRunKpis?.serviceLevel)}
                      />
                      <MetricCard
                        label="Demand at Risk"
                        value={formatNumber(selectedRunKpis?.demandAtRisk)}
                        valueClassName={getKpiValueClass("demandAtRisk", selectedRunKpis?.demandAtRisk)}
                      />
                      <MetricCard
                        label="Unfulfilled Demand"
                        value={formatNumber(selectedRunKpis?.unfulfilledDemand)}
                        valueClassName={getKpiValueClass("unfulfilledDemand", selectedRunKpis?.unfulfilledDemand)}
                      />
                      <MetricCard
                        label="TTR"
                        value={
                          selectedRunKpis?.ttrDays === Infinity
                            ? "Not recovered"
                            : typeof selectedRunKpis?.ttrDays === "number"
                              ? `${formatNumber(selectedRunKpis.ttrDays)} days`
                              : "n/a"
                        }
                        valueClassName={getKpiValueClass("ttrDays", selectedRunKpis?.ttrDays)}
                      />
                      <MetricCard
                        label="Revenue at Risk"
                        value={formatCurrency(selectedRunKpis?.revenueExposure)}
                        valueClassName={getKpiValueClass("revenueExposure", selectedRunKpis?.revenueExposure)}
                      />
                    </div>

                    {selectedRunReport.sections?.length ? (
                      <div className="space-y-4">
                        {selectedRunReport.sections.map((section) => (
                          <div
                            key={section.id}
                            className="rounded-2xl border p-5"
                          style={{
                            borderColor: "rgba(148,163,184,0.14)",
                            background: "linear-gradient(145deg, rgba(17,24,39,0.94), rgba(30,41,59,0.88))",
                            boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
                          }}
                          >
                            <h4 className="text-lg font-semibold text-white mb-3">
                              {section.title}
                            </h4>

                            {section.body ? (
                              <p className="text-sm text-slate-300 leading-6">
                                {section.body}
                              </p>
                            ) : null}

                            {section.bullets?.length ? (
                              <ul className="mt-4 space-y-2 text-sm text-slate-300 list-disc pl-5">
                                {section.bullets.map((bullet, idx) => (
                                  <li key={`${section.id}-bullet-${idx}`}>{String(bullet)}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {(selectedRunReport.risks?.length || selectedRunReport.actions?.length) ? (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <div className="rounded-2xl border p-5"
                          style={{
                            borderColor: "rgba(148,163,184,0.14)",
                            background: "linear-gradient(145deg, rgba(17,24,39,0.94), rgba(30,41,59,0.88))",
                            boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
                          }}>
                          <h4 className="text-lg font-semibold text-white mb-3">
                            Key Risks
                          </h4>
                          {selectedRunReport.risks?.length ? (
                            <ul className="space-y-2 text-sm text-slate-300 list-disc pl-5">
                              {selectedRunReport.risks.map((item, idx) => (
                                <li key={`risk-${idx}`}>{String(item)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-400">No risks listed.</p>
                          )}
                        </div>

                        <div className="rounded-2xl border p-5"
                          style={{
                            borderColor: "rgba(148,163,184,0.14)",
                            background: "linear-gradient(145deg, rgba(17,24,39,0.94), rgba(30,41,59,0.88))",
                            boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
                          }}>
                          <h4 className="text-lg font-semibold text-white mb-3">
                            Recommended Actions
                          </h4>
                          {selectedRunReport.actions?.length ? (
                            <ul className="space-y-2 text-sm text-slate-300 list-disc pl-5">
                              {selectedRunReport.actions.map((item, idx) => (
                                <li key={`action-${idx}`}>{String(item)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-400">No actions listed.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* PDF Download Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

                            // Fetch countermeasures CSV
                            let countermeasures = [];
                            const cmUrl = selectedRun?.raw?.countermeasures || selectedRun?.raw?.countermeasures_output_file_url;
                            if (cmUrl) {
                              try {
                                const cmRes = await fetch(cmUrl);
                                const cmText = await cmRes.text();
                                const lines = cmText.trim().split("\n");
                                const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
                                countermeasures = lines.slice(1, 6).map(line => {
                                  const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
                                  const obj = {};
                                  headers.forEach((h, i) => obj[h] = vals[i] || "");
                                  return obj;
                                });
                              } catch (e) {
                                console.warn("Countermeasures fetch failed:", e);
                              }
                            }

                            const res = await fetch(`${apiBase}/api/report/generate`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({
                                scenario: selectedRun?.label || activeScenarioName || "Simulation",
                                aiNarrative: (() => {
                                  const k = selectedRunKpis || {};
                                  if (typeof k.serviceLevel !== "number") {
                                    return selectedRunReport?.sections?.find((s) => s.id === "overview")?.body || "";
                                  }
                                  let t = `This simulation run shows on-time service at ${k.serviceLevel.toFixed(1)}%`;
                                  if (typeof k.unfulfilledDemand === "number") t += `, with a peak backlog of ${k.unfulfilledDemand.toLocaleString()} units`;
                                  if (typeof k.revenueExposure === "number") t += ` and revenue at risk of $${Math.round(k.revenueExposure).toLocaleString()}`;
                                  t += ".";
                                  if (k.ttrDays === Infinity) t += " The network does not fully recover within the simulation window.";
                                  else if (typeof k.ttrDays === "number") t += ` Full network recovery is projected at ${k.ttrDays} days.`;
                                  return t;
                                })(),
                                kpis: {
                                  serviceLevelPct: selectedRunKpis?.serviceLevel ?? 0,
                                  peakBacklogUnits: selectedRunKpis?.unfulfilledDemand ?? 0,
                                  timeToRecoverDays: Number.isFinite(selectedRunKpis?.ttrDays) ? selectedRunKpis.ttrDays : null,
                                  notRecovered: selectedRunKpis?.ttrDays === Infinity,
                                  timeToSurviveDays: selectedRunKpis?.ttsDays ?? kpisOf(selectedRun, live)?.ttsDays ?? null,
                                  demandAtRiskUnits: selectedRunKpis?.demandAtRisk ?? 0,
                                  revenueExposure: selectedRunKpis?.revenueExposure ?? null,
                                  worstWeeklyServicePct: kpiNum(kpisOf(selectedRun, live)?.worstWeeklyServicePct),
                                  falseConfidenceDays: kpiNum(kpisOf(selectedRun, live)?.falseConfidenceDays),
                                },
                                disruptionSignals: {
                                  facilitiesImpacted: kpisOf(selectedRun, live)?.impactedFacilities ?? null,
                                  highRiskSkuCount: null,
                                  occurrenceCount: kpisOf(selectedRun, live)?.occurrenceCount ?? null,
                                  revenueExposure: selectedRunKpis?.revenueExposure ?? null,
                                  severityMix: {},
                                  highRiskSkus: [],
                                },
                              countermeasures,
                                generatedLocal: new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }),
                                generatedDateLocal: new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
                                revenueBasis: live?.scorecard?.revenue_basis || "",
                                runMetadata: {
                                  runId: selectedRun?.runId || "",
                                  timestamp: selectedRun?.createdAt || "",
                                  timestampLocal: selectedRun?.createdAt ? formatDateTime(selectedRun.createdAt) : "",
                                },
                              }),
                            });
                            if (!res.ok) throw new Error("PDF generation failed");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `forc_report_${Date.now()}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (e) {
                            console.error("PDF failed:", e);
                            alert("PDF generation failed. Check console.");
                          }
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition"
                        style={{ background: "linear-gradient(90deg, #9CF700, #22c55e)", color: "#020617" }}
                      >
                        📄 Download PDF Report
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      </div>
    </div>
  );
}
