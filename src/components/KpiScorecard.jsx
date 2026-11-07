import React, { useState } from "react";

// Standard supply chain KPIs for one run: before the disruption versus during it versus the whole run,
// with a plain status. Shows the headline measures first; the rest are one click away.

const fmtNum = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");

function fmtValue(v, unit, row) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  switch (unit) {
    case "%": return `${Number(v).toFixed(Number(v) % 1 === 0 ? 0 : 1)}%`;
    case "days": return `${fmtNum(v)} days`;
    case "hours": return `${fmtNum(v)} hrs`;
    case "$": return `$${fmtNum(v)}`;
    case "x": return `${Number(v).toFixed(1)}x`;
    case "count": return row?.of ? `${fmtNum(v)} of ${fmtNum(row.of)}` : fmtNum(v);
    default: return fmtNum(v);
  }
}

const STATUS = {
  good: { label: "On target", cls: "border-emerald-500/40 text-emerald-300", dot: "bg-emerald-400" },
  watch: { label: "Watch", cls: "border-amber-500/40 text-amber-300", dot: "bg-amber-400" },
  bad: { label: "At risk", cls: "border-rose-500/40 text-rose-300", dot: "bg-rose-400" },
  info: { label: "Context", cls: "border-slate-600 text-slate-400", dot: "bg-slate-500" },
  na: { label: "n/a", cls: "border-slate-700 text-slate-500", dot: "bg-slate-600" },
};

const REVENUE_ROW = (revenue) => ({
  key: "revenue", label: "Estimated revenue at risk", unit: "$", before: null, during: null, overall: revenue, worst: null,
  status: "info", headline: true, hint: "Estimate based on unit values where provided; treat as indicative.",
});

function Row({ r }) {
  const st = STATUS[r.status] || STATUS.na;
  return (
    <tr className="border-t border-slate-800 align-top">
      <td className="py-2 pr-3 text-slate-100">
        <span title={r.hint}>{r.label}</span>
        <span className="block text-[11px] leading-4 text-slate-500 max-w-md">{r.hint}</span>
        {r.names && r.names.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1 max-w-md">
            {r.names.map((n) => (
              <span key={n} className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200">{n}</span>
            ))}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{fmtValue(r.before, r.unit, r)}</td>
      <td className="py-2 pr-3 font-semibold text-slate-50 whitespace-nowrap">{r.display_text ? r.display_text : fmtValue(r.during, r.unit, r)}</td>
      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{fmtValue(r.overall, r.unit, r)}</td>
      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">
        {r.worst !== null && r.worst !== undefined ? <>{fmtValue(r.worst, r.unit, r)}{r.worst_label ? <span className="text-[11px] text-slate-500"> {r.worst_label}</span> : null}</> : "–"}
      </td>
      <td className="py-2 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
        </span>
      </td>
    </tr>
  );
}

export default function KpiScorecard({ scorecard, loading, revenue }) {
  const [showAll, setShowAll] = useState(false);
  if (loading && !scorecard) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4" data-testid="kpi-scorecard">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">KPI scorecard</p>
        <p className="text-sm text-slate-400 mt-2">Calculating the scorecard for this run.</p>
      </div>
    );
  }
  if (!scorecard?.ok) {
    return scorecard ? (
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4" data-testid="kpi-scorecard">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">KPI scorecard</p>
        <p className="text-sm text-amber-300 mt-2">{scorecard.reason || "The scorecard is not available for this run."}</p>
      </div>
    ) : null;
  }
  const allRowsFlat = scorecard.groups.flatMap((g) => g.rows);
  const headline = [
    ...(revenue > 0 ? [REVENUE_ROW(revenue)] : []),
    ...allRowsFlat.filter((r) => r.headline),
  ];
  const hiddenCount = allRowsFlat.filter((r) => !r.headline).length;
  const Head = (
    <thead>
      <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
        <th className="py-2 pr-3 font-medium">Measure</th>
        <th className="py-2 pr-3 font-medium">Before</th>
        <th className="py-2 pr-3 font-medium">During</th>
        <th className="py-2 pr-3 font-medium">Whole run</th>
        <th className="py-2 pr-3 font-medium">Worst point</th>
        <th className="py-2 font-medium">Status</th>
      </tr>
    </thead>
  );
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4" data-testid="kpi-scorecard">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">KPI scorecard</p>
        {scorecard.disruption_start && (
          <p className="text-[11px] text-slate-500">Before = up to {scorecard.disruption_start}. During = from the disruption start. Whole run = the full simulation.</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          {Head}
          {!showAll ? (
            <tbody>{headline.map((r) => <Row key={r.key} r={r} />)}</tbody>
          ) : (
            <>
              {revenue > 0 && <tbody><Row r={REVENUE_ROW(revenue)} /></tbody>}
              {scorecard.groups.map((g) => (
                <tbody key={g.name}>
                  <tr><td colSpan={6} className="pt-4 pb-1 text-[11px] uppercase tracking-[0.18em] text-lime-400/80">{g.name}</td></tr>
                  {g.rows.map((r) => <Row key={r.key} r={r} />)}
                </tbody>
              ))}
            </>
          )}
        </table>
      </div>
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-3 text-xs text-slate-300 underline hover:text-slate-100">
          {showAll ? "Show headline measures only" : `Show all measures (${hiddenCount} more)`}
        </button>
      )}
      <p className="mt-3 text-[10px] text-slate-500">Standard definitions applied to the simulated run. Status uses common default targets (for example fill rate of 97% or more); your own targets can differ.</p>
    </div>
  );
}
