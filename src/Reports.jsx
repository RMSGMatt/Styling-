const API_BASE =
  (import.meta?.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/$/, "")) ||
  "https://supply-chain-simulator.onrender.com";

import React, { useEffect, useMemo, useState } from "react";

/* ======= BRAND SYSTEM ======= */
const BRAND = {
  green: "#1D625B",
  greenMid: "#2e7c6f",
  greenLight: "#e8f8f5",
  limeSoft: "#e9fce0",
  limeText: "#1a3a34",
  border: "border-gray-200",
};

const CARD =
  "relative p-5 rounded-2xl shadow-sm border bg-white/90 hover:shadow-md transition " +
  BRAND.border;
const BTN =
  "px-3 py-2 rounded-xl border text-sm disabled:opacity-50 transition " +
  "focus:outline-none focus:ring-2 focus:ring-offset-2";
const ICONBTN =
  "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition " +
  "focus:outline-none focus:ring-2 focus:ring-offset-2";

/* ======= HELPERS ======= */
function formatDate(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}
function copyText(txt) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(ta);
}
const openIf = (url) => {
  if (!url) return;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 0);
};

/* ======= MAIN ======= */
export default function Reports({ switchView }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ======= FETCH LIVE SIMULATION HISTORY ======= */
  async function fetchReports() {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Missing authentication token.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/simulations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      list.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setReports(list);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  /* ======= UI ======= */
  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${BRAND.greenLight} 0%, #ffffff 42%)`,
      }}
    >
      {/* Header */}
      <header
        className="w-full border-b sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/10"
        style={{
          background: `linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`,
          borderColor: "rgba(255,255,255,0.15)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="FOR-C"
              className="h-8 w-auto rounded-lg shadow-sm"
            />
            <div className="text-white text-lg font-semibold tracking-wide">
              Reports
            </div>
            <span className="hidden md:inline-flex items-center text-xs text-white/85 bg-white/10 rounded-full px-2 py-1 ml-1">
              Simulation Outputs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                typeof switchView === "function"
                  ? switchView("control")
                  : (window.location.href = "/")
              }
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white shadow-sm"
              aria-label="Back to Control Tower"
              title="Back to Control Tower"
            >
              ← Control Tower
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header & Refresh */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[#1D625B]">
            📄 Simulation Reports
          </h1>
          <button
            onClick={fetchReports}
            className="bg-[#1D625B] text-white px-4 py-2 rounded hover:bg-lime-600"
          >
            Refresh
          </button>
        </div>

        {/* States */}
        {loading && <p className="text-gray-600">Loading reports…</p>}
        {error && <p className="text-red-600">Error: {error}</p>}
        {!loading && !error && reports.length === 0 && (
          <div className={`${CARD} text-gray-600`}>
            <div className="text-lg font-medium">No reports yet</div>
            <div className="text-sm">
              Run a simulation, then check back here. We’ll populate this
              automatically.
            </div>
          </div>
        )}

        {/* Reports */}
        {!loading &&
          !error &&
          reports.length > 0 &&
          reports.map((r, idx) => {
            const urls = r.outputUrls || r.output_urls || {};
            return (
              <article
                key={idx}
                className="bg-white rounded-lg shadow p-4 border border-gray-200"
              >
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-[#1D625B]">
                    Run #{reports.length - idx}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {formatDate(r.timestamp)}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  {Object.entries(urls).map(
                    ([key, url]) =>
                      url && (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm bg-lime-100 hover:bg-lime-200 text-[#1D625B] px-3 py-1 rounded transition"
                        >
                          {key
                            .replace("_output_file_url", "")
                            .replace(/_/g, " ")}
                        </a>
                      )
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className={BTN}
                    style={{
                      borderColor: BRAND.green,
                      color: BRAND.green,
                    }}
                    onClick={() =>
                      Object.values(urls).forEach((u, i) =>
                        setTimeout(() => openIf(u), i * 100)
                      )
                    }
                  >
                    Open All
                  </button>
                  <button
                    className={BTN}
                    style={{
                      borderColor: BRAND.green,
                      color: BRAND.green,
                    }}
                    onClick={() =>
                      copyText(
                        Object.entries(urls)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("\n")
                      )
                    }
                  >
                    Copy Links
                  </button>
                </div>
              </article>
            );
          })}

        <footer className="pt-2 pb-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} FOR-C • Reports
        </footer>
      </main>
    </div>
  );
}
