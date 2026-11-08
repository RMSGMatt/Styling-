import React, { useEffect, useState, useCallback } from "react";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never");

// Keys let an ERP job or script refresh this network's data without a login. A key is shown once, then only its label is kept.
export default function IngestKeysCard({ apiBase }) {
  const [keys, setKeys] = useState([]);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("access_token") || ""}` });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/ingest-keys`, { headers: auth() });
      const body = await res.json().catch(() => ({}));
      if (body.status === "ok") setKeys(body.keys);
    } catch { /* leave list as is */ }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setErr(""); setCopied(false);
    try {
      const res = await fetch(`${apiBase}/api/ingest-keys`, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify({ label }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr((body.errors || ["Could not create the key."])[0]); return; }
      setFresh(body); setLabel(""); load();
    } catch { setErr("Could not create the key."); }
  };
  const revoke = async (id) => {
    setErr("");
    try {
      const res = await fetch(`${apiBase}/api/ingest-keys/${id}`, { method: "DELETE", headers: auth() });
      if (!res.ok) { setErr("Could not revoke the key."); return; }
      setConfirmId(null); if (fresh?.id === id) setFresh(null); load();
    } catch { setErr("Could not revoke the key."); }
  };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } };

  const box = { borderColor: "rgba(148,163,184,0.15)", background: "rgba(9,25,19,0.5)" };
  const btn = { borderColor: "rgba(159,214,58,0.35)", color: "#9FD63A" };
  const curl = fresh ? `curl -H "X-API-Key: ${fresh.key}" -F customer_orders=@customer_orders.csv ${apiBase}/api/ingest/refresh` : "";

  return (
    <section className="mb-6 rounded-2xl border px-5 py-4" style={box} data-testid="ingest-keys-block">
      <h2 className="text-xl font-semibold" style={{ color: "#9FD63A" }}>Automatic refresh keys</h2>
      <div className="text-sm" style={{ color: "#64748B" }}>Let an ERP export or a script send fresh files without logging in. Treat a key like a password.</div>

      {fresh && (
        <div className="mt-3 rounded-xl px-3 py-3 border" style={{ borderColor: "rgba(252,211,77,0.4)", background: "rgba(252,211,77,0.06)" }}>
          <div className="text-xs font-semibold" style={{ color: "#FCD34D" }}>Copy this key now. It is not shown again.</div>
          <code className="block mt-1 text-xs break-all" style={{ color: "#E2E8F0" }}>{fresh.key}</code>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => copy(fresh.key)} className="px-3 py-1 rounded-lg text-xs font-semibold border" style={btn}>{copied ? "Copied" : "Copy key"}</button>
            <button type="button" onClick={() => copy(curl)} className="px-3 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: "rgba(148,163,184,0.3)", color: "#94A3B8" }}>Copy example command</button>
            <button type="button" onClick={() => setFresh(null)} className="px-3 py-1 rounded-lg text-xs border" style={{ borderColor: "rgba(148,163,184,0.3)", color: "#94A3B8" }}>Done</button>
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {keys.map((k) => (
          <li key={k.id} className="rounded-xl px-3 py-2 flex items-center gap-3" style={{ background: "rgba(2,6,23,0.35)" }}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold" style={{ color: "#E2E8F0" }}>{k.label}</span>
              <span className="block text-xs" style={{ color: "#64748B" }}>Created {fmt(k.created_at)} · last used {fmt(k.last_used)}</span>
            </span>
            {confirmId === k.id ? (
              <span className="flex gap-2">
                <button type="button" onClick={() => revoke(k.id)} className="px-3 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: "#EF4444", color: "#FCA5A5" }}>Revoke</button>
                <button type="button" onClick={() => setConfirmId(null)} className="px-3 py-1 rounded-lg text-xs border" style={{ borderColor: "rgba(148,163,184,0.3)", color: "#94A3B8" }}>Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmId(k.id)} className="px-3 py-1 rounded-lg text-xs border" style={{ borderColor: "rgba(148,163,184,0.3)", color: "#94A3B8" }}>Revoke</button>
            )}
          </li>
        ))}
        {keys.length === 0 && <li className="text-sm" style={{ color: "#94A3B8" }}>No keys yet.</li>}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Label, for example SAP nightly export" className="rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[220px]" style={{ background: "#0B1F17", color: "#E2E8F0", border: "1px solid rgba(148,163,184,0.3)" }} />
        <button type="button" onClick={create} disabled={keys.length >= 5} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ ...btn, opacity: keys.length >= 5 ? 0.5 : 1 }}>Create key</button>
      </div>
      {err && <p className="mt-2 text-xs" style={{ color: "#FCA5A5" }}>{err}</p>}
      <p className="mt-2 text-[11px]" style={{ color: "#64748B" }}>Up to 5 keys. Revoking a key stops it immediately.</p>
    </section>
  );
}
