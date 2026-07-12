// ─────────────────────────────────────────────────────────────────────────────
// CorridorRiskPanel.jsx
// FOR-C Risk Intelligence — Geopolitical corridor risk scorer
// Calls /api/risk-intelligence/corridor on the Flask backend
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import { getApiBase } from "../../../config/apiBase";

const API_BASE = getApiBase();

// ── Data ─────────────────────────────────────────────────────────────────────
const DESTINATION = { name: "United States", flag: "🇺🇸" };

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

const COMMODITY_TYPES = [
  { id: "automotive",    label: "Automotive / Industrial",       icon: "⚙️",
    weights: { geopolitical: 0.20, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.20, infrastructure: 0.15, tariff: 0.15, substitutability: 0.05 } },
  { id: "semiconductor", label: "Semiconductors / Electronics",  icon: "🔬",
    weights: { geopolitical: 0.35, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.15, infrastructure: 0.05, tariff: 0.10, substitutability: 0.10 } },
  { id: "raw_materials", label: "Raw Materials / Minerals",      icon: "⛏️",
    weights: { geopolitical: 0.15, political_stability: 0.20, natural_disaster: 0.15, chokepoint: 0.20, infrastructure: 0.15, tariff: 0.10, substitutability: 0.05 } },
  { id: "food_ag",       label: "Food / Agriculture",            icon: "🌾",
    weights: { geopolitical: 0.10, political_stability: 0.20, natural_disaster: 0.25, chokepoint: 0.15, infrastructure: 0.15, tariff: 0.10, substitutability: 0.05 } },
  { id: "pharma",        label: "Pharmaceuticals / Chemicals",   icon: "💊",
    weights: { geopolitical: 0.25, political_stability: 0.15, natural_disaster: 0.10, chokepoint: 0.15, infrastructure: 0.10, tariff: 0.15, substitutability: 0.10 } },
];

const VARIABLE_META = {
  geopolitical:        { label: "Geopolitical Alignment",     desc: "US alliance status, UN voting similarity, treaty relationships" },
  political_stability: { label: "Political Stability",         desc: "Regime stability, civil unrest, coup risk, governance quality" },
  natural_disaster:    { label: "Natural Disaster Exposure",   desc: "Earthquake, flood, typhoon, climate event frequency" },
  chokepoint:          { label: "Chokepoint / Route Exposure", desc: "Strait of Malacca, Taiwan Strait, Suez, Panama Canal dependency" },
  infrastructure:      { label: "Infrastructure Quality",      desc: "World Bank LPI, port efficiency, logistics performance" },
  tariff:              { label: "Trade War / Tariff Level",    desc: "Current tariff rates, active trade disputes, sanction exposure" },
  substitutability:    { label: "Import Substitution",         desc: "Nearshoring feasibility, domestic production capacity, allied alternatives" },
};

// Facility mapping: closest facility per origin country (for scenario pre-fill)
const ORIGIN_TO_FACILITY = {
  TWN: "TSMC_TAIWAN",
  JPN: "MURATA_JAPAN",
  CHN: "TSMC_TAIWAN",
  KOR: "TDK_JAPAN",
  VNM: "NEXTY_MARYVILLE",
  MYS: "NEXTY_MARYVILLE",
  THA: "NEXTY_MARYVILLE",
  IND: "NEXTY_MARYVILLE",
  MEX: "DENSO_BATTLE_CREEK",
  CAN: "DENSO_BATTLE_CREEK",
  DEU: "AISIN_SEIKI_US",
  POL: "AISIN_SEIKI_US",
  CZE: "AISIN_SEIKI_US",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const severityFromScore = (score) => {
  if (score >= 75) return 1.0;
  if (score >= 55) return 0.7;
  if (score >= 35) return 0.5;
  return 0.3;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CorridorRiskPanel({ onLaunchScenario }) {
  const [selectedOrigin,    setSelectedOrigin]    = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState(COMMODITY_TYPES[0]);
  const [result,            setResult]            = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [activeRegion,      setActiveRegion]      = useState("All");

  const regions = ["All", ...Array.from(new Set(ORIGINS.map((o) => o.region)))];
  const filteredOrigins = activeRegion === "All"
    ? ORIGINS
    : ORIGINS.filter((o) => o.region === activeRegion);

  const analyze = useCallback(async (origin, commodity) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
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
          origin_name:      origin.name,
          origin_code:      origin.code,
          commodity_label:  commodity.label,
          commodity_id:     commodity.id,
          weights:          commodity.weights,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setResult(data.result);
      } else {
        setError(data.error || "Analysis failed.");
      }
    } catch (e) {
      setError("Could not reach the risk intelligence service.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOriginSelect = (origin) => {
    setSelectedOrigin(origin);
    analyze(origin, selectedCommodity);
  };

  const handleCommodityChange = (commodity) => {
    setSelectedCommodity(commodity);
    if (selectedOrigin) analyze(selectedOrigin, commodity);
  };

  const compositeScore = result
    ? Math.round(
        Object.entries(result.scores).reduce((acc, [key, val]) => {
          return acc + val * (selectedCommodity.weights[key] || 0);
        }, 0)
      )
    : null;

  // Wire "Simulate This Disruption →" into handleLaunchScenario
  const handleSimulate = () => {
    if (!selectedOrigin || compositeScore === null || !onLaunchScenario) return;

    const facility = ORIGIN_TO_FACILITY[selectedOrigin.code] || "NEXTY_MARYVILLE";
    const severity = severityFromScore(compositeScore);
    const scenarioName = `${selectedOrigin.name} Corridor Risk — ${selectedCommodity.label}`;

    onLaunchScenario({
      scenario: scenarioName,
      params: {
        facility,
        severity,
        startDate: "2025-07-01",
        endDate: "2025-08-30",
        disruptionScenarios: [{
          facility,
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

  // ── Styles (matching FOR-C Risk Intelligence light theme) ─────────────────
  const S = {
    wrap: {
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 0,
      minHeight: 600,
      border: "0.5px solid #1E2733",
      borderRadius: 12,
      overflow: "hidden",
      background: "#141B23",
    },
    sidebar: {
      borderRight: "0.5px solid #1E2733",
      background: "#141B23",
      overflowY: "auto",
    },
    sideSection: {
      padding: "14px 14px 10px",
      borderBottom: "0.5px solid #1E2733",
    },
    sideLabel: {
      fontSize: 9,
      color: "#7A8A99",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 10,
      fontWeight: 500,
    },
    commodityBtn: (active) => ({
      width: "100%",
      textAlign: "left",
      background: active ? "#1A2129" : "none",
      border: "none",
      borderLeft: `2px solid ${active ? "#9FD63A" : "transparent"}`,
      color: active ? "#9FD63A" : "#7A8A99",
      padding: "7px 10px",
      cursor: "pointer",
      fontSize: 11,
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 1,
      transition: "all 0.12s",
      borderRadius: "0 4px 4px 0",
    }),
    regionBtn: (active) => ({
      background: active ? "rgba(159,214,58,0.1)" : "none",
      border: `0.5px solid ${active ? "#9FD63A" : "#1E2733"}`,
      color: active ? "#9FD63A" : "#7A8A99",
      padding: "3px 7px",
      borderRadius: 4,
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: "0.06em",
      marginBottom: 3,
    }),
    countryBtn: (active) => ({
      width: "100%",
      textAlign: "left",
      background: active ? "#1A2129" : "none",
      border: "none",
      borderLeft: `2px solid ${active ? "#f97316" : "transparent"}`,
      color: active ? "#F1F5F9" : "#7A8A99",
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      transition: "all 0.1s",
    }),
    main: {
      padding: "24px 28px",
      overflowY: "auto",
      background: "#141B23",
    },
  };

  return (
    <div>
      {/* Panel header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#7A8A99", lineHeight: 1.6 }}>
          AI-powered geopolitical risk scoring for trade corridors into the United States.
          Select an origin country and commodity type — FOR-C scores 7 risk variables and
          generates an executive summary with a direct path to simulation.
        </div>
      </div>

      <div style={S.wrap}>
        {/* ── Sidebar ── */}
        <div style={S.sidebar}>
          {/* Commodity */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Commodity Type</div>
            {COMMODITY_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCommodityChange(c)}
                style={S.commodityBtn(selectedCommodity.id === c.id)}
              >
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <span style={{ lineHeight: 1.3 }}>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Region filter */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Region</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {regions.map((r) => (
                <button key={r} onClick={() => setActiveRegion(r)} style={S.regionBtn(activeRegion === r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Countries */}
          <div style={{ padding: "12px 0 0" }}>
            <div style={{ ...S.sideLabel, padding: "0 14px", marginBottom: 8 }}>Origin Country</div>
            {filteredOrigins.map((o) => (
              <button
                key={o.code}
                onClick={() => handleOriginSelect(o)}
                style={S.countryBtn(selectedOrigin?.code === o.code)}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{o.flag}</span>
                <div>
                  <div style={{ fontSize: 12 }}>{o.name}</div>
                  <div style={{ fontSize: 9, color: "#55606B", marginTop: 1 }}>{o.region}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main panel ── */}
        <div style={S.main}>
          {/* Empty state */}
          {!selectedOrigin && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, opacity: 0.5, minHeight: 400 }}>
              <div style={{ fontSize: 40, opacity: 0.3 }}>🌐</div>
              <div style={{ fontSize: 12, color: "#7A8A99", textAlign: "center", maxWidth: 280, lineHeight: 1.7 }}>
                Select an origin country to score the trade corridor risk for the selected commodity type.
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, minHeight: 400 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "2px solid #1E2733", borderTop: "2px solid #9FD63A",
                animation: "forc-spin 0.9s linear infinite",
              }} />
              <style>{`@keyframes forc-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 11, color: "#7A8A99", letterSpacing: "0.08em" }}>
                Analyzing {selectedOrigin?.name} → USA corridor...
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#DC2626", fontSize: 12, marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}

          {/* Results */}
          {result && !loading && selectedOrigin && compositeScore !== null && (
            <div>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#7A8A99", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Risk Corridor Analysis
                  </div>
                  <div style={{ fontSize: 20, color: "#F1F5F9", display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
                    <span>{selectedOrigin.flag} {selectedOrigin.name}</span>
                    <span style={{ color: "#1E2733" }}>→</span>
                    <span>{DESTINATION.flag} {DESTINATION.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#7A8A99", marginTop: 3 }}>
                    {selectedCommodity.icon} {selectedCommodity.label}
                  </div>
                </div>

                {/* Composite score */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
                  <div style={{
                    background: "#141B23",
                    border: `0.5px solid ${riskColor(compositeScore)}40`,
                    borderTop: `3px solid ${riskColor(compositeScore)}`,
                    borderRadius: 10,
                    padding: "14px 20px",
                    textAlign: "center",
                    minWidth: 130,
                  }}>
                    <div style={{ fontSize: 44, fontWeight: 600, color: riskColor(compositeScore), lineHeight: 1 }}>
                      {compositeScore}
                    </div>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: riskColor(compositeScore), marginTop: 4 }}>
                      {riskLabel(compositeScore)} RISK
                    </div>
                    <div style={{ fontSize: 9, color: "#55606B", marginTop: 4 }}>Composite / 100</div>
                  </div>

                  {result.state_dept_advisory && (
                    <div style={{
                      background: "#141B23",
                      border: `0.5px solid ${result.state_dept_advisory.color}40`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 8, color: "#7A8A99", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        State Dept Advisory
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: result.state_dept_advisory.color, marginTop: 2 }}>
                        Level {result.state_dept_advisory.level}
                      </div>
                      <div style={{ fontSize: 8, color: "#55606B" }}>
                        {result.state_dept_advisory.label}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Executive summary */}
              <div style={{
                background: "#141B23",
                border: "0.5px solid #1E2733",
                borderLeft: `3px solid ${riskColor(compositeScore)}`,
                borderRadius: 8,
                padding: "14px 18px",
                marginBottom: 20,
              }}>
                {result.uflpa?.flagged && (
                  <div style={{
                    background: result.uflpa.matched_entity ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.1)",
                    border: `1.5px solid ${result.uflpa.matched_entity ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.3)"}`,
                    borderRadius: 8,
                    padding: "14px 18px",
                    marginBottom: 16,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {result.uflpa.matched_entity ? "🚫" : "⚠️"}
                    </span>
                    <div>
                      <div style={{
                        fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                        fontWeight: 700,
                        color: result.uflpa.matched_entity ? "#F87171" : "#FBBF24",
                        marginBottom: 4,
                      }}>
                        {result.uflpa.matched_entity ? "UFLPA Entity List Match" : "UFLPA Advisory"}
                      </div>
                      <div style={{
                        fontSize: 12, lineHeight: 1.6,
                        color: result.uflpa.matched_entity ? "#F87171" : "#FBBF24",
                      }}>
                        {result.uflpa.reason}
                      </div>
                      <div style={{ fontSize: 9, color: "#55606B", marginTop: 6 }}>
                        Source: DHS UFLPA Entity List via OpenSanctions.org — refreshed every 24 hours.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 9, color: "#7A8A99", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Executive Summary
                </div>
                <div style={{ color: "#C7D0D9", lineHeight: 1.75, fontSize: 12 }}>
                  {result.executive_summary}
                </div>
              </div>

              {/* Recent signals */}
              {result.recent_signals?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, color: "#7A8A99", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                    Live Risk Signals
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {result.recent_signals.map((s, i) => (
                      <div key={i} style={{
                        background: "#1A2129",
                        border: "0.5px solid rgba(59,130,246,0.12)",
                        padding: "8px 12px",
                        fontSize: 11,
                        color: "#7DB8F0",
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        borderRadius: 6,
                      }}>
                        <span style={{ color: "#93C5FD", flexShrink: 0 }}>▸</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variable breakdown */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "#7A8A99", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Variable Breakdown
                </div>
                <div style={{ display: "grid", gap: 2 }}>
                  {Object.entries(VARIABLE_META)
                    .sort((a, b) => (selectedCommodity.weights[b[0]] || 0) - (selectedCommodity.weights[a[0]] || 0))
                    .map(([key, meta]) => {
                      const score = result.scores[key] ?? 0;
                      const weight = selectedCommodity.weights[key] || 0;
                      const isTop = key === result.top_risk_factor;
                      return (
                        <div key={key} style={{
                          background: isTop ? "rgba(245,158,11,0.12)" : "#141B23",
                          border: `0.5px solid ${isTop ? "rgba(245,158,11,0.35)" : "#1E2733"}`,
                          borderLeft: `3px solid ${isTop ? "#f97316" : riskColor(score) + "60"}`,
                          borderRadius: 6,
                          padding: "10px 14px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7, gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
                                {isTop && (
                                  <span style={{ fontSize: 9, background: "rgba(245,158,11,0.35)", color: "#FDBA74", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                                    TOP RISK
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: "#55606B" }}>{meta.desc}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 22, fontWeight: 600, color: riskColor(score), lineHeight: 1 }}>{score}</div>
                              <div style={{ fontSize: 9, color: "#55606B" }}>wt: {(weight * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                          {/* Score bar */}
                          <div style={{ height: 3, background: "#1E2733", borderRadius: 2, marginBottom: 7 }}>
                            <div style={{
                              height: "100%",
                              width: `${score}%`,
                              background: `linear-gradient(90deg, ${riskColor(score)}50, ${riskColor(score)})`,
                              borderRadius: 2,
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                          {result.reasoning?.[key] && (
                            <div style={{ fontSize: 11, color: "#C7D0D9", lineHeight: 1.6 }}>
                              {result.reasoning[key]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Simulate CTA */}
              <div style={{
                background: "linear-gradient(135deg, #0D1F18, #0B3D2E)",
                border: "0.5px solid #1E3D2C",
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white", marginBottom: 4 }}>
                    Ready to quantify the downstream impact?
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>
                    FOR-C will simulate a {selectedOrigin.name} disruption at{" "}
                    <span style={{ color: "#9FD63A" }}>
                      {ORIGIN_TO_FACILITY[selectedOrigin.code] || "the nearest facility"}
                    </span>{" "}
                    with severity {Math.round(severityFromScore(compositeScore) * 100)}% — matching this corridor's risk score.
                  </div>
                </div>
                <button
                  onClick={handleSimulate}
                  style={{
                    background: "linear-gradient(90deg, #9FD63A, #22c55e)",
                    color: "#111B21",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Simulate This Disruption →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
