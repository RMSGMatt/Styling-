import React from "react";

// Instant "order by" dates: first shortage date minus the time it takes a fix to arrive.
// Simple lead-time arithmetic, no replays. The detailed analysis in Options refines it.

export const DEFAULT_LEVERS = [
  { id: "expedite", label: "Expedite existing supplier", days: 7 },
  { id: "broker", label: "Broker or spot buy", days: 14 },
  { id: "second", label: "Qualify a second source", days: 60 },
];

const MS = 86400000;
const parse = (iso) => new Date(`${iso}T00:00:00`);
export const fmtLong = (iso) =>
  iso ? parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const toIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function computeClock(levers, firstShortageDate, disruptionStart) {
  if (!firstShortageDate) return [];
  const first = parse(firstShortageDate);
  const d0 = disruptionStart ? parse(disruptionStart) : null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return levers.map((l) => {
    const days = Math.max(0, Number(l.days) || 0);
    const order = new Date(first.getTime() - days * MS);
    return {
      ...l,
      days,
      orderBy: toIso(order),
      isPast: order < now,
      beforeDisruption: d0 ? order < d0 : false,
      leadDaysBeforeDisruption: d0 ? Math.round((d0 - order) / MS) : null,
    };
  });
}

export default function DecisionClock({ firstShortageDate, disruptionStart, sku, facility, levers, setLevers }) {
  if (!firstShortageDate) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4" data-testid="decision-clock">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Decision clock</p>
        <p className="text-sm text-emerald-300 mt-2">No customer shortage in this scenario, so there is no decision deadline.</p>
      </div>
    );
  }
  const rows = computeClock(levers, firstShortageDate, disruptionStart);
  const update = (id, days) => setLevers(levers.map((l) => (l.id === id ? { ...l, days } : l)));
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4" data-testid="decision-clock">
      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90">Decision clock</p>
      <p className="text-sm text-slate-200 mt-2 leading-6">
        Customers first run short on <span className="font-semibold text-slate-50">{fmtLong(firstShortageDate)}</span>
        {sku ? <> ({sku}{facility ? ` at ${facility}` : ""})</> : null}. A fix has to arrive before then, so the order has to be placed earlier by however long that fix takes.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Response</th>
              <th className="py-1.5 pr-3 font-medium">Days to arrive</th>
              <th className="py-1.5 font-medium">Order by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-amber-500/20 align-top">
                <td className="py-2 pr-3 text-slate-100">{r.label}</td>
                <td className="py-2 pr-3">
                  <input
                    type="number" min="0" max="365" value={levers.find((l) => l.id === r.id)?.days ?? ""}
                    onChange={(e) => update(r.id, e.target.value)}
                    aria-label={`Days to arrive for ${r.label}`}
                    className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </td>
                <td className="py-2 font-semibold text-slate-50 whitespace-nowrap">
                  {r.isPast ? (
                    <>
                      <span className="text-slate-400 line-through">{fmtLong(r.orderBy)}</span>
                      <span className="block text-[11px] font-normal text-red-300">
                        Already passed. Too late for this response unless it can arrive faster.
                      </span>
                    </>
                  ) : fmtLong(r.orderBy)}
                  {!r.isPast && r.beforeDisruption && (
                    <span className="block text-[11px] font-normal text-amber-300">
                      {r.leadDaysBeforeDisruption} days before the disruption starts, so it would have to be in place beforehand
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        Lead-time arithmetic on the simulated first-shortage date. The detailed analysis under Options replays the scenario for an exact window.
      </p>
    </div>
  );
}
