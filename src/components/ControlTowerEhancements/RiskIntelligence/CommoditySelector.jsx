// ─────────────────────────────────────────────────────────────────────────────
// CommoditySelector.jsx
// FOR-C v3 · Commodity dropdown selector
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { COMMODITY_REGISTRY, STATUS_CONFIG } from "./commodityRegistry";

export default function CommoditySelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);

  const current = COMMODITY_REGISTRY.find((c) => c.key === selected)
    || COMMODITY_REGISTRY[0];

  function handleSelect(commodity) {
    if (commodity.status === "coming_soon") return;
    onChange(commodity.key);
    setOpen(false);
  }

  const grouped = COMMODITY_REGISTRY.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  return (
    <div style={{ position: "relative", display: "inline-block" }}>

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          padding:      "8px 14px",
          background:   "#141B23",
          border:       "0.5px solid #1E2733",
          borderRadius: 10,
          cursor:       "pointer",
          fontSize:     13,
          fontWeight:   500,
          color:        "#F1F5F9",
          minWidth:     260,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{current.icon}</span>
          <span>{current.label}</span>
          <span style={{
            fontSize:     10,
            padding:      "2px 7px",
            borderRadius: 20,
            background:   STATUS_CONFIG[current.status].bg,
            color:        STATUS_CONFIG[current.status].color,
            border:       `0.5px solid ${STATUS_CONFIG[current.status].border}`,
          }}>
            {STATUS_CONFIG[current.status].label}
          </span>
        </div>
        <span style={{ color: "#7A8A99", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:     "absolute",
          top:          "calc(100% + 6px)",
          left:         0,
          zIndex:       200,
          background:   "#141B23",
          border:       "0.5px solid #1E2733",
          borderRadius: 12,
          boxShadow:    "0 4px 24px rgba(0,0,0,0.10)",
          minWidth:     320,
          overflow:     "hidden",
        }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{
                padding:    "8px 14px 4px",
                fontSize:   10,
                fontWeight: 500,
                color:      "#7A8A99",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "#1A2129",
              }}>
                {category}
              </div>
              {items.map((commodity) => {
                const cfg = STATUS_CONFIG[commodity.status];
                const isDisabled = commodity.status === "coming_soon";
                const isSelected = commodity.key === selected;

                return (
                  <div
                    key={commodity.key}
                    onClick={() => handleSelect(commodity)}
                    style={{
                      display:    "flex",
                      alignItems: "flex-start",
                      gap:        10,
                      padding:    "10px 14px",
                      cursor:     isDisabled ? "default" : "pointer",
                      opacity:    isDisabled ? 0.5 : 1,
                      background: isSelected ? "rgba(74,222,128,0.1)" : "transparent",
                      borderLeft: isSelected ? "3px solid #9FD63A" : "3px solid transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled && !isSelected)
                        e.currentTarget.style.background = "#1A2129";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{commodity.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        6,
                        marginBottom: 2,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#F1F5F9" }}>
                          {commodity.label}
                        </span>
                        <span style={{
                          fontSize:     10,
                          padding:      "1px 6px",
                          borderRadius: 20,
                          background:   cfg.bg,
                          color:        cfg.color,
                          border:       `0.5px solid ${cfg.border}`,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#7A8A99", lineHeight: 1.4 }}>
                        {commodity.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{
            padding:    "8px 14px",
            fontSize:   11,
            color:      "#7A8A99",
            background: "#1A2129",
            borderTop:  "0.5px solid #1E2733",
          }}>
            More commodities added each quarter · Request a commodity →
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}