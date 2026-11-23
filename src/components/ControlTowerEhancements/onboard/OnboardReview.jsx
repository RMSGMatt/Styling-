/**
 * Admin: onboarding agent, first version (internal). Upload a customer's ERP exports, review every mapping the agent
 * proposes (columns, date and number formats, units, plant codes, site merges), then load the converted files into
 * the customer's account. Nothing loads until every mapping is approved.
 */
import React, { useEffect, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
async function call(path, opts = {}) {
  const r = await fetch(`${getApiBase()}${path}`, { ...opts, headers: { ...auth(), ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(b.message || b.error || `HTTP ${r.status}`);
    e.body = b;
    throw e;
  }
  return b;
}

const TARGETS = [
  { id: "customer_orders", label: "Customer orders" },
  { id: "inventory", label: "Inventory" },
  { id: "supplier_pos", label: "Supplier POs" },
  { id: "locations", label: "Locations" },
];
const DATE_FORMATS = [
  ["%Y-%m-%d", "2026-08-03"], ["%Y%m%d", "20260803"], ["%d.%m.%Y", "03.08.2026"], ["%m/%d/%Y", "08/03/2026 (month first)"],
  ["%d/%m/%Y", "03/08/2026 (day first)"], ["%d-%b-%Y", "03-AUG-2026"], ["%d-%b-%y", "03-AUG-26"], ["%Y/%m/%d", "2026/08/03"],
  ["%m/%d/%y", "08/03/26"], ["excel", "Spreadsheet serial number"],
];
const CONF = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-red-50 text-red-700 border-red-200",
  manual: "bg-sky-50 text-sky-700 border-sky-200",
  missing: "bg-red-50 text-red-700 border-red-200",
  none: "bg-gray-50 text-gray-500 border-gray-200",
};
const btn = "text-sm rounded-xl px-3 py-1.5 border bg-white text-gray-700 border-[#E5ECE7] hover:bg-[#F9FAF9] disabled:opacity-40";
const primary = "text-sm rounded-xl px-3 py-1.5 bg-[#1D625B] text-white disabled:opacity-40";

export default function OnboardReview() {
  const [sessions, setSessions] = useState([]);
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState("");
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [codes, setCodes] = useState({});

  const list = () => call("/api/admin/onboard").then((b) => setSessions(b.sessions || [])).catch((e) => setErr(e.message));
  useEffect(() => { list(); }, []);

  const open = async (id) => {
    setErr(""); setPreview(null);
    try {
      const b = await call(`/api/admin/onboard/${id}`);
      setS(b.session); setCodes(b.session.sites?.codes || {});
    } catch (e) { setErr(e.message); }
  };

  const start = async () => {
    if (!account.trim() || !files.length) { setErr("Enter the customer's account email and choose at least one export."); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("account", account.trim());
      files.forEach((f) => fd.append("files", f));
      const b = await call("/api/admin/onboard", { method: "POST", body: fd });
      setS(b.session); setCodes(b.session.sites?.codes || {}); setFiles([]); list();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const update = async (body) => {
    setBusy(true); setErr(""); setPreview(null);
    try {
      const b = await call(`/api/admin/onboard/${s.id}`, { method: "PUT", body: JSON.stringify(body) });
      setS(b.session); setCodes(b.session.sites?.codes || {});
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const col = (fname, target, change) => update({ files: { [fname]: { columns: { [target]: change } } } });

  const doPreview = async () => {
    setBusy(true); setErr("");
    try { setPreview(await call(`/api/admin/onboard/${s.id}/preview`, { method: "POST" })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const load = async () => {
    if (!window.confirm(`Load the converted files into ${s.account}? This replaces that account's current network data.`)) return;
    setBusy(true); setErr("");
    try {
      const b = await call(`/api/admin/onboard/${s.id}/load`, { method: "POST" });
      setPreview({ report: b.report, blocking: [] });
      await open(s.id); list();
    } catch (e) { setErr([e.message, ...(e.body?.blocking || []), ...(e.body?.errors || [])].join(" ")); } finally { setBusy(false); }
  };

  if (!s) {
    return (
      <div className="space-y-4">
        <div className="border border-[#E5ECE7] rounded-2xl p-5 bg-white">
          <div className="font-semibold text-gray-900">New onboarding</div>
          <p className="text-sm text-gray-500 mt-1">Upload a customer's exports as CSV. The agent proposes how each column maps to FOR-C's files; you approve every mapping before anything loads.</p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Customer account email" className="text-sm border border-[#E5ECE7] rounded-xl px-3 py-1.5 w-72" />
            <input type="file" multiple accept=".csv,.txt,.tsv" onChange={(e) => setFiles([...e.target.files])} className="text-sm" />
            <button type="button" className={primary} disabled={busy} onClick={start}>{busy ? "Reading files…" : "Start"}</button>
          </div>
          {err && <div className="text-sm text-red-600 mt-3">{err}</div>}
        </div>
        <div className="border border-[#E5ECE7] rounded-2xl bg-white">
          <div className="px-5 py-3 font-semibold text-gray-900 border-b border-[#E5ECE7]">Recent sessions</div>
          {!sessions.length && <div className="px-5 py-4 text-sm text-gray-500">None yet.</div>}
          {sessions.map((x) => (
            <button key={x.id} type="button" onClick={() => open(x.id)} className="w-full text-left px-5 py-3 border-b border-[#E5ECE7] last:border-0 hover:bg-[#F9FAF9]">
              <span className="font-medium text-gray-900">{x.account}</span>
              <span className="text-sm text-gray-500"> · {x.files.length} file(s) · {x.created_at?.slice(0, 16).replace("T", " ")} · {x.created_by}</span>
              <span className={"ml-2 text-xs border rounded-lg px-2 py-0.5 " + (x.status === "loaded" ? CONF.high : CONF.medium)}>{x.status === "loaded" ? "Loaded" : "In review"}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const loaded = s.status === "loaded";
  const blocking = s.blocking || [];
  const unknown = s.sites?.unknown_codes || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={() => { setS(null); setPreview(null); list(); }}>All sessions</button>
        <div className="font-semibold text-gray-900">{s.account}</div>
        <span className={"text-xs border rounded-lg px-2 py-0.5 " + (loaded ? CONF.high : CONF.medium)}>
          {loaded ? `Loaded ${s.loaded_at?.slice(0, 16).replace("T", " ")} by ${s.loaded_by}` : `${blocking.length} decision(s) left`}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn} disabled={busy} onClick={doPreview}>Preview</button>
          <button type="button" className={primary} disabled={busy || loaded || blocking.length > 0} onClick={load}>Load into account</button>
        </div>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}

      {Object.entries(s.files).map(([fname, f]) => (
        <FileCard key={fname} fname={fname} f={f} busy={busy || loaded} update={update} col={col} />
      ))}

      <div className="border border-[#E5ECE7] rounded-2xl p-5 bg-white space-y-4">
        <div>
          <div className="font-semibold text-gray-900">Sites</div>
          <p className="text-sm text-gray-500">{s.sites?.count || 0} site and supplier names across the files. Codes need a site name; merges join spellings of one site.</p>
        </div>
        {(unknown.length > 0 || Object.keys(codes).length > 0) && (
          <div>
            <div className="text-sm font-medium text-gray-800 mb-2">Plant and organization codes</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...new Set([...unknown, ...Object.keys(codes)])].map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <span className="w-20 font-mono text-gray-700">{c}</span>
                  <span className="text-gray-400">→</span>
                  <input value={codes[c] || ""} disabled={busy || loaded} onChange={(e) => setCodes((x) => ({ ...x, [c]: e.target.value }))}
                    placeholder="Site name, as in locations" className="flex-1 border border-[#E5ECE7] rounded-xl px-3 py-1.5" />
                </label>
              ))}
            </div>
            <button type="button" className={btn + " mt-2"} disabled={busy || loaded} onClick={() => update({ sites: { codes } })}>Save codes</button>
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-gray-800 mb-2">Proposed merges</div>
          {!(s.sites?.merges || []).length && <div className="text-sm text-gray-500">None proposed.</div>}
          {(s.sites?.merges || []).map((g) => (
            <div key={g.keep + g.merge.join()} className="flex flex-wrap items-center gap-2 text-sm py-1.5 border-b border-[#F0F3F1] last:border-0">
              <span className="text-gray-700">{g.merge.join(", ")}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-900">{g.keep}</span>
              <span className={"text-xs border rounded-lg px-2 py-0.5 " + CONF[g.confidence]}>{g.reason}</span>
              <span className="ml-auto text-xs text-gray-500">{g.approved === true ? "Merge approved" : g.approved === false ? "Kept separate" : "Undecided"}</span>
              <button type="button" className={primary} disabled={busy || loaded || g.approved === true} onClick={() => update({ sites: { merges: [{ keep: g.keep, merge: g.merge, approved: true }] } })}>Merge</button>
              <button type="button" className={btn} disabled={busy || loaded || g.approved === false} onClick={() => update({ sites: { merges: [{ keep: g.keep, merge: g.merge, approved: false }] } })}>Keep separate</button>
            </div>
          ))}
        </div>
      </div>

      {blocking.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">Before loading</div>
          <ul className="list-disc pl-5 space-y-0.5">{blocking.slice(0, 12).map((b) => <li key={b}>{b}</li>)}</ul>
          {blocking.length > 12 && <div className="mt-1">and {blocking.length - 12} more.</div>}
        </div>
      )}

      {preview && <Preview p={preview} />}

      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer">Activity</summary>
        <ul className="mt-2 space-y-0.5">{(s.log || []).map((l, i) => <li key={i}>{l.at?.slice(0, 16).replace("T", " ")} · {l.by} · {l.what}</li>)}</ul>
      </details>
    </div>
  );
}

function FileCard({ fname, f, busy, update, col }) {
  if (f.error) {
    return <div className="border border-red-200 bg-red-50 rounded-2xl p-4 text-sm text-red-700"><b>{fname}</b>: {f.error}</div>;
  }
  const mp = f.mapping;
  const target = f.skip ? "skip" : mp?.target || "";
  const approveHigh = () => {
    const columns = {};
    (mp?.columns || []).forEach((c) => { if (c.source && c.confidence === "high" && !c.approved) columns[c.target] = { approved: true }; });
    if (Object.keys(columns).length) update({ files: { [fname]: { columns } } });
  };
  return (
    <div className="border border-[#E5ECE7] rounded-2xl bg-white">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[#E5ECE7]">
        <div className="font-semibold text-gray-900">{fname}</div>
        <span className="text-sm text-gray-500">{f.rows} rows</span>
        {(f.notes || []).map((n) => <span key={n} className="text-xs text-gray-500 border border-[#E5ECE7] rounded-lg px-2 py-0.5">{n}</span>)}
        <select value={target} disabled={busy} onChange={(e) => update({ files: { [fname]: e.target.value === "skip" ? { skip: true } : { skip: false, target: e.target.value } } })}
          className="ml-auto text-sm border border-[#E5ECE7] rounded-xl px-2 py-1.5">
          <option value="" disabled>Which FOR-C file is this?</option>
          {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          <option value="skip">Skip this file</option>
        </select>
        {mp && !f.skip && <button type="button" className={btn} disabled={busy} onClick={approveHigh}>Approve high-confidence</button>}
      </div>
      {mp && !f.skip && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 bg-[#F9FAF9]">
                <th className="px-4 py-2">FOR-C column</th><th className="px-4 py-2">From their column</th><th className="px-4 py-2">Sample: theirs → FOR-C</th>
                <th className="px-4 py-2">Format</th><th className="px-4 py-2">Confidence</th><th className="px-4 py-2">Approve</th>
              </tr>
            </thead>
            <tbody>
              {mp.columns.map((c) => {
                const t = c.transform || {};
                return (
                  <tr key={c.target} className="border-t border-[#F0F3F1] align-top">
                    <td className="px-4 py-2 font-mono text-gray-900">{c.target}{c.required ? <span className="text-red-500"> *</span> : null}</td>
                    <td className="px-4 py-2">
                      <select value={c.source || ""} disabled={busy} onChange={(e) => col(fname, c.target, { source: e.target.value || null })}
                        className="border border-[#E5ECE7] rounded-xl px-2 py-1 max-w-[14rem]">
                        <option value="">Not mapped</option>
                        {f.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {(c.samples || []).map((x, i) => (
                        <div key={i} className="whitespace-nowrap"><span className="font-mono">{String(x.from)}</span> → <span className={"font-mono " + (x.to == null ? "text-red-600" : "text-gray-900")}>{x.to == null ? "unreadable" : String(x.to)}</span></div>
                      ))}
                    </td>
                    <td className="px-4 py-2">
                      {t.kind === "date" && c.source && (
                        <select value={t.ambiguous ? "" : t.format || ""} disabled={busy} onChange={(e) => col(fname, c.target, { date_format: e.target.value })}
                          className={"border rounded-xl px-2 py-1 " + (t.ambiguous ? "border-red-300 bg-red-50" : "border-[#E5ECE7]")}>
                          <option value="" disabled>{t.ambiguous ? "Choose: day or month first?" : "Choose a format"}</option>
                          {DATE_FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      )}
                      {t.kind === "number" && c.source && (
                        <select value={t.decimal || "."} disabled={busy} onChange={(e) => col(fname, c.target, { decimal: e.target.value })} className="border border-[#E5ECE7] rounded-xl px-2 py-1">
                          <option value=".">1,234.50</option>
                          <option value=",">1.234,50</option>
                        </select>
                      )}
                      {t.note && <div className="text-xs text-amber-700 mt-1">{t.note}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={"text-xs border rounded-lg px-2 py-0.5 " + (CONF[c.confidence] || CONF.none)}>{c.confidence}</span>
                      <div className="text-xs text-gray-500 mt-1">{c.reason}</div>
                    </td>
                    <td className="px-4 py-2">
                      {c.source ? (
                        <input type="checkbox" checked={!!c.approved} disabled={busy || t.ambiguous} onChange={(e) => col(fname, c.target, { approved: e.target.checked })} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {mp && !f.skip && mp.uom && <UomBox fname={fname} u={mp.uom} busy={busy} update={update} />}
      {mp && !f.skip && mp.unmapped?.length > 0 && (
        <div className="px-5 py-3 text-xs text-gray-500 border-t border-[#E5ECE7]">Not used: {mp.unmapped.join(", ")}</div>
      )}
    </div>
  );
}

function UomBox({ fname, u, busy, update }) {
  const [factors, setFactors] = useState(u.factors || {});
  useEffect(() => setFactors(u.factors || {}), [u]);
  return (
    <div className="px-5 py-3 border-t border-[#E5ECE7] text-sm">
      <div className="font-medium text-gray-800">Units of measure from “{u.source}”: quantities are multiplied by the factor to get units.</div>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        {Object.keys(factors).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <span className="font-mono">{k || "(blank)"}</span> ×
            <input value={factors[k] ?? ""} disabled={busy} onChange={(e) => setFactors((x) => ({ ...x, [k]: e.target.value }))}
              className={"w-20 border rounded-xl px-2 py-1 " + (factors[k] == null || factors[k] === "" ? "border-red-300 bg-red-50" : "border-[#E5ECE7]")} />
          </label>
        ))}
        <button type="button" className={btn} disabled={busy} onClick={() => update({ files: { [fname]: { uom: { factors } } } })}>Save factors</button>
        <label className="flex items-center gap-1 ml-auto">
          <input type="checkbox" checked={!!u.approved} disabled={busy} onChange={(e) => update({ files: { [fname]: { uom: { approved: e.target.checked } } } })} /> Approve conversion
        </label>
      </div>
    </div>
  );
}

function Preview({ p }) {
  const r = p.report || {};
  return (
    <div className="border border-[#E5ECE7] rounded-2xl p-5 bg-white space-y-3">
      <div className="font-semibold text-gray-900">Converted files</div>
      {(r.blocking || []).map((b) => <div key={b} className="text-sm text-red-600">{b}</div>)}
      {(r.warnings || []).map((w) => <div key={w} className="text-sm text-amber-700">{w}</div>)}
      {Object.entries(r.files || {}).map(([name, f]) => (
        <div key={name}>
          <div className="text-sm text-gray-700"><b>{name}.csv</b>: {f.rows} rows{f.unusable_rows ? `, ${f.unusable_rows} unusable` : ""}</div>
          <div className="overflow-x-auto mt-1">
            <table className="text-xs">
              <thead><tr>{f.columns.map((c) => <th key={c} className="text-left px-2 py-1 font-mono text-gray-500">{c}</th>)}</tr></thead>
              <tbody>{(f.preview || []).map((row, i) => <tr key={i} className="border-t border-[#F0F3F1]">{f.columns.map((c) => <td key={c} className="px-2 py-1 whitespace-nowrap">{row[c]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
