import React from "react";

export default function ReportsView({ simulationHistory }) {
  if (!simulationHistory || simulationHistory.length === 0) {
    return (
      <div className="text-gray-600">
        No reports available yet. Run a simulation first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#1D625B] mb-4">📊 Simulation Reports</h2>
      <ul className="space-y-3">
        {simulationHistory.map((sim, idx) => (
          <li
            key={idx}
            className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-[#1D625B]">
                  Run {idx + 1} – {sim.timestamp || "Unknown date"}
                </p>
                <p className="text-sm text-gray-600">
                  Status: {sim.status || "done"}
                </p>
              </div>
              {sim.output_urls?.inventory_output_file_url && (
                <a
                  href={sim.output_urls.inventory_output_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1D625B] underline"
                >
                  View Report
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
