import React, { useCallback, useEffect, useState } from "react";
import { getApiBase } from "../../config/apiBase";

/**
 * Agents add-on: entitlement, this month's usage, and add/remove.
 * Reads GET /api/agents/status; POST / DELETE /api/agents/addon change the Stripe subscription.
 */

const API_BASE = getApiBase();

async function call(path, method = "GET") {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || body?.message || res.statusText);
  return body;
}

const money = (n) => `$${Number(n || 0).toLocaleString()}`;

const SOURCE_LABEL = {
  admin: "Included (admin)",
  addon: "Active",
  pilot: "Included in your pilot",
  plan: "Included in your plan",
  none: "Not active",
};

function Meter({ label, used, limit, note }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-[#9FD63A]";
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-slate-300">{label}</div>
        <div className="text-sm font-semibold text-slate-100">
          {limit > 0 ? `${used} of ${limit}` : "Not included"}
        </div>
      </div>
      <div className="h-1.5 rounded bg-slate-800 mt-2 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {note && <div className="text-xs text-slate-500 mt-2">{note}</div>}
    </div>
  );
}

export default function AgentsAddonPanel({ onChange, onStatus }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/agents/status");
      setData(d);
      onStatus?.(d);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the agents status.");
    }
  }, [onStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function change(add) {
    const ent = data?.entitlement || {};
    const msg = add
      ? `Add the agents to your ${ent.plan} plan for ${money(ent.price_usd)} a month? Stripe charges a prorated amount for the rest of this billing period.`
      : "Remove the agents add-on? Ask your network, decision briefs, the incident watcher and the supplier scout stop at once. Stripe credits the unused part of this period.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await call("/api/agents/addon", add ? "POST" : "DELETE");
      await load();
      onChange?.();
    } catch (e) {
      setError(e.message || "Could not change the add-on.");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <div className="animate-pulse h-32 rounded-2xl bg-slate-800" />;
  }

  const ent = data?.entitlement || {};
  const u = data?.usage || {};
  const paid = ["pro", "enterprise"].includes(ent.plan);
  const showBuy = ent.required && ent.can_buy && !ent.has_agents;
  const showRemove = ent.source === "addon";

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Agents add-on</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded font-semibold border ${
                ent.has_agents
                  ? "bg-[#2EC4A6]/20 text-[#9FD63A] border-[#2EC4A6]/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {SOURCE_LABEL[ent.source] || "Not active"}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Ask your network, decision briefs, the incident watcher and the supplier scout. {money(500)} a month on
            Pro, {money(1500)} a month on Enterprise. The agents recommend; a person approves every action.
          </p>
        </div>
        <div className="flex gap-2">
          {showBuy && (
            <button
              onClick={() => change(true)}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-[#9FD63A] text-[#11200A] hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Adding…" : `Add agents (${money(ent.price_usd)}/mo)`}
            </button>
          )}
          {showRemove && (
            <button
              onClick={() => change(false)}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Removing…" : "Remove add-on"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {!paid && ent.source !== "admin" && (
        <div className="text-sm text-slate-400">
          The agents need a Pro or Enterprise plan. Choose a plan below and tick "Include the agents add-on".
        </div>
      )}

      {data?.ai_off && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          AI features are switched off for this account, so no network data is sent to the AI provider. Briefs are
          written from the simulation figures, watcher matches are marked not reviewed, and Ask and the scout are
          unavailable.
        </div>
      )}

      {ent.has_agents && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Meter label="Questions this month" used={u.ask?.used || 0} limit={u.ask?.limit || 0} />
          <Meter
            label="Briefs you started"
            used={u.briefs?.used || 0}
            limit={u.briefs?.limit || 0}
            note="Briefs started by risk triggers don't count."
          />
          <Meter label="Supplier searches" used={u.scout?.used || 0} limit={u.scout?.limit || 0} />
          <Meter
            label="Watcher reviews today"
            used={u.watch?.reviews_today || 0}
            limit={u.watch?.cap || 0}
            note="Resets at midnight UTC. Matches past the cap are logged as not reviewed."
          />
        </div>
      )}
    </div>
  );
}
