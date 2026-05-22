import React, { useState, useMemo, useEffect, useRef } from "react";

const RISK_COLOR = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#2EC4A6",
};

const BRAND = {
  lime: "#9FD63A",
  mint: "#2EC4A6",
  charcoal: "#111B21",
  amber: "#F59E0B",
};

// Build tier order and cascade hops from lanes + disrupted facility
function buildCascade(lanesData, scenarioData, runoutRiskData) {
  if (!lanesData?.length) return null;

  const disruptedFacilities = new Set(
    (scenarioData?.disruptionScenarios || [])
      .map(s => String(s.facility || "").trim())
      .filter(Boolean)
  );

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

  // Build adjacency: from -> [to]
  const downstream = {};
  const upstream = {};
  const allFacilities = new Set();

  for (const row of lanesData) {
    const from = String(row.from_facility || "").trim();
    const to = String(row.to_facility || "").trim();
    const sku = String(row.sku || "").trim();
    if (!from || !to) continue;
    allFacilities.add(from);
    allFacilities.add(to);
    if (!downstream[from]) downstream[from] = [];
    if (!upstream[to]) upstream[to] = [];
    downstream[from].push({ to, sku });
    upstream[to].push({ from, sku });
  }

  // BFS from disrupted facilities to build hops
  const hops = []; // hops[i] = array of facility ids at hop i
  const visited = new Set();
  const facilityHop = {}; // facility -> hop index
  const facilityEdges = {}; // facility -> [{ from, sku }] incoming edges that activated it

  const queue = [];
  for (const f of disruptedFacilities) {
    if (allFacilities.has(f)) {
      queue.push({ facility: f, hop: 0 });
      visited.add(f);
      facilityHop[f] = 0;
      facilityEdges[f] = [];
    }
  }

  // If no disrupted facility matches lanes, start from tier 3
  if (queue.length === 0) {
    const allFrom = new Set(lanesData.map(r => r.from_facility).filter(Boolean));
    const allTo = new Set(lanesData.map(r => r.to_facility).filter(Boolean));
    const tier3 = [...allFrom].filter(f => !allTo.has(f));
    for (const f of tier3) {
      queue.push({ facility: f, hop: 0 });
      visited.add(f);
      facilityHop[f] = 0;
      facilityEdges[f] = [];
    }
  }

  let maxHop = 0;
  while (queue.length > 0) {
    const { facility, hop } = queue.shift();
    if (!hops[hop]) hops[hop] = [];
    if (!hops[hop].includes(facility)) hops[hop].push(facility);
    maxHop = Math.max(maxHop, hop);

    for (const { to, sku } of (downstream[facility] || [])) {
      if (!visited.has(to)) {
        visited.add(to);
        facilityHop[to] = hop + 1;
        facilityEdges[to] = [{ from: facility, sku }];
        queue.push({ facility: to, hop: hop + 1 });
      } else if (facilityHop[to] === hop + 1) {
        if (!facilityEdges[to]) facilityEdges[to] = [];
        facilityEdges[to].push({ from: facility, sku });
      }
    }
  }

  // Add unvisited facilities at end
  for (const f of allFacilities) {
    if (!visited.has(f)) {
      const lastHop = maxHop + 1;
      if (!hops[lastHop]) hops[lastHop] = [];
      hops[lastHop].push(f);
      facilityHop[f] = lastHop;
      facilityEdges[f] = [];
    }
  }

  return { hops, facilityHop, facilityEdges, facilityRisk, disruptedFacilities, downstream, upstream };
}

export default function CascadeView({ lanesData, scenarioData, runoutRiskData, apiBase = "https://supply-chain-simulator-v2.onrender.com", kpis }) {
  const [currentHop, setCurrentHop] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const intervalRef = useRef(null);

  const cascade = useMemo(
    () => buildCascade(lanesData, scenarioData, runoutRiskData),
    [lanesData, scenarioData, runoutRiskData]
  );

  const totalHops = cascade?.hops?.length || 0;

  useEffect(() => {
    if (!cascade || !cascade.disruptedFacilities?.size) return;

    const disrupted = [...cascade.disruptedFacilities];
    const downstream = cascade.hops.slice(1).flat();
    if (!downstream.length) return;

    const generateCascadeSummary = async () => {
      try {
        setAiLoading(true);
        setAiSummary(null);
        const res = await fetch(`${apiBase}/api/narrative/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: `Disruption at ${disrupted.join(", ")}`,
            kpis: {
              serviceLevelPct: kpis?.onTimeFulfillment ?? kpis?.serviceLevelPct ?? 0,
              peakBacklogUnits: kpis?.peakBacklog ?? kpis?.peakBacklogUnits ?? 0,
              timeToRecoverDays: kpis?.ttrDays ?? kpis?.timeToRecoverDays ?? 0,
              timeToSurviveDays: kpis?.ttsDays ?? kpis?.timeToSurviveDays ?? 0,
              demandAtRiskUnits: kpis?.unitsAtRisk ?? kpis?.lateFulfilledUnits ?? 0,
              facilitiesImpacted: downstream.length,
              revenueExposure: kpis?.revenueExposure ?? 0,
            },
            context: `Disruption originated at ${disrupted.join(" and ")}. Downstream facilities impacted in sequence: ${cascade.hops.slice(1).map((hop, i) => `Hop ${i + 1}: ${hop.join(", ")}`).join(" → ")}. Explain the operational impact on each downstream facility and what supply chain managers should prioritize.`
          })
        });
        const data = await res.json();
        if (data.status === "success" && data.narrative) {
          const clean = data.narrative
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/^#+\s/gm, "")
            .trim();
          setAiSummary(clean);
        }
      } catch (e) {
        console.error("Cascade summary failed:", e);
      } finally {
        setAiLoading(false);
      }
    };

    generateCascadeSummary();
  }, [cascade, apiBase]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentHop(h => {
          if (h >= totalHops - 1) {
            setPlaying(false);
            return h;
          }
          return h + 1;
        });
      }, speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, totalHops]);

  if (!cascade || totalHops === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-4xl">🔗</span>
        <p className="text-slate-400 text-sm font-semibold">No cascade data</p>
        <p className="text-slate-500 text-xs">Upload lanes file and run a simulation to see cascade impact.</p>
      </div>
    );
  }

  const { hops, facilityHop, facilityEdges, facilityRisk, disruptedFacilities, downstream } = cascade;

  // All facilities visible up to currentHop
  const activeFacilities = new Set(
    hops.slice(0, currentHop + 1).flat()
  );

  // Active edges: edges between facilities where both endpoints are active
  const activeEdges = [];
  for (const [from, targets] of Object.entries(downstream || {})) {
    if (!activeFacilities.has(from)) continue;
    for (const { to, sku } of targets) {
      if (activeFacilities.has(to) && facilityHop[to] === (facilityHop[from] + 1)) {
        activeEdges.push({ from, to, sku });
      }
    }
  }

  function getFacilityState(facility) {
    const hop = facilityHop[facility];
    if (hop === undefined || hop > currentHop) return "hidden";
    if (disruptedFacilities.has(facility)) return "disrupted";
    if (hop === currentHop) return "new";
    return "affected";
  }

  function getNodeColor(facility) {
    const state = getFacilityState(facility);
    if (state === "disrupted") return BRAND.amber;
    const risk = facilityRisk[facility] || "low";
    return RISK_COLOR[risk];
  }

  function shortLabel(id) {
    return id.replace(/_/g, " ");
  }

  // Layout: columns by hop
  const SVG_W = 720;
  const SVG_H = 400;
  const NODE_W = 110;
  const NODE_H = 44;
  const colCount = totalHops;
  const colSpacing = Math.min(180, (SVG_W - 60) / Math.max(colCount, 1));

  const nodePos = {};
  for (let h = 0; h < hops.length; h++) {
    const facilities = hops[h];
    const x = 30 + h * colSpacing;
    const spacing = Math.min(100, (SVG_H - 60) / Math.max(facilities.length, 1));
    const startY = SVG_H / 2 - ((facilities.length - 1) * spacing) / 2;
    facilities.forEach((f, i) => {
      nodePos[f] = { x, y: startY + i * spacing };
    });
  }

  const hopLabel = currentHop === 0
    ? disruptedFacilities.size > 0 ? "⚡ Disruption Origin" : "🔴 Tier 3 Suppliers"
    : `📡 Hop ${currentHop} — Downstream Impact`;

  const impactCount = hops.slice(1, currentHop + 1).flat().length;

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => { setPlaying(false); setCurrentHop(0); }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
          style={{ borderColor: "#1f3f33", color: "#94a3b8", background: "rgba(15,30,24,0.6)" }}
        >
          ⏮ Reset
        </button>
        <button
          onClick={() => setCurrentHop(h => Math.max(0, h - 1))}
          disabled={currentHop === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
          style={{ borderColor: "#1f3f33", color: currentHop === 0 ? "#475569" : "#94a3b8", background: "rgba(15,30,24,0.6)" }}
        >
          ← Back
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="px-4 py-1.5 rounded-lg text-xs font-bold transition"
          style={{ background: playing ? "#EF4444" : `linear-gradient(90deg, ${BRAND.lime}, #22c55e)`, color: "#020617" }}
        >
          {playing ? "⏸ Pause" : "▶ Play Cascade"}
        </button>
        <button
          onClick={() => setCurrentHop(h => Math.min(totalHops - 1, h + 1))}
          disabled={currentHop === totalHops - 1}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
          style={{ borderColor: "#1f3f33", color: currentHop === totalHops - 1 ? "#475569" : "#94a3b8", background: "rgba(15,30,24,0.6)" }}
        >
          Next →
        </button>

        {/* Speed */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Speed</span>
          {[["Slow", 2000], ["Normal", 1200], ["Fast", 600]].map(([label, ms]) => (
            <button
              key={label}
              onClick={() => setSpeed(ms)}
              className="px-2 py-1 rounded text-[10px] transition"
              style={{
                background: speed === ms ? BRAND.lime : "rgba(15,30,24,0.6)",
                color: speed === ms ? "#020617" : "#64748b",
                border: `1px solid ${speed === ms ? BRAND.lime : "#1f3f33"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Hop indicator */}
        <div className="ml-auto flex items-center gap-2">
          {hops.map((_, h) => (
            <button
              key={h}
              onClick={() => { setPlaying(false); setCurrentHop(h); }}
              className="rounded-full transition"
              style={{
                width: 10,
                height: 10,
                background: h === currentHop ? BRAND.lime : h < currentHop ? "#EF4444" : "#1e3a2f",
                border: `1.5px solid ${h === currentHop ? BRAND.lime : "#1f3f33"}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold" style={{ color: BRAND.lime }}>{hopLabel}</p>
        {impactCount > 0 && (
          <p className="text-[11px] text-slate-400">
            <span className="text-red-400 font-bold">{impactCount}</span> facilit{impactCount === 1 ? "y" : "ies"} affected downstream
          </p>
        )}
      </div>

      {/* SVG Canvas */}
      <div
        className="rounded-xl overflow-hidden border border-slate-700/60"
        style={{ background: "rgba(4,16,12,0.95)" }}
      >
        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
          <defs>
            <marker id="cascade-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <filter id="cascade-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Hop column labels */}
          {hops.map((_, h) => {
            const sampleFacility = hops[h][0];
            const x = nodePos[sampleFacility]?.x + NODE_W / 2;
            const label = h === 0
              ? disruptedFacilities.size > 0 ? "Origin" : "Tier 3"
              : `Hop ${h}`;
            return (
              <text key={h} x={x} y={16} textAnchor="middle" fill={h <= currentHop ? "#64748b" : "#1e3a2f"} fontSize="10" fontFamily="monospace">
                {label}
              </text>
            );
          })}

          {/* Edges */}
          {activeEdges.map((edge, i) => {
            const fromPos = nodePos[edge.from];
            const toPos = nodePos[edge.to];
            if (!fromPos || !toPos) return null;
            const x1 = fromPos.x + NODE_W;
            const y1 = fromPos.y + NODE_H / 2;
            const x2 = toPos.x;
            const y2 = toPos.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            const isNew = facilityHop[edge.to] === currentHop;
            return (
              <g key={i}>
                <path
                  d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                  fill="none"
                  stroke={isNew ? "#EF4444" : "#374151"}
                  strokeOpacity={isNew ? 0.8 : 0.4}
                  strokeWidth={isNew ? 2 : 1}
                  markerEnd="url(#cascade-arrow)"
                />
                {isNew && (
                  <text
                    x={mx}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fill="#EF4444"
                    fontSize="8"
                    fontFamily="monospace"
                    opacity="0.8"
                  >
                    {edge.sku}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {Object.entries(nodePos).map(([facility, { x, y }]) => {
            const state = getFacilityState(facility);
            if (state === "hidden") return null;
            const color = getNodeColor(facility);
            const isDisrupted = disruptedFacilities.has(facility);
            const isNew = state === "new";
            const words = shortLabel(facility).split(" ");

            return (
              <g key={facility}>
                {/* Disruption pulse ring */}
                {isDisrupted && (
                  <rect
                    x={x - 6} y={y - 6}
                    width={NODE_W + 12} height={NODE_H + 12}
                    rx={12}
                    fill="none"
                    stroke={BRAND.amber}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    opacity={0.7}
                  />
                )}
                {/* New hop highlight ring */}
                {isNew && !isDisrupted && (
                  <rect
                    x={x - 4} y={y - 4}
                    width={NODE_W + 8} height={NODE_H + 8}
                    rx={10}
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    opacity={0.6}
                  />
                )}
                {/* Main node */}
                <rect
                  x={x} y={y}
                  width={NODE_W} height={NODE_H}
                  rx={7}
                  fill={isNew || isDisrupted ? "rgba(20,40,30,0.95)" : "rgba(10,20,16,0.8)"}
                  stroke={color}
                  strokeWidth={isNew || isDisrupted ? 2 : 1}
                  filter={isNew ? "url(#cascade-glow)" : undefined}
                />
                {/* Risk dot */}
                <circle cx={x + NODE_W - 8} cy={y + 8} r={3.5} fill={color} />
                {/* Disruption icon */}
                {isDisrupted && (
                  <text x={x + 8} y={y + 10} fontSize="10" fontFamily="sans-serif" dominantBaseline="central">⚡</text>
                )}
                {/* Label */}
                {words.length <= 2 ? (
                  <text x={x + NODE_W / 2} y={y + NODE_H / 2} textAnchor="middle" dominantBaseline="central"
                    fill={isNew || isDisrupted ? "#e2e8f0" : "#64748b"} fontSize="8" fontWeight="600" fontFamily="monospace">
                    {shortLabel(facility)}
                  </text>
                ) : (
                  <>
                    <text x={x + NODE_W / 2} y={y + NODE_H / 2 - 7} textAnchor="middle" dominantBaseline="central"
                      fill={isNew || isDisrupted ? "#e2e8f0" : "#64748b"} fontSize="8" fontWeight="600" fontFamily="monospace">
                      {words.slice(0, 2).join(" ")}
                    </text>
                    <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 7} textAnchor="middle" dominantBaseline="central"
                      fill={isNew || isDisrupted ? "#e2e8f0" : "#64748b"} fontSize="8" fontWeight="600" fontFamily="monospace">
                      {words.slice(2).join(" ")}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Incoming edges for current hop */}
      {currentHop > 0 && hops[currentHop]?.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Impact at Hop {currentHop}</p>
          <div className="flex flex-wrap gap-2">
            {hops[currentHop].map(facility => {
              const edges = facilityEdges[facility] || [];
              const risk = facilityRisk[facility] || "low";
              return (
                <div key={facility} className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-200">{shortLabel(facility)}</p>
                  {edges.length > 0 && (
                    <p className="text-slate-500 text-[10px] mt-0.5">
                      via {edges.map(e => e.sku).join(", ")} ← {edges.map(e => shortLabel(e.from)).join(", ")}
                    </p>
                  )}
                  <span className="text-[10px] font-semibold mt-1 inline-block" style={{ color: RISK_COLOR[risk] }}>
                    {risk.toUpperCase()} RISK
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5"><span style={{ color: BRAND.amber }}>⚡</span> Disruption origin</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/><span>Newly impacted</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"/><span>Previously affected</span></div>
      </div>

      {/* AI Cascade Summary */}
      {(aiLoading || aiSummary) && (
        <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#9FD63A" }}>
            ⚡ Cascade Impact Analysis
          </p>
          {aiLoading ? (
            <p className="text-xs text-slate-400 animate-pulse">Analyzing downstream impact...</p>
          ) : (
            <p className="text-sm leading-6 text-slate-200">{aiSummary}</p>
          )}
        </div>
      )}
    </div>
  );
}
