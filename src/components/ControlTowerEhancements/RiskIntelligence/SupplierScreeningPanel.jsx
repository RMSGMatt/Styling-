// ─────────────────────────────────────────────────────────────────────────────
// SupplierScreeningPanel.jsx
// FOR-C Risk Intelligence — Supplier List Screening
//
// Upload a customer's actual supplier list (CSV: supplier_name,
// country_code, commodity_category) and screen every row against UFLPA,
// State Department Travel Advisory, and AI-scored corridor risk in one
// batch. This is the bridge between FOR-C's generic country-level tools
// and a customer's specific named Tier N supply base.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useRef } from "react";
import { getApiBase } from "../../../config/apiBase";

const API_BASE = getApiBase();

const riskColor = (score) => {
  if (score === null || score === undefined) return "#55606B";
  if (score >= 75) return "#ef4444";
  if (score >= 55) return "#f97316";
  if (score >= 35) return "#eab308";
  return "#22c55e";
};

const riskLabel = (score) => {
  if (score === null || score === undefined) return "N/A";
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
};

const SAMPLE_CSV = `supplier_name,country_code,commodity_category
Example Supplier 1,CHN,semiconductor
Example Supplier 2,DEU,automotive
Example Supplier 3,MEX,automotive`;

export default function SupplierScreeningPanel() {
  const [file,      setFile]      = useState(null);
  const [results,   setResults]   = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forc_supplier_list_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runScreening = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSummary(null);

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("token") ||
        "";

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/supplier-screening/bulk`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (data.status === "success") {
        setResults(data.results);
        setSummary(data.summary);
      } else {
        setError(data.error || "Screening failed.");
      }
    } catch (e) {
      setError("Could not reach the screening service.");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const S = {
    wrap: { background: "#141B23", border: "0.5px solid #1E2733", borderRadius: 12, overflow: "hidden" },
    header: { padding: "20px 24px", borderBottom: "0.5px solid #1E2733" },
    body: { padding: "20px 24px" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ fontSize: 13, color: "#7A8A99", lineHeight: 1.6 }}>
          Upload your actual supplier list and screen every row against the same
          authoritative signals used throughout Risk Intelligence — UFLPA Entity List,
          State Department Travel Advisories, and AI-scored corridor risk. Results are
          sorted highest-risk-first; hard compliance flags always sort to the top.
        </div>
      </div>

      <div style={S.body}>
        {!results && !loading && (
          <div style={{
            border: "1.5px dashed #1E2733",
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>📄</div>
            <div style={{ fontSize: 13, color: "#C7D0D9", marginBottom: 16 }}>
              Upload a CSV with columns: <code>supplier_name</code>, <code>country_code</code>,
              and optionally <code>commodity_category</code>.
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "#1A2129", color: "#9FD63A", border: "0.5px solid #9FD63A",
                  borderRadius: 8, padding: "10px 18px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {file ? `📎 ${file.name}` : "Choose CSV File"}
              </button>

              <button
                onClick={downloadSample}
                style={{
                  background: "none", color: "#7A8A99", border: "0.5px solid #1E2733",
                  borderRadius: 8, padding: "10px 18px", fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Download Template
              </button>
            </div>

            {file && (
              <button
                onClick={runScreening}
                style={{
                  marginTop: 16,
                  background: "linear-gradient(90deg, #9FD63A, #22c55e)",
                  color: "#111B21", border: "none", borderRadius: 8,
                  padding: "12px 28px", fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Screen Suppliers →
              </button>
            )}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "2px solid #1E2733", borderTop: "2px solid #9FD63A",
              animation: "forc-ssp-spin 0.9s linear infinite",
            }} />
            <style>{`@keyframes forc-ssp-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 12, color: "#7A8A99" }}>
              Screening suppliers against UFLPA, State Dept, and corridor risk...
            </div>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#DC2626", fontSize: 12, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {results && !loading && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "#1A2129", color: "#C7D0D9", fontWeight: 500 }}>
                {summary.total_screened} screened
              </div>
              {summary.uflpa_flagged > 0 && (
                <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#F87171", fontWeight: 600 }}>
                  🚫 {summary.uflpa_flagged} UFLPA flagged
                </div>
              )}
              {summary.high_or_critical_risk > 0 && (
                <div style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#FDBA74", fontWeight: 600 }}>
                  ⚠ {summary.high_or_critical_risk} high/critical risk
                </div>
              )}
              <button
                onClick={() => { setResults(null); setSummary(null); setFile(null); }}
                style={{
                  marginLeft: "auto",
                  fontSize: 11, color: "#7A8A99", background: "none",
                  border: "0.5px solid #1E2733", borderRadius: 20,
                  padding: "6px 14px", cursor: "pointer",
                }}
              >
                Screen another list
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((r) => {
                const color = riskColor(r.corridor_score);
                const isExpanded = expanded === r.row;

                return (
                  <div
                    key={r.row}
                    style={{
                      background: "#141B23",
                      border: "0.5px solid #1E2733",
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => setExpanded(isExpanded ? null : r.row)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 16px", cursor: "pointer", flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#F1F5F9" }}>
                          {r.supplier_name}
                        </div>
                        <div style={{ fontSize: 10, color: "#55606B" }}>
                          {r.country_code} · {r.commodity_category}
                        </div>
                      </div>

                      {r.uflpa?.flagged && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                          background: r.uflpa.matched_entity ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.1)",
                          color: r.uflpa.matched_entity ? "#F87171" : "#FBBF24",
                        }}>
                          {r.uflpa.matched_entity ? "UFLPA MATCH" : "UFLPA ADVISORY"}
                        </span>
                      )}

                      {r.state_dept_advisory && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                          background: `${r.state_dept_advisory.color}1A`,
                          color: r.state_dept_advisory.color,
                          border: `0.5px solid ${r.state_dept_advisory.color}50`,
                        }}>
                          STATE DEPT L{r.state_dept_advisory.level}
                        </span>
                      )}

                      <div style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>
                          {r.corridor_score ?? "—"}
                        </div>
                        <div style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
                          {riskLabel(r.corridor_score)}
                        </div>
                      </div>

                      <div style={{ fontSize: 14, color: "#55606B", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                        ▸
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 16px 16px 16px", borderTop: "0.5px solid #1E2733" }}>
                        {r.error && (
                          <div style={{ fontSize: 11, color: "#DC2626", padding: "10px 0 4px" }}>
                            ⚠ {r.error}
                          </div>
                        )}
                        {r.executive_summary && (
                          <div style={{ fontSize: 11.5, color: "#C7D0D9", lineHeight: 1.7, padding: "12px 0 4px" }}>
                            {r.executive_summary}
                          </div>
                        )}
                        {r.state_dept_advisory?.summary && (
                          <div style={{ fontSize: 10.5, color: "#7A8A99", lineHeight: 1.6, padding: "8px 0 4px" }}>
                            <strong>State Dept:</strong> {r.state_dept_advisory.summary}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
