// src/components/ThreatIntelPanel.jsx
// Standalone live threat feed — fetches GDACS, USGS, NOAA independently.
// Drop below the MapView container. No props required.

import React, { useEffect, useState, useCallback } from "react";
import { getApiBase } from "../config/apiBase";

const API_BASE = getApiBase();

// ── Severity helpers ──────────────────────────────────────────────────────────
function gdacsSeverity(props = {}) {
  const lvl = String(props.alertlevel || props.severity || "").toLowerCase();
  if (lvl === "red") return "red";
  if (lvl === "orange") return "orange";
  return "yellow";
}

function usgsSeverity(mag) {
  if (mag >= 7) return "red";
  if (mag >= 6) return "orange";
  return "yellow";
}

function noaaSeverity(props = {}) {
  const sev = String(props.severity || "").toLowerCase();
  if (sev === "extreme" || sev === "severe") return "red";
  if (sev === "moderate") return "orange";
  return "yellow";
}

const SEV_COLOR = {
  red:    "#F87171",
  orange: "#FB923C",
  yellow: "#FBBF24",
};

const SEV_LABEL = {
  red:    "HIGH",
  orange: "MED",
  yellow: "LOW",
};

function gdacsEmoji(props = {}) {
  const t = String(props.type || props.eventtype || "").toLowerCase();
  if (t === "eq" || t.includes("earthquake")) return "🌍";
  if (t === "fl" || t.includes("flood"))      return "🌊";
  if (t.includes("cyclone") || t.includes("storm") || t.includes("hurricane")) return "🌀";
  if (t.includes("fire"))    return "🔥";
  if (t.includes("volcano")) return "🌋";
  return "⚠️";
}

function noaaEmoji(props = {}) {
  const e = String(props.event || "").toLowerCase();
  if (e.includes("tornado"))  return "🌪️";
  if (e.includes("flood"))    return "🌊";
  if (e.includes("winter") || e.includes("snow")) return "❄️";
  if (e.includes("hurricane") || e.includes("tropical")) return "🌀";
  if (e.includes("fire"))     return "🔥";
  if (e.includes("heat"))     return "🥵";
  return "⚠️";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ThreatIntelPanel() {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updated, setUpdated]   = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // all | red | orange

  const fetchAll = useCallback(async () => {
    const collected = [];

    // GDACS
    try {
      const res  = await fetch(`${API_BASE}/api/gdacs-feed`);
      const data = await res.json();
      (data?.features || []).forEach((f) => {
        const p   = f.properties || {};
        const sev = gdacsSeverity(p);
        collected.push({
          id:     `gdacs-${f.id || p.eventid || Math.random()}`,
          source: "GDACS",
          emoji:  gdacsEmoji(p),
          label:  p.name || p.type || "Event",
          region: p.country || p.iso3 || "",
          sev,
        });
      });
    } catch {}

    // USGS M5+
    try {
      const res  = await fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
      );
      const data = await res.json();
      (data?.features || [])
        .filter((f) => Number(f.properties?.mag || 0) >= 5)
        .slice(0, 10)
        .forEach((f) => {
          const mag = Number(f.properties?.mag || 0);
          const sev = usgsSeverity(mag);
          collected.push({
            id:     `usgs-${f.id || Math.random()}`,
            source: "USGS",
            emoji:  mag >= 7 ? "🔴" : mag >= 6 ? "🟠" : "🟡",
            label:  `M${mag.toFixed(1)} — ${(f.properties?.place || "Unknown").slice(0, 45)}`,
            region: "",
            sev,
          });
        });
    } catch {}

    // NOAA
    try {
      const res  = await fetch("https://api.weather.gov/alerts/active", {
        headers: { Accept: "application/geo+json" },
      });
      const data = await res.json();
      (data?.features || [])
        .slice(0, 8)
        .forEach((f) => {
          const p   = f.properties || {};
          const sev = noaaSeverity(p);
          collected.push({
            id:     `noaa-${f.id || Math.random()}`,
            source: "NOAA",
            emoji:  noaaEmoji(p),
            label:  p.event || p.headline || "Alert",
            region: (p.areaDesc || "").slice(0, 30),
            sev,
          });
        });
    } catch {}

    // Sort: red first, then orange, then yellow
    const sevOrder = { red: 0, orange: 1, yellow: 2 };
    collected.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);

    setEvents(collected);
    setUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const filtered =
    activeTab === "all"
      ? events
      : events.filter((e) => e.sev === activeTab);

  const redCount    = events.filter((e) => e.sev === "red").length;
  const orangeCount = events.filter((e) => e.sev === "orange").length;

  return (
    <div
      className="rounded-2xl mt-3 p-4"
      style={{
        background: "#0a1a16",
        border: "1px solid rgba(159,214,58,0.15)",
        minHeight: "148px",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#9FD63A" }}
          >
            🌐 Threat Intelligence
          </span>

          {/* Summary badges */}
          {!loading && (
            <div className="flex gap-1.5">
              {redCount > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "#F8717122",
                    color: "#F87171",
                    border: "1px solid #F8717155",
                  }}
                >
                  {redCount} HIGH
                </span>
              )}
              {orangeCount > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "#FB923C22",
                    color: "#FB923C",
                    border: "1px solid #FB923C55",
                  }}
                >
                  {orangeCount} MED
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex gap-1">
            {["all", "red", "orange"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-xs px-2 py-0.5 rounded-lg transition-all"
                style={{
                  background:
                    activeTab === tab
                      ? tab === "all"
                        ? "rgba(159,214,58,0.15)"
                        : `${SEV_COLOR[tab]}22`
                      : "transparent",
                  color:
                    activeTab === tab
                      ? tab === "all"
                        ? "#9FD63A"
                        : SEV_COLOR[tab]
                      : "rgba(255,255,255,0.3)",
                  border:
                    activeTab === tab
                      ? `1px solid ${tab === "all" ? "#9FD63A55" : SEV_COLOR[tab] + "55"}`
                      : "1px solid transparent",
                }}
              >
                {tab === "all" ? "All" : SEV_LABEL[tab]}
              </button>
            ))}
          </div>

          {updated && (
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>
              {updated}
            </span>
          )}
        </div>
      </div>

      {/* ── Event list ── */}
      {loading ? (
        <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span className="text-xs animate-pulse">Fetching live threat data…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          No {activeTab === "all" ? "" : SEV_LABEL[activeTab] + " "}events detected.
        </div>
      ) : (
        <div
          className="grid gap-1.5 overflow-y-auto pr-1"
          style={{
            maxHeight: "90px",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {filtered.map((ev) => {
            const color = SEV_COLOR[ev.sev];
            return (
              <div
                key={ev.id}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: `${color}0d`, border: `1px solid ${color}22` }}
              >
                {/* Severity dot */}
                <span
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    background: color,
                    boxShadow: `0 0 5px ${color}`,
                    flexShrink: 0,
                  }}
                />
                {/* Source badge */}
                <span
                  className="text-xs font-bold flex-shrink-0"
                  style={{ color, minWidth: 36 }}
                >
                  {ev.source}
                </span>
                {/* Emoji + label */}
                <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {ev.emoji} {ev.label}
                  {ev.region && (
                    <span style={{ color: "rgba(255,255,255,0.35)" }}> · {ev.region}</span>
                  )}
                </span>
                {/* Severity label */}
                <span
                  className="text-xs font-bold ml-auto flex-shrink-0"
                  style={{ color, opacity: 0.75 }}
                >
                  {SEV_LABEL[ev.sev]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
