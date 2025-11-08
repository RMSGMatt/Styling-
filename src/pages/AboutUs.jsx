import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    icon: '🔄',
    title: 'Digital Twin Simulation',
    desc: 'Model your supply network in real-time to test disruptions and what-ifs.',
    details: `Run proactive scenarios to understand the ripple effects of supplier shutdowns, transport delays, or demand surges — before they happen. Make decisions using live data instead of guesswork.`
  },
  {
    icon: '🧠',
    title: 'AI-Driven Forecasting',
    desc: 'Predict disruption likelihoods using live data and learned risk patterns.',
    details: `Our models learn from years of incident and supplier data to help you spot risk trends early. Adjust buffers, orders, and inventory based on predictive alerts.`
  },
  {
    icon: '🌐',
    title: 'Interactive Global Map',
    desc: 'Visualize facilities and risk overlays on a dynamic globe.',
    details: `Quickly locate bottlenecks and risk clusters across your global network. See incident zones, supplier locations, and demand centers in real-time.`
  },
  {
    icon: '📊',
    title: 'Control Tower KPIs',
    desc: 'Monitor real-time metrics with toggleable day/week/month views.',
    details: `All your key performance indicators — from fill rate to lead time — in one place. Toggle between time windows to spot trends and drill into problem areas.`
  },
  {
    icon: '📂',
    title: 'CSV Integration',
    desc: 'Upload BOM, demand, and process files. Simulate instantly.',
    details: `Drag and drop your real-world data to simulate with precision. FOR-C reads your structure, validates format, and runs full-chain simulations without IT integration.`
  },
  {
    icon: '📥',
    title: 'Downloadable Outputs',
    desc: 'Get inventory, production, and disruption CSVs with one click.',
    details: `Easily export simulation results for executive review, reporting, or further modeling. Outputs are formatted to plug into your analytics workflows.`
  }
];

export default function AboutUs() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const navigate = useNavigate();

  const handleBackClick = () => {
    console.log("🔙 Back to Control Tower clicked");
    navigate('/control');
  };

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans relative">
      {/* ✅ Eye + Main Logo in top-left with blinking animation */}
<div className="absolute top-4 left-4 z-50">
  {/* Inline <style> tag for custom blink animation */}
  <style>{`
    @keyframes blink {
      0%, 90%, 100% {
        transform: scaleY(1);
      }
      95% {
        transform: scaleY(0.1);
      }
    }
    .blinking-eye {
      animation: blink 5s infinite;
      transform-origin: center;
    }
  `}</style>

  <div className="bg-white p-2 pr-5 pl-4 rounded-2xl shadow-md flex items-center space-x-3">
    <img
      src="/eye-logo.png"
      alt="Eye Logo"
      className="h-12 w-12 object-contain blinking-eye"
    />
    <img
      src="/logo.png"
      alt="FOR-C Logo"
      className="h-8 object-contain"
    />
  </div>
</div>



      {/* ✅ Back to Control Tower button in top-right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleBackClick}
          className="bg-[#1D625B] text-white px-4 py-2 rounded shadow hover:bg-[#144C45] transition"
        >
          ← Back to Control Tower
        </button>
      </div>

      {/* Hero Section */}
      <div className="bg-[#1D625B] text-white py-20 px-6 md:px-16 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Built for the Next Era of Supply Chain Intelligence
          </h1>
          <p className="text-lg font-light">
            FOR-C isn’t just a platform — it’s a new operating model for resilient, AI-powered, future-ready supply chains.
          </p>
        </div>
        <div className="md:w-1/2 flex justify-center">
          <img
            src="/assets/BornOutOfCrisis.png"
            alt="Born Out of Crisis"
            className="max-w-[350px] w-full h-auto rounded-lg shadow-xl"
          />
        </div>
      </div>

      {/* Feature Section */}
      <div className="py-16 px-6 md:px-16 bg-gray-50">
        <h2 className="text-3xl font-bold text-[#1D625B] mb-6 text-center">What FOR-C Delivers</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f) => (
            <button
              key={f.title}
              onClick={() => setSelectedFeature(f)}
              className="bg-white text-left border-l-4 border-[#ABFA7D] p-6 rounded shadow hover:shadow-md focus:outline-none"
            >
              <h3 className="text-xl font-semibold text-[#1D625B] mb-2">{f.icon} {f.title}</h3>
              <p>{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white max-w-xl w-full mx-4 p-6 rounded-lg shadow-xl relative">
            <button
              className="absolute top-3 right-4 text-2xl text-gray-500 hover:text-red-500"
              onClick={() => setSelectedFeature(null)}
            >
              ×
            </button>
            <h3 className="text-2xl font-bold text-[#1D625B] mb-4">
              {selectedFeature.icon} {selectedFeature.title}
            </h3>
            <p className="text-gray-700">{selectedFeature.details}</p>
          </div>
        </div>
      )}
    </div>
  );
}
