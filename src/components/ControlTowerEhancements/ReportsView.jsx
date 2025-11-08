import React from "react";

/**
 * ReportsView – Polished UI/UX
 * Matches BillingView visual style with gradients, cards, and placeholder design.
 */

export default function ReportsView({ simulationHistory }) {
  const hasReports = simulationHistory && simulationHistory.length > 0;

  return (
    <div className="min-h-screen bg-[#F9FAF9] p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white rounded-2xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Simulation Reports</h1>
          <p className="text-sm opacity-90 mt-1">
            View your most recent simulation runs and download reports.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 md:mt-0 bg-[#ABFA7D] hover:bg-[#93EB6C] text-[#1D625B] font-semibold px-5 py-2 rounded-lg shadow-sm transition"
        >
          Refresh
        </button>
      </div>

      {/* Report List */}
      {hasReports ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {simulationHistory.map((sim, idx) => (
            <li
              key={idx}
              className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold text-[#1D625B]">
                  Run {idx + 1}
                </h2>
                <span className="text-xs text-gray-500">
                  {sim.timestamp || "Unknown date"}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-3">
                Status:{" "}
                <span className="font-medium text-[#1D625B]">
                  {sim.status || "done"}
                </span>
              </p>

              {sim.output_urls?.inventory_output_file_url ? (
                <a
                  href={sim.output_urls.inventory_output_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-[#1D625B] hover:bg-[#174F47] text-white text-sm font-semibold rounded-lg px-4 py-2 mt-3 shadow-sm transition-all"
                >
                  View Report
                </a>
              ) : (
                <div className="text-gray-400 text-sm italic">
                  Report not available yet.
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-white border border-[#E5ECE7] rounded-2xl shadow-sm p-12 text-center text-gray-600 flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-[#1D625B] mb-2">
            No reports yet
          </h2>
          <p className="text-gray-500 max-w-md">
            Run a simulation, then check back here to view downloadable reports.
            Your completed runs will appear automatically.
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-gray-500 mt-12 pt-6 border-t border-[#E5ECE7]">
        © {new Date().getFullYear()} FOR-C • Reports
      </footer>
    </div>
  );
}
