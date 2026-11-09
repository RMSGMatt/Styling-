import React, { useEffect, useState } from "react";
import { getApiBase } from "../config/apiBase";

const GREEN = "#9FD63A";
const money = (v) => (typeof v === "number" ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`) : "n/a");
const pct = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "n/a");
const units = (v) => (typeof v === "number" ? Math.round(v).toLocaleString("en-US") : "n/a");
const days = (v) => (v === Infinity ? "Not recovered" : typeof v === "number" ? `${Math.round(v)} days` : "n/a");

function row(sc, key) {
  for (const g of sc?.groups || []) for (const r of g.rows || []) if (r.key === key) return r;
  return null;
}

function metricsOf(sc) {
  const ttrRow = row(sc, "ttr");
  let ttr = null;
  if (ttrRow) ttr = ttrRow.state === "not_recovered" ? Infinity : typeof ttrRow.during === "number" ? ttrRow.during : null;
  const num = (r, f) => (r && typeof r[f] === "number" ? r[f] : null);
  const rr = row(sc, "fill_rate");
  const pk = row(sc, "peak_backorder");
  const cu = row(sc, "customers_impacted");
  return {
    fill: num(rr, "overall") ?? num(rr, "during"),
    peak: num(pk, "overall") ?? num(pk, "during"),
    customers: num(cu, "during"),
    ttr,
    hidden: num(row(sc, "hidden"), "during"),
    revenue: typeof sc?.revenue_at_risk === "number" ? sc.revenue_at_risk : null,
    first: sc?.first_shortage_date || null,
  };
}

// metric definitions: label, key, format, direction (1 = higher is better, -1 = lower is better, 0 = no ranking)
const METRICS = [
  { label: "Fill rate", key: "fill", fmt: pct, dir: 1 },
  { label: "Peak backorder (units)", key: "peak", fmt: units, dir: -1 },
  { label: "Revenue at risk", key: "revenue", fmt: money, dir: -1 },
  { label: "Time to recover", key: "ttr", fmt: days, dir: -1 },
  { label: "Customers impacted", key: "customers", fmt: (v) => (typeof v === "number" ? String(v) : "n/a"), dir: -1 },
  { label: "Days exposed before it shows", key: "hidden", fmt: days, dir: 0 },
  { label: "First shortage (later is better)", key: "first", fmt: (v) => v || "None", dir: 1, rank: (v) => (v ? Date.parse(v) : Infinity) },
];

function bestIndex(vals, dir) {
  if (!dir) return -1;
  const ok = vals.map((v, i) => [v, i]).filter(([v]) => typeof v === "number" && !Number.isNaN(v));
  if (ok.length < 2) return -1;
  const target = dir === 1 ? Math.max(...ok.map(([v]) => v)) : Math.min(...ok.map(([v]) => v));
  const hits = ok.filter(([v]) => v === target);
  return hits.length === 1 ? hits[0][1] : -1;
}

function summary(cols) {
  const withFill = cols.filter((c) => typeof c.m.fill === "number");
  if (withFill.length < 2) return "";
  const best = [...withFill].sort((a, b) => b.m.fill - a.m.fill)[0];
  const worst = [...withFill].sort((a, b) => a.m.fill - b.m.fill)[0];
  if (best === worst || Math.abs(best.m.fill - worst.m.fill) < 0.05) return "These runs have the same fill rate.";
  let s = `${best.label} holds fill rate ${(best.m.fill - worst.m.fill).toFixed(1)} points higher than ${worst.label}`;
  if (typeof best.m.revenue === "number" && typeof worst.m.revenue === "number" && worst.m.revenue > best.m.revenue) {
    s += ` and carries ${money(worst.m.revenue - best.m.revenue)} less revenue at risk`;
  }
  const bt = best.m.ttr, wt = worst.m.ttr;
  if (typeof bt === "number" && bt !== Infinity && (wt === Infinity || (typeof wt === "number" && wt > bt))) {
    s += wt === Infinity ? ", and recovers while the other does not" : `, and recovers ${Math.round(wt - bt)} days sooner`;
  }
  return s + ".";
}

export default function CompareRuns({ runs, onClose }) {
  const [cols, setCols] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCols(null);
    setErr("");
    (async () => {
      const API_BASE = getApiBase();
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      try {
        const out = await Promise.all(runs.map(async (r) => {
          const res = await fetch(`${API_BASE}/api/run-kpis/${r.id}`, { headers: { Authorization: `Bearer ${token}` } });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body?.scorecard?.ok) return { label: r.label, m: null };
          return { label: r.label, m: metricsOf(body.scorecard) };
        }));
        if (!cancelled) setCols(out);
      } catch (e) {
        if (!cancelled) setErr("Could not load these runs.");
      }
    })();
    return () => { cancelled = true; };
  }, [runs.map((r) => r.id).join("|")]);

  const ready = cols && cols.every((c) => c.m);
  return (
    <div className="rounded-2xl border p-5 mb-4" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "#143629" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold" style={{ color: GREEN }}>Compare runs</h3>
        <button onClick={onClose} className="rounded-lg border px-3 py-1 text-sm font-semibold" style={{ color: GREEN, borderColor: "rgba(159,214,58,0.35)" }}>Close</button>
      </div>
      {err && <div className="text-sm text-red-300">{err}</div>}
      {!err && !cols && <div className="text-sm" style={{ color: "#94A3B8" }}>Loading runs...</div>}
      {cols && !ready && <div className="text-sm text-amber-300">One or more runs could not be loaded. Open them once from the repository, then try again.</div>}
      {ready && (
        <>
          <p className="text-sm mb-4" style={{ color: "#E2E8F0" }}>{summary(cols)}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "#64748B" }}>
                  <th className="text-left font-semibold py-2 pr-3 text-xs uppercase tracking-wider">Measure</th>
                  {cols.map((c, i) => <th key={i} className="text-left font-semibold py-2 px-3 text-xs" style={{ color: GREEN }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((mt) => {
                  const vals = cols.map((c) => c.m[mt.key]);
                  const best = bestIndex(mt.rank ? vals.map(mt.rank) : vals, mt.dir);
                  return (
                    <tr key={mt.key} className="border-t" style={{ borderColor: "#143629" }}>
                      <td className="py-2 pr-3" style={{ color: "#94A3B8" }}>{mt.label}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="py-2 px-3 font-semibold" style={{ color: i === best ? GREEN : "#E2E8F0" }}>
                          {mt.fmt(v)}{i === best ? " ✓" : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px]" style={{ color: "#64748B" }}>A check mark shows the better value for that measure. Revenue at risk is the largest unfilled backlog priced at your unit prices and shows n/a when no prices were supplied.</p>
        </>
      )}
    </div>
  );
}
