// src/components/ControlTowerEnhancements/UpgradeBanner.jsx
import React from "react";

export default function UpgradeBanner({ className = "" }) {
  return (
    <div className={`p-4 rounded-xl border-l-4 bg-amber-500/10 border-amber-500 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-200">
          <strong className="mr-1 text-amber-400">Pro feature:</strong>
          Upgrade to unlock this capability.
        </div>
        <a
          href="/billing"
          className="shrink-0 rounded-lg px-3 py-1.5 bg-[#9FD63A] text-[#111B21] font-semibold hover:bg-[#B8E85C]"
        >
          Upgrade Now
        </a>
      </div>
    </div>
  );
}
