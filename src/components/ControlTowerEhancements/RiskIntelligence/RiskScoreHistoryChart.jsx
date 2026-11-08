import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  API_BASE,
  MOCK_SIGNAL_DETAIL,
  MOCK_LITHIUM_SIGNAL_DETAIL,
  MOCK_RARE_EARTH_SIGNAL_DETAIL,
  MOCK_STEEL_ALUMINUM_SIGNAL_DETAIL,
  MOCK_RESINS_SIGNAL_DETAIL,
  MOCK_RUBBER_SIGNAL_DETAIL,
} from "./signalSources";
import { COMMODITY_REGISTRY } from "./commodityRegistry";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// A distinct color per commodity so lines stay visually distinguishable
// as more commodities accumulate history.
const COMMODITY_COLORS = {
  semiconductors_mlcc: "#4ADE80",
  lithium_battery: "#60A5FA",
  rare_earth_metals: "#F472B6",
  steel_aluminum: "#FBBF24",
  automotive_resins: "#A78BFA",
  natural_rubber: "#34D399",
};

// Which detail object holds each commodity's signals — same mapping
// RiskIntelligenceView.jsx uses to pick detailData per commodity.
const DETAIL_BY_COMMODITY = {
  semiconductors_mlcc: MOCK_SIGNAL_DETAIL,
  lithium_battery: MOCK_LITHIUM_SIGNAL_DETAIL,
  rare_earth_metals: MOCK_RARE_EARTH_SIGNAL_DETAIL,
  steel_aluminum: MOCK_STEEL_ALUMINUM_SIGNAL_DETAIL,
  automotive_resins: MOCK_RESINS_SIGNAL_DETAIL,
  natural_rubber: MOCK_RUBBER_SIGNAL_DETAIL,
};

// Built 2026-09-30, alongside the signal accuracy pass and the Signal
// Contribution Waterfall. This chart's spanGaps:true draws a straight
// line across any day with no snapshot — which looks identical to a day
// where a signal WAS checked and genuinely confirmed unchanged. Without
// a marker, both read as "static." This pulls the distinct reviewedAt
// dates out of each commodity's own detail objects so a reviewed point
// on the line can be drawn differently from an un-reviewed one.
function getReviewDatesForCommodity(commodityKey) {
  const detail = DETAIL_BY_COMMODITY[commodityKey];
  if (!detail) return new Set();
  const dates = new Set();
  for (const signal of Object.values(detail)) {
    if (signal?.reviewedAt) dates.add(signal.reviewedAt);
  }
  return dates;
}

export default function RiskScoreHistoryChart() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // All commodities visible by default — "combined" per the original
  // request. Individual toggle buttons below provide the "filtered by
  // each commodity" requirement.
  const [visibleCommodities, setVisibleCommodities] = useState(
    () => new Set(COMMODITY_REGISTRY.map((c) => c.key))
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/risk/history`);
        const data = await res.json();
        setHistory(data.history || []);
        setError(null);
      } catch (e) {
        setError("Failed to load risk score history.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleCommodity = (key) => {
    setVisibleCommodities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Shared x-axis: every unique date across ALL commodities' history,
  // sorted chronologically.
  const allDates = [...new Set(history.map((h) => h.date))].sort();

  // One Chart.js dataset per currently-visible commodity, each aligned
  // to the shared date axis. A date with no snapshot for a given
  // commodity becomes null (not zero) — spanGaps below tells Chart.js
  // to draw a continuous line across those gaps rather than dropping
  // to zero, since a missing day of data isn't the same as a real
  // score of zero.
  const datasets = COMMODITY_REGISTRY.filter((c) => visibleCommodities.has(c.key)).map((c) => {
    const commodityHistory = history.filter((h) => h.commodity_key === c.key);
    const scoreByDate = Object.fromEntries(commodityHistory.map((h) => [h.date, h.risk_score]));
    const reviewDates = getReviewDatesForCommodity(c.key);
    const color = COMMODITY_COLORS[c.key] || "#94A3B8";
    return {
      label: c.label,
      data: allDates.map((d) => (d in scoreByDate ? scoreByDate[d] : null)),
      borderColor: color,
      backgroundColor: color,
      spanGaps: true,
      tension: 0.2,
      // A reviewed date gets a bigger, ringed point so "confirmed
      // unchanged" is visually distinct from "just unmeasured" — both
      // would otherwise look like the same flat, interpolated stretch.
      pointRadius: allDates.map((d) => (reviewDates.has(d) && d in scoreByDate ? 7 : d in scoreByDate ? 3 : 0)),
      pointBackgroundColor: allDates.map((d) => (reviewDates.has(d) && d in scoreByDate ? "#0B0F14" : color)),
      pointBorderColor: allDates.map((d) => (reviewDates.has(d) && d in scoreByDate ? color : color)),
      pointBorderWidth: allDates.map((d) => (reviewDates.has(d) && d in scoreByDate ? 3 : 1)),
      _reviewDates: reviewDates,
    };
  });

  const chartData = { labels: allDates, datasets };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Risk Score Over Time" },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const ds = context.dataset;
            const date = allDates[context.dataIndex];
            return ds?._reviewDates?.has(date) ? "✓ Accuracy-reviewed this date" : undefined;
          },
        },
      },
    },
    scales: {
      y: { min: 0, max: 100, title: { display: true, text: "Risk Score" } },
    },
  };

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        {COMMODITY_REGISTRY.map((c) => {
          const color = COMMODITY_COLORS[c.key] || "#94A3B8";
          const isVisible = visibleCommodities.has(c.key);
          return (
            <button
              key={c.key}
              onClick={() => toggleCommodity(c.key)}
              style={{
                padding: "4px 12px",
                borderRadius: "999px",
                border: `1px solid ${color}`,
                background: isVisible ? color : "transparent",
                color: isVisible ? "#0B0F14" : color,
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {loading && <div>Loading risk score history…</div>}
      {error && <div style={{ color: "#F87171" }}>{error}</div>}
      {!loading && !error && allDates.length === 0 && (
        <div style={{ color: "#94A3B8" }}>
          No historical data yet — this chart builds up over time as each commodity's dashboard gets viewed
          day to day.
        </div>
      )}
      {!loading && !error && allDates.length > 0 && (
        <>
          <div style={{ height: "400px" }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
            Larger, ringed points mark a date a commodity's signals were accuracy-reviewed —
            distinguishing "confirmed stable" from a day that just wasn't measured.
          </div>
        </>
      )}
    </div>
  );
}
