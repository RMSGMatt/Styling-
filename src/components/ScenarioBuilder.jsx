import React, { useMemo, useState } from 'react';

export default function ScenarioBuilder({ setScenarioData, onClear }) {
  // UI state
  const [open, setOpen] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(['natural_disaster']);
  const [facility, setFacility] = useState('VN-Facility-1');
  const [startDate, setStartDate] = useState('2025-08-01');
  const [duration, setDuration] = useState(14);            // days
  const [severity, setSeverity] = useState(70);            // 0-100, applies to disruptions
  const [demandSpikePct, setDemandSpikePct] = useState(25); // % increase in demand
  const [supplyCapPct, setSupplyCapPct] = useState(80);     // resulting capacity (e.g., 80% of normal)
  const [sourcing, setSourcing] = useState('none');        // sourcing strategy
  const [notes, setNotes] = useState('');

  const disruptionOptions = [
    { id: 'natural_disaster', label: '🌪️ Natural Disaster' },
    { id: 'supplier_delay', label: '🚚 Supplier Delay' },
    { id: 'port_congestion', label: '⚓ Port Congestion' },
    { id: 'labor_strike', label: '✊ Labor Strike' },
    { id: 'cyber_attack', label: '💻 Cyber Attack' }
  ];

  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const endDate = useMemo(() => {
    if (!startDate || Number.isNaN(duration)) return '';
    const d = new Date(startDate);
    d.setDate(d.getDate() + Number(duration));
    return d.toISOString().slice(0, 10);
  }, [startDate, duration]);

  const applyScenario = () => {
    const demandMultiplier = 1 + (Number(demandSpikePct || 0) / 100);
    const capacityMultiplier = Math.max(0, Math.min(1, Number(supplyCapPct || 0) / 100));
    const sev = Math.max(0, Math.min(100, Number(severity || 0)));

    // Normalized object your upload step can consume to modify CSVs
    const payload = {
      meta: {
        createdAt: new Date().toISOString(),
        notes: notes || '',
      },
      scope: {
        facility,
        startDate,
        endDate,
        durationDays: Number(duration),
        types: selectedTypes, // array of strings
        sourcing,             // 'none' | 'enable_backup' | 'regional_only'
        severity: sev,        // 0-100
      },
      transforms: {
        // Apply to demand.csv rows within [startDate, endDate]
        demand: {
          multiplier: demandMultiplier, // e.g., 1.25 for +25%
          // Optional filters you can wire up later:
          // skuList: [], channel: null, region: null
        },

        // Apply logical disruptions (you’ll translate this into disruptions.csv rows)
        disruptions: selectedTypes.map((type) => ({
          type,                // matches your disruptions taxonomy
          facility,
          startDate,
          endDate,
          severity: sev,       // can inform recovery/throughput loss
          // You can map this to columns like: type, start_date, end_date, facility_id, severity
        })),

        // Apply to location_materials.csv (capacity/lead-time style effects)
        supply: {
          facility,
          capacityMultiplier,  // e.g., 0.8 for 80% capacity
          // Later you could add: leadTimeDaysDelta: +5
        },

        // Sourcing policy (the dashboard can interpret this to tweak routing/filters)
        sourcing: {
          mode: sourcing, // 'none' | 'enable_backup' | 'regional_only'
        }
      }
    };

    setScenarioData(payload);
  };

  const clearScenario = () => {
    setSelectedTypes([]);
    setFacility('VN-Facility-1');
    setStartDate('2025-08-01');
    setDuration(14);
    setSeverity(70);
    setDemandSpikePct(0);
    setSupplyCapPct(100);
    setSourcing('none');
    setNotes('');
    setScenarioData(null);
    onClear?.();
  };

  return (
    <div className="bg-white border border-gray-300 rounded-xl p-4 shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="text-[#1D625B] font-semibold mb-2 flex justify-between items-center w-full"
      >
        🛠️ Scenario Builder
        <span className="text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-4 text-sm">
          {/* Disruption Types */}
          <div>
            <label className="font-medium block mb-1">Disruption Types</label>
            <div className="flex flex-wrap gap-3">
              {disruptionOptions.map(({ id, label }) => (
                <label key={id} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(id)}
                    onChange={() => toggleType(id)}
                    className="form-checkbox h-4 w-4 text-green-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Facility */}
          <div>
            <label className="font-medium block mb-1">Affected Facility</label>
            <select
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            >
              <option>VN-Facility-1</option>
              <option>MY-Facility-1</option>
              <option>CN-Facility-2</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-medium block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="font-medium block mb-1">Duration: {duration} days</label>
              <input
                type="range"
                min="1"
                max="90"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="font-medium block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                readOnly
                className="w-full border px-2 py-1 rounded bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="font-medium block mb-1">Disruption Severity: {severity}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Demand spike */}
          <div>
            <label className="font-medium block mb-1">Demand Spike</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="500"
                value={demandSpikePct}
                onChange={(e) => setDemandSpikePct(e.target.value)}
                className="border w-24 px-2 py-1 rounded"
              />
              <span>% increase over baseline</span>
            </div>
          </div>

          {/* Supply capacity */}
          <div>
            <label className="font-medium block mb-1">Supply Capacity During Disruption</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                value={supplyCapPct}
                onChange={(e) => setSupplyCapPct(e.target.value)}
                className="border w-24 px-2 py-1 rounded"
              />
              <span>% of normal (e.g., 80 = operate at 80%)</span>
            </div>
          </div>

          {/* Sourcing strategy */}
          <div>
            <label className="font-medium block mb-1">Alternate Sourcing Strategy</label>
            <select
              value={sourcing}
              onChange={(e) => setSourcing(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            >
              <option value="none">None</option>
              <option value="enable_backup">Enable Backup Supplier</option>
              <option value="regional_only">Force Regional Supply</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium mb-1">Scenario Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="2"
              placeholder="Optional notes about this scenario"
              className="w-full border px-2 py-1 rounded"
            />
          </div>

          {/* Preview */}
          <div className="bg-[#F0FDF4] p-3 rounded border border-[#C6F6D5] text-sm text-[#1D625B]">
            <p><strong>Preview:</strong></p>
            <p>📍 Facility: {facility}</p>
            <p>🗓️ {startDate} → {endDate} ({duration} days)</p>
            <p>🚨 Types: {selectedTypes.length ? selectedTypes.map(id => disruptionOptions.find(o => o.id === id)?.label).join(', ') : 'None'}</p>
            <p>📉 Severity: {severity}%</p>
            <p>📈 Demand Spike: +{demandSpikePct}%</p>
            <p>🏭 Capacity During Disruption: {supplyCapPct}%</p>
            <p>📦 Sourcing: {sourcing}</p>
            {notes && <p>📝 Notes: {notes}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={clearScenario}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-1 px-3 rounded"
            >
              Reset
            </button>
            <button
              onClick={applyScenario}
              className="bg-[#1D625B] hover:bg-[#144a44] text-white font-semibold py-1 px-4 rounded"
            >
              ✅ Apply Scenario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
