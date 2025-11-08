import React, { useEffect, useState } from "react";

/**
 * RevenueSummary with delta vs baseline
 */
export default function RevenueSummary({ runs = [], highlightBaselineId }) {
  const [rows, setRows] = useState([]);

  // Common field keys
  const QUANTITY_KEYS = ["quantity", "qty", "amount"];
  const PRICE_KEYS = ["sell_price", "price", "unit_price"];
  const COST_KEYS = ["cost_per_unit", "cost", "unit_cost"];

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const parts = line.split(",");
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = parts[i] ? parts[i].trim() : "";
      });
      return obj;
    });
  }

  function computeMetrics(data) {
    let revenue = 0,
      cost = 0;
    data.forEach((row) => {
      const q = parseFloat(
        QUANTITY_KEYS.map((k) => row[k]).find((v) => v !== undefined) || 0
      );
      const p = parseFloat(
        PRICE_KEYS.map((k) => row[k]).find((v) => v !== undefined) || 0
      );
      const c = parseFloat(
        COST_KEYS.map((k) => row[k]).find((v) => v !== undefined) || 0
      );
      if (!isNaN(q)) {
        if (!isNaN(p)) revenue += q * p;
        if (!isNaN(c)) cost += q * c;
      }
    });
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, cost, margin, marginPct };
  }

  async function fetchText(url) {
    if (!url) return null;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  useEffect(() => {
    let alive = true;

    async function processRuns() {
      const results = [];
      for (const r of runs) {
        try {
          const urls = r.urls || {};
          const url =
            urls.flow_output_file_url || urls.production_output_file_url;
          if (!url) continue;
          const text = await fetchText(url);
          if (!text) continue;
          const parsed = parseCSV(text);
          const m = computeMetrics(parsed);
          results.push({ id: r.id, name: r.name, ...m });
        } catch (err) {
          console.error("RevenueSummary error", err);
        }
      }
      if (alive) setRows(results);
    }

    processRuns();
    return () => {
      alive = false;
    };
  }, [runs]);

  if (!runs || runs.length === 0) return null;

  // find baseline row
  const baseline = rows.find((r) => String(r.id) === String(highlightBaselineId));

  function deltaDisplay(current, base, betterWhenHigher = true) {
    if (!baseline) return null;
    const diff = current - base;
    if (Math.abs(diff) < 1e-6) return <span className="text-gray-400 ml-1">● 0</span>;
    const positive = betterWhenHigher ? diff > 0 : diff < 0;
    return (
      <span
        className={`ml-1 ${
          positive ? "text-green-600" : "text-red-600"
        } text-xs`}
      >
        {positive ? "▲" : "▼"} {diff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
    );
  }

  return (
    <div className="rounded-2xl p-4 border bg-white/80 mt-4">
      <div className="text-sm font-semibold text-[#1D625B] mb-3">
        💰 Revenue & Cost Summary
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600 border-b">
            <th className="py-1">Run</th>
            <th className="py-1">Revenue</th>
            <th className="py-1">Cost</th>
            <th className="py-1">Margin</th>
            <th className="py-1">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isBaseline = highlightBaselineId === String(row.id);
            const cls = isBaseline
              ? "font-semibold text-[#065f46]"
              : "text-gray-800";
            return (
              <tr key={row.id} className="border-b last:border-0">
                <td className={`py-1 ${cls}`}>
                  {row.name} {isBaseline && "✓ Baseline"}
                </td>
                <td className="py-1">
                  ${row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {baseline &&
                    !isBaseline &&
                    deltaDisplay(row.revenue, baseline.revenue, true)}
                </td>
                <td className="py-1">
                  ${row.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {baseline &&
                    !isBaseline &&
                    deltaDisplay(row.cost, baseline.cost, false)}
                </td>
                <td className="py-1">
                  ${row.margin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {baseline &&
                    !isBaseline &&
                    deltaDisplay(row.margin, baseline.margin, true)}
                </td>
                <td className="py-1">
                  {row.marginPct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
