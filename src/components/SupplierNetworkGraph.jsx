import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import CascadeView from "./CascadeView";

const RISK_COLOR = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#2EC4A6",
};

const NODE_RADIUS = 28;

// Roll a raw runout-risk time series up to ONE classification per
// (facility, sku) for the whole analysis window — must match the same
// logic used in SimulationDashboard.jsx (Severity Mix / High-Risk SKUs) and
// CascadeView.jsx, or the Network Graph's node colors will disagree with
// the dashboard cards.
//
// Requires HIGH_RISK_MIN_DAYS distinct High-risk days before classifying as
// High. A single isolated shortfall day (normal demand/lead-time noise,
// happens even in a clean baseline run) downgrades to Medium instead of
// branding that SKU "High" for the whole run.
const HIGH_RISK_MIN_DAYS = 2;

function classifyFacilitySkuRisk(rows) {
  const groups = new Map();
  for (const r of (rows || [])) {
    const facility = (r.facility || r.Facility || "").toString().trim();
    const sku = (r.sku || r.SKU || "").toString().trim();
    if (!facility) continue;
    const key = `${facility}__${sku}`;
    const level = (r.risk_level || r.riskLevel || "low").toString().toLowerCase().trim();
    let g = groups.get(key);
    if (!g) { g = { facility, sku, highDays: 0, mediumDays: 0 }; groups.set(key, g); }
    if (level === "high") g.highDays += 1;
    else if (level === "medium" || level === "med") g.mediumDays += 1;
  }
  const out = [];
  for (const g of groups.values()) {
    let level;
    if (g.highDays >= HIGH_RISK_MIN_DAYS) level = "high";
    else if (g.highDays >= 1 || g.mediumDays >= 1) level = "medium";
    else level = "low";
    out.push({ facility: g.facility, sku: g.sku, risk_level: level });
  }
  return out;
}

function snapshotFacilityRisk(runoutRiskData) {
  const skuLevel = classifyFacilitySkuRisk(runoutRiskData);
  const map = {};
  for (const row of skuLevel) {
    const facility = row.facility;
    const risk = row.risk_level;
    const current = map[facility] || "low";
    if (risk === "high" || (risk === "medium" && current === "low")) {
      map[facility] = risk;
    }
  }
  return map;
}


// ── Build force graph data from lanes + runout risk ───────────────────
function buildGraph(bomData, locationsData, runoutRiskData, locationMaterialsData, lanesData) {
  if (!bomData?.length) return { nodes: [], links: [] };

  const skuToFacility = {};
  const matSource = (locationMaterialsData?.length ? locationMaterialsData : locationsData) || [];
  for (const row of matSource) {
    const facility = row.Facility || row.facility || row.name || row.Name;
    const sku = row.SKU || row.sku;
    if (facility && sku) skuToFacility[String(sku).trim()] = String(facility).trim();
  }

  const facilityRisk = snapshotFacilityRisk(runoutRiskData);

  const edgeMap = new Map();
  const facilitySet = new Set();

  if (lanesData?.length) {
    for (const row of lanesData) {
      const from = String(row.from_facility || "").trim();
      const to = String(row.to_facility || "").trim();
      const sku = String(row.sku || "").trim();
      if (!from || !to) continue;
      facilitySet.add(from);
      facilitySet.add(to);
      const key = `${from}→${to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: from, target: to, skus: [] });
      }
      if (sku) edgeMap.get(key).skus.push(sku);
    }
  } else {
    for (const row of bomData) {
      const parent = String(row.parent || row.Parent || "").trim();
      const component = String(row.component || row.Component || "").trim();
      if (!parent || !component) continue;
      const parentFacility = skuToFacility[parent];
      const componentFacility = skuToFacility[component];
      if (parentFacility && componentFacility && parentFacility !== componentFacility) {
        facilitySet.add(parentFacility);
        facilitySet.add(componentFacility);
        const key = `${componentFacility}→${parentFacility}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { source: componentFacility, target: parentFacility, skus: [] });
        }
        edgeMap.get(key).skus.push(component);
      }
    }
  }

  for (const row of locationsData || []) {
    const facility = row.facility || row.Facility || row.name || row.Name;
    if (facility) facilitySet.add(String(facility).trim());
  }

  const nodes = Array.from(facilitySet).map((id) => ({
    id,
    risk: facilityRisk[id] || "low",
    label: id.replace(/_/g, " "),
  }));

  const links = Array.from(edgeMap.values()).map((e) => ({
    ...e,
    label: e.skus.slice(0, 2).join(", ") + (e.skus.length > 2 ? "+" + (e.skus.length - 2) : ""),
  }));

  return { nodes, links };
}


// ── Force Graph view ──────────────────────────────────────────────────
function ForceGraphView({ bomData, locationsData, locationMaterialsData, lanesData, runoutRiskData, scenarioData, disruptionsData }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);

  const disruptedFacilities = useMemo(() => {
    const scenarios = scenarioData?.disruptionScenarios || [];
    const set = new Set(scenarios.map(s => String(s.facility || "").trim()).filter(Boolean));
    // scenarioData.disruptionScenarios only gets populated when a run is
    // built through the War Room's scenario builder — a run created by
    // directly uploading disruptions.csv (the normal path for most runs)
    // never populates it, so the pulsing disruption ring silently never
    // appeared on the true disrupted facility. Fold in the raw uploaded
    // disruptions.csv rows too, so this works either way.
    for (const row of (disruptionsData || [])) {
      const facility = String(row.facility || row.Facility || "").trim();
      if (facility) set.add(facility);
    }
    return set;
  }, [scenarioData, disruptionsData]);

  const facilityRisk = useMemo(() => snapshotFacilityRisk(runoutRiskData), [runoutRiskData]);

  const { pos, edges } = useMemo(() => {
    if (!lanesData?.length) return { pos: {}, edges: [] };

    const allFrom = new Set(lanesData.map(r => r.from_facility).filter(Boolean));
    const allTo = new Set(lanesData.map(r => r.to_facility).filter(Boolean));

    const tier3 = [...allFrom].filter(f => !allTo.has(f));
    const tierN = [...allTo].filter(f => !allFrom.has(f));
    const middle = [...new Set([...allFrom, ...allTo])].filter(f => !tier3.includes(f) && !tierN.includes(f));
    const feedsOEM = new Set(lanesData.filter(r => tierN.includes(r.to_facility)).map(r => r.from_facility));
    const distributor = middle.filter(f => !feedsOEM.has(f));
    const tier1 = middle.filter(f => feedsOEM.has(f));

    const cols = { tier3: 80, distributor: 260, tier1: 440, oem: 620 };
    const H = 480;

    function colY(list, idx) {
      const spacing = Math.min(130, (H - 100) / Math.max(list.length, 1));
      const startY = H / 2 - ((list.length - 1) * spacing) / 2;
      return startY + idx * spacing;
    }

    const pos = {};
    tier3.forEach((f, i) => { pos[f] = { x: cols.tier3, y: colY(tier3, i), tier: "Tier 3" }; });
    distributor.forEach((f, i) => { pos[f] = { x: cols.distributor, y: colY(distributor, i), tier: "Distributor" }; });
    tier1.forEach((f, i) => { pos[f] = { x: cols.tier1, y: colY(tier1, i), tier: "Tier 1" }; });
    tierN.forEach((f, i) => { pos[f] = { x: cols.oem, y: colY(tierN, i), tier: "OEM" }; });

    return { pos, edges: lanesData };
  }, [lanesData]);

  const NW = 128;
  const NH = 54;

  function shortLabel(id) {
    return id.replace(/_/g, " ");
  }

  const allNodes = Object.entries(pos);
  const H = 480;

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/60" style={{ background: "rgba(4,16,12,0.95)" }}>
      <style>{`
        @keyframes disruption-pulse {
          0%, 100% { stroke-opacity: 0.9; }
          50% { stroke-opacity: 0.2; }
        }
      `}</style>
      <svg style={{ display: "block", width: "100%", height: H }} viewBox={`0 0 720 ${H}`}>
        <defs>
          <marker id="h-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
          <filter id="h-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g transform={`translate(360, 240) scale(${zoom}) translate(-360, -240)`}>

        {/* Tier column headers */}
        {[
          { label: "Tier 3", x: 80 },
          { label: "Distributor", x: 260 },
          { label: "Tier 1", x: 440 },
          { label: "OEM", x: 620 },
        ].map(({ label, x }) => (
          <text key={label} x={x + NW / 2} y={22} textAnchor="middle" fill="#475569" fontSize="11" fontFamily="monospace">
            {label}
          </text>
        ))}

        {/* Vertical tier dividers */}
        {[185, 365, 545].map(x => (
          <line key={x} x1={x} y1={32} x2={x} y2={H - 20} stroke="#1e3a2f" strokeWidth="1" strokeDasharray="4 4"/>
        ))}

        {/* Edges */}
        {edges.map((row, i) => {
          const from = pos[row.from_facility];
          const to = pos[row.to_facility];
          if (!from || !to) return null;
          const x1 = from.x + NW;
          const y1 = from.y + NH / 2;
          const x2 = to.x;
          const y2 = to.y + NH / 2;
          const mx = (x1 + x2) / 2;
          const isSelected = selectedNode && (row.from_facility === selectedNode || row.to_facility === selectedNode);
          const isDimmed = selectedNode && !isSelected;
          return (
            <g key={i}>
              <path
                d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                fill="none"
                stroke={isSelected ? "#9FD63A" : "#2EC4A6"}
                strokeOpacity={isSelected ? 0.9 : (isDimmed ? 0.15 : 0.35)}
                strokeWidth={isSelected ? 2 : 1.2}
                markerEnd="url(#h-arrow)"
              />
              {!isDimmed && (
                <text
                  x={mx}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  fill={isSelected ? "#9FD63A" : "#2EC4A6"}
                  fontSize="10.5"
                  fontWeight="600"
                  fontFamily="monospace"
                  opacity={isSelected ? 1 : 0.65}
                >
                  {row.sku}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {allNodes.map(([id, { x, y }]) => {
          const risk = facilityRisk[id] || "low";
          const color = RISK_COLOR[risk];
          const isSelected = selectedNode === id;
          const label = shortLabel(id);
          const words = label.split(" ");

          return (
            <g key={id} style={{ cursor: "pointer" }} onClick={() => setSelectedNode(prev => prev === id ? null : id)}>
              {/* Disruption ring */}
              {disruptedFacilities.has(id) && (
                <rect
                  x={x - 6} y={y - 6}
                  width={NW + 12} height={NH + 12}
                  rx={12}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  style={{ animation: "disruption-pulse 1.5s ease-in-out infinite" }}
                />
              )}
              {/* Outer ring */}
              <rect
                x={x - 2} y={y - 2}
                width={NW + 4} height={NH + 4}
                rx={9}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 2 : 0.8}
                strokeOpacity={isSelected ? 0.8 : 0.3}
                strokeDasharray={isSelected ? "0" : "4 3"}
              />
              {/* Main box */}
              <rect
                x={x} y={y}
                width={NW} height={NH}
                rx={7}
                fill={isSelected ? "#0d2e20" : "#0a1f16"}
                stroke={color}
                strokeWidth={isSelected ? 2 : 1.5}
                filter={risk === "high" ? "url(#h-glow)" : undefined}
              />
              {/* Risk dot */}
              <circle cx={x + NW - 8} cy={y + 8} r={3.5} fill={color}/>
              {/* Disruption indicator */}
              {disruptedFacilities.has(id) && (
                <text x={x + 8} y={y + 10} fontSize="10" fontFamily="sans-serif" dominantBaseline="central">⚡</text>
              )}

              {/* Label */}
              {words.length <= 2 ? (
                <text x={x + NW / 2} y={y + NH / 2} textAnchor="middle" dominantBaseline="central"
                  fill="#f1f5f9" fontSize="11" fontWeight="700" fontFamily="monospace">
                  {label}
                </text>
              ) : (
                <>
                  <text x={x + NW / 2} y={y + NH / 2 - 7} textAnchor="middle" dominantBaseline="central"
                    fill="#f1f5f9" fontSize="11" fontWeight="700" fontFamily="monospace">
                    {words.slice(0, 2).join(" ")}
                  </text>
                  <text x={x + NW / 2} y={y + NH / 2 + 7} textAnchor="middle" dominantBaseline="central"
                    fill="#f1f5f9" fontSize="11" fontWeight="700" fontFamily="monospace">
                    {words.slice(2).join(" ")}
                  </text>
                </>
              )}
            </g>
          );
        })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute flex flex-col gap-1" style={{ top: 12, right: 12 }}>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(2)))}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold"
          style={{ background: "rgba(15,30,24,0.85)", color: "#e2e8f0", border: "1px solid #1f3f33" }}
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold"
          style={{ background: "rgba(15,30,24,0.85)", color: "#e2e8f0", border: "1px solid #1f3f33" }}
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold"
          style={{ background: "rgba(15,30,24,0.85)", color: "#94a3b8", border: "1px solid #1f3f33" }}
        >
          1:1
        </button>
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(159,214,58,0.2)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white font-bold text-sm">{shortLabel(selectedNode)}</p>
            <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{
              background: `${RISK_COLOR[facilityRisk[selectedNode] || "low"]}22`,
              color: RISK_COLOR[facilityRisk[selectedNode] || "low"],
              border: `1px solid ${RISK_COLOR[facilityRisk[selectedNode] || "low"]}44`,
            }}>
              {(facilityRisk[selectedNode] || "low").toUpperCase()} RISK
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {edges.filter(e => e.from_facility === selectedNode).map(e => `→ ${e.to_facility} (${e.sku})`).join("  ·  ")}
            {edges.filter(e => e.to_facility === selectedNode).map(e => `← ${e.from_facility} (${e.sku})`).join("  ·  ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export default function SupplierNetworkGraph({ bomData, locationsData, locationMaterialsData, lanesData, runoutRiskData, scenarioData, disruptionsData, apiBase = "https://supply-chain-simulator-v2.onrender.com", kpis }) {
  const [activeTab, setActiveTab] = useState("network");

  const hasData = bomData?.length || lanesData?.length;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-4xl">🕸️</span>
        <p className="text-slate-400 text-sm font-semibold">No network data yet</p>
        <p className="text-slate-500 text-xs">Run a simulation to generate the supplier network graph.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { id: "network", label: "🕸 Network" },
          { id: "cascade", label: "⚡ Cascade" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={
              activeTab === tab.id
                ? { background: "#9FD63A", color: "#020617" }
                : { background: "rgba(15,30,24,0.6)", color: "#94a3b8", border: "1px solid #1f3f33" }
            }
          >
            {tab.label}
          </button>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 ml-4">
          {[["high", "High Risk"], ["medium", "Medium Risk"], ["low", "Operational"]].map(([risk, label]) => (
            <div key={risk} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[risk] }} />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span style={{ color: "#F59E0B", fontSize: 12 }}>⚡</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Disrupted</span>
          </div>
        </div>
        {activeTab === "network" && (
          <span className="text-[10px] text-slate-500 ml-auto">Click to inspect</span>
        )}
      </div>

      {activeTab === "network" ? (
        <ForceGraphView
          bomData={bomData}
          locationsData={locationsData}
          locationMaterialsData={locationMaterialsData}
          lanesData={lanesData}
          runoutRiskData={runoutRiskData}
          scenarioData={scenarioData}
          disruptionsData={disruptionsData}
        />
      ) : (
        <CascadeView
          lanesData={lanesData}
          scenarioData={scenarioData}
          runoutRiskData={runoutRiskData}
          apiBase={apiBase}
          kpis={kpis}
        />
      )}
    </div>
  );
}
