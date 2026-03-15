// src/components/ControlTowerEnhancements/UpgradeBanner.jsx
import React from "react";

export default function UpgradeBanner({ className = "" }) {
  return (
    <div className={`p-4 rounded-xl border-l-4 bg-yellow-50 border-yellow-500 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <strong className="mr-1">Pro feature:</strong>
          Upgrade to unlock this capability.
        </div>
        <a
          href="/billing"
          className="shrink-0 rounded-lg px-3 py-1.5 bg-[#1D625B] text-white"
        >
          Upgrade Now
        </a>
      </div>
    </div>
  );
}
