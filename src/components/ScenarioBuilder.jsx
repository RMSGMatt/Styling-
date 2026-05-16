import React, { useMemo, useState, useEffect } from "react";
import Papa from "papaparse";

function getAuthToken() {
  const t =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    sessionStorage.getItem("token") ||
    "";

  return typeof t === "string" ? t.trim() : "";
}

export default function ScenarioBuilder({
  locationsFile,
  onRun,
  setScenarioData,
  onClear,
  apiBase = "https://supply-chain-simulator.onrender.com",
  token, // optional prop from parent
  onSaved, // optional callback({id,name,created_at})
}) {
  // UI state
  const [open, setOpen] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(["natural_disaster"]);
  const [facility, setFacility] = useState("VN-Facility-1");
  const [startDate, setStartDate] = useState("2025-08-01");
  const [duration, setDuration] = useState(14); // days
  const [severity, setSeverity] = useState(70); // 0-100
  const [productionImpact, setProductionImpact] = useState(100);
  const [shippingImpact, setShippingImpact] = useState(0);
  const [regionMode, setRegionMode] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regionFacilities, setRegionFacilities] = useState([]);
  const [availableRegions, setAvailableRegions] = useState([]);
  // Parse locations file to extract countries/regions
  useEffect(() => {
    if (!locationsFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const rows = parsed.data || [];
        const countryCol = Object.keys(rows[0] || {}).find(k =>
          ["country", "Country", "region", "Region", "nation"].includes(k)
        );
        const facCol = Object.keys(rows[0] || {}).find(k =>
          ["facility", "Facility", "site", "node"].includes(k)
        );
        if (!countryCol || !facCol) return;
        const countriesMap = {};
        rows.forEach(row => {
          const country = String(row[countryCol] || "").trim();
          const fac = String(row[facCol] || "").trim();
          if (country && fac) {
            if (!countriesMap[country]) countriesMap[country] = [];
            countriesMap[country].push(fac);
          }
        });
        setAvailableRegions(Object.keys(countriesMap).sort());
        setRegionFacilities(countriesMap);
      } catch (e) {
        console.warn("Could not parse locations file for regions:", e);
      }
    };
    reader.readAsText(locationsFile);
  }, [locationsFile]);

  const [demandSpikePct, setDemandSpikePct] = useState(25); // % demand change
  const [supplyCapPct, setSupplyCapPct] = useState(80); // capacity % of normal
  const [sourcing, setSourcing] = useState("none");
  const [notes, setNotes] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlFeedback, setNlFeedback] = useState("");

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
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const resetScenario = () => {
    setSelectedTypes(["natural_disaster"]);
    setFacility("VN-Facility-1");
    setStartDate("2025-08-01");
    setDuration(14);
    setSeverity(70);
    setProductionImpact(100);
    setShippingImpact(0);
    setDemandSpikePct(0);
    setSupplyCapPct(100);
    setSourcing("none");
    setNotes("");
    setScenarioData?.(null);
    try {
      localStorage.removeItem("forc_active_scenario");
    } catch {}
    onClear?.();
    console.log("🧼 [ScenarioBuilder] Scenario reset + cleared.");
  };

  // ✅ Canonical scenario object (used by Apply AND Save)
  const buildScenarioObject = () => {
    const scenarioName = `Scenario: ${selectedTypes
      .map((t) => disruptionOptions.find((o) => o.value === t)?.label || t)
      .join(", ")} @ ${facility}`;

    const facilitiesToDisrupt = regionMode && selectedRegion && regionFacilities[selectedRegion]
      ? regionFacilities[selectedRegion]
      : [facility];
    // One row per facility regardless of how many types are selected.
    // Multiple types share the same impact sliders — writing one row per type
    // would double-count the disruption signal in the simulator.
    const primaryType = selectedTypes[0] || "natural_disaster";
    const disruptionScenarios = facilitiesToDisrupt.map((fac) => ({
      type: primaryType,
      combined_types: selectedTypes,
      facility: fac,
      startDate,
      endDate,
      severity: productionImpact / 100,
      production_impact: productionImpact / 100,
      shipping_impact: shippingImpact / 100,
    }));

    const demandAdjustments =
      Number(demandSpikePct) !== 0
        ? [
            {
              sku: "",
              facility: "",
              changeType: "percent",
              value: Number(demandSpikePct),
            },
          ]
        : [];

    const inventoryPolicies = [];

    return {
      name: scenarioName,
      disruptionScenarios,
      demandAdjustments,
      inventoryPolicies,
      meta: {
        supplyCapPct: Number(supplyCapPct),
        sourcing,
        notes,
      },
    };
  };

  // ✅ Shared helper: persist + broadcast so Reports/other views can see it too
  const persistAndBroadcastScenario = (scenario) => {
    try {
      localStorage.setItem("forc_active_scenario", JSON.stringify(scenario));
      localStorage.setItem("currentScenarioJSON", JSON.stringify(scenario));
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent("forc:scenario_updated", { detail: scenario })
      );
    } catch {}

    console.log("📦 [ScenarioBuilder] Scenario applied:", scenario);
  };

  const applyScenario = () => {
    const scenario = buildScenarioObject();

    console.log("🧪 [ScenarioBuilder] buildScenarioObject output:", JSON.stringify(scenario, null, 2));
    console.log("🧪 [ScenarioBuilder] current raw state:", {
      selectedTypes,
      facility,
      startDate,
      endDate,
      duration,
      severity: productionImpact / 100,
      production_impact: productionImpact / 100,
      shipping_impact: shippingImpact / 100,
      demandSpikePct,
      supplyCapPct,
      sourcing,
      notes,
    });

    // 1) update parent state (SimulationDashboard path)
    setScenarioData?.(scenario);

    // 2) persist + broadcast (Reports / other views path)
    persistAndBroadcastScenario(scenario);
    // Auto-run disabled - user clicks Run Simulation after applying
  };

  const saveScenarioToBackend = async () => {
    const scenario = buildScenarioObject();

    // ✅ Use token prop first (if provided), fallback to storage
    const authToken =
      (typeof token === "string" ? token.trim() : "") || getAuthToken();

    // Block only if truly invalid (prevents false negatives)
    const bad =
      !authToken ||
      authToken === "null" ||
      authToken === "undefined" ||
      authToken.length < 20;

    if (bad) {
      console.warn("⚠️ ScenarioBuilder: token missing or invalid at click time", {
        authToken,
        keys: Object.keys(localStorage),
        origin: window.location.origin,
      });
      alert("Session expired. Please log in again.");
      return;
    }

    let res;
    try {
      res = await fetch(`${apiBase}/api/scenarios`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: scenario.name,
          // ✅ stringify to avoid backend 'dict'.strip crash
          data: JSON.stringify(scenario),
        }),
      });
    } catch (err) {
      console.error("❌ [ScenarioBuilder] Save scenario network error:", err);
      alert("Save scenario failed (network error). Check console.");
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("❌ [ScenarioBuilder] Save scenario failed:", res.status, text);
      alert(`Save scenario failed (${res.status}). Check console.`);
      return;
    }

    const json = await res.json().catch(() => ({}));
    onSaved?.(json?.scenario);
    console.log("✅ [ScenarioBuilder] Saved scenario:", json?.scenario);
    alert(`✅ Scenario saved: ${json?.scenario?.name || scenario.name}`);
  };

  // ✅ Convenience: Apply first, then Save (most common workflow)
  const handleNlParse = async () => {
    if (!nlQuery.trim()) return;
    try {
      setNlLoading(true);
      setNlFeedback("");
      const res = await fetch(`${apiBase}/api/narrative/parse-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nlQuery })
      });
      const data = await res.json();
      if (data.status === "success" && data.scenario) {
        const s = data.scenario;
        // Pre-fill form fields
        if (s.facility) setFacility(s.facility);
        if (s.startDate) setStartDate(s.startDate);
        if (s.endDate) {
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
          setDuration(days);
        }
        if (s.severity !== undefined) {
          setProductionImpact(Math.round(s.severity * 100));
        }
        if (s.description) setNotes(s.description);
        setNlFeedback(`✅ Parsed: ${s.title} — ${s.assumptions || "Review and adjust before applying."}`);
      } else {
        setNlFeedback("⚠️ Could not parse scenario. Try rephrasing.");
      }
    } catch (e) {
      console.error("❌ NL parse failed:", e);
      setNlFeedback("⚠️ Parse failed. Check connection.");
    } finally {
      setNlLoading(false);
    }
  };
  
  const applyAndSave = async () => {
    applyScenario();
    await saveScenarioToBackend();
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
        <span className="text-xs text-slate-300">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-300">
            Configure demand shocks, disruption injections, and high-level policies,
            then apply this configuration to the next simulation run.
          </p>

          {/* Natural Language Input */}
          <div className="border border-lime-500/30 rounded-xl p-3 bg-lime-950/20">
            <p className="text-xs font-semibold mb-2" style={{ color: "#9CF700" }}>
              ✨ Describe a scenario in plain English
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md bg-slate-950/80 border border-slate-700 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-lime-500"
                placeholder='e.g. "What happens if TSMC goes down for 60 days at 80% severity?"'
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nlQuery.trim()) handleNlParse();
                }}
              />
              <button
                type="button"
                onClick={handleNlParse}
                disabled={nlLoading || !nlQuery.trim()}
                className="px-3 py-2 rounded-md text-[11px] font-semibold transition"
                style={{
                  background: nlLoading ? "rgba(156,247,0,0.2)" : "linear-gradient(90deg,#9CF700,#22c55e)",
                  color: "#020617",
                  opacity: nlLoading || !nlQuery.trim() ? 0.6 : 1,
                }}
              >
                {nlLoading ? "Parsing..." : "→ Parse"}
              </button>
            </div>
            {nlFeedback && (
              <p className="text-[10px] mt-2" style={{ color: "#9CF700" }}>
                {nlFeedback}
              </p>
            )}
          </div>

          {/* Disruption types */}
          <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
            <p className="text-xs font-semibold mb-2" style={{ color: "#E8FFE8" }}>
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
                      <p className="text-[11px] text-slate-300">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Facility + dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold" style={{ color: "#E8FFE8" }}>
                  {regionMode ? "Affected Region" : "Affected Facility"}
                </p>
                <button
                  type="button"
                  onClick={() => { setRegionMode(r => !r); setSelectedRegion(""); }}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
                >
                  {regionMode ? "Single Facility" : "By Region"}
                </button>
              </div>
              {regionMode ? (
                <select
                  className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                >
                  <option value="">Select a country/region...</option>
                  {availableRegions.map(r => (
                    <option key={r} value={r}>{r} ({(regionFacilities[r] || []).length} facilities)</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                />
              )}
              <p className="text-[11px] text-slate-300 mt-1">
                {regionMode
                  ? selectedRegion
                    ? `Will disrupt all ${(regionFacilities[selectedRegion] || []).length} facilities in ${selectedRegion}`
                    : "Upload locations.csv to see available regions"
                  : "Use any label that matches your locations file"}
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Disruption Window
              </p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-300">Start Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-300">Duration (days)</label>
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
                End Date: <span className="text-slate-100">{endDate || "—"}</span>
              </p>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Production Impact
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={productionImpact}
                onChange={(e) => setProductionImpact(Number(e.target.value) || 0)}
                className="w-full accent-rose-400"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Production stopped: <span className="text-rose-300 font-semibold">{productionImpact}%</span>
              </p>
            </div>
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Shipping Impact
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={shippingImpact}
                onChange={(e) => setShippingImpact(Number(e.target.value) || 0)}
                className="w-full accent-blue-400"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Outbound blocked: <span className="text-blue-300 font-semibold">{shippingImpact}%</span>
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Demand Spike
              </p>
              <input
                type="range"
                min="-50"
                max="200"
                value={demandSpikePct}
                onChange={(e) => setDemandSpikePct(Number(e.target.value) || 0)}
                className="w-full accent-amber-300"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Demand change:{" "}
                <span className="text-amber-300 font-semibold">{demandSpikePct}%</span>
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Available Capacity
              </p>
              <input
                type="range"
                min="0"
                max="120"
                value={supplyCapPct}
                onChange={(e) => setSupplyCapPct(Number(e.target.value) || 0)}
                className="w-full accent-emerald-400"
              />
              <p className="text-[11px] text-slate-300 mt-1">
                Capacity set to{" "}
                <span className="text-emerald-300 font-semibold">{supplyCapPct}%</span>{" "}
                of normal.
              </p>
            </div>
          </div>

          {/* Sourcing + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Sourcing Strategy
              </p>
              <select
                className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                value={sourcing}
                onChange={(e) => setSourcing(e.target.value)}
              >
                <option value="none">No change (baseline sourcing)</option>
                <option value="alternate">Shift volume to alternate sources</option>
                <option value="localize">Localize to NA / regional plants</option>
                <option value="dual_source">Dual-source key SKUs</option>
              </select>
              <p className="text-[11px] text-slate-300 mt-1">
                Sourcing is passed as metadata for downstream analysis.
              </p>
            </div>

            <div className="border border-slate-700/80 rounded-xl p-3 bg-slate-900/60">
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
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
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#E8FFE8" }}>
                Preview
              </p>
              <p className="text-[11px] text-slate-300">
                <span className="text-slate-100 font-semibold">
                  {selectedTypes
                    .map((t) => disruptionOptions.find((o) => o.value === t)?.label || t)
                    .join(", ") || "No type selected"}
                </span>{" "}
                impacting{" "}
                <span className="text-slate-100 font-semibold">{facility}</span> from{" "}
                <span className="text-slate-100 font-semibold">{startDate || "—"}</span>{" "}
                to <span className="text-slate-100 font-semibold">{endDate || "—"}</span>, with{" "}
                <span className="text-rose-300 font-semibold">{severity}% severity</span>,{" "}
                <span className="text-amber-300 font-semibold">{demandSpikePct}% demand change</span>,{" "}
                and <span className="text-emerald-300 font-semibold">capacity at {supplyCapPct}%</span>.
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

              {/* ✅ Save */}
              <button
                type="button"
                onClick={saveScenarioToBackend}
                className="w-full border border-slate-500 rounded-lg py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/70 transition"
              >
                💾 Save Scenario
              </button>

              {/* ✅ Apply */}
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

              {/* ✅ Apply + Save */}
              <button
                type="button"
                onClick={applyAndSave}
                className="w-full rounded-lg py-1.5 text-[11px] font-semibold shadow-md"
                style={{
                  background: "linear-gradient(90deg, #22c55e, #0ea5e9)",
                  color: "#020617",
                }}
              >
                ✅💾 Apply + Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
