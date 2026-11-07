import React, { useEffect, useMemo, useRef, useState } from "react";

// Cost of waiting: replays the current run with a one-time stock buy placed on
// different dates (real simulator, server side) and charts what each week of delay costs.

const RUN_ID_RE = /(\d{8}_\d{6}_[0-9a-f]{6,})/;

function findRunId(outputUrls, simulationHistory) {
  const urls = Object.values(outputUrls || {});
  for (const u of urls) {
    const m = typeof u === "string" ? u.match(RUN_ID_RE) : null;
    if (m) return m[1];
  }
  const h = simulationHistory?.[0];
  const id = h?.run_id || h?.id || "";
  return RUN_ID_RE.test(id) ? id : null;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtDateLong(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");

const METRICS = {
  days_short: { label: "Days short", unit: "days" },
  peak_backlog: { label: "Peak backlog", unit: "units" },
  worst_week_service_pct: { label: "Worst week service", unit: "%" },
};

function Chart({ points, metric, lastOk }) {
  const W = 720, H = 250, L = 52, R = 16, T = 16, B = 38;
  const vals = points.map((p) => Number(p[metric]) || 0);
  const isPct = metric === "worst_week_service_pct";
  const ymin = isPct ? Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10) : 0;
  const ymax = isPct ? 100 : Math.max(1, Math.ceil(Math.max(...vals) * 1.1));
  const X = (i) => L + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - L - R));
  const Y = (v) => T + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(Number(p[metric]) || 0).toFixed(1)}`).join(" ");
  const ticks = 4;
  const okIdx = points.findIndex((p) => p.decision_date === lastOk);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${METRICS[metric].label} by decision date`}>
      {Array.from({ length: ticks + 1 }).map((_, k) => {
        const v = ymin + ((ymax - ymin) * k) / ticks;
        return (
          <g key={k}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{isPct ? `${Math.round(v)}%` : fmtInt(v)}</text>
          </g>
        );
      })}
      {points.map((p, i) => (
        (i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) ? (
          <text key={p.decision_date} x={X(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="#94a3b8">{fmtDate(p.decision_date)}</text>
        ) : null
      ))}
      <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle" fontSize="10" fill="#64748b">Date the buy is decided</text>
      {okIdx >= 0 && (
        <g>
          <line x1={X(okIdx)} x2={X(okIdx)} y1={T} y2={H - B} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x={X(okIdx) + 6} y={T + 12} fontSize="11" fill="#fbbf24">Last safe date</text>
        </g>
      )}
      <path d={path} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.decision_date} cx={X(i)} cy={Y(Number(p[metric]) || 0)} r="3.5" fill={p.decision_date === lastOk ? "#fbbf24" : "#34d399"}>
          <title>{`${fmtDateLong(p.decision_date)}: ${METRICS[metric].label} ${isPct ? p[metric] + "%" : fmtInt(p[metric])}`}</title>
        </circle>
      ))}
    </svg>
  );
}

const LEVERS = [
  { id: "expedite", label: "Expedite existing supplier", lt: 7, hint: "Priority build and air freight" },
  { id: "broker", label: "Broker or spot buy", lt: 14, hint: "Authenticity and price risk" },
  { id: "second", label: "Qualify a second source", lt: 60, hint: "Qualification plus first deliveries" },
];
const IDLE = { status: "idle", progress: [0, 0], result: null, message: "" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slopeOf(r) {
  if (r?.quick) return r.week_slip ? { days: r.week_slip.days_short, units: r.week_slip.peak_backlog } : null;
  const pts = (r?.points || []).filter((p) => p.plot);
  if (!r?.ok || pts.length < 2) return null;
  const i = pts.findIndex((p) => p.decision_date === r.last_responsible_date);
  const after = i >= 0 ? pts.slice(i) : [];
  if (after.length < 2) return null;
  const weeks = after.length - 1;
  return {
    days: (after[after.length - 1].days_short - after[0].days_short) / weeks,
    units: (after[after.length - 1].peak_backlog - after[0].peak_backlog) / weeks,
  };
}

export default function CostOfWaiting({ apiBase, outputUrls, simulationHistory, hasRun }) {
  const runId = useMemo(() => findRunId(outputUrls, simulationHistory), [outputUrls, simulationHistory]);
  const [levers, setLevers] = useState(LEVERS.map((l) => ({ ...l, premium: "" })));
  const [unitValue, setUnitValue] = useState("");
  const [metric, setMetric] = useState("days_short");
  const [runs, setRuns] = useState({});
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const gen = useRef(0);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { gen.current += 1; setRuns({}); setBusy(false); }, [runId]);

  const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
  const setRun = (id, v) => alive.current && setRuns((s) => ({ ...s, [id]: { ...(s[id] || IDLE), ...v } }));

  const runLever = async (lever, myGen, quick) => {
    const ok = () => alive.current && gen.current === myGen;
    setRun(lever.id, { status: "running", progress: [0, 0], result: null, message: "" });
    const finish = (body) => setRun(lever.id, { status: body.result?.ok ? "done" : "empty", progress: [1, 1], result: body.result, message: body.result?.reason || "" });
    try {
      const res = await fetch(`${apiBase}/api/cost-of-waiting`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ run_id: runId, lead_time_days: Number(lever.lt) || 14, quick: !!quick }),
      });
      let body = await res.json().catch(() => ({}));
      if (!ok()) return false;
      if (res.status === 402) { setRun(lever.id, { status: "error", message: "Cost of waiting is available on Pro and Enterprise plans." }); return false; }
      while (body.status === "running") {
        setRun(lever.id, { status: "running", progress: body.progress || [0, 0] });
        await sleep(2500);
        if (!ok()) return false;
        const pr = await fetch(`${apiBase}/api/cost-of-waiting/${encodeURIComponent(body.job_id || "")}`, { headers: { Authorization: `Bearer ${token()}` } });
        const pb = await pr.json().catch(() => ({}));
        body = { ...pb, job_id: body.job_id };
      }
      if (!ok()) return false;
      if (body.status === "done") { finish(body); return true; }
      setRun(lever.id, { status: "error", message: body.message || "The analysis failed." });
    } catch {
      if (ok()) setRun(lever.id, { status: "error", message: "Could not reach the server." });
    }
    return false;
  };

  const runAll = async () => {
    if (!runId) { setRun(selected, { status: "error", message: "Open a completed run first." }); return; }
    const myGen = gen.current;
    setBusy(true);
    // The reference option gets the full weekly sweep; the others are estimated by shifting its dates and confirmed by replay.
    const ref = levers.find((l) => l.id === "broker") || levers[0];
    const list = [ref, ...levers.filter((l) => l.id !== ref.id)];
    for (const l of list) {
      const good = await runLever(l, myGen, l.id !== ref.id);
      if (!alive.current || gen.current !== myGen) return;
      if (!good) break;
    }
    if (alive.current && gen.current === myGen) setBusy(false);
  };

  const updateLever = (id, patch) => { setLevers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))); setRuns((s) => { const n = { ...s }; if (patch.lt !== undefined) delete n[id]; return n; }); };

  const uv = Number(unitValue) > 0 ? Number(unitValue) : null;
  const doneIds = levers.filter((l) => runs[l.id]?.status === "done");
  const selLever = levers.find((l) => l.id === selected) || null;
  const cur = (selLever && runs[selLever.id]) || IDLE;
  const r = cur.result;
  const plotPts = useMemo(() => (r?.points || []).filter((p) => p.plot), [r]);
  const slope = useMemo(() => slopeOf(r), [r]);
  const safePt = useMemo(() => (r?.points || []).find((p) => p.decision_date === r?.last_responsible_date) || null, [r]);
  const slowest = useMemo(() => {
    const done = levers.filter((l) => runs[l.id]?.status === "done").map((l) => ({ l, r: runs[l.id].result }));
    if (!done.length) return null;
    const x = done.reduce((a, b) => (Number(b.l.lt) > Number(a.l.lt) ? b : a));
    if (!x.r.first_shortage_date || !x.r.last_responsible_date) return null;
    const days = Math.round((new Date(x.r.first_shortage_date) - new Date(x.r.last_responsible_date)) / 86400000);
    return days >= 7 ? { label: x.l.label, date: x.r.last_responsible_date, first: x.r.first_shortage_date, weeks: Math.round(days / 7) } : null;
  }, [levers, runs]);
  const anyError = levers.map((l) => runs[l.id]).find((x) => x && (x.status === "error" || x.status === "empty"));

  if (!hasRun) return null;

  const inputCls = "block mt-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4 mt-4" data-testid="cost-of-waiting">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">Cost of waiting</p>
      <p className="text-sm text-slate-300 mb-3">
        When does the window to act close? This replays the scenario with a one-time buy of the first product to run short, placed on different dates, and compares response options by how fast stock can arrive.
      </p>

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {levers.map((l) => (
          <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-sm font-semibold text-slate-100">{l.label}</p>
            <p className="text-[11px] text-slate-500">{l.hint}</p>
            <div className="flex gap-2 mt-2">
              <label className="text-[11px] text-slate-400">Days to arrive
                <input type="number" min="1" max="180" value={l.lt} onChange={(e) => updateLever(l.id, { lt: e.target.value })} className={`${inputCls} w-20`} />
              </label>
              <label className="text-[11px] text-slate-400">Price premium %
                <input type="number" min="0" step="any" value={l.premium} placeholder="optional" onChange={(e) => updateLever(l.id, { premium: e.target.value })} className={`${inputCls} w-24`} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 mt-3">
        <label className="text-[11px] text-slate-400">
          Value per unit, optional ($)
          <input type="number" min="0" step="any" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} placeholder="e.g. 850" className={`${inputCls} w-32`} />
        </label>
        <button type="button" onClick={() => runAll()} disabled={busy}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? "Running replays" : doneIds.length ? "Re-run comparison" : "Compare response options"}
        </button>
      </div>

      {busy && (
        <div className="mt-3" role="status" aria-live="polite">
          {levers.map((l) => {
            const x = runs[l.id];
            if (!x || x.status !== "running") return null;
            return (
              <div key={l.id}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${x.progress[1] ? Math.round((x.progress[0] / x.progress[1]) * 100) : 5}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {l.label}: {x.progress[1] ? `replay ${x.progress[0]} of ${x.progress[1]}` : "preparing the baseline"}. The first option takes a few minutes; the others take about a minute each. Results are saved for this scenario.
                </p>
              </div>
            );
          })}
        </div>
      )}

      {anyError && <p className="mt-3 text-sm text-amber-300" role="alert">{anyError.message}</p>}

      {doneIds.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[620px] text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Option</th><th className="px-3 py-2">Arrives in</th><th className="px-3 py-2">Decide by</th>
                <th className="px-3 py-2">Each week later</th><th className="px-3 py-2">Cost to act</th>
              </tr>
            </thead>
            <tbody>
              {doneIds.map((l) => {
                const rr = runs[l.id].result; const sl = slopeOf(rr);
                const cost = uv && Number(l.premium) > 0 ? rr.qty * uv * (Number(l.premium) / 100) : null;
                return (
                  <tr key={l.id} onClick={() => setSelected(selected === l.id ? null : l.id)} className={`cursor-pointer border-t border-slate-800 ${selLever && l.id === selLever.id ? "bg-amber-950/30 text-amber-100" : "hover:bg-slate-900"}`}>
                    <td className="px-3 py-1.5 font-semibold">{l.label}</td>
                    <td className="px-3 py-1.5">{l.lt} days</td>
                    <td className="px-3 py-1.5">{fmtDateLong(rr.last_responsible_date)}{rr.quick ? (rr.verified ? " (replay checked)" : " (estimate)") : ""}</td>
                    <td className="px-3 py-1.5">{sl ? `${Math.round(sl.days)} days short, ${fmtInt(sl.units)} units` : "n/a"}</td>
                    <td className="px-3 py-1.5">{cost ? `$${fmtInt(cost)} premium` : "enter price premium and value per unit"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {slowest && (
        <p className="mt-3 text-sm leading-6 text-slate-200">
          <span className="font-semibold text-amber-200">{slowest.label}:</span> decide by {fmtDateLong(slowest.date)}, about {slowest.weeks} weeks before the first shortage appears on {fmtDateLong(slowest.first)}. Slower options need an earlier call, which is why qualifying alternates before a disruption matters.
        </p>
      )}
      {doneIds.length > 0 && <p className="mt-1 text-[10px] text-slate-500">Select a row for its detail. The full weekly sweep is run for the broker option; the others are estimated by shifting its dates and confirmed by replaying the scenario.</p>}

      {selLever && cur.status === "done" && r?.ok && (
        <div className="mt-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90">Decision window closes: {selLever.label.toLowerCase()}</p>
            <p className="text-3xl font-bold text-slate-50 mt-1">{fmtDateLong(r.last_responsible_date)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Assumes a one-time buy of {fmtInt(r.qty)} units that arrives {r.lead_time_days} days after the decision. Change the options above to test other assumptions.</p>
            <p className="text-sm leading-6 text-slate-200 mt-2">
              Under these assumptions, deciding by this date cuts the shortage of <span className="font-semibold">{r.target.sku}</span> at {r.target.facility} from {r.baseline.days_short} days to {safePt ? safePt.days_short : r.best_days_short}.
              Without action it runs short from {fmtDateLong(r.first_shortage_date)} for {r.baseline.days_short} days, with a peak backlog of {fmtInt(r.baseline.peak_backlog)} units.
            </p>
            {slope && (
              <p className="text-sm leading-6 text-slate-200 mt-2">
                <span className="font-semibold text-amber-200">Each week the decision slips after that:</span> about {Math.round(slope.days)} more days short and {fmtInt(slope.units)} more units of peak backlog
                {uv ? `, roughly ${"$" + fmtInt(slope.units * uv)} of product not delivered` : ""}.
              </p>
            )}
          </div>

          {r.quick && (
            <p className="mt-2 text-[11px] text-slate-400">
              Estimated from the {r.estimated_from_lead_time_days}-day sweep by shifting the date, then confirmed by replaying the scenario at the dates below ({r.replays} replays).
              {r.verified ? " The replays agree." : " The replays did not fully agree, so treat the date as approximate."}
            </p>
          )}
          {!r.quick && <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Chart metric">
            {Object.entries(METRICS).map(([k, m]) => (
              <button key={k} type="button" onClick={() => setMetric(k)} aria-pressed={metric === k}
                className={`rounded-full border px-3 py-1 text-xs ${metric === k ? "border-emerald-400 bg-emerald-400 text-slate-950 font-semibold" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                {m.label}
              </button>
            ))}
          </div>}
          {!r.quick && <div className="mt-2"><Chart points={plotPts} metric={metric} lastOk={r.last_responsible_date} /></div>}

          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[520px] text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr><th className="px-3 py-2">Decide on</th><th className="px-3 py-2">Stock arrives</th><th className="px-3 py-2">Days short</th><th className="px-3 py-2">Peak backlog</th><th className="px-3 py-2">Worst week service</th></tr>
              </thead>
              <tbody>
                {plotPts.map((p) => (
                  <tr key={p.decision_date} className={p.decision_date === r.last_responsible_date ? "bg-amber-950/30 text-amber-100" : "border-t border-slate-800"}>
                    <td className="px-3 py-1.5">{fmtDateLong(p.decision_date)}</td>
                    <td className="px-3 py-1.5">{fmtDateLong(p.arrival_date)}</td>
                    <td className="px-3 py-1.5">{p.days_short}</td>
                    <td className="px-3 py-1.5">{fmtInt(p.peak_backlog)}</td>
                    <td className="px-3 py-1.5">{p.worst_week_service_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Real simulation, one lever: a one-time purchase sized to cover the peak shortfall.{r.window_open_date ? ` Buys placed before ${fmtDateLong(r.window_open_date)} are partly absorbed by normal replenishment in the model and are not shown.` : ""} This is a planning signal, not a forecast; supplier terms, availability and quantities change the answer.
          </p>
        </div>
      )}
    </div>
  );
}
