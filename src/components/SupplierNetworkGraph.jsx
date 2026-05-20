import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ── Derive facility→facility edges from BOM + locations data ──────────
function buildGraph(bomData, locationsData, runoutRiskData, locationMaterialsData, lanesData) {
  if (!bomData?.length) return { nodes: [], links: [] };

  // Map SKU → facility using location_materials (preferred) or locations fallback
  const skuToFacility = {};
  const matSource = (locationMaterialsData?.length ? locationMaterialsData : locationsData) || [];
  for (const row of matSource) {
    const facility = row.Facility || row.facility || row.name || row.Name;
    const sku = row.SKU || row.sku;
    if (facility && sku) skuToFacility[String(sku).trim()] = String(facility).trim();
  }

  // Risk map from runout data
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

  // Build edges: use lanes directly if available, otherwise derive from BOM
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

  // Also add all facilities from locations even if no BOM edge
  for (const row of locationsData) {
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
    label: e.skus.slice(0, 2).join(", ") + (e.skus.length > 2 ? `+${e.skus.length - 2}` : ""),
  }));

  return { nodes, links };
}

const RISK_COLOR = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#2EC4A6",
};

const NODE_RADIUS = 28;

export default function SupplierNetworkGraph({ bomData, locationsData, locationMaterialsData, lanesData, runoutRiskData }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const { nodes, links } = useMemo(
    () => buildGraph(bomData, locationsData, runoutRiskData, locationMaterialsData, lanesData),
    [bomData, locationsData, runoutRiskData, locationMaterialsData, lanesData]
  );

  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    const W = container.clientWidth || 800;
    const H = 520;

    const svg = d3.select(svgRef.current)
      .attr("width", W)
      .attr("height", H);

    svg.selectAll("*").remove();

    // Defs: arrowhead + glow filter
    const defs = svg.append("defs");

    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_RADIUS + 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#9FD63A")
      .attr("opacity", 0.7);

    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 3])
        .on("zoom", (e) => g.attr("transform", e.transform))
    );

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(100).strength(0.8))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(NODE_RADIUS + 20));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#9FD63A")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Edge labels
    const edgeLabel = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("fill", "#9FD63A")
      .attr("font-size", 8)
      .attr("opacity", 0.6)
      .attr("text-anchor", "middle")
      .text((d) => d.label);

    // Node groups
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (e, d) => {
        setSelectedNode((prev) => prev?.id === d.id ? null : d);
        e.stopPropagation();
      });

    // Outer ring
    node.append("circle")
      .attr("r", NODE_RADIUS + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => RISK_COLOR[d.risk])
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .attr("stroke-dasharray", "4 3");

    // Main circle
    node.append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", "#0d1f1a")
      .attr("stroke", (d) => RISK_COLOR[d.risk])
      .attr("stroke-width", 2)
      .attr("filter", (d) => d.risk === "high" ? "url(#glow)" : null);

    // Risk dot
    node.append("circle")
      .attr("r", 4)
      .attr("cx", NODE_RADIUS - 6)
      .attr("cy", -(NODE_RADIUS - 6))
      .attr("fill", (d) => RISK_COLOR[d.risk]);

    // Label inside node
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 7.5)
      .attr("font-weight", "600")
      .attr("font-family", "monospace")
      .each(function(d) {
        const words = d.label.split(" ");
        const el = d3.select(this);
        if (words.length <= 2) {
          el.text(d.label);
        } else {
          el.append("tspan").attr("x", 0).attr("dy", -6).text(words.slice(0, 2).join(" "));
          el.append("tspan").attr("x", 0).attr("dy", 12).text(words.slice(2).join(" "));
        }
      });

    svg.on("click", () => setSelectedNode(null));

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      edgeLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2 - 5);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, links]);

  if (!bomData?.length || !locationsData?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-4xl">🕸️</span>
        <p className="text-slate-400 text-sm font-semibold">No network data yet</p>
        <p className="text-slate-500 text-xs">Run a simulation to generate the supplier network graph.</p>
      </div>
    );
  }

  const connectedLinks = selectedNode
    ? links.filter((l) => l.source.id === selectedNode.id || l.target.id === selectedNode.id)
    : [];

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-3 px-1">
        {[["high", "High Risk"], ["medium", "Medium Risk"], ["low", "Operational"]].map(([risk, label]) => (
          <div key={risk} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[risk] }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-500 ml-auto">Drag nodes · Scroll to zoom · Click to inspect</span>
      </div>

      {/* Graph */}
      <div
        className="rounded-xl overflow-hidden border border-slate-700/60"
        style={{ background: "rgba(4,16,12,0.95)" }}
      >
        <svg ref={svgRef} style={{ display: "block", width: "100%", height: 520 }} />
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <div
          className="mt-3 rounded-xl px-4 py-3 border"
          style={{ background: "#0a2e22", borderColor: "rgba(159,214,58,0.3)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#9FD63A" }}>
                Facility Intelligence
              </p>
              <p className="text-white font-bold text-sm">{selectedNode.label}</p>
            </div>
            <span
              className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{
                background: `${RISK_COLOR[selectedNode.risk]}22`,
                color: RISK_COLOR[selectedNode.risk],
                border: `1px solid ${RISK_COLOR[selectedNode.risk]}44`,
              }}
            >
              {selectedNode.risk.toUpperCase()} RISK
            </span>
          </div>
          {connectedLinks.length > 0 && (
            <div className="text-xs text-slate-400">
              <span className="text-slate-300 font-medium">Connections: </span>
              {connectedLinks.map((l, i) => (
                <span key={i}>
                  {l.source.id === selectedNode.id
                    ? `→ ${l.target.id} (${l.label})`
                    : `← ${l.source.id} (${l.label})`}
                  {i < connectedLinks.length - 1 ? "  ·  " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}