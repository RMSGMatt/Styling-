import React, { useMemo, useState } from "react";

export default function ScenarioBuilder({ setScenarioData, onClear }) {
  // UI state
  const [open, setOpen] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(["natural_disaster"]);
  const [facility, setFacility] = useState("VN-Facility-1");
  const [startDate, setStartDate] = useState("2025-08-01");
  const [duration, setDuration] = useState(14); // days
  const [severity, setSeverity] = useState(70); // 0-100, applies to disruptions
  const [demandSpikePct, setDemandSpikePct] = useState(25); // % increase in demand
  const [supplyCapPct, setSupplyCapPct] = useState(80); // resulting capacity (e.g., 80% of normal)
  const [sourcing, setSourcing] = useState("none"); // sourcing strategy
  const [notes, setNotes] = useState("");

  const disruptionOptions = [
    {
      value: "natural_disaster",
      label: "Natural Disaster",
      description: "Earthquake, flood, typhoon, etc.",
      icon: "🌪️",
    },
    {
      value: "logistics",
      label: "Logistics / Port",
      description: "Port congestion, carrier failures, customs delays.",
      icon: "🚢",
    },
    {
      value: "geopolitical",
      label: "Geopolitical / Trade",
      description: "Export controls, tariffs, sanctions, or conflict.",
      icon: "🌍",
    },
    {
      value: "factory",
      label: "Factory / Capacity Loss",
      description: "Fire, tool failure, or extended maintenance.",
      icon: "🏭",
    },
  ];

  // Derived end date
  const endDate = useMemo(() => {
    if (!startDate || !duration) return "";
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return "";
    const copy = new Date(d);
    copy.setDate(copy.getDate() + Number(duration));
    return copy.toISOString().slice(0, 10);
  }, [startDate, duration]);

  const handleToggleType = (value) => {
    setSelectedTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const resetScenario = () => {
    setSelectedTypes(["natural_disaster"]);
    setFacility("VN-Facility-1");
    setStartDate("2025-08-01");
    setDuration(14);
    setSeverity(70);
    setDemandSpikePct(0);
    setSupplyCapPct(100);
    setSourcing("none");
    setNotes("");
    setScenarioData?.(null);
    onClear?.();
  };

  const applyScenario = () => {
    // Build a scenario payload that your SimulationDashboard can consume
    const scenarioName = `Scenario: ${selectedTypes
      .map((t) => disruptionOptions.find((o) => o.value === t)?.label || t)
      .join(", ")} @ ${facility}`;

    // One disruptionScenario per selected type
    const disruptionScenarios = selectedTypes.map((type) => ({
      type,
      facility,
      startDate,
      endDate,
      severity,
    }));

    // Demand adjustments: global spike if non-zero
    const demandAdjustments =
      Number(demandSpikePct) !== 0
        ? [
            {
              sku: "", // empty = apply broadly; SimulationDashboard can match as needed
              facility: "",
              changeType: "percent",
              value: Number(demandSpikePct),
            },
          ]
        : [];

    // Inventory policies: future hook (kept for compatibility)
    const inventoryPolicies = [];

    setScenarioData?.({
      name: scenarioName,
      disruptionScenarios,
      demandAdjustments,
      inventoryPolicies,
      meta: {
        supplyCapPct: Number(supplyCapPct),
        sourcing,
        notes,
      },
    });
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 shadow-lg text-slate-200">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-2xl bg-slate-900/70 hover:bg-slate-800/80 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" style={{ color: "#9CF700" }}>
            🧪
          </span>
          <span className="text-sm font-semibold" style={{ color: "#E8FFE8" }}>
            Scenario Builder (Phase 1A)
          </span>
        </div>
        <span className="text-xs text-slate-300">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Intro */}
          <p className="text-xs text-slate-300">
            Configure demand shocks, disruption injections, and high-level
            policies, then apply this configuration to the next simulation run.
          </p>

          {/* Disruption types */}
          <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "#E8FFE8" }}
            >
              Disruption Types
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {disruptionOptions.map((opt) => {
                const active = selectedTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleType(opt.value)}
                    className={`flex items-start gap-2 rounded-lg border px-2 py-2 text-left transition ${
                      active
                        ? "border-emerald-400/80 bg-emerald-500/10"
                        : "border-slate-700/80 bg-slate-900/50 hover:border-slate-500"
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "#E8FFE8" }}
                      >
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Facility + dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Affected Facility
              </p>
              <input
                type="text"
                className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Use any label that matches your locations file (e.g.{" "}
                <span className="text-slate-100">VN-Facility-1</span>).
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Disruption Window
              </p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-300">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value || 0)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-300">
                End Date:{" "}
                <span className="text-slate-100">
                  {endDate || "—"}
                </span>
              </p>
            </div>
          </div>

          {/* Sliders row: Severity, Demand spike, Capacity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Severity */}
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Disruption Severity
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value) || 0)}
                className="w-full accent-rose-400"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Severity:{" "}
                <span className="text-rose-300 font-semibold">
                  {severity}%
                </span>
              </p>
            </div>

            {/* Demand spike */}
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Demand Spike
              </p>
              <input
                type="range"
                min="-50"
                max="200"
                value={demandSpikePct}
                onChange={(e) =>
                  setDemandSpikePct(Number(e.target.value) || 0)
                }
                className="w-full accent-amber-300"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Demand change:{" "}
                <span className="text-amber-300 font-semibold">
                  {demandSpikePct}%
                </span>
              </p>
            </div>

            {/* Supply capacity */}
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Available Capacity
              </p>
              <input
                type="range"
                min="0"
                max="120"
                value={supplyCapPct}
                onChange={(e) =>
                  setSupplyCapPct(Number(e.target.value) || 0)
                }
                className="w-full accent-emerald-400"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Capacity set to{" "}
                <span className="text-emerald-300 font-semibold">
                  {supplyCapPct}%
                </span>{" "}
                of normal.
              </p>
            </div>
          </div>

          {/* Sourcing + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Sourcing Strategy
              </p>
              <select
                className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                value={sourcing}
                onChange={(e) => setSourcing(e.target.value)}
              >
                <option value="none">No change (baseline sourcing)</option>
                <option value="alternate">
                  Shift volume to alternate sources
                </option>
                <option value="localize">
                  Localize to NA / regional plants
                </option>
                <option value="dual_source">Dual-source key SKUs</option>
              </select>
              <p className="text-[11px] text-slate-300 mt-1">
                Sourcing is passed as metadata for downstream analysis.
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Scenario Notes
              </p>
              <textarea
                rows={3}
                className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500"
                placeholder="Optional description or storyline for this scenario..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Preview + actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="md:col-span-2 border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p
                className="text-[11px] font-semibold mb-1"
                style={{ color: "#E8FFE8" }}
              >
                Preview
              </p>
              <p className="text-[11px] text-slate-300">
                <span className="text-slate-100 font-semibold">
                  {selectedTypes
                    .map(
                      (t) =>
                        disruptionOptions.find((o) => o.value === t)
                          ?.label || t
                    )
                    .join(", ") || "No type selected"}
                </span>{" "}
                impacting{" "}
                <span className="text-slate-100 font-semibold">
                  {facility}
                </span>{" "}
                from{" "}
                <span className="text-slate-100 font-semibold">
                  {startDate || "—"}
                </span>{" "}
                to{" "}
                <span className="text-slate-100 font-semibold">
                  {endDate || "—"}
                </span>
                , with{" "}
                <span className="text-rose-300 font-semibold">
                  {severity}% severity
                </span>
                ,{" "}
                <span className="text-amber-300 font-semibold">
                  {demandSpikePct}% demand change
                </span>
                , and{" "}
                <span className="text-emerald-300 font-semibold">
                  capacity at {supplyCapPct}%.
                </span>
              </p>
              {notes && (
                <p className="text-[11px] text-slate-300 mt-1">
                  Note: <span className="text-slate-100">{notes}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col justify-between gap-2">
              <button
                type="button"
                onClick={resetScenario}
                className="w-full border border-slate-600 rounded-lg py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyScenario}
                className="w-full rounded-lg py-1.5 text-[11px] font-semibold shadow-md"
                style={{
                  background: "linear-gradient(90deg, #9CF700, #22c55e)",
                  color: "#020617",
                }}
              >
                ✅ Apply Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
