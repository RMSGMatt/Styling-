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

const DISRUPTION_OPTIONS = [
  { value: "natural_disaster", label: "Natural Disaster", icon: "🌪️" },
  { value: "logistics", label: "Logistics / Port", icon: "🚢" },
  { value: "geopolitical", label: "Geopolitical / Trade", icon: "🌍" },
  { value: "factory", label: "Factory / Capacity Loss", icon: "🏭" },
];

function makeDisruption(facility = "") {
  return {
    id: Math.random().toString(36).slice(2),
    types: ["natural_disaster"],
    facility,
    startDate: "2025-08-01",
    duration: 14,
    productionImpact: 100,
    shippingImpact: 0,
  };
}

function makeLaneDelay() {
  return {
    id: Math.random().toString(36).slice(2),
    fromFacility: "",
    toFacility: "",
    delayDays: 5,
  };
}

function makeDemandShock() {
  return {
    id: Math.random().toString(36).slice(2),
    facility: "",
    sku: "",
    changePct: 20,
  };
}

// ── Single disruption row ─────────────────────────────────────────────
function DisruptionRow({ disruption, onChange, onRemove, canRemove, availableFacilities }) {
  const endDate = useMemo(() => {
    if (!disruption.startDate || !disruption.duration) return "";
    const d = new Date(disruption.startDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + Number(disruption.duration));
    return d.toISOString().slice(0, 10);
  }, [disruption.startDate, disruption.duration]);

  function update(key, value) {
    onChange({ ...disruption, [key]: value });
  }

  function toggleType(value) {
    const types = disruption.types.includes(value)
      ? disruption.types.filter(t => t !== value)
      : [...disruption.types, value];
    update("types", types.length ? types : [value]);
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Disruption</p>
        {canRemove && (
          <button onClick={onRemove} className="text-[10px] text-rose-400 hover:text-rose-300 transition">
            ✕ Remove
          </button>
        )}
      </div>

      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5">
        {DISRUPTION_OPTIONS.map(opt => {
          const active = disruption.types.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleType(opt.value)}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold transition border"
              style={{
                background: active ? "rgba(159,214,58,0.12)" : "rgba(15,30,24,0.6)",
                borderColor: active ? "#9FD63A" : "#1f3f33",
                color: active ? "#9FD63A" : "#64748b",
              }}
            >
              {opt.icon} {opt.label}
            </button>
          );
        })}
      </div>

      {/* Facility */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">Affected Facility</label>
        {availableFacilities.length > 0 ? (
          <select
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
            value={disruption.facility}
            onChange={e => update("facility", e.target.value)}
          >
            <option value="">Select facility...</option>
            {availableFacilities.map(f => (
              <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500"
            placeholder="e.g. TSMC_TAIWAN"
            value={disruption.facility}
            onChange={e => update("facility", e.target.value)}
          />
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wide">Start Date</label>
          <input
            type="date"
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
            value={disruption.startDate}
            onChange={e => update("startDate", e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wide">Duration (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
            value={disruption.duration}
            onChange={e => update("duration", Number(e.target.value) || 1)}
          />
        </div>
      </div>
      {endDate && (
        <p className="text-[10px] text-slate-500">End date: <span className="text-slate-300">{endDate}</span></p>
      )}

      {/* Impact sliders */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wide">
            Production Impact: <span className="text-rose-300 font-bold">{disruption.productionImpact}%</span>
          </label>
          <input
            type="range" min="0" max="100"
            value={disruption.productionImpact}
            onChange={e => update("productionImpact", Number(e.target.value))}
            className="w-full mt-1 accent-rose-400"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wide">
            Shipping Impact: <span className="text-blue-300 font-bold">{disruption.shippingImpact}%</span>
          </label>
          <input
            type="range" min="0" max="100"
            value={disruption.shippingImpact}
            onChange={e => update("shippingImpact", Number(e.target.value))}
            className="w-full mt-1 accent-blue-400"
          />
        </div>
      </div>
    </div>
  );
}

// ── Lane delay row ────────────────────────────────────────────────────
function LaneDelayRow({ delay, onChange, onRemove, availableFacilities }) {
  function update(key, value) {
    onChange({ ...delay, [key]: value });
  }

  const facilitySelect = (key, placeholder) => (
    availableFacilities.length > 0 ? (
      <select
        className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
        value={delay[key]}
        onChange={e => update(key, e.target.value)}
      >
        <option value="">{placeholder}</option>
        {availableFacilities.map(f => (
          <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
        ))}
      </select>
    ) : (
      <input
        type="text"
        className="w-full rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500"
        placeholder={placeholder}
        value={delay[key]}
        onChange={e => update(key, e.target.value)}
      />
    )
  );

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">From</label>
        <div className="mt-1">{facilitySelect("fromFacility", "From facility...")}</div>
      </div>
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">To</label>
        <div className="mt-1">{facilitySelect("toFacility", "To facility...")}</div>
      </div>
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">+Days</label>
        <input
          type="number"
          min={1}
          max={60}
          className="w-20 mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
          value={delay.delayDays}
          onChange={e => update("delayDays", Number(e.target.value) || 1)}
        />
      </div>
      <button onClick={onRemove} className="text-rose-400 hover:text-rose-300 text-xs pb-1">✕</button>
    </div>
  );
}

// ── Demand shock row ──────────────────────────────────────────────────
function DemandShockRow({ shock, onChange, onRemove, availableFacilities }) {
  function update(key, value) {
    onChange({ ...shock, [key]: value });
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">Facility (blank = all)</label>
        {availableFacilities.length > 0 ? (
          <select
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
            value={shock.facility}
            onChange={e => update("facility", e.target.value)}
          >
            <option value="">All facilities</option>
            {availableFacilities.map(f => (
              <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500"
            placeholder="All facilities"
            value={shock.facility}
            onChange={e => update("facility", e.target.value)}
          />
        )}
      </div>
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">SKU (blank = all)</label>
        <input
          type="text"
          className="w-full mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500"
          placeholder="All SKUs"
          value={shock.sku}
          onChange={e => update("sku", e.target.value)}
        />
      </div>
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wide">
          Change %
        </label>
        <input
          type="number"
          min={-100}
          max={500}
          className="w-24 mt-1 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
          value={shock.changePct}
          onChange={e => update("changePct", Number(e.target.value) || 0)}
        />
      </div>
      <button onClick={onRemove} className="text-rose-400 hover:text-rose-300 text-xs pb-1">✕</button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export default function ScenarioBuilder({
  locationsFile,
  onRun,
  setScenarioData,
  onClear,
  apiBase = "https://supply-chain-simulator.onrender.com",
  token,
  onSaved,
}) {
  const [open, setOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("disruptions");

  // Multi-disruption list
  const [disruptions, setDisruptions] = useState([]);

  // Lane delays
  const [laneDelays, setLaneDelays] = useState([]);

  // Demand shocks
  const [demandShocks, setDemandShocks] = useState([]);

  // Global options
  const [sourcing, setSourcing] = useState("none");
  const [notes, setNotes] = useState("");

  // NL parse
  const [nlQuery, setNlQuery] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlFeedback, setNlFeedback] = useState("");

  // Available facilities from locations file
  const [availableFacilities, setAvailableFacilities] = useState([]);

  useEffect(() => {
    if (!locationsFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        const rows = parsed.data || [];
        const facCol = Object.keys(rows[0] || {}).find(k =>
          ["facility", "Facility", "site", "node"].includes(k)
        );
        if (!facCol) return;
        const facilities = [...new Set(rows.map(r => String(r[facCol] || "").trim()).filter(Boolean))].sort();
        setAvailableFacilities(facilities);
      } catch (e) {
        console.warn("Could not parse locations file:", e);
      }
    };
    reader.readAsText(locationsFile);
  }, [locationsFile]);

  // ── Build scenario object ─────────────────────────────────────────
  const buildScenarioObject = () => {
    const disruptionScenarios = disruptions
      .filter(d => d.facility)
      .map(d => {
        const endDate = (() => {
          const date = new Date(d.startDate);
          if (isNaN(date.getTime())) return d.startDate;
          date.setDate(date.getDate() + Number(d.duration));
          return date.toISOString().slice(0, 10);
        })();
        return {
          type: d.types[0] || "natural_disaster",
          combined_types: d.types,
          facility: d.facility,
          startDate: d.startDate,
          endDate,
          severity: d.productionImpact / 100,
          production_impact: d.productionImpact / 100,
          shipping_impact: d.shippingImpact / 100,
        };
      });

    const demandAdjustments = demandShocks
      .filter(s => s.changePct !== 0)
      .map(s => ({
        sku: s.sku || "",
        facility: s.facility || "",
        changeType: "percent",
        value: s.changePct,
      }));

    const laneAdjustments = laneDelays
      .filter(l => l.fromFacility && l.toFacility && l.delayDays > 0)
      .map(l => ({
        from_facility: l.fromFacility,
        to_facility: l.toFacility,
        additional_lead_days: l.delayDays,
      }));

    const primaryDisruption = disruptions[0];
    const scenarioName = primaryDisruption?.facility
      ? `${primaryDisruption.types.map(t => DISRUPTION_OPTIONS.find(o => o.value === t)?.label || t).join(" + ")} @ ${primaryDisruption.facility}${disruptions.length > 1 ? ` +${disruptions.length - 1} more` : ""}`
      : "Compound Scenario";

    return {
      name: scenarioName,
      disruptionScenarios,
      demandAdjustments,
      laneAdjustments,
      inventoryPolicies: [],
      meta: { sourcing, notes },
    };
  };

  const persistAndBroadcast = (scenario) => {
    try {
      localStorage.setItem("forc_active_scenario", JSON.stringify(scenario));
      localStorage.setItem("currentScenarioJSON", JSON.stringify(scenario));
      window.dispatchEvent(new CustomEvent("forc:scenario_updated", { detail: scenario }));
    } catch {}
  };

  const applyScenario = () => {
    const scenario = buildScenarioObject();
    setScenarioData?.(scenario);
    persistAndBroadcast(scenario);
  };

  const resetScenario = () => {
    setDisruptions([makeDisruption()]);
    setLaneDelays([]);
    setDemandShocks([]);
    setSourcing("none");
    setNotes("");
    setScenarioData?.(null);
    try {
      localStorage.removeItem("forc_active_scenario");
      localStorage.removeItem("currentScenarioJSON");
    } catch {}
    onClear?.();
  };

  const saveScenarioToBackend = async () => {
    const scenario = buildScenarioObject();
    const authToken = (typeof token === "string" ? token.trim() : "") || getAuthToken();
    const bad = !authToken || authToken === "null" || authToken === "undefined" || authToken.length < 20;
    if (bad) { alert("Session expired. Please log in again."); return; }

    try {
      const res = await fetch(`${apiBase}/api/scenarios`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: scenario.name, data: JSON.stringify(scenario) }),
      });
      if (!res.ok) { alert(`Save failed (${res.status})`); return; }
      const json = await res.json().catch(() => ({}));
      onSaved?.(json?.scenario);
      alert(`✅ Saved: ${scenario.name}`);
    } catch (err) {
      alert("Save failed (network error).");
    }
  };

  const handleNlParse = async () => {
    if (!nlQuery.trim()) return;
    try {
      setNlLoading(true);
      setNlFeedback("");
      const res = await fetch(`${apiBase}/api/narrative/parse-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nlQuery }),
      });
      const data = await res.json();
      if (data.status === "success" && data.scenario) {
        const s = data.scenario;
        setDisruptions([{
          ...makeDisruption(s.facility || ""),
          startDate: s.startDate || "2025-08-01",
          duration: s.endDate ? Math.round((new Date(s.endDate) - new Date(s.startDate)) / 86400000) : 14,
          productionImpact: s.severity !== undefined ? Math.round(s.severity * 100) : 70,
          shippingImpact: 0,
        }]);
        if (s.description) setNotes(s.description);
        setNlFeedback(`✅ Parsed: ${s.title || "Scenario"} — review and adjust before applying.`);
      } else {
        setNlFeedback("⚠️ Could not parse. Try rephrasing.");
      }
    } catch {
      setNlFeedback("⚠️ Parse failed. Check connection.");
    } finally {
      setNlLoading(false);
    }
  };

  // ── Section tabs ──────────────────────────────────────────────────
  const sections = [
    { id: "disruptions", label: "⚡ Disruptions", count: disruptions.length },
    { id: "lanes", label: "🚚 Lane Delays", count: laneDelays.length },
    { id: "demand", label: "📈 Demand Shocks", count: demandShocks.length },
    { id: "options", label: "⚙️ Options" },
  ];

  // ── Summary preview ───────────────────────────────────────────────
  const summaryLines = [
    disruptions.filter(d => d.facility).map(d =>
      `${d.facility.replace(/_/g, " ")} disrupted ${d.productionImpact}% production`
    ),
    laneDelays.filter(l => l.fromFacility && l.toFacility).map(l =>
      `${l.fromFacility.replace(/_/g, " ")} → ${l.toFacility.replace(/_/g, " ")} +${l.delayDays}d`
    ),
    demandShocks.filter(s => s.changePct !== 0).map(s =>
      `${s.facility || "All"} demand ${s.changePct > 0 ? "+" : ""}${s.changePct}%`
    ),
  ].flat();

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 shadow-lg text-slate-200">
      {/* Header */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-t-2xl bg-slate-900/70 hover:bg-slate-800/80 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" style={{ color: "#9FD63A" }}>🧪</span>
          <span className="text-sm font-semibold text-slate-100">Scenario Builder</span>
          {summaryLines.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(159,214,58,0.15)", color: "#9FD63A" }}>
              {summaryLines.length} parameter{summaryLines.length !== 1 ? "s" : ""} set
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">

          {/* NL input */}
          <div className="rounded-xl border border-lime-500/30 bg-lime-950/20 p-3">
            <p className="text-xs font-semibold mb-2" style={{ color: "#9FD63A" }}>✨ Describe in plain English</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md bg-slate-950/80 border border-slate-700 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-lime-500"
                placeholder='e.g. "TSMC goes down for 60 days at 80% severity with Toyota demand up 20%"'
                value={nlQuery}
                onChange={e => setNlQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && nlQuery.trim()) handleNlParse(); }}
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
            {nlFeedback && <p className="text-[10px] mt-2" style={{ color: "#9FD63A" }}>{nlFeedback}</p>}
          </div>

          {/* Section tabs */}
          <div className="flex gap-2 flex-wrap">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
                style={
                  activeSection === s.id
                    ? { background: "#9FD63A", color: "#020617" }
                    : { background: "rgba(15,30,24,0.6)", color: "#64748b", border: "1px solid #1f3f33" }
                }
              >
                {s.label}
                {s.count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]"
                    style={{
                      background: activeSection === s.id ? "rgba(0,0,0,0.2)" : "rgba(159,214,58,0.15)",
                      color: activeSection === s.id ? "#020617" : "#9FD63A",
                    }}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── DISRUPTIONS ── */}
          {activeSection === "disruptions" && (
            <div className="space-y-3">
              {disruptions.map((d, i) => (
                <DisruptionRow
                  key={d.id}
                  disruption={d}
                  onChange={updated => setDisruptions(prev => prev.map(x => x.id === d.id ? updated : x))}
                  onRemove={() => setDisruptions(prev => prev.filter(x => x.id !== d.id))}
                  canRemove={disruptions.length > 1}
                  availableFacilities={availableFacilities}
                />
              ))}
              <button
                onClick={() => setDisruptions(prev => [...prev, makeDisruption()])}
                className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-[11px] text-slate-400 hover:border-lime-500 hover:text-lime-400 transition"
              >
                ＋ Add Disruption
              </button>
            </div>
          )}

          {/* ── LANE DELAYS ── */}
          {activeSection === "lanes" && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">
                Add lead time delays to specific lanes — e.g. NEXTY → DENSO delayed by 5 days due to port congestion.
              </p>
              {laneDelays.length === 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4 text-center">
                  <p className="text-slate-500 text-xs">No lane delays configured.</p>
                </div>
              )}
              {laneDelays.map(l => (
                <LaneDelayRow
                  key={l.id}
                  delay={l}
                  onChange={updated => setLaneDelays(prev => prev.map(x => x.id === l.id ? updated : x))}
                  onRemove={() => setLaneDelays(prev => prev.filter(x => x.id !== l.id))}
                  availableFacilities={availableFacilities}
                />
              ))}
              <button
                onClick={() => setLaneDelays(prev => [...prev, makeLaneDelay()])}
                className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-[11px] text-slate-400 hover:border-lime-500 hover:text-lime-400 transition"
              >
                ＋ Add Lane Delay
              </button>
            </div>
          )}

          {/* ── DEMAND SHOCKS ── */}
          {activeSection === "demand" && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">
                Adjust demand by facility and/or SKU — positive % = spike, negative % = drop.
              </p>
              {demandShocks.length === 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4 text-center">
                  <p className="text-slate-500 text-xs">No demand shocks configured.</p>
                </div>
              )}
              {demandShocks.map(s => (
                <DemandShockRow
                  key={s.id}
                  shock={s}
                  onChange={updated => setDemandShocks(prev => prev.map(x => x.id === s.id ? updated : x))}
                  onRemove={() => setDemandShocks(prev => prev.filter(x => x.id !== s.id))}
                  availableFacilities={availableFacilities}
                />
              ))}
              <button
                onClick={() => setDemandShocks(prev => [...prev, makeDemandShock()])}
                className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-[11px] text-slate-400 hover:border-lime-500 hover:text-lime-400 transition"
              >
                ＋ Add Demand Shock
              </button>
            </div>
          )}

          {/* ── OPTIONS ── */}
          {activeSection === "options" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Sourcing Strategy</label>
                <select
                  className="w-full mt-2 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100"
                  value={sourcing}
                  onChange={e => setSourcing(e.target.value)}
                >
                  <option value="none">No change (baseline sourcing)</option>
                  <option value="alternate">Shift to alternate sources</option>
                  <option value="localize">Localize to NA / regional plants</option>
                  <option value="dual_source">Dual-source key SKUs</option>
                </select>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Scenario Notes</label>
                <textarea
                  rows={3}
                  className="w-full mt-2 rounded-md bg-slate-950/80 border border-slate-700 px-2 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500"
                  placeholder="Optional description or storyline..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Summary */}
          {summaryLines.length > 0 && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Scenario Summary</p>
              <ul className="space-y-1">
                {summaryLines.map((line, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span style={{ color: "#9FD63A" }}>·</span> {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={resetScenario}
              className="py-2 rounded-lg text-[11px] border border-slate-600 text-slate-300 hover:bg-slate-800/80 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveScenarioToBackend}
              className="py-2 rounded-lg text-[11px] font-semibold border border-slate-500 text-slate-100 hover:bg-slate-800/70 transition"
            >
              💾 Save
            </button>
            <button
              type="button"
              onClick={applyScenario}
              className="py-2 rounded-lg text-[11px] font-semibold"
              style={{ background: "linear-gradient(90deg,#9CF700,#22c55e)", color: "#020617" }}
            >
              ✅ Apply
            </button>
          </div>

          {onRun && (
            <button
              type="button"
              onClick={() => { applyScenario(); onRun(); }}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition"
              style={{ background: "linear-gradient(90deg,#9CF700,#22c55e)", color: "#020617" }}
            >
              ▶ Apply & Run Simulation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
