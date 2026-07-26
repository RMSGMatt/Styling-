// ─────────────────────────────────────────────────────────────────────────────
// CountryWatchListPanel.jsx
// FOR-C Risk Intelligence — Country Watch List
//
// A standing, commodity-agnostic risk ranking of every tracked origin
// country. Unlike Corridor Risk (single-country lookup) or Best Place to
// Buy (commodity-specific sourcing recommendation), this view answers a
// simpler standing question: "which countries carry the most country-level
// risk, period — regardless of what I'm sourcing from them?"
//
// Reuses the existing /api/risk-intelligence/corridor endpoint with a
// neutral weighting that EXCLUDES the two genuinely commodity-specific
// variables (tariff, substitutability) — geopolitical alignment, political
// stability, natural disaster exposure, chokepoint exposure, and
// infrastructure quality are properties of the country itself, not the
// product moving through it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import { getApiBase } from "../../../config/apiBase";
import { riskColor100 as riskColor, riskLabel100 as riskLabel } from "./riskScoreEngine";

const API_BASE = getApiBase();

const ORIGINS = [
  { name: "China",          code: "CHN", flag: "🇨🇳", region: "East Asia" },
  { name: "Taiwan",         code: "TWN", flag: "🇹🇼", region: "East Asia" },
  { name: "Japan",          code: "JPN", flag: "🇯🇵", region: "East Asia" },
  { name: "South Korea",    code: "KOR", flag: "🇰🇷", region: "East Asia" },
  { name: "Vietnam",        code: "VNM", flag: "🇻🇳", region: "Southeast Asia" },
  { name: "Malaysia",       code: "MYS", flag: "🇲🇾", region: "Southeast Asia" },
  { name: "Thailand",       code: "THA", flag: "🇹🇭", region: "Southeast Asia" },
  { name: "India",          code: "IND", flag: "🇮🇳", region: "South Asia" },
  { name: "Mexico",         code: "MEX", flag: "🇲🇽", region: "North America" },
  { name: "Canada",         code: "CAN", flag: "🇨🇦", region: "North America" },
  { name: "Germany",        code: "DEU", flag: "🇩🇪", region: "Europe" },
  { name: "Poland",         code: "POL", flag: "🇵🇱", region: "Europe" },
  { name: "Czech Republic", code: "CZE", flag: "🇨🇿", region: "Europe" },
  { name: "Turkey",         code: "TUR", flag: "🇹🇷", region: "Europe/Middle East" },
  { name: "Brazil",         code: "BRA", flag: "🇧🇷", region: "South America" },
  { name: "South Africa",   code: "ZAF", flag: "🇿🇦", region: "Africa" },
  { name: "Saudi Arabia",   code: "SAU", flag: "🇸🇦", region: "Middle East" },
  { name: "Israel",         code: "ISR", flag: "🇮🇱", region: "Middle East" },
  { name: "Australia",      code: "AUS", flag: "🇦🇺", region: "Oceania" },
  { name: "Indonesia",      code: "IDN", flag: "🇮🇩", region: "Southeast Asia" },
];

const GENERIC_WEIGHTS = {
  geopolitical:        0.25,
  political_stability: 0.25,
  natural_disaster:    0.20,
  chokepoint:           0.20,
  infrastructure:       0.10,
  tariff:               0,
  substitutability:     0,
};

// riskColor/riskLabel now imported from riskScoreEngine.js — see
// CorridorRiskPanel.jsx for why this was consolidated.

export default function CountryWatchListPanel({ onSelectCountry }) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hasRun,   setHasRun]   = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const scoreCountry = useCallback(async (origin) => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      "";

    const res = await fetch(`${API_BASE}/api/risk-intelligence/corridor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        origin_name:     origin.name,
        origin_code:     origin.code,
        commodity_label: "General Sourcing Risk",
        commodity_id:    "general",
        weights:         GENERIC_WEIGHTS,
        is_bulk:         true,
      }),
    });
    if (res.status === 402) {
      const err = new Error("upgrade_required");
      err.isUpgradeRequired = true;
      throw err;
    }
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.error || `Scoring failed for ${origin.name}`);
    return data.result;
  }, []);

  const CONCURRENCY = 4;

  const runScan = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    setResults([]);
    setUpgradeRequired(false);
    setProgress({ done: 0, total: ORIGINS.length });

    const scored = new Array(ORIGINS.length);
    let cursor = 0;
    let doneCount = 0;

    async function worker() {
      while (cursor < ORIGINS.length) {
        const i = cursor++;
        const origin = ORIGINS[i];
        try {
          const result = await scoreCountry(origin);
          const compositeScore = Math.round(
            Object.entries(result.scores).reduce(
              (acc, [key, val]) => acc + val * (GENERIC_WEIGHTS[key] || 0),
              0
            )
          );
          scored[i] = { origin, result, compositeScore };
        } catch (e) {
          if (e.isUpgradeRequired) {
            setUpgradeRequired(true);
            setLoading(false);
            return;
          }
          scored[i] = { origin, result: null, compositeScore: null, error: e.message };
        }
        doneCount++;
        setProgress((p) => ({ ...p, done: doneCount }));
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(workers);

    const ranked = scored.filter(Boolean).sort((a, b) => {
      if (a.compositeScore === null) return 1;
      if (b.compositeScore === null) return -1;
      return b.compositeScore - a.compositeScore;
    });

    setResults(ranked);
    setLoading(false);
  }, [scoreCountry]);

  const S = {
    wrap: { background: "rgba(2,6,23,0.5)", border: "0.5px solid rgba(148,163,184,0.15)", borderRadius: 12, overflow: "hidden" },
    header: { padding: "20px 24px", borderBottom: "0.5px solid rgba(148,163,184,0.15)" },
    body: { padding: "20px 24px" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
          A standing, commodity-agnostic risk ranking of every tracked sourcing country —
          geopolitical alignment, political stability, natural disaster exposure, chokepoint
          dependency, and infrastructure quality. This reflects country-level risk only;
          it does not factor in tariffs or product-specific substitutability, since those
          depend on what you're sourcing, not where from.
        </div>
      </div>

      <div style={S.body}>
        {!hasRun && (
          <button
            onClick={runScan}
            disabled={loading}
            style={{
              background: "linear-gradient(90deg, #9FD63A, #22c55e)",
              color: "#111B21", border: "none", borderRadius: 8,
              padding: "12px 24px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", marginBottom: 8,
            }}
          >
            Scan All Countries →
          </button>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "2px solid rgba(148,163,184,0.15)", borderTop: "2px solid #2EC4A6",
              animation: "forc-cwl-spin 0.9s linear infinite",
            }} />
            <style>{`@keyframes forc-cwl-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              Scoring country {progress.done} of {progress.total}...
            </div>
          </div>
        )}

        {upgradeRequired && !loading && (
          <div style={{
            padding: "20px 24px", borderRadius: 12,
            background: "rgba(86,244,177,0.08)", border: "1px solid rgba(86,244,177,0.22)",
            display: "flex", flexDirection: "column", gap: 10, marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2EC4A6" }}>
              🔒 Enterprise plan required
            </div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
              Country Watch List bulk scanning requires an Enterprise plan. Upgrade to access unlimited bulk corridor scoring across all sourcing countries, Supplier Screening, and Best Place to Buy.
            </div>
            <button
              onClick={() => window.location.href = "/billing"}
              style={{
                alignSelf: "flex-start",
                background: "rgba(86,244,177,0.95)", border: "none",
                color: "#062014", borderRadius: 8, padding: "8px 16px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Upgrade to Enterprise →
            </button>
          </div>
        )}

        {results.length > 0 && !loading && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {["CRITICAL", "HIGH", "MODERATE", "LOW"].map((label) => {
                const count = results.filter(
                  (r) => r.compositeScore !== null && riskLabel(r.compositeScore) === label
                ).length;
                const color =
                  label === "CRITICAL" ? "#ef4444" :
                  label === "HIGH"     ? "#f97316" :
                  label === "MODERATE" ? "#eab308" : "#22c55e";
                return (
                  <div key={label} style={{
                    fontSize: 11, padding: "5px 12px", borderRadius: 20,
                    background: `${color}15`, color, fontWeight: 600,
                    border: `0.5px solid ${color}40`,
                  }}>
                    {count} {label}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((entry, idx) => {
                if (entry.compositeScore === null) {
                  return (
                    <div key={entry.origin.code} style={{ padding: "10px 14px", background: "rgba(2,6,23,0.4)", border: "0.5px solid rgba(148,163,184,0.12)", borderRadius: 8, fontSize: 11, color: "rgba(148,163,184,0.3)" }}>
                      {entry.origin.flag} {entry.origin.name} — scoring unavailable
                    </div>
                  );
                }
                const color = riskColor(entry.compositeScore);
                const isExpanded = expanded === entry.origin.code;
                return (
                  <div
                    key={entry.origin.code}
                    style={{
                      background: "rgba(2,6,23,0.4)",
                      border: "0.5px solid rgba(148,163,184,0.12)",
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => setExpanded(isExpanded ? null : entry.origin.code)}
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "12px 16px", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(148,163,184,0.3)", minWidth: 24 }}>
                        #{idx + 1}
                      </div>
                      <span style={{ fontSize: 18 }}>{entry.origin.flag}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0" }}>{entry.origin.name}</div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.3)" }}>{entry.origin.region}</div>
                      </div>
                      {entry.result?.state_dept_advisory && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                          background: `${entry.result.state_dept_advisory.color}1A`,
                          color: entry.result.state_dept_advisory.color,
                          border: `0.5px solid ${entry.result.state_dept_advisory.color}50`,
                        }}>
                          STATE DEPT L{entry.result.state_dept_advisory.level}
                        </span>
                      )}
                      {entry.result?.uflpa?.flagged && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                          background: entry.result.uflpa.matched_entity ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                          color: entry.result.uflpa.matched_entity ? "#f87171" : "#facc15",
                        }}>
                          {entry.result.uflpa.matched_entity ? "UFLPA MATCH" : "UFLPA ADVISORY"}
                        </span>
                      )}
                      <div style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>
                          {entry.compositeScore}
                        </div>
                        <div style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
                          {riskLabel(entry.compositeScore)}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: "rgba(148,163,184,0.3)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                        ▸
                      </div>
                    </div>

                    {isExpanded && entry.result && (
                      <div style={{ padding: "0 16px 16px 16px", borderTop: "0.5px solid rgba(148,163,184,0.12)" }}>
                        <div style={{ fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.7, padding: "12px 0 8px" }}>
                          {entry.result.executive_summary}
                        </div>
                        {onSelectCountry && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectCountry(entry.origin); }}
                            style={{
                              fontSize: 11, fontWeight: 600, color: "#2EC4A6",
                              background: "#E8F0EE", border: "0.5px solid #9FD63A",
                              borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                            }}
                          >
                            View full Corridor Risk analysis →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
