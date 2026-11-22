/**
 * The account's own cost figures for decision briefs: expedite and alternate-source premiums, qualification cost
 * and time per cost class, carrying cost, gross margin, and which class a part belongs to. Blank means the FOR-C default.
 */
import React, { useEffect, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const LIME = "#9FD63A";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const TEXT = "#E2E8F0";
const LINE = "rgba(148,163,184,0.18)";
const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const FIELDS = [
  ["expedite_premium_pct", "Expedite premium %", "Extra paid per unit to air-freight or spot-buy"],
  ["alt_price_premium_pct", "Alternate price premium %", "Extra paid per unit from a second source"],
  ["qualification_cost", "Qualification cost $", "One-off cost to qualify a second source"],
  ["qualification_weeks", "Qualification weeks", "Time before a second source can ship"],
];
const input = { width: "100%", background: "#0B1220", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 7px", fontSize: 13 };
const str = (v) => (v == null ? "" : String(v));

export default function BriefCostSettings({ onClose }) {
  const [view, setView] = useState(null);
  const [form, setForm] = useState({});
  const [carry, setCarry] = useState("");
  const [margin, setMargin] = useState("");
  const [parts, setParts] = useState([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = (v) => {
    setView(v);
    const s = v.settings || {};
    const f = {};
    (v.classes || []).forEach((c) => { f[c.key] = Object.fromEntries(FIELDS.map(([k]) => [k, str((s[c.key] || {})[k])])); });
    setForm(f);
    setCarry(s.carrying_rate_annual != null ? str(Math.round(s.carrying_rate_annual * 1000) / 10) : "");
    setMargin(str(s.gross_margin_pct));
    setParts(Object.entries(s.part_classes || {}).map(([sku, cls]) => ({ sku, cls })));
  };

  useEffect(() => {
    fetch(`${getApiBase()}/api/agent/brief-costs`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((b) => (b.classes ? load(b) : setMsg(b.message || "Settings could not be loaded.")))
      .catch(() => setMsg("Settings could not be loaded."));
  }, []);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const save = async () => {
    setSaving(true); setMsg("");
    const body = { ...form, carrying_rate_annual: carry === "" ? "" : Number(carry) / 100, gross_margin_pct: margin,
                   part_classes: Object.fromEntries(parts.filter((p) => p.sku.trim() && p.cls).map((p) => [p.sku.trim(), p.cls])) };
    try {
      const r = await fetch(`${getApiBase()}/api/agent/brief-costs`, {
        method: "PUT", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.message || "The settings could not be saved.");
      load(b);
      setMsg("Saved. Briefs started from now on use these figures.");
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const set = (cls, k, v) => setForm((f) => ({ ...f, [cls]: { ...f[cls], [k]: v } }));
  const classes = view?.classes || [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(2,6,23,0.75)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 16px", overflowY: "auto" }}>
      <style>{".forc-cost input::placeholder{color:#475569;font-style:italic;opacity:1}"}</style>
      <div className="forc-cost" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 860, background: "#0B1220", border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: LIME, textTransform: "uppercase", letterSpacing: "0.08em" }}>Decision briefs</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginTop: 2 }}>Your cost figures</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>Briefs price each response with these. Leave a field blank to use the FOR-C default shown in grey.</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: 0, color: MUTED, fontSize: 18, cursor: "pointer", lineHeight: 1, alignSelf: "flex-start" }} aria-label="Close">×</button>
        </div>

        {!view && !msg && <div className="animate-pulse" style={{ marginTop: 14, color: MUTED, fontSize: 13 }}>Loading…</div>}

        {view && (
          <>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={{ fontSize: 12, color: MUTED }}>
                Gross margin %
                <input style={{ ...input, marginTop: 4 }} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="Not set: briefs use revenue" />
                <span style={{ display: "block", fontSize: 11, color: DIM, marginTop: 3 }}>When set, responses are judged on margin protected, not revenue.</span>
              </label>
              <label style={{ fontSize: 12, color: MUTED }}>
                Carrying cost % a year
                <input style={{ ...input, marginTop: 4 }} inputMode="decimal" value={carry} onChange={(e) => setCarry(e.target.value)} placeholder={str(Math.round((view.default_carrying_rate_annual || 0) * 100))} />
                <span style={{ display: "block", fontSize: 11, color: DIM, marginTop: 3 }}>Cost of holding extra stock, as a share of its value.</span>
              </label>
            </div>

            <div style={{ marginTop: 18, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em" }}>By cost class</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", color: DIM, fontWeight: 500, fontSize: 11, padding: "4px 6px" }}>Class</th>
                    {FIELDS.map(([k, label, tip]) => <th key={k} title={tip} style={{ textAlign: "left", color: DIM, fontWeight: 500, fontSize: 11, padding: "4px 6px" }}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.key} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={{ padding: "6px", color: TEXT, minWidth: 170 }} title={c.note}>{c.label}<div style={{ fontSize: 11, color: DIM }}>{c.note}</div></td>
                      {FIELDS.map(([k]) => (
                        <td key={k} style={{ padding: "6px", minWidth: 110 }}>
                          <input style={input} inputMode="decimal" value={(form[c.key] || {})[k] || ""} onChange={(e) => set(c.key, k, e.target.value)}
                                 placeholder={k === "qualification_cost" ? Number(c.defaults[k]).toLocaleString() : str(c.defaults[k])} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 18, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em" }}>Parts in a different class</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>FOR-C picks a class from the part's commodity and name. Set it here when that is wrong, for example a part that needs a full redesign to second-source.</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {parts.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...input, flex: 1 }} value={p.sku} placeholder="Part number" onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, sku: e.target.value } : y)))} />
                  <select style={{ ...input, flex: 1 }} value={p.cls} onChange={(e) => setParts((x) => x.map((y, j) => (j === i ? { ...y, cls: e.target.value } : y)))}>
                    <option value="">Pick a class</option>
                    {classes.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setParts((x) => x.filter((_, j) => j !== i))} style={{ background: "transparent", border: 0, color: MUTED, cursor: "pointer", fontSize: 16 }} aria-label="Remove">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setParts((x) => [...x, { sku: "", cls: "" }])} style={{ justifySelf: "start", fontSize: 12, color: LIME, background: "transparent", border: "1px dashed rgba(159,214,58,0.4)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                + Add a part
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
              <button type="button" disabled={saving} onClick={save} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: LIME, color: "#0B0F13", border: 0, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <span style={{ fontSize: 12, color: DIM }}>
                Grey italic figures are FOR-C defaults; type over one to use your own.{" "}
                {view.settings?.updated_at ? `Last saved ${view.settings.updated_at.slice(0, 10)}${view.settings.updated_by ? ` by ${view.settings.updated_by}` : ""}.` : "Using FOR-C defaults."} Existing briefs keep the figures they were made with.
              </span>
            </div>
          </>
        )}
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: msg.startsWith("Saved") ? "#86EFAC" : "#FCA5A5" }}>{msg}</div>}
      </div>
    </div>
  );
}
