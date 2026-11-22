/**
 * Early Warning: the chokepoint and signal-chain loop as its own page, and a strip for the top of the Dashboard.
 * What is coming, whether it hits your parts and when, and what to do about it.
 */
import React, { useEffect, useState } from "react";
import ChokepointPanel from "./ChokepointPanel";
import IncidentsPanel from "./IncidentsPanel";
import { launchScenarioToSimulation } from "./riskScoreEngine";
import { SCENARIO_CONFIG } from "./scenarioConfig";
import BriefButton from "../briefs/BriefButton";
import BriefView from "../briefs/BriefView";
import { BRIEF_COST_ONLY } from "../briefs/briefStore";

const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const STAGE = { act: ["Act", "#F87171"], warning: ["Warning", "#F4A742"], watch: ["Watch", "#E8D44D"], none: ["Quiet", "#64748B"] };
const money = (v) => (v == null ? "" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);

export function EarlyWarningView({ switchView, focus, preferredEdition, hideEditions }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 500, color: "#2EC4A6", margin: 0 }}>Early Warning</h2>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          Shortages forming upstream, the date they reach component lead times, the parts of yours in their path, and what each response costs.
        </div>
      </div>
      <IncidentsPanel onLaunchScenario={({ scenario, params }) => launchScenarioToSimulation({ scenario, params, source: "incident_log" }, switchView)} />
      <ChokepointPanel key={`${focus?.chain || "default"}|${preferredEdition || ""}`} switchView={switchView} initialChain={focus?.chain} initialView={focus?.chain ? "signals" : undefined}
                       preferredEdition={preferredEdition} hideEditions={hideEditions}
                       onLaunchScenario={({ scenario, params }) => launchScenarioToSimulation({ scenario, params, source: "early_warning" }, switchView)} />
    </div>
  );
}

function oneLine(c) {
  const you = c.you || {};
  const top = (c.options?.options || []).find((o) => o.feasible && o.days_avoided > 0);
  const bits = [];
  if (you.min_days_cover != null && c.stage_rank >= 2) bits.push(`${you.min_days_cover} days cover`);
  if (top) bits.push(`${top.title.split(" or ")[0]} avoids ${top.days_avoided} line-down days${top.cost != null ? ` for ${money(top.cost)}` : ""}`);
  if (!bits.length) return c.window_text || c.headline;
  return bits.join(" · ");
}

const LEVEL_STAGE = (score) => (score == null ? STAGE.none : score >= 75 ? STAGE.act : score >= 55 ? STAGE.warning : score >= 35 ? STAGE.watch : STAGE.none);

function commodityLine(c) {
  const bits = [`${c.parts} part${c.parts === 1 ? "" : "s"} at ${c.sites} site${c.sites === 1 ? "" : "s"}`];
  if (c.minCover != null) bits.push(`${Math.round(c.minCover)} days cover`);
  const t = (c.triggers || []).find((x) => x.status === "triggered") || (c.triggers || [])[0];
  if (t) bits.push(t.status === "triggered" ? "trigger fired" : "trigger building");
  return bits.join(" · ");
}

// Networks whose parts sit outside the electronics chains (MedTech, for one) get cards for the commodities their parts map to.
function CommodityStrip({ commodities, onOpenCommodity, onOpenRun }) {
  const [openBrief, setOpenBrief] = useState(null);
  const urgent = commodities.filter((c) => (c.score ?? 0) >= 55).length;
  const anyMock = commodities.some((c) => c.source === "mock");
  return (
    <section className="mb-6 rounded-xl" style={{ background: "#111B21", border: "1px solid #1f3a2e", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F2EC" }}>Early warning</div>
        <div style={{ fontSize: 12.5, color: "#94A3B8" }}>
          {urgent ? `${urgent} of ${commodities.length} commodities behind your parts are High or Critical` : "Commodity risk behind your parts"}
          {anyMock && " · some signals analyst-reviewed"}
        </div>
        <button type="button" onClick={() => onOpenCommodity(commodities[0]?.key)} style={{ marginLeft: "auto", background: "none", border: 0, color: "#9FD63A", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>
          Open Risk Intelligence
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        {commodities.map((c) => {
          const [, color] = LEVEL_STAGE(c.score);
          const hot = (c.score ?? 0) >= 55;
          // A fired trigger on this commodity gets the decision brief control under the card.
          const fired = (c.triggers || []).find((t) => t.status === "triggered" && SCENARIO_CONFIG[t.scenario] && !BRIEF_COST_ONLY.has(t.scenario));
          return (
            <div key={c.key} style={{ background: "rgba(2,6,23,0.45)", border: `1px solid ${hot ? color + "88" : "rgba(148,163,184,0.18)"}`, borderRadius: 10, display: "grid" }}>
            <button type="button" onClick={() => onOpenCommodity(c.key)}
                    style={{ textAlign: "left", cursor: "pointer", background: "transparent", border: 0, padding: "10px 12px", display: "grid", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#E8F2EC" }}>{c.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111B21", background: c.color || color, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase" }}>
                  {c.score == null ? "Unscored" : `${c.level} ${c.score}`}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.35 }}>{commodityLine(c)}</div>
            </button>
            {fired && (
              <div style={{ padding: "0 12px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{SCENARIO_CONFIG[fired.scenario].label}</span>
                <span style={{ marginLeft: "auto" }}>
                  <BriefButton compact scenario={fired.scenario} commodity={fired.commodity || c.key} config={SCENARIO_CONFIG[fired.scenario]} onOpen={setOpenBrief} />
                </span>
              </div>
            )}
            </div>
          );
        })}
      </div>
      {openBrief && <BriefView briefId={openBrief} onClose={() => setOpenBrief(null)} onOpenRun={onOpenRun ? (id) => { setOpenBrief(null); onOpenRun(id); } : null} />}
    </section>
  );
}

export function EarlyWarningStrip({ apiBase, onOpen, commodities = [], onOpenCommodity, onOpenRun }) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/api/chokepoints/signals`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((b) => { if (live && Array.isArray(b?.chains)) setRes(b); }).catch(() => {});
    return () => { live = false; };
  }, [apiBase]);
  // Electronics chains only speak to networks with electronics parts. When the loaded network has none, show its own commodities.
  const electronics = new Set(["semiconductors_mlcc"]);
  const useCommodities = commodities.length > 0 && onOpenCommodity && !commodities.some((c) => electronics.has(c.key));
  if (useCommodities) return <CommodityStrip commodities={commodities} onOpenCommodity={onOpenCommodity} onOpenRun={onOpenRun} />;
  if (!res) return null;
  const urgent = res.chains.filter((c) => c.stage_rank >= 2).length;
  return (
    <section className="mb-6 rounded-xl" style={{ background: "#111B21", border: "1px solid #1f3a2e", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#E8F2EC" }}>Early warning</div>
        <div style={{ fontSize: 12.5, color: "#94A3B8" }}>
          {urgent ? `${urgent} of ${res.chains.length} electronics chains need a decision` : "Upstream shortages heading for your parts"}
          {!res.personalized && (res.not_personalized_reason === "plan"
            ? " · your parts and options in these chains are part of Pro and Enterprise"
            : " · load your network to see your parts and options")}
        </div>
        <button type="button" onClick={() => onOpen(null)} style={{ marginLeft: "auto", background: "none", border: 0, color: "#9FD63A", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>
          Open Early Warning
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        {res.chains.map((c) => {
          const [label, color] = STAGE[c.stage] || STAGE.none;
          return (
            <button key={c.id} type="button" onClick={() => onOpen(c.id)}
                    style={{ textAlign: "left", cursor: "pointer", background: "rgba(2,6,23,0.45)", border: `1px solid ${c.stage_rank >= 2 ? color + "88" : "rgba(148,163,184,0.18)"}`, borderRadius: 10, padding: "10px 12px", display: "grid", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#E8F2EC" }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111B21", background: color, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase" }}>{label}</span>
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.35 }}>{oneLine(c)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
