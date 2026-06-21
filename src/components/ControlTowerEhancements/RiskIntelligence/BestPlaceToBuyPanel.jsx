// ─────────────────────────────────────────────────────────────────────────────
// BestPlaceToBuyPanel.jsx
// FOR-C Risk Intelligence — Best Place to Buy
//
// Inverts CorridorRiskPanel's single-country lookup into a ranked sourcing
// recommendation: filters origins to those with REAL production presence for
// the selected commodity (productionAvailability.js), then batch-scores every
// viable origin via the same /api/risk-intelligence/corridor endpoint, and
// ranks lowest-risk-first.
//
// This is the gate CorridorRiskPanel doesn't have: Australia will never appear
// as a recommended semiconductor source, regardless of how low its political-
// risk score might be, because it does not fabricate semiconductors.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useMemo } from "react";
import { getApiBase } from "../../../config/apiBase";
import {
  filterViableOrigins,
  getAvailabilityNote,
  getExcludedOrigins,
} from "./productionAvailability";

const API_BASE = getApiBase();

// ── Shared data (mirrors CorridorRiskPanel) ───────────────────────────────────
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
  { name: "Chile",          code: "CHL", flag: "🇨🇱", region: "South America" },
  { name: "Argentina",      code: "ARG", flag: "🇦🇷", region: "South America" },
  { name: "Singapore",      code: "SGP", flag: "🇸🇬", region: "Southeast Asia" },
  { name: "Ireland",        code: "IRL", flag: "🇮🇪", region: "Europe" },
  { name: "Switzerland",    code: "CHE", flag: "🇨🇭", region: "Europe" },
  { name: "Philippines",    code: "PHL", flag: "🇵🇭", region: "Southeast Asia" },
  { name: "Russia",         code: "RUS", flag: "🇷🇺", region: "Europe/Asia" },
  { name: "France",         code: "FRA", flag: "🇫🇷", region: "Europe" },
  { name: "Ukraine",        code: "UKR", flag: "🇺🇦", region: "Europe" },
];

const COMMODITY_TYPES = [
  { id: "automotive",    label: "Automotive / Industrial",      icon: "⚙️",
    weights: { geopolitical: 0.20, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.20, infrastructure: 0.15, tariff: 0.15, substitutability: 0.05 } },
  { id: "semiconductor", label: "Semiconductors / Electronics", icon: "🔬",
    weights: { geopolitical: 0.35, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.15, infrastructure: 0.05, tariff: 0.10, substitutability: 0.10 } },
  { id: "raw_materials", label: "Raw Materials / Minerals",     icon: "⛏️",
    weights: { geopolitical: 0.15, political_stability: 0.20, natural_disaster: 0.15, chokepoint: 0.20, infrastructure: 0.15, tariff: 0.10, substitutability: 0.05 } },
  { id: "food_ag",       label: "Food / Agriculture",           icon: "🌾",
    weights: { geopolitical: 0.10, political_stability: 0.20, natural_disaster: 0.25, chokepoint: 0.15, infrastructure: 0.15, tariff: 0.10, substitutability: 0.05 } },
  { id: "pharma",        label: "Pharmaceuticals / Chemicals",  icon: "💊",
    weights: { geopolitical: 0.25, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.15, infrastructure: 0.10, tariff: 0.15, substitutability: 0.10 } },
];

const riskColor = (score) => {
  if (score >= 75) return "#ef4444";
  if (score >= 55) return "#f97316";
  if (score >= 35) return "#eab308";
  return "#22c55e";
};

const riskLabel = (score) => {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
};

const tierBadge = (tier) => {
  if (tier === 1) return { label: "Major Producer", bg: "#E8F0EE", color: "#1D625B", border: "#9FD63A" };
  if (tier === 2) return { label: "Established Producer", bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" };
  return { label: "Emerging Producer", bg: "#F1EFE8", color: "#5F5E5A", border: "#D3D1C7" };
};

export default function BestPlaceToBuyPanel({ onLaunchScenario }) {
  const [selectedCommodity, setSelectedCommodity] = useState(COMMODITY_TYPES[0]);
  const [results,           setResults]           = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [progress,          setProgress]          = useState({ done: 0, total: 0 });
  const [error,             setError]             = useState(null);
  const [hasRun,            setHasRun]            = useState(false);

  const viableOrigins   = useMemo(() => filterViableOrigins(ORIGINS, selectedCommodity.id), [selectedCommodity]);
  const excludedOrigins = useMemo(() => getExcludedOrigins(ORIGINS, selectedCommodity.id), [selectedCommodity]);
  const availabilityNote = getAvailabilityNote(selectedCommodity.id);

  const scoreOrigin = useCallback(async (origin, commodity) => {
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
        commodity_label: commodity.label,
        commodity_id:    commodity.id,
        weights:         commodity.weights,
      }),
    });
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.error || `Scoring failed for ${origin.name}`);
    return data.result;
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setHasRun(true);
    setProgress({ done: 0, total: viableOrigins.length });

    const scored = [];
    for (const origin of viableOrigins) {
      try {
        const result = await scoreOrigin(origin, selectedCommodity);
        const compositeScore = Math.round(
          Object.entries(result.scores).reduce(
            (acc, [key, val]) => acc + val * (selectedCommodity.weights[key] || 0),
            0
          )
        );
        scored.push({ origin, result, compositeScore });
      } catch (e) {
        scored.push({ origin, result: null, compositeScore: null, error: e.message });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    scored.sort((a, b) => {
      if (a.compositeScore === null) return 1;
      if (b.compositeScore === null) return -1;
      return a.compositeScore - b.compositeScore;
    });

    setResults(scored);
    setLoading(false);
  }, [viableOrigins, selectedCommodity, scoreOrigin]);

  const handleSimulateBest = (entry) => {
    if (!onLaunchScenario || !entry.result) return;
    const severity = entry.compositeScore >= 75 ? 1.0 : entry.compositeScore >= 55 ? 0.7 : entry.compositeScore >= 35 ? 0.5 : 0.3;
    const scenarioName = `${entry.origin.name} Corridor Risk — ${selectedCommodity.label}`;
    onLaunchScenario({
      scenario: scenarioName,
      params: {
        facility: "NEXTY_MARYVILLE",
        severity,
        startDate: "2025-07-01",
        endDate: "2025-08-30",
        disruptionScenarios: [{
          facility: "NEXTY_MARYVILLE",
          startDate: "2025-07-01",
          endDate: "2025-08-30",
          severity,
          production_impact: severity,
          shipping_impact: 0,
        }],
        name: scenarioName,
      },
    });
  };

  const S = {
    wrap: { background: "#ffffff", border: "0.5px solid #D3D1C7", borderRadius: 12, overflow: "hidden" },
    header: { padding: "20px 24px", borderBottom: "0.5px solid #D3D1C7" },
    commodityRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 },
    commodityBtn: (active) => ({
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 14px", borderRadius: 20, cursor: "pointer",
      fontSize: 12, fontWeight: active ? 500 : 400,
      background: active ? "#1D625B" : "#F1EFE8",
      color: active ? "#ffffff" : "#5F5E5A",
      border: `0.5px solid ${active ? "#1D625B" : "#D3D1C7"}`,
      transition: "all 0.12s",
    }),
    body: { padding: "20px 24px" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.6, marginBottom: 4 }}>
          Ranks viable sourcing origins for a commodity by corridor risk — lowest risk first.
          Countries with no meaningful production presence for the selected commodity are
          excluded automatically, not just scored low.
        </div>

        <div style={S.commodityRow}>
          {COMMODITY_TYPES.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCommodity(c); setResults([]); setHasRun(false); }}
              style={S.commodityBtn(selectedCommodity.id === c.id)}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={S.body}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: "#F6F8FF", border: "0.5px solid #DBEAFE", borderRadius: 8,
          padding: "12px 16px", marginBottom: 16,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
          <div style={{ fontSize: 12, color: "#1D4ED8", lineHeight: 1.6 }}>
            {availabilityNote}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "#E8F0EE", color: "#1D625B", fontWeight: 500 }}>
            {viableOrigins.length} viable origin{viableOrigins.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "#F1EFE8", color: "#888780" }}>
            {excludedOrigins.length} excluded — no production presence
          </div>
        </div>

        {!hasRun && (
          <button
            onClick={runAnalysis}
            disabled={loading || viableOrigins.length === 0}
            style={{
              background: "linear-gradient(90deg, #9FD63A, #22c55e)",
              color: "#111B21", border: "none", borderRadius: 8,
              padding: "12px 24px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", marginBottom: 20,
            }}
          >
            Find Best Place to Buy →
          </button>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "2px solid #D3D1C7", borderTop: "2px solid #1D625B",
              animation: "forc-bptb-spin 0.9s linear infinite",
            }} />
            <style>{`@keyframes forc-bptb-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 12, color: "#888780" }}>
              Scoring corridor {progress.done} of {progress.total}...
            </div>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: "12px 16px", background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 8, color: "#DC2626", fontSize: 12, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {results.length > 0 && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((entry, idx) => {
              if (entry.compositeScore === null) {
                return (
                  <div key={entry.origin.code} style={{ padding: "10px 14px", background: "#FAFAF8", border: "0.5px solid #EDECEA", borderRadius: 8, fontSize: 11, color: "#B4B2A9" }}>
                    {entry.origin.flag} {entry.origin.name} — scoring unavailable
                  </div>
                );
              }
              const badge = tierBadge(entry.origin.productionTier.tier);
              const isBest = idx === 0;
              return (
                <div
                  key={entry.origin.code}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 18px",
                    background: isBest ? "#F0FDF4" : "#FAFAF8",
                    border: `0.5px solid ${isBest ? "#86EFAC" : "#EDECEA"}`,
                    borderLeft: `3px solid ${riskColor(entry.compositeScore)}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 600, color: isBest ? "#16A34A" : "#B4B2A9", minWidth: 28 }}>
                    {isBest ? "★" : `#${idx + 1}`}
                  </div>

                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{entry.origin.flag}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#2C2C2A" }}>{entry.origin.name}</span>
                      {isBest && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#16A34A", color: "#fff" }}>
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 3 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, background: badge.bg, color: badge.color, border: `0.5px solid ${badge.border}` }}>
                        {badge.label}
                      </span>
                      <span style={{ color: "#B4B2A9", marginLeft: 6 }}>{entry.origin.region}</span>
                    </div>
                  </div>

                  {entry.result?.top_risk_factor && (
                    <div style={{ fontSize: 10, color: "#888780", maxWidth: 160, lineHeight: 1.4 }}>
                      Top risk: <span style={{ color: "#5F5E5A" }}>{entry.result.top_risk_factor.replace(/_/g, " ")}</span>
                    </div>
                  )}

                  <div style={{ textAlign: "center", minWidth: 70 }}>
                    <div style={{ fontSize: 26, fontWeight: 600, color: riskColor(entry.compositeScore), lineHeight: 1 }}>
                      {entry.compositeScore}
                    </div>
                    <div style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: riskColor(entry.compositeScore) }}>
                      {riskLabel(entry.compositeScore)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSimulateBest(entry)}
                    style={{
                      background: isBest ? "#16A34A" : "#F1EFE8",
                      color: isBest ? "#fff" : "#5F5E5A",
                      border: "none", borderRadius: 6,
                      padding: "8px 14px", fontSize: 11, fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    Simulate →
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {hasRun && excludedOrigins.length > 0 && (
          <details style={{ marginTop: 20 }}>
            <summary style={{ fontSize: 11, color: "#888780", cursor: "pointer", userSelect: "none" }}>
              {excludedOrigins.length} countries excluded — no {selectedCommodity.label.toLowerCase()} production
            </summary>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {excludedOrigins.map((o) => (
                <span key={o.code} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#F1EFE8", color: "#B4B2A9" }}>
                  {o.flag} {o.name}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
