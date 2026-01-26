import React, { useMemo } from "react";

/**
 * ReportsView – Enhanced Premium UI (Revenue-ready)
 * - Strong visual hierarchy: hero, summary chips, report-pack cards
 * - Tile buttons for downloads (Core vs Insights)
 * - Supports sim.output_urls OR sim.outputUrls
 * - Optional bundle + locations support
 */

export default function ReportsView({ simulationHistory }) {
  const hasReports = Array.isArray(simulationHistory) && simulationHistory.length > 0;

  const getOutputs = (sim) => sim?.output_urls || sim?.outputUrls || {};
  const pickUrl = (outputs, snakeKey, camelKey) =>
    outputs?.[snakeKey] || outputs?.[camelKey] || null;

  const formatTimestamp = (ts) => {
    if (!ts) return "Unknown date";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      return d.toLocaleString();
    } catch {
      return String(ts);
    }
  };

  const latestRun = useMemo(() => {
    if (!hasReports) return null;
    // assume history is already sorted DESC; if not, still "latest shown"
    return simulationHistory[0];
  }, [hasReports, simulationHistory]);

  const latestTs = latestRun?.timestamp ? formatTimestamp(latestRun.timestamp) : "—";
  const latestStatus = latestRun?.status || "done";

  const statusStyles = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("error") || s.includes("fail")) {
      return "bg-red-50 text-red-700 border-red-200";
    }
    if (s.includes("run") || s.includes("process") || s.includes("pending")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  };

  const tileBase =
    "group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all " +
    "hover:shadow-md hover:-translate-y-[1px] active:translate-y-0";

  const tilePrimary =
    tileBase + " bg-[#1D625B] border-[#1D625B] text-white hover:bg-[#174F47]";

  const tileSecondary =
    tileBase +
    " bg-white border-[#D8E5DD] text-[#1D625B] hover:bg-[#F2F6F3]";

  const tileMuted =
    "flex items-center gap-3 rounded-xl border border-dashed border-[#D8E5DD] px-4 py-3 text-sm text-gray-400 bg-white";

  const SectionTitle = ({ icon, title, subtitle }) => (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#F2F6F3] border border-[#D8E5DD] flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#1D625B]">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
      </div>
    </div>
  );

  const Chip = ({ label, value }) => (
    <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/20">
      <div className="text-[11px] uppercase tracking-wide opacity-90">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAF9] p-8 space-y-6">
      {/* Hero Header */}
      <div className="rounded-3xl overflow-hidden shadow-md border border-[#E5ECE7]">
        <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white p-7">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-80">
                FOR-C • Reports
              </div>
              <h1 className="text-3xl font-bold mt-2">📊 Simulation Reports</h1>
              <p className="text-sm opacity-90 mt-2 max-w-2xl">
                Download complete report packs from your simulation runs—core outputs,
                risk insights, and supporting datasets.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex gap-3">
                <Chip label="Runs" value={hasReports ? simulationHistory.length : "0"} />
                <Chip label="Latest" value={latestTs} />
                <Chip label="Status" value={latestStatus} />
              </div>

              <button
                onClick={() => window.location.reload()}
                className="bg-[#ABFA7D] hover:bg-[#93EB6C] text-[#1D625B] font-semibold px-5 py-2 rounded-xl shadow-sm transition"
                title="Refresh to reload simulation history"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Subheader strip */}
        <div className="bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold text-[#1D625B]">Tip:</span>{" "}
            Use “Download Full Pack” for the fastest export, or grab individual files below.
          </div>
          <div className="text-xs text-gray-500">
            Files open in a new tab (S3 links).
          </div>
        </div>
      </div>

      {/* Content */}
      {hasReports ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {simulationHistory.map((sim, idx) => {
            const outputs = getOutputs(sim);

            const flowUrl = pickUrl(outputs, "flow_output_file_url", "flow_output_file_url");
            const inventoryUrl = pickUrl(outputs, "inventory_output_file_url", "inventory_output_file_url");
            const productionUrl = pickUrl(outputs, "production_output_file_url", "production_output_file_url");
            const occurrenceUrl = pickUrl(outputs, "occurrence_output_file_url", "occurrence_output_file_url");

            const disruptionImpactUrl = pickUrl(outputs, "disruption_impact_url", "disruptionImpactUrl");
            const projectedImpactUrl = pickUrl(outputs, "projected_impact_url", "projectedImpactUrl");
            const runoutRiskUrl = pickUrl(outputs, "runout_risk_url", "runoutRiskUrl");
            const countermeasuresUrl = pickUrl(outputs, "countermeasures_url", "countermeasuresUrl");

            const locationsUrl =
              outputs?.locations_url ||
              outputs?.locationsUrl ||
              sim?.locations_url ||
              sim?.locationsUrl ||
              null;

            const bundleUrl =
              outputs?.report_bundle_url ||
              outputs?.bundle_url ||
              sim?.report_bundle_url ||
              sim?.bundle_url ||
              null;

            const status = sim?.status || "done";
            const timestamp = formatTimestamp(sim?.timestamp);

            const anyCore = flowUrl || inventoryUrl || productionUrl || occurrenceUrl;
            const anyInsights =
              disruptionImpactUrl || projectedImpactUrl || runoutRiskUrl || countermeasuresUrl || locationsUrl;

            const anyUrl = bundleUrl || anyCore || anyInsights;

            return (
              <div
                key={idx}
                className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-6 border-b border-[#E5ECE7] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gray-400">
                      Report Pack
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <h2 className="text-xl font-bold text-[#1D625B]">
                        Run {idx + 1}
                      </h2>
                      <span
                        className={
                          "text-xs font-semibold px-2.5 py-1 rounded-full border " +
                          statusStyles(status)
                        }
                      >
                        {status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{timestamp}</div>
                  </div>

                  {/* Primary CTA */}
                  {bundleUrl ? (
                    <a
                      href={bundleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#1D625B] hover:bg-[#174F47] text-white font-semibold px-4 py-2 rounded-xl shadow-sm transition w-full sm:w-auto"
                      title="Download full bundled report pack"
                    >
                      ⬇️ Download Full Pack
                    </a>
                  ) : (
                    <div className="text-xs text-gray-400 sm:text-right">
                      {anyUrl
                        ? "Full pack not available (download individual files)."
                        : "No files available yet."}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {/* Core Outputs */}
                  <div className="space-y-3">
                    <SectionTitle
                      icon="🧾"
                      title="Core Outputs"
                      subtitle="Primary simulation exports used for dashboards & analysis"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {flowUrl ? (
                        <a
                          href={flowUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">🌐</span>
                          <div>
                            <div className="font-semibold">Flow Output</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Network movement / lanes / quantities
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">🌐</span>
                          <div>
                            <div className="font-semibold">Flow Output</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {inventoryUrl ? (
                        <a
                          href={inventoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">📦</span>
                          <div>
                            <div className="font-semibold">Inventory Output</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Stock levels, turns, runout patterns
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">📦</span>
                          <div>
                            <div className="font-semibold">Inventory Output</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {productionUrl ? (
                        <a
                          href={productionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">🏭</span>
                          <div>
                            <div className="font-semibold">Production Output</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Build plan, constraints, capacity outcomes
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">🏭</span>
                          <div>
                            <div className="font-semibold">Production Output</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {occurrenceUrl ? (
                        <a
                          href={occurrenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">⚠️</span>
                          <div>
                            <div className="font-semibold">Occurrence Output</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Exceptions, unfulfilled demand, incidents
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">⚠️</span>
                          <div>
                            <div className="font-semibold">Occurrence Output</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Insights & Risk */}
                  <div className="space-y-3">
                    <SectionTitle
                      icon="🧠"
                      title="Insights & Risk"
                      subtitle="Decision-support outputs for revenue-ready reporting"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {disruptionImpactUrl ? (
                        <a
                          href={disruptionImpactUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">📉</span>
                          <div>
                            <div className="font-semibold">Disruption Impact</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Exposure + severity by node / region / supplier
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">📉</span>
                          <div>
                            <div className="font-semibold">Disruption Impact</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {projectedImpactUrl ? (
                        <a
                          href={projectedImpactUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">📈</span>
                          <div>
                            <div className="font-semibold">Projected Impact</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Forward-looking risk projection & cost
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">📈</span>
                          <div>
                            <div className="font-semibold">Projected Impact</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {runoutRiskUrl ? (
                        <a
                          href={runoutRiskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">🧯</span>
                          <div>
                            <div className="font-semibold">SKU Runout Risk</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Runout dates, safety stock flags, urgency
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">🧯</span>
                          <div>
                            <div className="font-semibold">SKU Runout Risk</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {countermeasuresUrl ? (
                        <a
                          href={countermeasuresUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">🛠️</span>
                          <div>
                            <div className="font-semibold">Countermeasures</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Suggested actions: alternates, buffers, expedite
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">🛠️</span>
                          <div>
                            <div className="font-semibold">Countermeasures</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}

                      {locationsUrl ? (
                        <a
                          href={locationsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={tileSecondary}
                        >
                          <span className="text-xl">🗺️</span>
                          <div>
                            <div className="font-semibold">Locations</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-600">
                              Facility list used for MapView overlays
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div className={tileMuted}>
                          <span className="text-xl">🗺️</span>
                          <div>
                            <div className="font-semibold">Locations</div>
                            <div className="text-xs">Not available</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtle footer strip inside card */}
                  <div className="pt-4 border-t border-[#E5ECE7] flex items-center justify-between text-xs text-gray-500">
                    <div>Opens in new tab • CSV exports</div>
                    <div className="text-[#1D625B] font-semibold">
                      FOR-C Report Pack
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm p-14 text-center text-gray-600 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F2F6F3] border border-[#D8E5DD] flex items-center justify-center text-3xl mb-5">
            📄
          </div>
          <h2 className="text-2xl font-bold text-[#1D625B]">No reports yet</h2>
          <p className="text-gray-500 max-w-lg mt-2">
            Run a simulation, then come back here. Completed runs will appear as downloadable report packs.
          </p>
          <div className="mt-6 text-xs text-gray-400">
            Tip: Once you have runs, you’ll see “Core Outputs” and “Insights & Risk” download tiles.
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 mt-12 pt-6 border-t border-[#E5ECE7]">
        © {new Date().getFullYear()} FOR-C • Reports
      </footer>
    </div>
  );
}
