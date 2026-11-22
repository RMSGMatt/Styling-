/**
 * Ask your network: a plain-language question about the loaded network, answered by the agent running the simulator.
 * Shows the answer, the assumptions behind it, each scenario it ran (with a link to the saved run) and, on request,
 * the steps it took.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const CONF = { high: ["High confidence", "#22C55E"], medium: ["Medium confidence", "#F59E0B"], low: ["Low confidence", "#F87171"] };

const money = (v) => (v == null ? null : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => (iso && iso.length >= 10 ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : iso || "");
const pretty = (s) => String(s || "").replace(/_/g, " ");

function measure(result, key) {
  return (result?.measures || []).find((m) => m.key === key) || null;
}

// Rows that share dates and severity read as one line: "6 parts at FAB TAIWAN 01, FAB JAPAN 01, 50%, Nov 29 to Dec 28".
function summarize(rows) {
  const groups = {};
  (rows || []).forEach((d) => { const k = `${d.start_date}|${d.end_date}|${d.severity}`; (groups[k] = groups[k] || []).push(d); });
  return Object.values(groups).map((g) => {
    const d0 = g[0];
    const whole = [...new Set(g.filter((x) => !x.sku).map((x) => pretty(x.facility)))];
    const partRows = g.filter((x) => x.sku);
    const partSites = [...new Set(partRows.map((x) => pretty(x.facility)))].join(", ");
    const bits = [];
    if (whole.length) bits.push(whole.join(", "));
    if (partRows.length === 1) bits.push(`${pretty(partRows[0].sku)} at ${partSites}`);
    else if (partRows.length > 1) bits.push(`${partRows.length} parts at ${partSites}`);
    return `${bits.join("; ")}, ${Math.round((d0.severity || 0) * 100)}%, ${day(d0.start_date)} to ${day(d0.end_date)}`;
  });
}

function RunCard({ run, onOpen }) {
  const r = run.result || {};
  const fill = measure(r, "fill_rate");
  const peak = measure(r, "peak_backorder");
  const cust = measure(r, "customers_impacted");
  const v = r.vs_baseline || {};
  const facts = [];
  if (v.added_revenue_at_risk != null) facts.push(["Added revenue at risk", `${v.added_revenue_at_risk >= 0 ? "+" : "−"}${money(Math.abs(v.added_revenue_at_risk))}`, r.revenue_at_risk != null ? `${money(r.revenue_at_risk)} total` : null]);
  if (r.first_shortage_date) facts.push(["First shortage", `${day(r.first_shortage_date)}${r.first_shortage_part ? `, ${pretty(r.first_shortage_part)}` : ""}${r.first_shortage_at ? ` at ${pretty(r.first_shortage_at)}` : ""}`]);
  else facts.push(["First shortage", "None in the window"]);
  if (fill && fill.worst != null) facts.push(["Worst-week fill", `${fill.worst}%`, v.worst_week_fill_pct_normal != null && v.worst_week_fill_pct_normal < 100 ? `${v.worst_week_fill_pct_normal}% normally` : null]);
  if (peak && peak.during != null) facts.push(["Peak backorder", `${Number(peak.during).toLocaleString()} units`, v.added_peak_backorder_units != null && v.added_peak_backorder_units !== Math.round(peak.during) ? `+${Number(v.added_peak_backorder_units).toLocaleString()} vs normal` : null]);
  if (cust && cust.during != null) facts.push(["Customers hit", String(cust.during)]);
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "rgba(148,163,184,0.18)", background: "rgba(2,6,23,0.35)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: TEXT }}>{run.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: DIM }}
               title={(run.disruptions || []).map((d) => `${pretty(d.facility)}${d.sku ? ` (${pretty(d.sku)})` : ""}`).join(", ")}>
            {summarize(run.disruptions).join(" · ")}
          </div>
        </div>
        {run.run_id && (
          <button type="button" onClick={() => onOpen(run.run_id)} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: "rgba(159,214,58,0.35)", color: LIME }}>
            Open run
          </button>
        )}
      </div>
      {v.normal_operations_already_short && v.first_shortage_date_normal && (
        <div className="mt-2 text-[11px]" style={{ color: "#FCD34D" }}>Normal operations already run short from {day(v.first_shortage_date_normal)}. The figures marked normal show that base.</div>
      )}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
        {facts.map(([k, val, sub]) => (
          <div key={k}>
            <div className="text-[10.5px] uppercase tracking-wide" style={{ color: DIM }}>{k}</div>
            <div className="text-sm font-semibold" style={{ color: TEXT }}>{val}</div>
            {sub && <div className="text-[11px]" style={{ color: DIM }}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AskNetworkCard({ apiBase, examples = [], simulationHistory, onReloadRun, onRefreshHistory }) {
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState(null);
  const [usage, setUsage] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(null);
  const timer = useRef(null);
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const loadList = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/agent/asks`, { headers: headers() });
      if (!r.ok) return;
      const b = await r.json();
      setUsage(b.usage || null);
      setRecent(b.asks || []);
      const running = (b.asks || []).find((a) => a.status === "running");
      setAsk((cur) => cur || running || null);
    } catch { /* the card still works without the list */ }
  }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [loadList]);

  // Poll while the agent works.
  useEffect(() => {
    if (!ask || ask.status !== "running") return undefined;
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${apiBase}/api/agent/ask/${ask.id}`, { headers: headers() });
        const b = await r.json().catch(() => ({}));
        if (b.ask) {
          setAsk(b.ask);
          if (b.ask.status !== "running") { loadList(); if (onRefreshHistory) onRefreshHistory(); }
        }
      } catch { setAsk((a) => ({ ...a })); }
    }, 2500);
    return () => clearTimeout(timer.current);
  }, [ask, apiBase, loadList, onRefreshHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (text) => {
    const question = String(text || q).trim();
    if (!question || busy) return;
    setErr(""); setSteps(null); setBusy(true);
    try {
      const r = await fetch(`${apiBase}/api/agent/ask`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const b = await r.json().catch(() => ({}));
      if (r.status === 202 && b.ask) { setAsk(b.ask); setUsage(b.usage || usage); setQ(""); }
      else { setErr(b.message || "That did not work. Try again."); if (b.usage) setUsage(b.usage); }
    } catch { setErr("Could not reach the server."); } finally { setBusy(false); }
  };

  const openRun = (runId) => {
    const e = (simulationHistory || []).find((x) => (x.run_id || x.id) === runId);
    if (e && onReloadRun) { onReloadRun(e); return; }
    setErr("That run is still being added to your history. Try again in a moment.");
    if (onRefreshHistory) onRefreshHistory();
  };

  const loadSteps = async () => {
    if (steps) { setSteps(null); return; }
    try {
      const r = await fetch(`${apiBase}/api/agent/ask/${ask.id}?steps=1`, { headers: headers() });
      const b = await r.json();
      setSteps(b.ask?.steps || []);
    } catch { setSteps([]); }
  };

  const running = ask && ask.status === "running";
  const out = usage && usage.limit > 0 && usage.used >= usage.limit;
  const [confLabel, confColor] = CONF[ask?.confidence] || CONF.medium;

  return (
    <section className="mb-6 rounded-2xl border px-5 py-4" style={{ background: "linear-gradient(150deg, rgba(4,22,17,0.98), rgba(5,34,26,0.98))", borderColor: "rgba(159,214,58,0.3)" }} data-testid="ask-network">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold" style={{ color: LIME }}>Ask your network</h2>
        {usage && usage.limit > 0 && <span className="text-[11px]" style={{ color: DIM }}>{usage.used} of {usage.limit} questions this month</span>}
      </div>
      <p className="text-sm mt-1" style={{ color: MUTED }}>Ask a what-if in plain words. FOR-C builds the scenario, runs it against normal operations and answers from the results.</p>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} disabled={running || out}
               placeholder={out ? "You have used this month's questions." : (examples[0] || "What if a key supplier is down for three weeks?")}
               className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "rgba(2,6,23,0.5)", border: "1px solid rgba(148,163,184,0.25)", color: TEXT }} />
        <button type="submit" disabled={running || busy || out || !q.trim()} className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "#9CF700", color: "#020617", opacity: running || busy || out || !q.trim() ? 0.5 : 1 }}>
          {running ? "Working…" : "Ask"}
        </button>
      </form>
      {!running && examples.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((x) => (
            <button key={x} type="button" disabled={out} onClick={() => submit(x)} className="rounded-full border px-3 py-1 text-xs"
                    style={{ borderColor: "rgba(148,163,184,0.25)", color: MUTED, background: "transparent" }}>{x}</button>
          ))}
        </div>
      )}
      {err && <div className="mt-2 text-sm" style={{ color: "#FCA5A5" }}>{err}</div>}

      {ask && (
        <div className="mt-4">
          <div className="text-xs" style={{ color: DIM }}>You asked</div>
          <div className="text-sm font-semibold" style={{ color: TEXT }}>{ask.question}</div>

          {running && <div className="mt-3 text-sm animate-pulse" style={{ color: LIME }}>{ask.progress || "Working"}…</div>}
          {ask.status === "error" && <div className="mt-3 text-sm" style={{ color: "#FCA5A5" }}>{ask.message || "The answer could not be finished."}</div>}

          {ask.status === "done" && (
            <>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "#E8F2EC" }}>{ask.answer}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: confColor, border: `1px solid ${confColor}66` }}>{confLabel}</span>
                <button type="button" onClick={loadSteps} className="text-xs underline" style={{ color: MUTED }}>{steps ? "Hide how I got this" : "How I got this"}</button>
              </div>
              {(ask.assumptions || []).length > 0 && (
                <div className="mt-3">
                  <div className="text-[10.5px] uppercase tracking-wide" style={{ color: DIM }}>Assumptions</div>
                  <ul className="mt-1 text-xs space-y-0.5" style={{ color: MUTED }}>{ask.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              {(ask.runs || []).length > 0 && (
                <div className="mt-3 grid gap-2">{ask.runs.map((r, i) => <RunCard key={r.run_id || i} run={r} onOpen={openRun} />)}</div>
              )}
              {steps && (
                <ol className="mt-3 text-[11px] space-y-1 list-decimal pl-5" style={{ color: DIM }}>
                  {steps.map((s, i) => (
                    <li key={i}><span style={{ color: MUTED }}>{s.tool === "get_network" ? "Read the network" : s.tool === "run_scenario" ? "Ran a scenario" : s.tool === "give_answer" ? "Wrote the answer" : s.tool}</span>
                      {s.tool === "run_scenario" && <span> ({s.seconds}s): {String(s.input).slice(0, 220)}</span>}</li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}

      {recent.filter((r) => !ask || r.id !== ask.id).length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "rgba(148,163,184,0.12)" }}>
          <div className="text-[10.5px] uppercase tracking-wide" style={{ color: DIM }}>Recent questions</div>
          <div className="mt-1 flex flex-col gap-1">
            {recent.filter((r) => !ask || r.id !== ask.id).slice(0, 4).map((r) => (
              <button key={r.id} type="button" onClick={() => { setAsk(r); setSteps(null); setErr(""); }} className="text-left text-xs hover:underline" style={{ color: MUTED }}>
                {r.question}{r.status === "error" ? " (did not finish)" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
