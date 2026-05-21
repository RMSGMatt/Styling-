import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

const RISK_COLOR = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#2EC4A6",
};

const NODE_RADIUS = 28;

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

  const facilityRisk = {};
  for (const row of (runoutRiskData || [])) {
    const facility = String(row.facility || row.Facility || "").trim();
    const risk = String(row.risk_level || row.riskLevel || "low").toLowerCase();
    if (facility) {
      const current = facilityRisk[facility] || "low";
      if (risk === "high" || (risk === "medium" && current === "low")) {
        facilityRisk[facility] = risk;
      }
    }
  }

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
function ForceGraphView({ bomData, locationsData, locationMaterialsData, lanesData, runoutRiskData, scenarioData }) {
  const [selectedNode, setSelectedNode] = useState(null);

  const disruptedFacilities = useMemo(() => {
    const scenarios = scenarioData?.disruptionScenarios || [];
    return new Set(scenarios.map(s => String(s.facility || "").trim()).filter(Boolean));
  }, [scenarioData]);

  const facilityRisk = useMemo(() => {
    const map = {};
    for (const row of (runoutRiskData || [])) {
      const facility = String(row.facility || row.Facility || "").trim();
      const risk = String(row.risk_level || row.riskLevel || "low").toLowerCase();
      if (facility) {
        const current = map[facility] || "low";
        if (risk === "high" || (risk === "medium" && current === "low")) map[facility] = risk;
      }
    }
    return map;
  }, [runoutRiskData]);

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

  const NW = 110;
  const NH = 46;

  function shortLabel(id) {
    return id.replace(/_/g, " ");
  }

  const allNodes = Object.entries(pos);
  const H = 480;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60" style={{ background: "rgba(4,16,12,0.95)" }}>
      <style>{`
        @keyframes disruption-pulse {
          0%, 100% { stroke-opacity: 0.9; }
          50% { stroke-opacity: 0.2; }
        }
      `}</style>
      <svg style={{ display: "block", width: "100%", height: H }} viewBox={`0 0 720 ${H}`}>
        <defs>
          <marker id="h-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </marker>
          <filter id="h-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

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
          return (
            <g key={i}>
              <path
                d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                fill="none"
                stroke={isSelected ? "#9FD63A" : "#2EC4A6"}
                strokeOpacity={isSelected ? 0.9 : 0.35}
                strokeWidth={isSelected ? 2 : 1.2}
                markerEnd="url(#h-arrow)"
              />
              <text
                x={mx}
                y={(y1 + y2) / 2 - 6}
                textAnchor="middle"
                fill={isSelected ? "#9FD63A" : "#2EC4A6"}
                fontSize="8"
                fontFamily="monospace"
                opacity={isSelected ? 1 : 0.5}
              >
                {row.sku}
              </text>
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
                  fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="monospace">
                  {label}
                </text>
              ) : (
                <>
                  <text x={x + NW / 2} y={y + NH / 2 - 7} textAnchor="middle" dominantBaseline="central"
                    fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="monospace">
                    {words.slice(0, 2).join(" ")}
                  </text>
                  <text x={x + NW / 2} y={y + NH / 2 + 7} textAnchor="middle" dominantBaseline="central"
                    fill="#e2e8f0" fontSize="8.5" fontWeight="600" fontFamily="monospace">
                    {words.slice(2).join(" ")}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

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
export default function SupplierNetworkGraph({ bomData, locationsData, locationMaterialsData, lanesData, runoutRiskData, scenarioData }) {

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
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {[["high", "High Risk"], ["medium", "Medium Risk"], ["low", "Operational"]].map(([risk, label]) => (
          <div key={risk} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[risk] }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <span style={{ color: "#F59E0B", fontSize: 12 }}>⚡</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Disrupted</span>
        </div>
        <span className="text-[10px] text-slate-500 ml-auto">Click to inspect</span>
      </div>

      <ForceGraphView
        bomData={bomData}
        locationsData={locationsData}
        locationMaterialsData={locationMaterialsData}
        lanesData={lanesData}
        runoutRiskData={runoutRiskData}
        scenarioData={scenarioData}
      />
    </div>
  );
}
