// ─────────────────────────────────────────────────────────────────────────────
// SafetyStockView.jsx
// FOR-C v3 · Control Tower — Safety Stock Monitor
//
// Real-data-intent monitor (per direction: Control Tower = real data,
// Simulation Dashboard = simulated data). v1 data source is manual CSV
// upload, clearly disclosed as such — the loadLatestSnapshot()/saveSnapshot()
// seam in safetyStockStore.js is where a future live ERP feed plugs in
// without this component needing to change.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import {
  loadLatestSnapshot,
  fetchNetworkSafetyStock,
  loadPreviousSnapshot,
  saveSnapshot,
  clearSnapshots,
  normalizeCsvRows,
  deriveSafetyStockAlerts,
  DEFAULT_DOH_FLOOR,
  WATCH_DROP_PCT,
  ACT_DROP_PCT,
} from "./safetyStockStore";

const SEVERITY_STYLE = {
  escalate: { color: "#fff", bg: "#7f1d1d", border: "#ef4444", label: "ESCALATE" },
  act:      { color: "#FCA5A5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", label: "ACT" },
  watch:    { color: "#FCD34D", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)", label: "WATCH" },
  ok:       { color: "#86efac", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.3)", label: "OK" },
};

export default function SafetyStockView() {
  const [manualSnapshot, setSnapshot] = useState(() => loadLatestSnapshot());
  const [manualPrevious, setPrevious] = useState(() => loadPreviousSnapshot());
  const [net, setNet] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchNetworkSafetyStock().then((n) => { if (!cancelled) setNet(n); });
    return () => { cancelled = true; };
  }, []);
  // A CSV the user uploaded wins; otherwise days on hand come from the loaded network.
  const snapshot = manualSnapshot || net?.current || null;
  const previous = manualSnapshot ? manualPrevious : (net?.previous || null);
  const fromNetwork = !manualSnapshot && !!net?.current;
  const [dragOver, setDragOver] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null); // { added, skipped } | null
  const [parseError, setParseError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setParseError("Please upload a .csv file.");
      return;
    }
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target.result || "").replace(/^\uFEFF/, "");
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      });
      const { rows, skipped } = normalizeCsvRows(parsed.data);

      if (rows.length === 0) {
        setParseError(
          skipped > 0
            ? `Couldn't read any valid rows (${skipped} row${skipped > 1 ? "s" : ""} missing facility/sku/DOH). Expected columns: facility, sku, current_doh, doh_floor (optional).`
            : "The file appears to be empty."
        );
        return;
      }

      const savedSnapshot = saveSnapshot({ rows, source: "csv_upload" });
      setSnapshot(savedSnapshot);
      setPrevious(loadPreviousSnapshot());
      setUploadSummary({ added: rows.length, skipped });
    };
    reader.onerror = () => setParseError("Could not read that file.");
    reader.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const handleClear = () => {
    clearSnapshots();
    setSnapshot(null);
    setPrevious(null);
    setUploadSummary(null);
    setParseError(null);
  };

  const alerts = snapshot ? deriveSafetyStockAlerts(snapshot, previous) : [];
  const alertByKey = {};
  alerts.forEach((a) => { alertByKey[`${a.facility}::${a.sku}`] = a; });

  // Independent of alerts — a row can have a previous value worth showing
  // even when it didn't trigger anything (e.g. a small drop, or a rise).
  const prevByKey = {};
  (previous?.rows || []).forEach((r) => { prevByKey[`${r.facility}::${r.sku}`] = r; });

  const tableRows = (snapshot?.rows || []).map((row) => {
    const key = `${row.facility}::${row.sku}`;
    const alert = alertByKey[key];
    const floor = row.doh_floor ?? DEFAULT_DOH_FLOOR;
    const prevRow = prevByKey[key];
    // Signed change for display (can be positive) — distinct from dropPct,
    // which only exists on the alert object for drops (that's what drives
    // severity). A rise like PMIC-500's +29% doesn't trigger anything in
    // v1, but hiding it now that Previous DOH is visible would just make
    // the table look wrong ("10 -> 18, no change shown?").
    const pctChange = prevRow && prevRow.current_doh > 0
      ? ((row.current_doh - prevRow.current_doh) / prevRow.current_doh) * 100
      : null;
    return {
      ...row,
      floor,
      severity: alert?.severity || "ok",
      dropPct: alert?.dropPct ?? null,
      previousDoh: prevRow ? prevRow.current_doh : null,
      pctChange,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: "#2EC4A6" }}>
            🛡️ Safety Stock Monitor
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "transparent", color: "#eab308", border: "1px solid rgba(234,179,8,0.5)" }}
              title={fromNetwork ? "Days on hand are calculated from the network loaded in Control Tower: on-hand inventory divided by average daily usage." : "Data source: manual CSV upload."}
            >
              {fromNetwork ? "NETWORK DATA" : "CSV UPLOAD"}
            </span>
          </h2>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
            Ground-truth inventory monitoring — independent of Simulation Dashboard's scenario data.
            {snapshot && (
              <> Last snapshot: {new Date(snapshot.timestamp).toLocaleString()}
                {previous && ` · compared against ${new Date(previous.timestamp).toLocaleString()}`}.
              </>
            )}
          </p>
        </div>
        {manualSnapshot && (
          <button
            onClick={handleClear}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.35)" }}
          >
            {net?.current ? "Use network data" : "Clear snapshots"}
          </button>
        )}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed px-6 py-8 mb-5 text-center cursor-pointer transition"
        style={{
          borderColor: dragOver ? "#9FD63A" : "rgba(159,214,58,0.3)",
          background: dragOver ? "rgba(159,214,58,0.08)" : "rgba(9,25,19,0.4)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <p className="text-sm font-semibold" style={{ color: "#9FD63A" }}>
          {snapshot ? "Drop a new snapshot to replace, or click to browse" : "Drop your current inventory CSV here, or click to browse"}
        </p>
        <p className="text-xs mt-1" style={{ color: "#64748B" }}>
          Expected columns: facility, sku, current_doh, doh_floor (optional — defaults to {DEFAULT_DOH_FLOOR} days)
        </p>
      </div>

      {parseError && (
        <div className="rounded-xl px-4 py-2.5 mb-4 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5" }}>
          {parseError}
        </div>
      )}

      {uploadSummary && !parseError && (
        <div className="rounded-xl px-4 py-2.5 mb-4 text-sm" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
          Loaded {uploadSummary.added} row{uploadSummary.added !== 1 ? "s" : ""}
          {uploadSummary.skipped > 0 && ` (${uploadSummary.skipped} skipped — missing facility/sku/DOH)`}.
        </div>
      )}

      {!snapshot ? (
        <div className="rounded-xl px-4 py-6 text-center text-sm" style={{ background: "rgba(9,25,19,0.4)", color: "#64748B" }}>
          No snapshot loaded yet. Load a network with inventory and average daily usage in Control Tower, or upload a CSV, to see current safety stock status.
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(159,214,58,0.2)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(9,25,19,0.6)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Facility</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>SKU</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Previous DOH</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Current DOH</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Floor</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Change</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "#64748B" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const style = SEVERITY_STYLE[row.severity];
                const changeColor = row.pctChange == null ? "#64748B" : row.pctChange < 0 ? "#FCA5A5" : "#86efac";
                return (
                  <tr key={`${row.facility}::${row.sku}`} style={{ background: i % 2 ? "rgba(9,25,19,0.3)" : "transparent" }}>
                    <td className="px-4 py-2.5" style={{ color: "#E2E8F0" }}>{row.facility}</td>
                    <td className="px-4 py-2.5" style={{ color: "#E2E8F0" }}>{row.sku}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "#64748B" }}>
                      {row.previousDoh != null ? row.previousDoh.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "#E2E8F0" }}>{row.current_doh.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "#64748B" }}>{Number.isInteger(row.floor) ? row.floor : Number(row.floor).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right" style={{ color: changeColor }}>
                      {row.pctChange == null ? "—" : `${row.pctChange > 0 ? "+" : ""}${row.pctChange.toFixed(0)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                      >
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] mt-4" style={{ color: "#475569" }}>
        Thresholds: WATCH at &gt;{WATCH_DROP_PCT}% DOH drop, ACT at &gt;{ACT_DROP_PCT}% drop or below floor, ESCALATE at both.
        Single-snapshot comparison in v1 — no multi-snapshot confirmation yet, so a single unusual delta (e.g. a large receipt or consumption day) can trigger an alert on its own.
      </p>
    </div>
  );
}
