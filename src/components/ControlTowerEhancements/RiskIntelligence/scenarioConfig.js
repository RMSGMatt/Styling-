// ─────────────────────────────────────────────────────────────────────────────
// scenarioConfig.js
// FOR-C v3 · Shared scenario display config
//
// Extracted from TriggerQueue.jsx so it can be shared with TriggerBanner.jsx
// (Control Tower) without a second copy drifting out of sync, and without
// tripping the react-refresh "only export components" rule that fires when
// a component file also exports plain data.
// ─────────────────────────────────────────────────────────────────────────────
// Exported so other surfaces (e.g. the Control Tower trigger banner) can
// share this exact config rather than maintaining a second copy that could
// drift out of sync.
export const SCENARIO_CONFIG = {
  MLCC_lead_time_extension: {
    label:       "MLCC lead time extension",
    description: "High-capacitance MLCC lead times exceeding 20 weeks. AI server demand cannibalising automotive allocation. Simulate impact on component-dependent production schedules.",
    icon:        "🔋",
    defaultParams: {
      lead_time_multiplier:  2.1,
      affected_components:   ["High-cap MLCC 1206", "High-cap MLCC 1210", "Automotive-grade MLCC"],
      duration_weeks:        20,
      supply_reduction_pct:  0.35,
    },
  },
  automotive_MCU_allocation: {
    label:       "Automotive MCU allocation constraint",
    description: "AEC-Q100 qualified 32-bit MCUs at 52+ week lead times. Mature node (40–180nm) foundry sold out through 2026. Simulate allocation tightening on MCU-dependent assemblies.",
    icon:        "🖥️",
    defaultParams: {
      lead_time_multiplier:  3.2,
      affected_components:   ["32-bit AEC-Q100 MCU", "Power MOSFET", "SiC MOSFET"],
      duration_weeks:        26,
      supply_reduction_pct:  0.45,
    },
  },
  export_control_discrete_semis: {
    label:       "Export control — discrete semiconductors",
    description: "Gallium & germanium export suspension until Nov 27, 2026. Nexperia supply chain partially restored but structurally fragile. Simulate impact on discrete component availability.",
    icon:        "🚫",
    defaultParams: {
      lead_time_multiplier:  1.8,
      affected_components:   ["Gallium-based ICs", "Germanium discretes", "Nexperia transistors/diodes"],
      duration_weeks:        26,
      supply_reduction_pct:  0.30,
      expiry_date:           "2026-11-27",
    },
  },
  taiwan_strait_crisis: {
    label:       "Taiwan Strait supply disruption",
    description: "Elevated baseline tension with #1 Beijing risk classification for 2026. Not a current active event but structural risk warrants scenario readiness. Simulate TSMC / Taiwan fab disruption.",
    icon:        "🌊",
    defaultParams: {
      lead_time_multiplier:  4.0,
      affected_components:   ["TSMC-sourced chips", "Taiwan fab output", "Advanced packaging"],
      duration_weeks:        52,
      supply_reduction_pct:  0.70,
      affected_region:       "Taiwan",
    },
  },
  freight_rate_shock: {
    label:       "Freight rate shock",
    description: "Transpacific rates ~$700/FEU above pre-Hormuz-crisis baseline. Middle East energy situation adding structural floor. Simulate freight cost escalation and modal shift pressure.",
    icon:        "🚢",
    defaultParams: {
      cost_multiplier:       1.4,
      modal_shift_to_air:    true,
      affected_routes:       ["Asia–US West Coast (FBX01)", "Asia–US East Coast (FBX03)"],
      duration_weeks:        12,
    },
  },
  AI_capacity_allocation_squeeze: {
    label:       "AI-driven capacity allocation squeeze",
    description: "Murata, TDK, Samsung Electro-Mechanics committing high-cap MLCC capacity to AI/hyperscaler customers under multi-year agreements. Automotive buyers left competing for residual allocation.",
    icon:        "🤖",
    defaultParams: {
      lead_time_multiplier:  2.4,
      affected_components:   ["High-cap MLCC", "Advanced packaging substrates"],
      duration_weeks:        32,
      supply_reduction_pct:  0.40,
      constrained_through:   "mid-2027",
    },
  },

  // ── Lithium & Battery scenarios ───────────────────────────────────────────
  cell_allocation_squeeze: {
    label:       "Cell capacity allocation squeeze",
    description: "CATL and LG Energy Solution committing >80% of 2026 prismatic cell capacity to priority OEMs. Tier 1 battery pack assemblers competing for residual allocation. Simulate impact on battery-dependent production schedules.",
    icon:        "🔋",
    defaultParams: {
      lead_time_multiplier:  1.8,
      affected_components:   ["Automotive prismatic cells", "Pouch cells", "NMC cathode packs"],
      duration_weeks:        24,
      supply_reduction_pct:  0.40,
    },
  },
  lithium_price_spike: {
    label:       "Lithium spot price spike",
    description: "Lithium carbonate and hydroxide prices recovering from 2024 lows with contango steepening. Simulate cost escalation impact on battery pack pricing and margin exposure.",
    icon:        "📈",
    defaultParams: {
      cost_multiplier:       1.35,
      affected_components:   ["Li carbonate", "Li hydroxide", "NMC cathode material"],
      duration_weeks:        16,
    },
  },
  china_refinery_restriction: {
    label:       "China lithium refinery restriction",
    description: "China controls ~65% of global lithium refining. Any export restriction or policy shift is a binary tail event. Simulate supply reduction across refined lithium and cathode material inputs.",
    icon:        "🚫",
    defaultParams: {
      lead_time_multiplier:  4.0,
      affected_components:   ["Battery-grade lithium", "NMC cathode", "LFP cathode"],
      duration_weeks:        52,
      supply_reduction_pct:  0.60,
      affected_region:       "China",
    },
  },
  ev_demand_cell_gap: {
    label:       "EV demand vs cell capacity gap",
    description: "Global EV production forecast outpacing cell capacity commitments by ~8% YoY. Allocation pressure falls on Tier 1 suppliers to smaller OEMs first. Simulate progressive allocation tightening.",
    icon:        "⚡",
    defaultParams: {
      lead_time_multiplier:  2.2,
      affected_components:   ["Prismatic cells", "Module assemblies", "BMS components"],
      duration_weeks:        32,
      supply_reduction_pct:  0.30,
    },
  },
};
