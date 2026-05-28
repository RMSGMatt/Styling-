import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    icon: '🔄',
    title: 'Supply Chain War Gaming',
    desc: 'Simulate any disruption across your network and see exactly what breaks, when, and how far the damage spreads.',
    details: 'Run proactive scenarios — supplier shutdowns, port congestion, demand spikes, lane delays — and watch the cascade propagate hop by hop through your network. FOR-C shows you the downstream impact before it hits the line.'
  },
  {
    icon: '⚡',
    title: 'Cascade Impact Visualization',
    desc: 'See disruptions propagate through your supply network in real time — facility by facility, hop by hop.',
    details: "FOR-C's cascade view animates how a disruption at a Tier 3 supplier travels through distributors, Tier 1 assemblers, and OEM plants. Identify which facilities are hit, in what order, and which SKUs are most exposed."
  },
  {
    icon: '🌐',
    title: 'Live Global Risk Map',
    desc: 'Monitor earthquakes, port disruptions, geopolitical events, and supply chain chokepoints in real time.',
    details: 'FOR-C overlays USGS seismic data, GDACS disaster alerts, and live news intelligence on a global map of your supply network. See which real-world events are near your facilities before they become disruptions.'
  },
  {
    icon: '🛡️',
    title: 'Network Resilience Score',
    desc: 'A single 0-100 score that tells you how resilient your network is right now — and what\'s dragging it down.',
    details: 'Derived from service level, backlog severity, missed service days, and time to recover. The Network Resilience Score gives executives a single number to track over time and a clear signal for when to act.'
  },
  {
    icon: '📂',
    title: 'Zero-Integration Setup',
    desc: 'Upload your BOM, demand, locations, and lanes files. FOR-C builds your digital twin instantly — no IT project required.',
    details: 'No ERP integration. No consultants. No 6-month implementation. Upload your CSV files and FOR-C builds a live digital twin of your supply network in minutes. Start simulating the same day.'
  },
  {
    icon: '📄',
    title: 'Executive PDF Reports',
    desc: 'Generate board-ready simulation reports with one click — KPI scorecard, countermeasures, and AI narrative included.',
    details: 'Every simulation run produces a branded PDF report with cover page, KPI scorecard, disruption signals, countermeasures, and an AI-generated executive narrative. Share with leadership without building a deck.'
  }
];

const stats = [
  { value: 'Hours', label: 'Time to first simulation' },
  { value: '34-day', label: 'Average recovery window identified' },
  { value: '<15%', label: 'Of finished goods cost via strategic buffering' },
  { value: '$847K', label: 'Revenue exposure identified per network' },
];

export default function AboutUs() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">

      {/* ── NAV ── */}
      <nav style={{ background: '#111B21' }} className="px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl px-3 py-1.5 flex items-center gap-2">
            <img src="/eye-logo.png" alt="FOR-C" className="h-7 w-7 object-contain" style={{ animation: 'blink 5s infinite', transformOrigin: 'center' }} />
            <img src="/logo.png" alt="FOR-C" className="h-5 object-contain" />
          </div>
        </div>
        <button
          onClick={() => navigate('/control')}
          className="text-sm font-semibold px-4 py-2 rounded-lg transition"
          style={{ background: 'rgba(159,214,58,0.12)', color: '#9FD63A', border: '1px solid rgba(159,214,58,0.3)' }}
        >
          ← Back to Control Tower
        </button>
      </nav>

      <style>{`
        @keyframes blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: 'linear-gradient(135deg, #111B21 0%, #0D3D2E 60%, #1D625B 100%)' }} className="px-6 md:px-16 py-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="md:w-1/2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: 'rgba(159,214,58,0.12)', color: '#9FD63A', border: '1px solid rgba(159,214,58,0.25)' }}>
              ⚡ Supply Chain Intelligence Platform
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5 text-white leading-tight">
              Find The Hairline Fractures<br />
              <span style={{ color: '#9FD63A' }}>Before They Become Breaks</span>
            </h1>
            <p className="text-lg mb-8" style={{ color: '#A8BFB0', lineHeight: '1.7' }}>
              FOR-C is a supply chain war gaming engine. Simulate any disruption, quantify the exposure,
              and find the exact inventory strategy that keeps your network resilient — before the line stops.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://FOR-C.com"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-xl font-bold text-sm transition hover:opacity-90"
                style={{ background: '#9FD63A', color: '#111B21' }}
              >
                Book a Demo →
              </a>
              <button
                onClick={() => navigate('/control')}
                className="px-6 py-3 rounded-xl font-semibold text-sm transition"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Open Control Tower
              </button>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-3xl opacity-30" style={{ background: '#9FD63A' }} />
              <img
                src="/assets/BornOutOfCrisis.png"
                alt="FOR-C Platform"
                className="relative max-w-sm w-full h-auto rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{ background: '#0D1F18', borderTop: '1px solid #1E3D2C', borderBottom: '1px solid #1E3D2C' }} className="px-6 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold mb-1" style={{ color: '#9FD63A', fontFamily: 'monospace' }}>{s.value}</div>
              <div className="text-xs" style={{ color: '#6B8070' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM STATEMENT ── */}
      <div className="py-16 px-6 md:px-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#9FD63A' }}>THE PROBLEM</div>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#111B21' }}>
              Your risk tools tell you what already happened.
            </h2>
            <p className="text-lg" style={{ color: '#4B6358', lineHeight: '1.7' }}>
              Everstream flags a port closure. Resilinc alerts you to a supplier event.
              By then you're already reacting — expediting freight at 3x cost, calling customers to explain delays,
              scrambling for alternate sources with zero leverage.
            </p>
            <p className="text-lg mt-4 font-semibold" style={{ color: '#1D625B' }}>
              That's not risk management. That's crisis management with better data.
            </p>
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ background: '#F4F7F4' }} className="py-16 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#9FD63A' }}>WHAT FOR-C DELIVERS</div>
            <h2 className="text-3xl font-bold" style={{ color: '#111B21' }}>Built for operators. Trusted by executives.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <button
                key={f.title}
                onClick={() => setSelectedFeature(f)}
                className="text-left p-6 rounded-2xl transition group hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: 'white', border: '1px solid #D5DDD8', borderTop: '3px solid #9FD63A' }}
              >
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-base font-bold mb-2" style={{ color: '#1D625B' }}>{f.title}</h3>
                <p className="text-sm" style={{ color: '#4B6358', lineHeight: '1.6' }}>{f.desc}</p>
                <div className="mt-3 text-xs font-semibold" style={{ color: '#9FD63A' }}>Learn more →</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── COMPARISON ── */}
      <div className="py-16 px-6 md:px-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#9FD63A' }}>WHY FOR-C</div>
            <h2 className="text-3xl font-bold" style={{ color: '#111B21' }}>Different by design</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: '#D5DDD8' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#111B21' }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: '#6B8070' }}></th>
                  <th className="px-5 py-3 font-semibold text-center" style={{ color: '#6B8070' }}>ERP</th>
                  <th className="px-5 py-3 font-semibold text-center" style={{ color: '#6B8070' }}>Risk Tools</th>
                  <th className="px-5 py-3 font-bold text-center" style={{ color: '#9FD63A' }}>FOR-C</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Tells you what happened', true, true, true],
                  ['Alerts to external events', false, true, true],
                  ['Simulates cascade impact', false, false, true],
                  ['Quantifies revenue exposure', false, false, true],
                  ['Identifies optimal buffer nodes', false, false, true],
                  ['Optimizes inventory policy', false, false, true],
                ].map(([label, erp, risk, forc], i) => (
                  <tr key={label} style={{ background: i % 2 === 0 ? 'white' : '#F4F7F4' }}>
                    <td className="px-5 py-3 font-medium" style={{ color: '#1A2E22' }}>{label}</td>
                    <td className="px-5 py-3 text-center" style={{ color: erp ? '#16a34a' : '#9CA3AF' }}>{erp ? '✓' : '—'}</td>
                    <td className="px-5 py-3 text-center" style={{ color: risk ? '#16a34a' : '#9CA3AF' }}>{risk ? '✓' : '—'}</td>
                    <td className="px-5 py-3 text-center font-bold" style={{ background: '#EAF7E0', color: '#166534' }}>{forc ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ background: 'linear-gradient(135deg, #111B21 0%, #0D3D2E 100%)', borderTop: '1px solid #1E3D2C' }} className="py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to see your network's breaking points?</h2>
          <p className="mb-8" style={{ color: '#A8BFB0' }}>
            Book a 20-minute demo. We'll run a live simulation on a network that looks like yours.
            You'll leave knowing exactly where your supply chain breaks — and what it would cost to fix it.
          </p>
          <a
            href="https://FOR-C.com"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-8 py-4 rounded-xl font-bold text-base transition hover:opacity-90"
            style={{ background: '#9FD63A', color: '#111B21' }}
          >
            Book a Demo at FOR-C.com
          </a>
        </div>
      </div>

      {/* ── MODAL ── */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden">
            <div style={{ background: '#111B21', borderBottom: '2px solid #9FD63A' }} className="px-6 py-5 flex items-start justify-between">
              <div>
                <div className="text-2xl mb-1">{selectedFeature.icon}</div>
                <h3 className="text-xl font-bold" style={{ color: '#9FD63A' }}>{selectedFeature.title}</h3>
              </div>
              <button onClick={() => setSelectedFeature(null)} className="text-2xl leading-none" style={{ color: '#6B8070' }}>×</button>
            </div>
            <div className="p-6">
              <p style={{ color: '#4B6358', lineHeight: '1.7' }}>{selectedFeature.details}</p>
              <button
                onClick={() => setSelectedFeature(null)}
                className="mt-6 px-5 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#F4F7F4', color: '#1D625B' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
