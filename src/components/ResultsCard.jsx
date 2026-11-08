import React, { useMemo } from "react";

/**
 * ResultsCard
 * - Accepts 1..N runs and renders a KPI comparison table.
 * - Each run is { id, name, timestamp, kpis = {}, scenario?: {name, id} }.
 */
export default function ResultsCard({ runs = [], title = "Results", subtitle, highlightBaselineId }) {
  const cols = runs.slice(0, 4); // keep UI tidy; expand later if needed

  // Build KPI row set (union of keys across runs)
  const kpiKeys = useMemo(() => {
    const set = new Set();
    cols.forEach(r => Object.keys(r.kpis || {}).forEach(k => set.add(k)));
    // a gentle preferred order if present
    const order = [
      "onTimeFulfillment","inventoryTurns","avgInventory",
      "costToServe","expediteRatio","backorderVolume",
      "totalProduction","impactedFacilities","avgTimeToRecovery"
    ];
    const withOrder = [
      ...order.filter(k => set.has(k)),
      ...Array.from(set).filter(k => !order.includes(k)),
    ];
    return withOrder;
  }, [cols]);

  if (cols.length === 0) {
    return (
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 text-slate-400">
        No runs selected yet.
      </div>
    );
  }

  const headerCell = (r) => (
    <div className="flex flex-col">
      <div className="font-semibold text-slate-100">{r.name || "Run"}</div>
      <div className="text-xs text-slate-400">{r.scenario?.name ? `Scenario: ${r.scenario.name}` : "Unassigned"}</div>
      <div className="text-[11px] text-slate-500">{r.timestamp}</div>
    </div>
  );

  const tdClass = "px-3 py-2 text-sm align-top border-t border-slate-800 text-slate-200";
  const thClass = "px-3 py-2 text-xs text-slate-400 align-top border-t border-slate-800";

  return (
    <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm">
      <div className="mb-3">
        <div className="text-lg font-semibold text-[#9FD63A]">{title}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full">
          <thead>
            <tr>
              <th className={`${thClass} w-48`}>KPI</th>
              {cols.map((r) => (
                <th key={`h-${r.id}`} className={`${thClass}`}>
                  <div className={`rounded-lg p-2 ${highlightBaselineId === r.id ? "bg-[rgba(159,214,58,0.1)] border border-[rgba(159,214,58,0.35)]" : ""}`}>
                    {headerCell(r)}
                    {highlightBaselineId === r.id && (
                      <div className="mt-1 text-[11px] text-[#9FD63A] font-medium">Baseline</div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpiKeys.map((k) => (
              <tr key={k}>
                <td className={`${tdClass} font-medium text-slate-300`}>{k.replace(/_/g," ")}</td>
                {cols.map((r) => (
                  <td key={`${r.id}-${k}`} className={tdClass}>
                    {r.kpis?.[k] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mini legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {cols.map((r) => (
          <span
            key={`legend-${r.id}`}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${highlightBaselineId === r.id ? "bg-[rgba(159,214,58,0.1)] border-[rgba(159,214,58,0.35)] text-[#9FD63A]" : "bg-slate-800/50 border-slate-700 text-slate-400"}`}
            title={r.timestamp}
          >
            {r.name || "Run"} {r.scenario?.name ? `• ${r.scenario.name}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
