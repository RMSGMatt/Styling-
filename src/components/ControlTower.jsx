import React, { useEffect, useMemo, useState } from "react";
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
import RiskIntelligenceView from "./ControlTowerEhancements/RiskIntelligence/RiskIntelligenceView";
import { useRiskTriggers } from "./ControlTowerEhancements/RiskIntelligence/useRiskTriggers";
import { SCENARIO_CONFIG } from "./ControlTowerEhancements/RiskIntelligence/scenarioConfig";
import { getApiBase } from "../config/apiBase";
import IngestKeysCard from "./ControlTowerEhancements/IngestKeysCard";
import PartsAtRiskCard from "./ControlTowerEhancements/PartsAtRiskCard";
import SafetyStockView from "./ControlTowerEhancements/SafetyStock/SafetyStockView";
import { useSafetyStockAlerts } from "./ControlTowerEhancements/SafetyStock/useSafetyStockAlerts";

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
        border: "1px solid rgba(159,214,58,0.2)",
        borderRadius: 18,
        padding: 18,
        background: "rgba(9,25,19,0.6)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#E2E8F0" }}>
        🔒 Simulation Repository is Pro+
      </div>
      <div style={{ color: "#94A3B8", lineHeight: 1.4, marginBottom: 12 }}>
        Upgrade to view past runs, download outputs, and access reporting features.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onUpgrade}
          style={{
            background: "linear-gradient(90deg,#9CF700,#22c55e)",
            color: "#020617",
            border: "none",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Upgrade to Pro →
        </button>
        <button
          onClick={onUpgrade}
          style={{
            background: "transparent",
            color: "#9FD63A",
            border: "1px solid rgba(159,214,58,0.35)",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          See plans
        </button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#64748B" }}>
        Current plan: <b style={{ color: "#94A3B8" }}>{normalizePlan(plan) || "free"}</b>
      </div>
    </div>
  );
}

const GLOBAL_LOCATIONS_URL =
  "https://supply-chain-simulation-files.s3.us-east-2.amazonaws.com/locations.csv";

function KpiCard({ value, label, risk, trend, deltaText }) {
  const trendLabels = { up: "Better", down: "Worse", neutral: "Flat" };
  const trendColors = {
    up: "bg-emerald-500/15 text-emerald-300",
    down: "bg-amber-500/15 text-amber-300",
    neutral: "bg-slate-500/15 text-slate-300",
  };
  const accentColor = risk === "high" ? "#EF4444" : risk === "medium" ? "#F59E0B" : "#9FD63A";

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
      className="relative overflow-hidden rounded-2xl border p-3.5 transition duration-200 ease-in-out transform hover:-translate-y-1"
      style={{ background: "linear-gradient(145deg, rgba(13,31,24,0.85), rgba(6,37,26,0.75))", borderColor: "rgba(148,163,184,0.15)" }}
      title={`${label} - Click for details`}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accentColor }} />
      <div className="text-[2.25rem] leading-none font-extrabold" style={{ color: "#E2E8F0" }} title={`Current value: ${value}`}>
        {value}
      </div>
      <div className="text-[13px] flex items-center gap-1 mt-1" style={{ color: "#94A3B8" }} title={`Metric: ${label}`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {deltaText && (
        <div className="mt-1.5 text-[11px] font-medium" style={{ color: "#64748B" }}>{deltaText}</div>
      )}
      {trend && trendColors[trend] && (
        <div
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${trendColors[trend]}`}
          title={`Trend: ${trendLabels[trend]}`}
        >
          {trendLabels[trend]}
        </div>
      )}
      {risk === "high" && (
        <div className="absolute top-8 right-2 text-red-400 animate-pulse" title="High Risk KPI">
          ⚠️
        </div>
      )}
    </div>
  );
}

const SITE_TYPE_LABEL = { supplier: "Supplier site", plant: "Plant", dc: "Distribution center", customer: "Customer site" };

function FacilityDrawer({ facility, snapshot, exposure, risk, siteParts, onOpenRisk, onSimulate, onClose }) {
  const name = String(facility || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const siteInfo = (exposure?.sites || []).find((x) => x.name === facility);
  const exps = (exposure?.exposures || []).filter((e) => e.site === facility);
  const fStat = snapshot?.sites?.facilities?.[facility];
  const sStat = snapshot?.sites?.suppliers?.[facility];
  const pastDue = Number(fStat?.past_due_units || 0);
  const overduePos = Number(sStat?.overdue_pos || 0);
  const hasData = !!snapshot;
  const siteRisk = (risk?.sites || []).find((x) => x.name === facility);
  const countryRisk = siteRisk ? (risk?.countries || []).find((x) => x.code === siteRisk.code) : null;
  let status = "No data for this site yet", statusColor = "#64748B";
  if (exps.length) { status = "Exposed to a live hazard"; statusColor = exps.some((e) => e.severity === "high") ? "#EF4444" : "#F59E0B"; }
  else if (pastDue > 0 || overduePos > 0) { status = "Open issues in your data"; statusColor = "#F59E0B"; }
  else if (hasData) { status = "No open issues in your data"; statusColor = "#1D625B"; }
  const isSupplier = siteInfo?.type === "supplier";
  const tiles = [
    ...(isSupplier ? [] : [
      { label: "Past-due units", value: fStat ? Math.round(pastDue).toLocaleString("en-US") : "–" },
      { label: "Late order lines", value: fStat ? Number(fStat.late_lines || 0).toLocaleString("en-US") : "–" },
    ]),
    ...(isSupplier ? [{ label: "Overdue supplier POs", value: sStat ? overduePos : "–" }] : []),
    { label: "Live hazards in range", value: exposure?.status === "ok" ? exps.length : "–" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="relative w-full max-w-md h-full flex flex-col" style={{ background: "#0B1512" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-start justify-between" style={{ background: "#0a2e22", borderColor: "#143629" }}>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#9FD63A" }}>Site detail</p>
            <h2 className="text-lg font-bold text-white">{name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{SITE_TYPE_LABEL[siteInfo?.type] || "Site"}{hasData && snapshot.source === "sample" ? " in the example network" : ""}</p>
          </div>
          <button onClick={onClose} className="mt-1 text-xl leading-none transition" style={{ color: "#64748B" }}>×</button>
        </div>

        <div className="px-6 py-3 flex items-center gap-2 border-b" style={{ background: "rgba(9,25,19,0.6)", borderColor: "#143629" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
          <span className="text-sm font-semibold" style={{ color: statusColor }}>{status}</span>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b" style={{ borderColor: "#143629" }}>
          {tiles.map((kpi) => (
            <div key={kpi.label} className="rounded-xl p-3" style={{ background: "rgba(9,25,19,0.5)" }}>
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#64748B" }}>{kpi.label}</div>
              <div className="text-lg font-extrabold" style={{ color: "#9FD63A" }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          {!hasData && (
            <p className="text-sm" style={{ color: "#94A3B8" }}>Add your orders, purchase orders and inventory on the Control Tower to see operational figures for this site.</p>
          )}
          {siteRisk && countryRisk && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(9,25,19,0.5)", border: "1px solid rgba(148,163,184,0.2)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: riskTone(siteRisk.country_score) }}>
                Country risk: {siteRisk.country} {siteRisk.country_score} ({siteRisk.country_label.toLowerCase()}) <span style={{ color: "#FCD34D" }}>AI-assessed</span>
              </p>
              {countryRisk.top_factor && <p className="text-xs" style={{ color: "#94A3B8" }}>Biggest driver: {FACTOR_LABEL[countryRisk.top_factor] || countryRisk.top_factor}. {countryRisk.reason}</p>}
              {countryRisk.summary && <p className="text-sm mt-2" style={{ color: "#e2e8e0" }}>{countryRisk.summary}</p>}
              {siteRisk.advisory_level >= 3 && <p className="text-xs mt-2" style={{ color: "#FCA5A5" }}>{countryRisk.advisory_label}</p>}
              {siteRisk.uflpa_flagged && <p className="text-xs mt-1" style={{ color: "#FCA5A5" }}>Name matches the UFLPA entity list.</p>}
              {onOpenRisk && <button type="button" onClick={() => { onOpenRisk(); onClose(); }} className="mt-3 text-xs underline" style={{ color: "#9FD63A" }}>Open in Risk Intelligence</button>}
            </div>
          )}
          {(siteParts || []).length > 0 && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(9,25,19,0.5)", border: "1px solid rgba(148,163,184,0.2)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#94A3B8" }}>Thin parts on at-risk commodities</p>
              <ul className="space-y-1.5">
                {siteParts.slice(0, 6).map((p) => (
                  <li key={p.sku} className="flex items-center gap-2 text-sm" style={{ color: "#E2E8F0" }}>
                    <span className="text-xs font-bold rounded-md px-1.5 py-0.5" style={{ background: "rgba(239,68,68,0.12)", color: p.below_safety || (p.days_cover != null && p.days_cover < 7) ? "#EF4444" : "#F59E0B" }}>{p.days_cover != null ? `${p.days_cover}d` : "n/a"}</span>
                    <span className="flex-1 min-w-0 truncate">{p.sku.replace(/_/g, " ")}{p.below_safety ? " (below safety)" : ""}</span>
                    <span className="text-xs rounded-md px-1.5 py-0.5 border shrink-0" style={{ color: p.color, borderColor: `${p.color}66` }} title={p.commodity_label}>{p.score}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] mt-2" style={{ color: "#64748B" }}>{siteParts[0].commodity_label} and other tracked commodities, from Risk Intelligence.</p>
            </div>
          )}
          {exps.map((e, i) => (
            <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#0d3d2e", border: "1px solid rgba(159,214,58,0.2)" }}>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: e.severity === "high" ? "#EF4444" : "#F59E0B" }}>
                {e.hazard_label}{e.example ? " (example)" : ""}
              </p>
              <p className="text-sm" style={{ color: "#e2e8e0" }}>{e.title}</p>
              <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{e.distance_km} km away, inside the {e.radius_km} km alert radius.</p>
              <button
                onClick={() => { onSimulate && onSimulate(e); onClose(); }}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "#9FD63A", color: "#0B1512" }}
              >
                Simulate this exposure →
              </button>
            </div>
          ))}
          {hasData && exposure?.status === "ok" && exps.length === 0 && (
            <p className="text-sm" style={{ color: "#94A3B8" }}>No live hazard is within range of this site right now.</p>
          )}
        </div>

        <div className="px-6 py-4 border-t" style={{ borderColor: "#143629" }}>
          <button onClick={onClose} className="w-full py-2 rounded-xl text-sm font-semibold border transition" style={{ borderColor: "#355e52", color: "#94A3B8", background: "rgba(2,6,23,0.45)" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function deriveAlerts(kpis) {
  if (!kpis) return [];
  const alerts = [];
  const svc = parseFloat(kpis.serviceLevel);
  const backorders = parseInt(kpis.backorders?.replace(/,/g, ""));
  const revenue = parseFloat(kpis.revenueAtRisk?.replace(/[$M]/g, ""));
  const incidents = parseInt(kpis.activeIncidents);

  if (svc < 94) alerts.push({ id: "svc-escalate", level: "escalate", kpi: "Service Level", value: kpis.serviceLevel, action: "Escalate to VP Ops — contractual SLA breach imminent." });
  else if (svc < 96) alerts.push({ id: "svc-act", level: "act", kpi: "Service Level", value: kpis.serviceLevel, action: "Review top 5 backorder SKUs and authorize expedite freight." });
  else if (svc < 97) alerts.push({ id: "svc-watch", level: "watch", kpi: "Service Level", value: kpis.serviceLevel, action: "Monitor daily — trending toward threshold." });

  if (backorders > 1500) alerts.push({ id: "bo-escalate", level: "escalate", kpi: "Backorders", value: kpis.backorders, action: "Escalate: backlog at risk of customer cancellations." });
  else if (backorders > 1000) alerts.push({ id: "bo-act", level: "act", kpi: "Backorders", value: kpis.backorders, action: "Authorize overtime or premium freight to clear backlog within 48hrs." });
  else if (backorders > 800) alerts.push({ id: "bo-watch", level: "watch", kpi: "Backorders", value: kpis.backorders, action: "Watch — backlog building toward action threshold." });

  if (revenue > 5) alerts.push({ id: "rev-escalate", level: "escalate", kpi: "Revenue at Risk", value: kpis.revenueAtRisk, action: "Escalate to CFO — exposure exceeds $5M threshold." });
  else if (revenue > 4) alerts.push({ id: "rev-act", level: "act", kpi: "Revenue at Risk", value: kpis.revenueAtRisk, action: "Identify top exposed customer accounts and initiate triage." });
  else if (revenue > 3) alerts.push({ id: "rev-watch", level: "watch", kpi: "Revenue at Risk", value: kpis.revenueAtRisk, action: "Watch — revenue exposure trending upward." });

  if (incidents > 150) alerts.push({ id: "inc-escalate", level: "escalate", kpi: "Active Incidents", value: kpis.activeIncidents, action: "Escalate: incident volume indicates systemic network stress." });
  else if (incidents > 120) alerts.push({ id: "inc-act", level: "act", kpi: "Active Incidents", value: kpis.activeIncidents, action: "Assign incident owners and set 24hr resolution targets." });
  else if (incidents > 100) alerts.push({ id: "inc-watch", level: "watch", kpi: "Active Incidents", value: kpis.activeIncidents, action: "Watch — incident count above normal baseline." });

  return alerts;
}

const ALERT_CONFIG = {
  watch:    { color: "#FCD34D", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)", icon: "🟡", label: "WATCH" },
  act:      { color: "#FCA5A5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", icon: "🔴", label: "ACT" },
  escalate: { color: "#fff",    bg: "#7f1d1d", border: "#ef4444", icon: "🚨", label: "ESCALATE" },
};

// ── KPI severity color lookup ────────────────────────────────────────────────
// Network Health Summary's KPI numbers used to have fixed colors (Service
// Level always lime, Revenue always amber, etc.) regardless of the actual
// value — which meant a KPI could read as "fine" in green right above the
// exact same KPI flagged WATCH/ACT in the unified attention panel below it.
// This derives the color from deriveAlerts() — the same function the
// attention panel uses — so both surfaces always agree by construction
// instead of by two people independently picking colors that could drift.
// Prefix matches deriveAlerts()'s own id convention (svc-/bo-/rev-/inc-).
function kpiSeverityColor(kpis, idPrefix) {
  const match = deriveAlerts(kpis).find((a) => a.id.startsWith(idPrefix));
  return match ? ALERT_CONFIG[match.level].color : "#9FD63A"; // no alert = nominal, brand lime
}

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedAttentionPanel
// Replaces what were three separate surfaces — the AI narrative paragraph,
// the KPI-derived AlertStrip, and Risk Intelligence's trigger banner — with
// one panel, one severity vocabulary (reusing ALERT_CONFIG's existing
// watch/act/escalate tiers), and one dismiss/collapse state.
//
// Real constraint worth being explicit about: the narrative paragraph itself
// (ctNarrative) is generated server-side from businessKpis alone via
// POST /api/control-tower/narrative — it cannot be made to also reference
// Risk Intelligence signals without a backend/prompt change. What's unified
// here is everything on the frontend: the discrete alert list below the
// narrative now merges both KPI-derived alerts and forward-looking risk
// triggers into one sorted, source-tagged list instead of two separately
// styled ones.
//
// Severity mapping for risk triggers, since evaluateTriggers() only has two
// non-nominal states: "triggered" -> ACT (actionable now), "watch"/Building
// -> WATCH (early signal). Neither maps to ESCALATE — that tier is currently
// KPI-only, since the risk engine has no "worse than triggered" state.
// ─────────────────────────────────────────────────────────────────────────────
const SEVERITY_ORDER = { escalate: 0, act: 1, watch: 2 };

function UnifiedAttentionPanel({ kpis, alertsOverride, hasKpiData, ctNarrative, narrativeLoading, onOpenRiskIntelligence, onOpenSafetyStock }) {
  const [dismissed, setDismissed] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const { triggers } = useRiskTriggers();
  const { alerts: safetyStockAlerts } = useSafetyStockAlerts();

  const kpiItems = (alertsOverride || deriveAlerts(kpis)).map((a) => ({
    id: `kpi:${a.id}`,
    severity: a.level,
    title: `${a.kpi}: ${a.value}`,
    detail: a.action,
    sourceTag: "Business KPI",
    sourceMock: false,
    onReview: null,
  }));

  const riskItems = triggers
    .map((t) => {
      const config = SCENARIO_CONFIG[t.scenario];
      if (!config) return null;
      return {
        id: `risk:${t.commodity}:${t.scenario}`,
        severity: t.status === "triggered" ? "act" : "watch",
        title: `${config.icon} ${config.label}`,
        detail: config.description,
        sourceTag: "Risk Signal",
        sourceMock: t.source === "mock",
        onReview: () => onOpenRiskIntelligence && onOpenRiskIntelligence({ commodity: t.commodity }),
      };
    })
    .filter(Boolean);

  // Note: sourceMock is deliberately false here even though the data comes
  // from a manual CSV upload. sourceMock drives the "SAMPLE" disclosure,
  // which means "this is placeholder/demo data, don't trust it as real" —
  // that's true of Risk Intelligence's USE_MOCK_DATA signals, but not true
  // here. A user's uploaded inventory CSV is real data, just not
  // continuously synced. The "· CSV" vs "· Live" suffix communicates
  // freshness/method without implying it's fabricated.
  const safetyStockItems = safetyStockAlerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    title: `${a.facility} · ${a.sku}`,
    detail: a.belowFloor
      ? `DOH ${a.current_doh.toFixed(1)} below floor of ${a.floor}${a.dropPct ? ` (down ${a.dropPct.toFixed(0)}% since last snapshot)` : ""}`
      : `DOH down ${a.dropPct.toFixed(0)}% since last snapshot (floor: ${a.floor})`,
    sourceTag: a.source === "csv_upload" ? "Safety Stock · CSV" : "Safety Stock · Live",
    sourceMock: false,
    onReview: () => onOpenSafetyStock && onOpenSafetyStock(),
  }));

  const items = [...kpiItems, ...riskItems, ...safetyStockItems]
    .filter((item) => !dismissed.includes(item.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const escalateCount = items.filter((i) => i.severity === "escalate").length;
  const actCount = items.filter((i) => i.severity === "act").length;
  const watchCount = items.filter((i) => i.severity === "watch").length;
  const anyMock = items.some((i) => i.sourceMock);
  const hasNarrative = Boolean(ctNarrative || narrativeLoading);

  if (items.length === 0 && !hasNarrative) {
    return (
      <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-sm" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
        <span>✅</span>
        <span className="font-medium" style={{ color: "#86efac" }}>{hasKpiData ? "All KPIs and risk signals within normal thresholds" : "No active alerts. Connect your network data to monitor KPIs."}</span>
      </div>
    );
  }

  // Summary line — highest severity present drives the header color/label.
  const topSeverity = escalateCount > 0 ? "escalate" : actCount > 0 ? "act" : "watch";
  const topCfg = ALERT_CONFIG[topSeverity];
  const summaryParts = [];
  if (escalateCount) summaryParts.push(`${escalateCount} escalate`);
  if (actCount) summaryParts.push(`${actCount} act`);
  if (watchCount) summaryParts.push(`${watchCount} watch`);

  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: "#0d3d2e", border: "1px solid rgba(159,214,58,0.2)" }}>
      {/* Narrative headline — server-generated from business KPIs */}
      {hasNarrative && (
        <div id="tour-narrative" className="px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: "#0B0F13", border: "1px solid rgba(159,214,58,0.5)" }}
              title="FOR-C Network Intelligence"
            >
              {/* Custom brain icon — an emoji glyph here rendered as an
                  illegible pink blob depending on the OS/browser's emoji
                  font. This is a simplified two-hemisphere outline (fold
                  detail dropped — it just reads as noise at this size) in
                  the Heroicons stroke style already used elsewhere, on a
                  dark badge for contrast against the card's green background. */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#9FD63A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="21" height="21">
                <path d="M9.5 4.5c-1.8 0-3.2 1.3-3.4 3-1.5.4-2.6 1.8-2.6 3.4 0 .9.4 1.8 1 2.4-.3.5-.5 1.1-.5 1.7 0 1.9 1.5 3.4 3.4 3.5.4 1.3 1.6 2.3 3.1 2.3.6 0 1.1-.1 1.5-.4V6.5C11.3 5.3 10.5 4.5 9.5 4.5Z" />
                <path d="M14.5 4.5c1.8 0 3.2 1.3 3.4 3 1.5.4 2.6 1.8 2.6 3.4 0 .9-.4 1.8-1 2.4.3.5.5 1.1.5 1.7 0 1.9-1.5 3.4-3.4 3.5-.4 1.3-1.6 2.3-3.1 2.3-.6 0-1.1-.1-1.5-.4V6.5c0-1.2.8-2 1.5-2Z" />
                <path d="M12 6.5v14" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#9FD63A" }}>
                FOR-C Network Intelligence
              </p>
              {narrativeLoading ? (
                <p className="text-sm animate-pulse" style={{ color: "#e2e8e0" }}>Analyzing network conditions...</p>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: "#e2e8e0" }}>{ctNarrative}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merged alert list — collapsed to one summary row by default */}
      {items.length > 0 && (
        <div id="tour-alerts" style={{ borderTop: hasNarrative ? "1px solid rgba(159,214,58,0.15)" : "none" }}>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3"
            style={{ background: topCfg.bg, cursor: "pointer" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{topCfg.icon}</span>
              <span className="text-sm font-semibold truncate" style={{ color: topCfg.color }}>
                {summaryParts.join(" · ")} — {items.length} item{items.length > 1 ? "s" : ""} need review
              </span>
              {anyMock && (
                <span
                  className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "transparent", color: "#eab308", border: "1px solid rgba(234,179,8,0.5)" }}
                >
                  SAMPLE
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs" style={{ color: "#94A3B8" }}>
              {expanded ? "Hide ▲" : "Show ▼"}
            </span>
          </button>

          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              {items.map((item) => {
                const cfg = ALERT_CONFIG[item.severity];
                return (
                  <div
                    key={item.id}
                    className="rounded-xl px-4 py-3 flex items-start justify-between gap-3"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-base mt-0.5">{cfg.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[10px] font-bold tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: cfg.color, background: "rgba(255,255,255,0.06)" }}>
                            {item.sourceTag}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{item.title}</span>
                        </div>
                        <p className="text-xs" style={{ color: cfg.color }}>{item.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.onReview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            item.onReview();
                          }}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: "rgba(159,214,58,0.15)", color: "#9FD63A", border: "1px solid rgba(159,214,58,0.4)" }}
                        >
                          Review →
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissed((d) => [...d, item.id]);
                        }}
                        className="text-xs opacity-50 hover:opacity-100 shrink-0"
                        style={{ color: cfg.color, background: "none", border: "none", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TOUR_STEPS_CONTROL_TOWER = [
  {
    id: "map",
    title: "Your Network, Live",
    body: "Every facility in your supply chain plotted in real time. Click any pin to see its risk status, capacity, and recommended action.",
    target: "tour-map",
    position: "bottom",
  },
  {
    id: "ticker",
    title: "Live Intel Feed",
    body: "Real-time supply chain news filtered for relevance — tariffs, port disruptions, freight conditions. No manual monitoring needed.",
    target: "tour-ticker",
    position: "top",
  },
  {
    id: "alerts",
    title: "Automatic Exception Alerts",
    body: "FOR-C watches your KPIs and surfaces exceptions automatically. No threshold configuration required — just act on what matters.",
    target: "tour-alerts",
    position: "top",
  },
  {
    id: "narrative",
    title: "AI Decision Intelligence",
    body: "Not a summary — a decision prompt. FOR-C tells you what needs a human call right now and what's at stake if you wait.",
    target: "tour-narrative",
    position: "bottom",
  },
];

function OnboardingTour({ steps, onFinish, onSkip }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const current = steps[step];

  useEffect(() => {
    if (!current?.target) return;
    const el = document.getElementById(current.target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = el.getBoundingClientRect();
    const tooltipHeight = 160;
    const rawTop = current.position === "bottom"
      ? rect.bottom + window.scrollY + 12
      : rect.top + window.scrollY - tooltipHeight - 12;
    const maxTop = window.scrollY + window.innerHeight - tooltipHeight - 16;
    const top = Math.min(rawTop, maxTop);
    const left = Math.min(rect.left + window.scrollX, window.innerWidth - 340);
    setPos({ top, left: Math.max(left, 16) });

    el.style.outline = "2px solid #9FD63A";
    el.style.outlineOffset = "4px";
    el.style.borderRadius = "8px";
    return () => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    };
  }, [step, current]);

  return (
    <div
      className="fixed z-[100] w-80 rounded-2xl shadow-2xl p-5"
      style={{
        top: pos.top,
        left: pos.left,
        background: "#0a2e22",
        border: "1px solid rgba(159,214,58,0.4)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9FD63A" }}>
          FOR-C Tour · Step {step + 1} of {steps.length}
        </p>
        <button onClick={onSkip} className="text-gray-500 hover:text-white text-xs">Skip</button>
      </div>
      <h3 className="text-white font-bold text-sm mb-1">{current.title}</h3>
      <p className="text-gray-300 text-xs leading-relaxed mb-4">{current.body}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 disabled:opacity-30"
        >
          ← Back
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="text-xs px-4 py-1.5 rounded-lg font-bold"
            style={{ background: "#9FD63A", color: "#020617" }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={onFinish}
            className="text-xs px-4 py-1.5 rounded-lg font-bold"
            style={{ background: "#9FD63A", color: "#020617" }}
          >
            Done ✓
          </button>
        )}
      </div>
    </div>
  );
}

const SampleChip = () => (
  <span className="ml-2 align-middle rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap inline-block" style={{ borderColor: "rgba(245,158,11,0.5)", color: "#FCD34D", background: "rgba(245,158,11,0.1)" }}>SAMPLE DATA</span>
);

function friendlyName(raw) {
  const base = String(raw || "").split("@")[0].split(/[._-]+/).filter(Boolean)[0] || "";
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

const vcLong = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
function vcValue(v, unit, row) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const n = (x) => Math.round(Number(x) || 0).toLocaleString("en-US");
  switch (unit) {
    case "%": return `${Number(v).toFixed(Number(v) % 1 === 0 ? 0 : 1)}%`;
    case "days": return `${n(v)} days`;
    case "hours": return `${n(v)} hrs`;
    case "$": return `$${n(v)}`;
    case "count": return row?.of ? `${n(v)} of ${n(row.of)}` : n(v);
    default: return n(v);
  }
}
const VC_DOT = { good: "#34d399", watch: "#fbbf24", bad: "#fb7185", info: "#64748b", na: "#475569" };

// ── Network snapshot (the data behind the KPIs) ─────────────────────────────
const SNAP_COLOR = { good: "#9FD63A", watch: "#FCD34D", bad: "#FCA5A5", info: "#E2E8F0", na: "#E2E8F0" };
const SNAP_ACTIONS = {
  service_level: "Review the largest short orders and decide on expedites or allocation.",
  otif: "Find the late lines by customer and reset delivery commitments where needed.",
  backorder_units: "Clear the oldest and largest past-due lines first.",
  supplier_on_time: "Escalate with the late suppliers and confirm recovery dates.",
  supplier_lead_time: "Check whether lead times have moved and update planning parameters.",
  overdue_pos: "Chase the overdue purchase orders today.",
  supplier_on_time_request: "Compare promised dates with the dates you asked for and reset expectations with the suppliers that promise late.",
  premium_freight: "Review what drove the premium freight and whether an earlier order would have avoided it.",
  line_fill: "Look at which order lines are missing in full, even when unit volume looks fine.",
  min_days_of_supply: "Place or expedite orders for the lowest-cover parts first.",
  days_of_supply: "Review parts with the lowest cover and place or expedite orders.",
  below_safety: "Review the parts under safety stock and expedite replenishment.",
};
function snapFmt(v, unit) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  if (unit === "%") return `${Number(v).toFixed(1)}%`;
  if (unit === "days") return `${Number(v).toFixed(1)} days`;
  if (unit === "x") return `${Number(v).toFixed(1)}x`;
  if (unit === "$") return `$${Math.round(v).toLocaleString("en-US")}`;
  return Math.round(v).toLocaleString("en-US");
}
function snapDelta(k, windowDays) {
  if (k.delta === null || k.delta === undefined) return k.n ? `${k.n} ${k.n_unit || "records"}${k.low_volume ? " · low volume" : ""}` : "";
  const abs = Math.abs(k.delta);
  const mag = k.unit === "%" ? `${abs.toFixed(1)} pts` : k.unit === "days" ? `${abs.toFixed(1)} days` : k.unit === "x" ? `${abs.toFixed(1)}x` : k.unit === "$" ? `$${Math.round(abs).toLocaleString("en-US")}` : Math.round(abs).toLocaleString("en-US");
  const base = k.trend === "flat" ? `Flat vs previous ${windowDays} days` : `${k.delta > 0 ? "↑" : "↓"} ${mag} vs previous ${windowDays} days`;
  return `${base}${k.n ? ` · ${k.n} ${k.n_unit || "records"}` : ""}${k.low_volume ? " · low volume" : ""}`;
}
function snapshotAlerts(snap) {
  if (!snap?.kpis) return [];
  return snap.kpis
    .filter((k) => k.status === "bad" || k.status === "watch")
    .map((k) => ({
      id: `snap-${k.key}`,
      level: k.status === "bad" ? "act" : "watch",
      kpi: k.label,
      value: snapFmt(k.value, k.unit),
      action: SNAP_ACTIONS[k.key] || k.hint,
    }));
}
const SourceChip = ({ snapshot }) => {
  if (!snapshot) return null;
  const sample = snapshot.source === "sample";
  return (
    <span className="ml-2 align-middle rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap inline-block"
      style={sample ? { borderColor: "rgba(245,158,11,0.5)", color: "#FCD34D", background: "rgba(245,158,11,0.1)" } : { borderColor: "rgba(159,214,58,0.4)", color: "#9FD63A", background: "rgba(159,214,58,0.08)" }}>
      {sample ? "EXAMPLE NETWORK" : `AS OF ${snapshot.as_of}`}
    </span>
  );
};

function exposureAlerts(exposure) {
  if (exposure?.status !== "ok") return [];
  return (exposure.exposures || []).slice(0, 5).map((e) => ({
    id: `exp-${e.site}-${e.hazard_type}-${e.example ? "ex" : "live"}`,
    level: e.severity === "high" ? "act" : "watch",
    kpi: e.example ? "Exposure (example)" : "Exposure",
    value: e.site,
    action: `${e.hazard_label} ${e.distance_km} km away${e.past_due_units > 0 ? `, and the site already has ${Math.round(e.past_due_units).toLocaleString("en-US")} past-due units` : ""}${e.overdue_pos > 0 ? `, with ${e.overdue_pos} overdue supplier orders` : ""}. Check inventory cover and open orders.`,
  }));
}

const riskTone = (score) => (score >= 80 ? "#EF4444" : score >= 60 ? "#F97316" : score >= 35 ? "#EAB308" : "#22C55E");
const FACTOR_LABEL = { geopolitical: "geopolitics", political_stability: "political stability", natural_disaster: "natural disasters", chokepoint: "shipping chokepoints", infrastructure: "infrastructure" };

// Country risk for the sites in the network, ranked with how each site is doing. Country scores are AI-assessed.
const RiskTag = ({ children, tone }) => (
  <span className="ml-2 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full border" style={{ color: tone, borderColor: `${tone}66`, background: `${tone}14` }}>{children}</span>
);

function NetworkRiskCard({ risk, state, onSelectSite, onOpenRisk }) {
  const box = { borderColor: "rgba(148,163,184,0.15)", background: "rgba(9,25,19,0.5)" };
  if (state === "loading") {
    return (
      <section className="mb-6 rounded-2xl border px-5 py-4" style={box} data-testid="network-risk-block">
        <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Network risk</h2>
        <div className="text-sm mt-1" style={{ color: "#64748B" }}>Assessing country risk for your sites. The first run can take up to half a minute.</div>
      </section>
    );
  }
  if (state !== "ready" || !risk?.sites?.length) return null;
  const top = risk.sites.slice(0, 5);
  return (
    <section className="mb-6 rounded-2xl border px-5 py-4" style={box} data-testid="network-risk-block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Network risk <span className="ml-2 align-middle text-[10px] px-2 py-0.5 rounded-full border font-semibold" style={{ color: "#FCD34D", borderColor: "rgba(252,211,77,0.4)" }}>AI-assessed</span></h2>
          <div className="text-sm" style={{ color: "#64748B" }}>Where country risk and open issues in your data meet. {risk.countries.length} countr{risk.countries.length === 1 ? "y" : "ies"} assessed.</div>
        </div>
        {onOpenRisk && <button type="button" onClick={onOpenRisk} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" }}>Open Risk Intelligence</button>}
      </div>
      <ul className="mt-3 space-y-2">
        {top.map((r) => (
          <li key={r.name} className="rounded-xl px-3 py-2 flex items-start gap-3 cursor-pointer" style={{ background: "rgba(2,6,23,0.35)" }} onClick={() => onSelectSite && onSelectSite(r.name)}>
            <span className="mt-0.5 shrink-0 text-xs font-bold rounded-md px-2 py-0.5" style={{ background: `${riskTone(r.country_score)}22`, color: riskTone(r.country_score) }} title={`Country risk ${r.country_label}`}>{r.country_score}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold" style={{ color: "#E2E8F0" }}>{r.name.replace(/_/g, " ")} <span className="font-normal" style={{ color: "#64748B" }}>{r.country}</span>
                {r.live_hazard && <RiskTag tone="#F59E0B">Live hazard</RiskTag>}
                {(r.status === "bad" || r.status === "watch") && <RiskTag tone={r.status === "bad" ? "#EF4444" : "#F59E0B"}>Open issues</RiskTag>}
                {r.advisory_level >= 3 && <RiskTag tone="#EF4444">Advisory L{r.advisory_level}</RiskTag>}
                {r.uflpa_flagged && <RiskTag tone="#EF4444">UFLPA</RiskTag>}
              </span>
              <span className="block text-xs" style={{ color: "#94A3B8" }}>{r.reason}</span>
            </span>
          </li>
        ))}
      </ul>
      {(risk.not_scored?.length > 0 || risk.skipped?.length > 0) && (
        <p className="mt-2 text-[11px]" style={{ color: "#FCD34D" }}>
          {risk.not_scored?.length > 0 && `Could not assess: ${risk.not_scored.map((x) => x.country).join(", ")}. `}
          {risk.skipped?.length > 0 && `Country not recognized for: ${risk.skipped.join(", ")}.`}
        </p>
      )}
      <p className="mt-2 text-[11px]" style={{ color: "#64748B" }}>Country scores are AI-assessed and cached for 24 hours. State Department advisories and the UFLPA entity check are not AI.</p>
    </section>
  );
}

function ExposureBlock({ exposure, state, example, setExample, onAddLocations, onSimulate }) {
  const sevColor = { high: "#FCA5A5", medium: "#FCD34D" };
  const box = { borderColor: "rgba(148,163,184,0.15)", background: "rgba(9,25,19,0.5)" };
  return (
    <section className="mb-6 rounded-2xl border px-5 py-4" style={box} data-testid="exposure-block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Exposure now</h2>
          <div className="text-sm" style={{ color: "#64748B" }}>Live hazards within range of your sites. Near means within range, not damaged.</div>
        </div>
        {state !== "loading" && (
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#94A3B8" }}>
            <input type="checkbox" checked={example} onChange={(e) => setExample(e.target.checked)} /> Show example hazard
          </label>
        )}
      </div>
      {state === "loading" && <p className="mt-3 text-sm" style={{ color: "#94A3B8" }}>Checking live hazards…</p>}
      {state === "no_locations" && (
        <p className="mt-3 text-sm" style={{ color: "#94A3B8" }}>
          Add a locations file to see which of your sites and suppliers are near live hazards.{" "}
          <button type="button" onClick={onAddLocations} className="underline" style={{ color: "#9FD63A" }}>Add locations</button>
        </p>
      )}
      {state === "error" && <p className="mt-3 text-sm" style={{ color: "#FCD34D" }}>Could not check live hazards right now.</p>}
      {state === "none" && (
        <p className="mt-3 text-sm" style={{ color: "#FCD34D" }}>
          The exposure check is not available yet. Restart the backend, then use Update data and Load example network.{" "}
          <button type="button" onClick={onAddLocations} className="underline" style={{ color: "#9FD63A" }}>Update data</button>
        </p>
      )}
      {state === "ready" && exposure.exposures.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: "#86efac" }}>
          No active hazards within range of your {exposure.sites_checked} sites. Checked {exposure.hazards_considered} current events.
        </p>
      )}
      {state === "ready" && exposure.exposures.length > 0 && (
        <ul className="mt-3 space-y-2">
          {exposure.exposures.map((e, i) => (
            <li key={`${e.site}-${e.hazard_type}-${i}`} className="rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "rgba(148,163,184,0.15)", background: "rgba(2,6,23,0.35)" }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>
                  <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: sevColor[e.severity] || "#64748B" }} />
                  {e.site}{e.site_type ? <span className="text-xs font-normal" style={{ color: "#64748B" }}> ({e.site_type})</span> : null}
                  {e.example && <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: "rgba(245,158,11,0.5)", color: "#FCD34D" }}>EXAMPLE</span>}
                </div>
                <div className="text-xs" style={{ color: "#94A3B8" }}>
                  {e.title} · {e.distance_km} km away (range {e.radius_km} km) · {e.source}
                </div>
                {(e.past_due_units > 0 || e.overdue_pos > 0) && (
                  <div className="text-xs mt-0.5" style={{ color: "#FCA5A5" }}>
                    {e.past_due_units > 0 ? `${Math.round(e.past_due_units).toLocaleString("en-US")} past-due units, ${e.late_lines} late lines` : ""}
                    {e.overdue_pos > 0 ? `${e.overdue_pos} overdue supplier orders` : ""}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => onSimulate(e)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#9CF700", color: "#020617" }}>Simulate this exposure →</button>
            </li>
          ))}
        </ul>
      )}
      {state === "ready" && exposure.feeds && (!exposure.feeds.usgs || !exposure.feeds.gdacs) && (
        <p className="mt-2 text-[11px]" style={{ color: "#FCD34D" }}>
          {!exposure.feeds.usgs && !exposure.feeds.gdacs ? "Hazard feeds are unreachable, so this check is incomplete." : `The ${!exposure.feeds.usgs ? "earthquake" : "storm, flood and wildfire"} feed is unreachable, so this check is incomplete.`}
        </p>
      )}
    </section>
  );
}

function SnapshotDataCard({ apiBase, onLoaded, onCancel }) {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState([]);
  const [warn, setWarn] = useState([]);
  const [profile, setProfile] = useState(null);
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("access_token") || ""}` });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/network-profile`, { headers: headers() });
        const body = await res.json().catch(() => ({}));
        if (live && body && body.status === "ok" && body.profile && body.profile.source !== "sample") setProfile(body.profile);
      } catch { /* the card still works as a first upload */ }
    })();
    return () => { live = false; };
  }, [apiBase]);
  const ago = (iso) => {
    const t = Date.parse(iso || "");
    if (!t) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.round(m / 60)} h ago`;
    return `${Math.round(m / 1440)} d ago`;
  };
  const refreshMode = !!profile;
  const finish = async (res) => {
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.status === "ok") { setErr([]); setWarn(body.warnings || []); onLoaded(body); }
    else { setErr(body.errors || [body.message || "That did not work. Check the files and try again."]); setWarn(body.warnings || []); }
  };
  const upload = async () => {
    if (!files.customer_orders) { setErr(["Choose customer_orders.csv first. The other two files are optional."]); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(files).forEach(([k, f]) => { if (f) fd.append(k, f, f.name); });
      await finish(await fetch(`${apiBase}/api/network-snapshot`, { method: "POST", headers: headers(), body: fd }));
    } catch { setErr(["Could not reach the server."]); } finally { setBusy(false); }
  };
  const refresh = async () => {
    const picked = Object.entries(files).filter(([, f]) => f);
    if (!picked.length) { setErr(["Choose at least one file to refresh. Files you leave out keep their last data."]); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      picked.forEach(([k, f]) => fd.append(k, f, f.name));
      await finish(await fetch(`${apiBase}/api/network-snapshot/refresh`, { method: "POST", headers: headers(), body: fd }));
    } catch { setErr(["Could not reach the server."]); } finally { setBusy(false); }
  };
  const loadSample = async () => {
    setBusy(true);
    try { await finish(await fetch(`${apiBase}/api/network-snapshot/sample`, { method: "POST", headers: headers() })); }
    catch { setErr(["Could not reach the server."]); } finally { setBusy(false); }
  };
  const inputs = [
    ["customer_orders", "customer_orders.csv", "Required"],
    ["supplier_pos", "supplier_pos.csv", "Adds supplier measures"],
    ["inventory", "inventory.csv", "Adds days of supply"],
    ["locations", "locations.csv", "Enables hazard exposure"],
  ];
  return (
    <section className="rounded-2xl border px-5 py-4 mb-6" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "rgba(159,214,58,0.3)" }} data-testid="snapshot-card">
      <h2 className="text-lg font-bold" style={{ color: "#9FD63A" }}>{refreshMode ? "Refresh your network data" : "Connect your network data"}</h2>
      <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>{refreshMode ? "Choose only the files that changed. The others keep their last data, and your delivery-window settings carry over." : "Upload exports from your ERP to see live service, supplier and inventory KPIs with real changes. Orders alone is enough to start."}</p>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {inputs.map(([key, label, note]) => (
          <label key={key} className="rounded-xl border p-3 text-xs cursor-pointer" style={{ borderColor: "rgba(148,163,184,0.2)", background: "rgba(2,6,23,0.35)", color: "#94A3B8" }}>
            <span className="block font-semibold" style={{ color: "#E2E8F0" }}>{label}</span>
            <span className="block mb-2">{refreshMode && profile.files && profile.files[key] ? `Last updated ${ago(profile.files[key].updated_at)}` : note}</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => setFiles((f) => ({ ...f, [key]: e.target.files?.[0] || null }))} className="block w-full text-[11px]" />
            {files[key] && <span className="block mt-1" style={{ color: "#9FD63A" }}>{files[key].name}</span>}
          </label>
        ))}
      </div>
      {err.length > 0 && <ul className="mt-3 text-sm" style={{ color: "#FCA5A5" }}>{err.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {warn.length > 0 && <ul className="mt-2 text-xs" style={{ color: "#FCD34D" }}>{warn.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="mt-3 flex flex-wrap gap-2">
        {refreshMode && <button onClick={refresh} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#9CF700", color: "#020617", opacity: busy ? 0.6 : 1 }}>{busy ? "Working…" : "Refresh with these files"}</button>}
        <button onClick={upload} disabled={busy} className={refreshMode ? "px-4 py-2 rounded-lg text-sm font-semibold border" : "px-4 py-2 rounded-lg text-sm font-bold"} style={refreshMode ? { borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A", opacity: busy ? 0.6 : 1 } : { background: "#9CF700", color: "#020617", opacity: busy ? 0.6 : 1 }}>{refreshMode ? "Replace everything" : (busy ? "Working…" : "Upload and calculate")}</button>
        <button onClick={loadSample} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" }}>Load example network</button>
        {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#94A3B8" }}>Cancel</button>}
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "#64748B" }}>Columns for each file are listed in NETWORK_SNAPSHOT_CONTRACT.md. Nothing leaves your account.</p>
    </section>
  );
}

// Latest-run verdict at the top of the Control Tower: the one sentence that matters,
// four headline measures, and a way in. Reads the saved run through /api/run-kpis.
function LatestRunVerdict({ simulationHistory, switchView }) {
  const latest = Array.isArray(simulationHistory) ? simulationHistory[0] : null;
  const runId = (() => {
    if (!latest) return null;
    if (latest.run_id && /^\d{8}_\d{6}_/.test(latest.run_id)) return latest.run_id;
    for (const v of Object.values(latest)) {
      const m = typeof v === "string" ? v.match(/(\d{8}_\d{6}_[0-9a-f]{6,})/) : null;
      if (m) return m[1];
    }
    return null;
  })();
  const [sc, setSc] = useState(null);
  const [state, setState] = useState("idle");
  useEffect(() => {
    if (!runId) { setSc(null); setState("idle"); return undefined; }
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const API_BASE = getApiBase();
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const res = await fetch(`${API_BASE}/api/run-kpis/${runId}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body?.scorecard?.ok) { setSc(body.scorecard); setState("ready"); } else { setState("error"); }
      } catch { if (!cancelled) setState("error"); }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  const runSample = () => {
    try { localStorage.setItem("forc_run_sample", "1"); } catch {}
    try { window.dispatchEvent(new Event("forc-run-sample")); } catch {}
    switchView("simulation");
  };

  const shell = "rounded-2xl mt-6 mb-5 px-5 py-4 border";
  const shellStyle = { background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "rgba(159,214,58,0.3)" };

  if (!runId) {
    return (
      <section className={shell} style={shellStyle} data-testid="latest-run-verdict">
        <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#9FD63A" }}>Scenario simulator</p>
        <p className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Test a disruption on your network.</p>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>Run the built-in sample to see the answer, the order-by dates and the KPI scorecard in about a minute. No uploads needed.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={runSample} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#9CF700", color: "#020617" }}>Run the sample scenario</button>
          <button onClick={() => switchView("simulation")} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" }}>Use my own data</button>
        </div>
      </section>
    );
  }

  const namedRun = latest?.name || latest?.scenario_name || latest?.raw?.scenario_name || null;
  const dateName = (() => {
    const m = String(runId || "").match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
    return m ? `run of ${new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
  })();
  const name = namedRun || dateName;
  const rows = state === "ready" ? sc.groups.flatMap((g) => g.rows).filter((r) => r.headline).slice(0, 4) : [];
  const d0 = sc?.disruption_start;
  const d1 = sc?.first_shortage_date;
  const headline = state === "ready"
    ? (d1 ? `The disruption starts ${vcLong(d0)}, but customers do not feel it until ${vcLong(d1)}.` : "No customer shortage in this scenario.")
    : state === "loading" ? "Loading the latest scenario result." : "The latest scenario result is not available yet.";
  return (
    <section className={shell} style={shellStyle} data-testid="latest-run-verdict">
      <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#9FD63A" }}>Scenario simulator · latest {name ? (namedRun ? `run: ${name}` : name) : "run"}</p>
      <p className="text-base font-semibold" style={{ color: "#E2E8F0" }}>{headline}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => switchView("simulation")} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#9CF700", color: "#020617" }}>Open the verdict and decision clock</button>
        <button onClick={runSample} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" }}>Run the sample again</button>
      </div>
    </section>
  );
}

export default function ControlTower({
  switchView,
  simulationHistory,
  onReloadRun,
  onLogout,
  userPlan,
  locationsUrl,
}) {
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [tourActive, setTourActive] = useState(() => {
    return localStorage.getItem("forc_tour_done") !== "true";
  });

  function finishTour() {
    localStorage.setItem("forc_tour_done", "true");
    setTourActive(false);
  }

  const handleFacilitySelect = React.useCallback((facility) => {
    setSelectedFacility(facility);
  }, []);

  const [userName, setUserName] = useState("");
  const [newsHeadlines, setNewsHeadlines] = useState([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const API_BASE = getApiBase();
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

  const resolvedPlan =
    normalizePlan(userPlan) || normalizePlan(localStorage.getItem("plan")) || "free";
  const proPlus = isProPlusPlan(resolvedPlan);

  const resolvedRole = (localStorage.getItem("role") || "").toString().trim().toLowerCase();
  const isAdmin = resolvedRole === "admin";

  const [activeView, setActiveView] = useState("dashboard");
  // Set when the unified attention panel's "Review in Risk Intelligence" is
  // clicked, so
  // RiskIntelligenceView mounts on the correct commodity/tab instead of
  // always defaulting to semiconductors/forward regardless of which trigger
  // the user actually clicked through on.
  const [riskIntelFocus, setRiskIntelFocus] = useState(null); // { commodity } | null

  const [kpiRange, setKpiRange] = useState("month");
  const [businessKpis, setBusinessKpis] = useState(null);

  const [kpiSectionVisibility, setKpiSectionVisibility] = useState({
    fulfillment: false,
    production: false,
    cost: false,
  });
  const toggleKpiSection = (section) =>
    setKpiSectionVisibility((prev) => ({ ...prev, [section]: !prev[section] }));

  const [chartType1, setChartType1] = useState("revenue");
  const [chartType2, setChartType2] = useState("onTime");
  const [ctNarrative, setCtNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const API_BASE_CT = getApiBase();
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotState, setSnapshotState] = useState("loading");
  const [showSnapshotCard, setShowSnapshotCard] = useState(false);
  const [moreMetrics, setMoreMetrics] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const res = await fetch(`${API_BASE_CT}/api/network-snapshot`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body.status === "ok") { setSnapshot(body); setSnapshotState("ready"); } else { setSnapshot(null); setSnapshotState("none"); }
      } catch { if (!cancelled) setSnapshotState("none"); }
    })();
    return () => { cancelled = true; };
  }, [API_BASE_CT]);
  const removeSnapshot = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      await fetch(`${API_BASE_CT}/api/network-snapshot`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    setSnapshot(null); setSnapshotState("none"); setCtNarrative("");
  };
  const [exposure, setExposure] = useState(null);
  const [exposureState, setExposureState] = useState("idle");
  const [exposureExample, setExposureExample] = useState(false);
  useEffect(() => {
    if (!snapshot) { setExposure(null); setExposureState("idle"); return undefined; }
    let cancelled = false;
    setExposureState("loading");
    (async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const res = await fetch(`${API_BASE_CT}/api/network-exposure${exposureExample ? "?example=1" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setExposure(body);
        setExposureState(body.status === "ok" ? "ready" : body.status === "no_locations" ? "no_locations" : "none");
      } catch { if (!cancelled) setExposureState("error"); }
    })();
    return () => { cancelled = true; };
  }, [snapshot, exposureExample, API_BASE_CT]);
  const [siteParts, setSiteParts] = useState({});
  const [netRisk, setNetRisk] = useState(null);
  const [netRiskState, setNetRiskState] = useState("idle");
  useEffect(() => {
    if (!snapshot) { setNetRisk(null); setNetRiskState("idle"); return undefined; }
    let cancelled = false;
    setNetRiskState("loading");
    (async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const res = await fetch(`${API_BASE_CT}/api/network-risk`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setNetRisk(body);
        setNetRiskState(body.status === "ok" ? "ready" : "none");
      } catch { if (!cancelled) setNetRiskState("error"); }
    })();
    return () => { cancelled = true; };
  }, [snapshot?.uploaded_at, snapshot?.source, API_BASE_CT]);
  const changeWindow = async (d) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const res = await fetch(`${API_BASE_CT}/api/network-snapshot?window_days=${d}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (body && body.status === "ok" && Array.isArray(body.kpis)) setSnapshot(body);
    } catch { /* keep the current view */ }
  };
  const simulateExposure = (e) => {
    try {
      const days = e.hazard_type === "EQ" ? (e.severity === "high" ? 60 : 7) : ({ TC: 7, FL: 14, VO: 14, WF: 10 }[e.hazard_type] || 10);
      const sev = e.severity === "high" ? 1.0 : 0.5;
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const start = new Date();
      const end = new Date(start.getTime() + days * 86400000);
      const sc = {
        name: `Exposure: ${e.site}`,
        disruptionScenarios: [{ facility: e.site, startDate: iso(start), endDate: iso(end), severity: sev, production_impact: sev, shipping_impact: sev }],
        demandAdjustments: [], laneAdjustments: [], inventoryPolicies: [],
        meta: { source: "control_tower_exposure", site: e.site, hazard: e.title, distance_km: e.distance_km, notes: `Launched from Control Tower. ${e.hazard_label} ${e.distance_km} km from ${e.site}. Assumed ${days} days at severity ${sev} (illustrative duration, not a forecast).` },
      };
      localStorage.setItem("forc_active_scenario", JSON.stringify(sc));
      localStorage.setItem("currentScenarioJSON", JSON.stringify(sc));
      localStorage.setItem("currentScenarioName", sc.name);
      localStorage.setItem("forc_exposure_sim", "1");
      try { window.dispatchEvent(new Event("forc-exposure-sim")); } catch {}
    } catch (err) { console.warn("Could not pre-populate scenario:", err); }
    switchView("simulation");
  };
  const exposureKey = JSON.stringify((exposure?.exposures || []).filter((x) => !x.example).map((x) => `${x.site}|${x.hazard_type}`));
  const exposedSites = useMemo(() => {
    const coords = Object.fromEntries((exposure?.sites || []).map((x) => [x.name, x]));
    const best = {};
    (exposure?.exposures || []).forEach((e) => {
      const c = coords[e.site];
      if (!c) return;
      if (!best[e.site] || (e.severity === "high" && best[e.site].severity !== "high")) {
        best[e.site] = { name: e.site, lat: c.lat, lng: c.lon, severity: e.severity, label: `${e.hazard_label} ${e.distance_km} km away${e.example ? " (example)" : ""}` };
      }
    });
    return Object.values(best);
  }, [exposure]);
  const mapHealth = useMemo(() => {
    const risk = Object.fromEntries((netRisk?.sites || []).map((r) => [r.name, r]));
    return Object.fromEntries((exposure?.sites || []).filter((x) => x.status).map((x) => {
      const r = risk[x.name];
      const sp = siteParts[x.name];
      const top = sp && sp.length ? sp.reduce((a, b) => (b.score > a.score ? b : a)) : null;
      return [x.name, { status: x.status, reason: x.reason + (r ? `. ${r.country} country risk ${r.country_score} (${r.country_label.toLowerCase()}, AI-assessed)` : "") + (top ? `. ${sp.length} thin part${sp.length > 1 ? "s" : ""} on ${top.commodity_label} risk ${top.score}` : "") }];
    }));
  }, [exposure, netRisk, siteParts]);
  const mapLanes = useMemo(() => exposure?.lanes || [], [exposure]);
  const hazardLinks = useMemo(() => {
    const coords = Object.fromEntries((exposure?.sites || []).map((x) => [x.name, x]));
    return (exposure?.exposures || []).filter((e) => e.hazard_lat != null && e.hazard_lon != null && coords[e.site]).map((e) => ({
      site: e.site, siteLat: coords[e.site].lat, siteLng: coords[e.site].lon, hazLat: e.hazard_lat, hazLng: e.hazard_lon,
      radiusKm: e.radius_km, distanceKm: e.distance_km, severity: e.severity,
    }));
  }, [exposure]);
  const snapAlerts = [...snapshotAlerts(snapshot), ...exposureAlerts(exposure)];
  const snapByKey = Object.fromEntries((snapshot?.kpis || []).map((k) => [k.key, k]));

  const chartOptions = [
    { value: "shipments",   label: "📦 Outbound Shipments" },
    { value: "utilization", label: "🏭 Facility Utilization" },
    { value: "inventory",   label: "📦 Inventory Levels" },
    { value: "leadTime",    label: "📈 Lead Time Trends" },
    { value: "revenue",     label: "💰 Revenue at Risk" },
    { value: "onTime",      label: "🕒 Supplier On-Time Rate" },
    { value: "expedite",    label: "⚡ Expedited Orders" },
  ];

  const chartMeta = {
    shipments:   { title: "Outbound Throughput Trend",      subtitle: "Network shipment activity across the selected horizon",          footer: "Basis: monitored outbound volume" },
    utilization: { title: "Facility Utilization Trend",     subtitle: "Capacity pressure across key operating regions",                footer: "Basis: blended facility utilization" },
    inventory:   { title: "Inventory Position Trend",       subtitle: "Overall inventory movement across the network",                 footer: "Basis: monitored inventory levels" },
    leadTime:    { title: "Lead Time Trend",                subtitle: "Transit and supplier response timing over time",               footer: "Basis: average end-to-end lead time" },
    revenue:     { title: "Revenue at Risk Trend",          subtitle: "Estimated business exposure from current network conditions",   footer: "Basis: exposure estimate from monitored disruptions" },
    onTime:      { title: "Supplier Reliability Trend",     subtitle: "Inbound supplier on-time performance over time",               footer: "Basis: supplier on-time delivery rate" },
    expedite:    { title: "Expedite Pressure Trend",        subtitle: "Operational stress indicated by expedited order activity",      footer: "Basis: expedited order share" },
  };

  useEffect(() => {
    if (!snapshot) { setCtNarrative(""); return; }
    if (exposureState === "loading") return;
    const fetchNarrative = async () => {
      setNarrativeLoading(true);
      try {
        const res = await fetch(`${API_BASE_CT}/api/control-tower/narrative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: {
              as_of: snapshot.as_of, window_days: snapshot.window_days, source: snapshot.source,
              kpis: (snapshot.kpis || []).map((k) => ({ label: k.label, value: k.value, prior: k.prior, unit: k.unit, trend: k.trend, status: k.status, n: k.n })),
              worst: snapshot.worst,
              exposures: (exposure?.exposures || []).filter((x) => !x.example).slice(0, 3).map((x) => ({ site: x.site, hazard: x.title, distance_km: x.distance_km, severity: x.severity, past_due_units: x.past_due_units, overdue_pos: x.overdue_pos })),
            },
          }),
        });
        const data = await res.json();
        if (data.status === "success") setCtNarrative(data.narrative);
      } catch (e) {
        console.warn("Control tower narrative failed:", e);
      } finally {
        setNarrativeLoading(false);
      }
    };
    fetchNarrative();
  }, [snapshot, API_BASE_CT, exposureState, exposureKey]);



  const kpiMeta = [
    { key: "totalFacilities",    label: "Network Facilities",      trend: "up",      delta: { day: "Network scope unchanged vs yesterday",    week: "Network scope unchanged vs last week",    month: "Network scope unchanged vs last month",    ytd: "Network scope unchanged vs start of year" } },
    { key: "activeIncidents",    label: "Active Incidents",        trend: "down",    risk: "high", delta: { day: "↓ 3 vs yesterday",          week: "↓ 4 vs last week",          month: "↓ 7 vs last month",          ytd: "↓ 13 vs start of year" } },
    { key: "shipments",          label: "Outbound Shipments",      trend: "neutral", delta: { day: "Flat vs yesterday",                        week: "↑ 4% vs last week",          month: "↑ 7% vs last month",          ytd: "↑ 12% vs start of year" } },
    { key: "disruptionPercent",  label: "Disruption %",            trend: "up",      risk: "high", delta: { day: "↑ 0.1 pts vs yesterday",    week: "Flat vs last week",          month: "↑ 0.2 pts vs last month",    ytd: "↓ 0.3 pts vs start of year" } },
    { key: "serviceLevel",       label: "Service Level",           trend: "up",      delta: { day: "↑ 0.2 pts vs yesterday",                  week: "↑ 0.1 pts vs last week",    month: "↑ 0.4 pts vs last month",    ytd: "↑ 0.9 pts vs start of year" } },
    { key: "avgLeadTime",        label: "Avg Lead Time (days)",    trend: "down",    delta: { day: "↓ 0.1 days vs yesterday",                 week: "↓ 0.1 days vs last week",   month: "↓ 0.3 days vs last month",   ytd: "↓ 0.6 days vs start of year" } },
    { key: "revenueAtRisk",      label: "Revenue at Risk",         trend: "up",      delta: { day: "↓ $0.2M vs yesterday",                    week: "↓ $0.2M vs last week",      month: "↓ $0.5M vs last month",      ytd: "↓ $0.9M vs start of year" } },
    { key: "backorders",         label: "Backorder Volume",        trend: "down",    risk: "high", delta: { day: "↓ 50 vs yesterday",         week: "↓ 80 vs last week",         month: "↓ 130 vs last month",        ytd: "↓ 270 vs start of year" } },
    { key: "capacityUtilization",label: "Capacity Utilization",    trend: "up",      delta: { day: "↑ 0.4 pts vs yesterday",                  week: "↑ 1.5 pts vs last week",    month: "↑ 2.5 pts vs last month",    ytd: "↑ 3.2 pts vs start of year" } },
    { key: "supplierOnTime",     label: "Supplier On-Time Rate",   trend: "up",      delta: { day: "↑ 0.2 pts vs yesterday",                  week: "↑ 0.7 pts vs last week",    month: "↑ 1.1 pts vs last month",    ytd: "↑ 1.9 pts vs start of year" } },
    { key: "expeditedOrders",    label: "Expedited Orders",        trend: "down",    delta: { day: "↓ 0.1 pts vs yesterday",                  week: "↓ 0.2 pts vs last week",    month: "↓ 0.5 pts vs last month",    ytd: "↓ 0.9 pts vs start of year" } },
    { key: "cycleTime",          label: "Order Cycle Time (days)", trend: "neutral", delta: { day: "Flat vs yesterday",                        week: "↓ 0.3 days vs last week",   month: "↓ 0.6 days vs last month",   ytd: "↓ 1.5 days vs start of year" } },
  ];

  const executiveKpiKeys = ["activeIncidents", "serviceLevel", "revenueAtRisk", "backorders", "avgLeadTime", "supplierOnTime"];

  const networkContext = {
    monitoredRegions: 12,
    activeFeeds: ["USGS", "NOAA", "GDACS", "Internal Alerts"],
    refreshCadence: "15 min",
    timezoneLabel: "ET",
  };

  const renderChart = (type) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    const chartConfigs = {
      shipments:   { type: Bar,  data: [2, 3, 5, 4, 3, 4, 2, 1], label: "Outbound Shipments", color: "#1D625B" },
      utilization: { type: Line, data: [{ label: "East", data: [61, 74, 92, 86, 81, 96, 98, 108], color: "#1D625B" }, { label: "West", data: [42, 56, 61, 66, 62, 71, 79, 88], color: "#F59E0B" }] },
      inventory:   { type: Bar,  data: [100, 92, 81, 86, 77, 71, 67, 62], label: "Inventory", color: "#3B82F6" },
      leadTime:    { type: Line, data: [6.0, 5.9, 5.7, 5.8, 5.5, 5.4, 5.2, 5.1], label: "Lead Time (days)", color: "#10B981" },
      revenue:     { type: Bar,  data: [4.8, 4.7, 4.5, 4.4, 4.1, 4.0, 3.9, 3.85], label: "Revenue at Risk ($M)", color: "#1D625B" },
      onTime:      { type: Line, data: [91.2, 91.4, 92.0, 92.3, 92.7, 92.9, 93.1, 93.2], label: "On-Time Rate (%)", color: "#6366F1" },
      expedite:    { type: Bar,  data: [5.1, 5.0, 4.85, 4.7, 4.65, 4.45, 4.35, 4.2], label: "Expedited Orders (%)", color: "#F59E0B" },
    };
    const config = chartConfigs[type];
    if (!config) return null;
    const ChartComponent = config.type;
    const dataset = Array.isArray(config.data)
      ? [{ label: config.label, data: config.data, backgroundColor: config.color, borderColor: config.color, fill: false, tension: 0.3 }]
      : config.data.map((d) => ({ ...d, borderColor: d.color, fill: false, tension: 0.3 }));
    return (
      <ChartComponent
        data={{ labels: months, datasets: dataset }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }}
      />
    );
  };

  const goToBilling = () => setActiveView("billing");

  return (
    <div className="flex h-screen font-sans overflow-hidden" style={{ background: "radial-gradient(circle at top left, #0B3D2E 0, #020617 40%, #020617 100%)" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-[#0a2e22] text-white p-6 space-y-6 h-screen overflow-y-auto">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="FOR-C Logo" className="h-12 w-auto rounded-lg" />
        </div>

        <div className="flex flex-col items-center space-y-2">
          <img src="/mj_profile.jpg" alt="User Profile" className="h-20 w-20 rounded-full border-2 border-white shadow-md" />
          <div className="text-sm font-semibold text-white">{userName || "User"}</div>
          <div className="text-[11px] opacity-80 bg-white/10 rounded px-2 py-0.5">
            {(resolvedPlan || "FREE").toUpperCase()}
          </div>
        </div>

        <div className="space-y-5">

          {/* ── Monitor ── */}
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Monitor</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  onClick={() => setActiveView("dashboard")}
                  className={`block cursor-pointer ${activeView === "dashboard" ? "text-lime-300" : "hover:underline"}`}
                >
                  📊 Dashboard
                </a>
              </li>

              {/* ── v3: Risk Intelligence ── */}
              <li>
                <a
                  onClick={() => {
                    setRiskIntelFocus(null); // clear any stale focus from a previous attention-panel click
                    setActiveView("risk");
                  }}
                  className={`block cursor-pointer ${activeView === "risk" ? "text-lime-300" : "hover:underline"}`}
                  style={activeView === "risk" ? {} : { color: "#9FD63A" }}
                >
                  🔭 Risk Intelligence
                </a>
              </li>

              <li>
                <a
                  onClick={() => setActiveView("safetystock")}
                  className={`block cursor-pointer ${activeView === "safetystock" ? "text-lime-300" : "hover:underline"}`}
                >
                  🛡️ Safety Stock
                </a>
              </li>
            </ul>
          </div>

          {/* ── Simulate ── */}
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Simulate</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a onClick={() => switchView("simulation")} className="hover:underline block cursor-pointer">
                  🚀 Launch Simulation
                </a>
              </li>

              <li>
                <a
                  onClick={() => setActiveView("simulations")}
                  className={`block cursor-pointer ${activeView === "simulations" ? "text-lime-300" : "hover:underline"}`}
                >
                  🧪 Simulation History
                </a>
              </li>

              <li>
                <a
                  onClick={() => { syncScenarioFromLocal(); setActiveView("scenario"); }}
                  className={`block cursor-pointer ${activeView === "scenario" ? "text-lime-300" : "hover:underline"}`}
                >
                  📝 Scenario Library
                </a>
              </li>
            </ul>
          </div>

          {/* ── Account ── */}
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Account</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a onClick={() => switchView("reports")} className="block cursor-pointer hover:underline">
                  📊 Reports
                </a>
              </li>

              <li>
                <a
                  onClick={() => setActiveView("billing")}
                  className={`block cursor-pointer ${activeView === "billing" ? "text-lime-300" : "hover:underline"}`}
                >
                  💸 Billing
                </a>
              </li>

              <li>
                <a onClick={() => switchView("about")} className="hover:underline block cursor-pointer">
                  📘 About FOR-C
                </a>
              </li>

              {isAdmin && (
                <li>
                  <a
                    onClick={() => setActiveView("admin")}
                    className={`block cursor-pointer ${activeView === "admin" ? "text-lime-300" : "hover:underline"}`}
                  >
                    🛠 Admin
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* ── Utility ── */}
          <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <ul className="space-y-2 text-sm pt-3">
              <li>
                <a
                  onClick={() => { setTourActive(true); setActiveView("dashboard"); }}
                  className="block cursor-pointer hover:underline"
                  style={{ color: "#9FD63A" }}
                >
                  🗺 Start Tour
                </a>
              </li>
            </ul>
          </div>

        </div>
      </aside>

      {/* ── Main column ── */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col">

        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b backdrop-blur" style={{ background: "rgba(2,6,23,0.85)", borderColor: "#123528" }}>
          <div className="flex items-center justify-between px-6 py-3">
            <h1 className="text-2xl font-bold" style={{ color: "#9FD63A" }}>Control Tower</h1>
            <button
              onClick={onLogout || (() => {})}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition"
              style={{ color: "#94A3B8", borderColor: "#355e52", background: "rgba(2,6,23,0.45)" }}
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

          {/* ── v3: Risk Intelligence view ── */}
          {activeView === "risk" && (
            <section className="mt-2">
              <RiskIntelligenceView
                switchView={switchView}
                initialTab={riskIntelFocus ? "triggers" : undefined}
                initialCommodity={riskIntelFocus?.commodity}
              />
            </section>
          )}

          {/* ── v3: Safety Stock Monitor ── */}
          {activeView === "safetystock" && (
            <section className="mt-2">
              <SafetyStockView />
            </section>
          )}

          {/* ── Dashboard ── */}
          {activeView === "dashboard" && (
            <>
              <div className="mb-2 text-lg" style={{ color: "#94A3B8" }}>
                Welcome back, <strong style={{ color: "#E2E8F0" }}>{friendlyName(userName) || userName}</strong> 👋
              </div>

              {scenarioName && (
                <div className="mt-1 mb-4 text-sm flex items-center gap-2" style={{ color: "#94A3B8" }}>
                  Active scenario: <span className="font-semibold" style={{ color: "#E2E8F0" }}>{scenarioName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.removeItem("forc_active_scenario");
                        localStorage.removeItem("currentScenarioJSON");
                        localStorage.removeItem("currentScenarioName");
                      } catch {}
                      setScenarioName("");
                    }}
                    className="ml-1 hover:text-red-400 transition text-xs font-bold"
                    style={{ color: "#64748B" }}
                    title="Clear active scenario"
                  >
                    ✕
                  </button>
                </div>
              )}

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div id="tour-map" className="lg:col-span-2 rounded overflow-hidden border" style={{ borderColor: "#123528" }}>

                  {newsHeadlines.length > 0 && (
                    <div id="tour-ticker" className="rounded-xl overflow-hidden mb-4" style={{ background: "#111B21", border: "1px solid #1f3a2e" }}>
                      <div className="flex items-center">
                        <div className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase whitespace-nowrap flex-shrink-0" style={{ background: "#9FD63A", color: "#111B21" }}>
                          LIVE INTEL
                        </div>
                        <div className="overflow-hidden flex-1 relative">
                          <div className="flex gap-12 py-2 px-4 whitespace-nowrap" style={{ animation: "ticker-scroll 90s linear infinite", display: "inline-flex" }}>
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

                  <MapView
                    locationsUrl={locationsUrl || simulationHistory?.[0]?.locations_url || GLOBAL_LOCATIONS_URL}
                    onFacilitySelect={handleFacilitySelect}
                    exposedSites={exposedSites}
                    siteHealth={mapHealth}
                    lanes={mapLanes}
                    hazardLinks={hazardLinks}
                    autoFit
                    fitLeft={120}
                    height="460px"
                  />
                </div>

                <div className="rounded-xl border p-4" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "#143629" }}>
                  <h2 className="text-lg font-bold mb-2" style={{ color: "#9FD63A" }}>Network Health Summary<SourceChip snapshot={snapshot} /></h2>
                  <div className="text-sm mb-3" style={{ color: "#94A3B8" }}>
                    {snapshot ? `Last ${snapshot.window_days} days to ${snapshot.as_of}.` : "Executive overview of current supply chain performance."}
                  </div>
                  {snapshot ? (
                    <ul className="space-y-3">
                      {["service_level", "otif", "backorder_units", "supplier_on_time"].filter((k) => snapByKey[k]).map((k) => (
                        <li key={k} className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "#64748B" }}>{snapByKey[k].label}</span>
                          <span className="text-base font-extrabold" style={{ color: SNAP_COLOR[snapByKey[k].status] }}>{snapFmt(snapByKey[k].value, snapByKey[k].unit)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm" style={{ color: "#64748B" }}>{snapshotState === "loading" ? "Loading…" : "No network data yet. Load the example network or upload your exports to see live KPIs here."}</p>
                  )}
                </div>
              </section>

              <UnifiedAttentionPanel
                kpis={null}
                alertsOverride={snapAlerts}
                hasKpiData={Boolean(snapshot)}
                ctNarrative={ctNarrative}
                narrativeLoading={narrativeLoading}
                onOpenRiskIntelligence={({ commodity } = {}) => {
                  setRiskIntelFocus({ commodity });
                  setActiveView("risk");
                }}
                onOpenSafetyStock={() => setActiveView("safetystock")}
              />

              <div className="mb-4 text-xs" style={{ color: "#64748B" }}>
                Live feeds: <span style={{ color: "#94A3B8" }}>{networkContext.activeFeeds.join(" • ")}</span>
              </div>

              {snapshot && (() => {
                const worst = snapshot.kpis.find((k) => k.status === "bad") || snapshot.kpis.find((k) => k.status === "watch");
                if (!worst) return null;
                return (
                  <div className="rounded-xl mb-5 px-5 py-4 flex items-center justify-between gap-4" style={{ background: "linear-gradient(90deg, #0d3d2e 0%, #1D625B 100%)", border: "1px solid rgba(156,247,0,0.2)" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⚡</span>
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-lime-300/70 mb-0.5">Recommended Action</p>
                        <p className="text-sm font-semibold text-white">{worst.label} is {snapFmt(worst.value, worst.unit)}{worst.delta ? ` (${snapDelta(worst, snapshot.window_days).split(" · ")[0].toLowerCase()})` : ""}. {SNAP_ACTIONS[worst.key] || worst.hint}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const baselineScenario = {
                            name: "Control Tower Baseline", disruptionScenarios: [], demandAdjustments: [], laneAdjustments: [], inventoryPolicies: [],
                            meta: { source: "control_tower", serviceLevel: snapFmt(snapByKey.service_level?.value, "%"), backorders: snapFmt(snapByKey.backorder_units?.value, "units"), notes: `Launched from Control Tower. Network snapshot as of ${snapshot.as_of}.` },
                          };
                          localStorage.setItem("forc_active_scenario", JSON.stringify(baselineScenario));
                          localStorage.setItem("currentScenarioJSON", JSON.stringify(baselineScenario));
                          localStorage.setItem("currentScenarioName", "Control Tower Baseline");
                          localStorage.setItem("forc_exposure_sim", "1");
                          try { window.dispatchEvent(new Event("forc-exposure-sim")); } catch (e2) { }
                        } catch (e) { console.warn("Could not pre-populate scenario:", e); }
                        switchView("simulation");
                      }}
                      className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition"
                      style={{ background: "#9CF700", color: "#020617" }}
                    >
                      Simulate this risk →
                    </button>
                  </div>
                );
              })()}

              {snapshotState !== "loading" && (!snapshot || showSnapshotCard) && (
                <SnapshotDataCard apiBase={API_BASE_CT} onCancel={snapshot ? () => setShowSnapshotCard(false) : null} onLoaded={(body) => { setSnapshot(body); setSnapshotState("ready"); setShowSnapshotCard(false); }} />
              )}
              {snapshot && showSnapshotCard && <IngestKeysCard apiBase={API_BASE_CT} />}

              {snapshot && (() => {
                const head = snapshot.kpis.filter((k) => k.headline).slice(0, 6);
                const rest = snapshot.kpis.filter((k) => !head.includes(k));
                const trendMap = { better: "up", worse: "down", flat: "neutral" };
                const card = (k) => (
                  <KpiCard key={k.key} value={snapFmt(k.value, k.unit)} label={k.label}
                    trend={trendMap[k.trend]} risk={k.status === "bad" ? "high" : k.status === "watch" ? "medium" : undefined}
                    deltaText={snapDelta(k, snapshot.window_days)} />
                );
                return (
                  <>
                    <section className="mb-6">
                      <div className="flex items-end justify-between mb-3 gap-3">
                        <div>
                          <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Network KPIs<SourceChip snapshot={snapshot} /></h2>
                          <div className="text-sm" style={{ color: "#64748B" }}>Last {snapshot.window_days} days to {snapshot.as_of}, compared with the {snapshot.window_days} days before.</div>
                        </div>
                        <div className="flex gap-3 text-sm items-center">
                          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(148,163,184,0.25)" }}>
                            {[7, 30, 90].map((d) => (
                              <button key={d} type="button" onClick={() => changeWindow(d)} className="px-2.5 py-1 text-xs font-semibold"
                                style={{ background: snapshot.window_days === d ? "#9FD63A" : "transparent", color: snapshot.window_days === d ? "#0B1512" : "#94A3B8" }}>
                                {d}d
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setShowSnapshotCard(true)} className="underline" style={{ color: "#94A3B8" }}>Update data</button>
                          <button type="button" onClick={removeSnapshot} className="underline" style={{ color: "#64748B" }}>Remove</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{head.map(card)}</div>
                      {snapshot.worst && (snapshot.worst.facilities?.length > 0 || snapshot.worst.customers?.length > 0 || snapshot.worst.suppliers?.length > 0) && (
                        <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(148,163,184,0.15)", background: "rgba(9,25,19,0.5)", color: "#94A3B8" }}>
                          <span className="text-[11px] uppercase tracking-widest" style={{ color: "#64748B" }}>Where it hurts</span>
                          {snapshot.worst.facilities?.length > 0 && <div className="mt-1">Facilities with the most past-due units: {snapshot.worst.facilities.map((f) => `${f.name} (${Math.round(f.units).toLocaleString("en-US")})`).join(", ")}</div>}
                          {snapshot.worst.customers?.length > 0 && <div className="mt-1">Customers with the most late lines: {snapshot.worst.customers.map((c) => `${c.name} (${c.lines})`).join(", ")}</div>}
                          {snapshot.worst.suppliers?.length > 0 && <div className="mt-1">Suppliers with overdue orders: {snapshot.worst.suppliers.map((c) => `${c.name} (${c.orders})`).join(", ")}</div>}
                        </div>
                      )}
                    </section>
                    <ExposureBlock exposure={exposure} state={exposureState} example={exposureExample} setExample={setExposureExample}
                      onAddLocations={() => setShowSnapshotCard(true)} onSimulate={simulateExposure} />
                    <NetworkRiskCard risk={netRisk} state={netRiskState} onSelectSite={handleFacilitySelect} onOpenRisk={() => switchView("risk")} />
                    <PartsAtRiskCard onSiteParts={setSiteParts} apiBase={API_BASE_CT} refreshKey={`${snapshot?.uploaded_at}|${snapshot?.source}`} onSelectSite={handleFacilitySelect} onOpenRisk={() => switchView("risk")} />
                    {rest.length > 0 && (
                      <section className="mb-6">
                        <button type="button" onClick={() => setMoreMetrics(!moreMetrics)} className="text-sm underline" style={{ color: "#94A3B8" }}>
                          {moreMetrics ? "Hide more metrics" : `Show more metrics (${rest.length})`}
                        </button>
                        {moreMetrics && <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{rest.map(card)}</div>}
                      </section>
                    )}
                  </>
                );
              })()}

              <LatestRunVerdict simulationHistory={simulationHistory} switchView={switchView} />
            </>
          )}

          {/* ── Simulations ── */}
          {activeView === "simulations" && (
            <section className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>🧪 Simulation Repository</h2>
                {!proPlus && (
                  <button onClick={goToBilling} className="rounded-xl border px-3 py-1.5 text-sm font-semibold transition" style={{ color: "#9FD63A", borderColor: "rgba(159,214,58,0.35)", background: "rgba(9,25,19,0.5)" }}>
                    Upgrade
                  </button>
                )}
              </div>
              {!proPlus ? (
                <div className="rounded-2xl p-5" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", border: "1px solid #143629" }}>
                  <UpgradeCtaCard plan={resolvedPlan} onUpgrade={goToBilling} />
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(simulationHistory) && simulationHistory.length > 0 ? (
                    simulationHistory.map((run, idx) => {
                      const kpis = run?.kpis || run?.raw?.kpis || {};
                      const svc = Number(kpis?.onTimeFulfillment ?? kpis?.serviceLevelPct ?? 0);
                      const ttr = Number(kpis?.ttrDays ?? kpis?.timeToRecoverDays ?? 0);
                      const rev = Number(kpis?.revenueExposure ?? kpis?.estimatedRevenueExposure ?? 0);
                      const nrs = (() => {
                        if (!svc) return null;
                        const backlog = Number(kpis?.peakBacklogUnits ?? kpis?.peakBacklog ?? 0);
                        const demand = Number(kpis?.serviceTruth?.totalDemand ?? 0);
                        const missed = Number(kpis?.missedServiceDays ?? 0);
                        const backlogPct = demand > 0 ? (backlog / demand) * 100 : 0;
                        const score = 0.55 * svc + 0.20 * (100 - Math.min(backlogPct, 100)) + 0.15 * (100 - Math.min((missed / 90) * 100, 100)) + 0.10 * (100 - Math.min((ttr / 30) * 100, 100));
                        return Math.max(0, Math.min(100, score)).toFixed(0);
                      })();
                      const nrsColor = !nrs ? "#9CA3AF" : nrs >= 90 ? "#16a34a" : nrs >= 72 ? "#d97706" : "#dc2626";
                      const nrsLabel = !nrs ? "No data" : nrs >= 90 ? "Resilient" : nrs >= 72 ? "Watch" : "Stressed";
                      const scenarioName = run?.name || run?.raw?.scenario_name || run?.scenario_name;
                      const runLabel = scenarioName || `Baseline Run`;
                      const runId = (run?.id || run?.run_id || run?.created_at || "").slice(-8);

                      return (
                        <div key={run.id || run.created_at || idx} className="rounded-xl border p-4 transition hover:-translate-y-0.5" style={{ background: "linear-gradient(145deg, rgba(13,31,24,0.85), rgba(6,37,26,0.75))", borderColor: "rgba(148,163,184,0.15)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {nrs && (
                                <div className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center border-2"
                                  style={{ borderColor: nrsColor, background: `${nrsColor}18` }}>
                                  <span className="text-[11px] font-bold leading-none" style={{ color: nrsColor }}>{nrs}</span>
                                  <span className="text-[8px] leading-none mt-0.5" style={{ color: nrsColor }}>NRS</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold truncate" style={{ color: "#9FD63A" }}>{runLabel}</div>
                                <div className="text-xs" style={{ color: "#64748B" }}>{(() => { const raw = run.created_at || run.timestamp || ""; if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) return raw; const d = new Date(raw.replace(" ", "T") + "Z"); if (isNaN(d)) return raw; const q = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())} ${q(d.getHours())}:${q(d.getMinutes())}:${q(d.getSeconds())}`; })()} {runId && `· ${runId}`}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => (typeof onReloadRun === "function" ? onReloadRun(run) : switchView?.("simulation"))}
                              className="shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold transition"
                              style={{ color: "#9FD63A", borderColor: "rgba(159,214,58,0.35)", background: "rgba(9,25,19,0.5)" }}
                            >
                              Open →
                            </button>
                          </div>

                          {svc > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${svc >= 95 ? "bg-emerald-500/15 text-emerald-300" : svc >= 80 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                                Service {svc.toFixed(1)}%
                              </span>
                              {ttr > 0 && (
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${ttr <= 7 ? "bg-emerald-500/15 text-emerald-300" : ttr <= 30 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                                  TTR {ttr}d
                                </span>
                              )}
                              {rev > 0 && (
                                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-orange-500/15 text-orange-300">
                                  ${rev >= 1000 ? `${(rev/1000).toFixed(0)}K` : rev} exposure
                                </span>
                              )}
                              <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: `${nrsColor}18`, color: nrsColor }}>
                                {nrsLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border p-4" style={{ background: "rgba(9,25,19,0.5)", borderColor: "#143629", color: "#94A3B8" }}>No runs yet.</div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Scenario Library ── */}
          {activeView === "scenario" && (
            <section className="mt-10">
              <ScenarioLibrary
                userPlan={resolvedPlan}
                getCurrentScenario={() => scenario}
                onApplyScenario={(data, meta) => applyScenario(data, meta?.name)}
              />
            </section>
          )}

          {/* ── Billing ── */}
          {activeView === "billing" && (
            <section className="mt-10">
              <BillingView switchView={switchView} />
            </section>
          )}

          {/* ── Admin ── */}
          {activeView === "admin" && isAdmin && (
            <section className="mt-10">
              <AdminPanel />
            </section>
          )}

        </div>
      </main>

      {tourActive && activeView === "dashboard" && (
        <OnboardingTour
          steps={TOUR_STEPS_CONTROL_TOWER}
          onFinish={finishTour}
          onSkip={finishTour}
        />
      )}

      {selectedFacility && (
        <FacilityDrawer
          facility={selectedFacility}
          snapshot={snapshot}
          exposure={exposure}
          risk={netRisk?.status === "ok" ? netRisk : null}
          siteParts={siteParts[selectedFacility] || []}
          onOpenRisk={() => switchView("risk")}
          onSimulate={simulateExposure}
          onClose={() => setSelectedFacility(null)}
        />
      )}

    </div>
  );
}
