/**
 * Decision briefs: one shared store for the brief list, so every trigger card and the dashboard see the same state
 * and only one poll runs while a brief is being prepared.
 */
import { useEffect, useState } from "react";
import { getApiBase } from "../../../config/apiBase";

const token = () => localStorage.getItem("token") || localStorage.getItem("access_token") || "";
const headers = (json) => ({ Authorization: `Bearer ${token()}`, ...(json ? { "Content-Type": "application/json" } : {}) });
const POLL_MS = 8000;

// Triggers that change prices, not supply: there is no shortage to simulate, so no brief.
export const BRIEF_COST_ONLY = new Set(["freight_rate_shock", "lithium_price_spike"]);
export const REPEAT_DAYS = 7;

let state = { briefs: [], usage: null, loaded: false, error: "", owner: null };
const subs = new Set();
let pollTimer = null;
let inflight = null;

const emit = () => subs.forEach((f) => f(state));
const set = (patch) => { state = { ...state, ...patch }; emit(); };

function schedulePoll() {
  clearTimeout(pollTimer);
  if (subs.size && state.briefs.some((b) => b.status === "running")) pollTimer = setTimeout(refreshBriefs, POLL_MS);
}

export function refreshBriefs() {
  if (inflight) return inflight;
  const owner = token();
  if (!owner) return Promise.resolve();
  inflight = (async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/agent/briefs`, { headers: headers() });
      if (!r.ok) { set({ loaded: true, owner, error: r.status === 401 ? "" : "Briefs are not available right now." }); return; }
      const b = await r.json();
      set({ briefs: b.briefs || [], usage: b.usage || null, loaded: true, owner, error: "" });
    } catch {
      set({ loaded: true, owner, error: "Briefs are not available right now." });
    } finally {
      inflight = null;
      schedulePoll();
    }
  })();
  return inflight;
}

/** Start a brief. Returns { ok, status, message, brief }. */
export async function startBrief({ scenario, commodity, label, params, auto = false }) {
  try {
    const r = await fetch(`${getApiBase()}/api/agent/brief`, {
      method: "POST", headers: headers(true),
      body: JSON.stringify({ scenario, commodity, label, params: briefParams(params), auto }),
    });
    const b = await r.json().catch(() => ({}));
    await refreshBriefs();
    const ok = r.status === 202 || b.status === "exists";
    return { ok, status: b.error || b.status, message: b.message || (ok ? "" : "The brief could not be started."), brief: b.brief };
  } catch {
    return { ok: false, status: "error", message: "The brief could not be started. Check your connection." };
  }
}

export async function fetchBrief(id) {
  const r = await fetch(`${getApiBase()}/api/agent/brief/${id}`, { headers: headers() });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.message || "The brief could not be loaded.");
  return b.brief;
}

export async function decideBrief(id, decision, option, reason) {
  const r = await fetch(`${getApiBase()}/api/agent/brief/${id}/decision`, {
    method: "POST", headers: headers(true), body: JSON.stringify({ decision, option, reason }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.message || "The decision could not be saved.");
  refreshBriefs();
  return b.brief;
}

/** Only the three settings the brief uses, from a trigger's default parameters. */
export function briefParams(p = {}) {
  const out = {};
  ["supply_reduction_pct", "duration_weeks", "lead_time_multiplier"].forEach((k) => { if (p[k] != null && p[k] !== "") out[k] = p[k]; });
  // A site outage (from the incident watcher) also names the site and the event behind it.
  ["facility", "source_event"].forEach((k) => { if (p[k]) out[k] = p[k]; });
  return out;
}

/** The newest brief for a trigger (the list comes newest first). */
export function latestBriefFor(briefs, scenario) {
  return (briefs || []).find((b) => (b.trigger || {}).scenario === scenario) || null;
}

export function isRecent(brief, days = REPEAT_DAYS) {
  const t = Date.parse(brief?.created_at || "");
  return Number.isFinite(t) && Date.now() - t < days * 864e5;
}

export function useBriefs() {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    // A different sign-in (or none loaded yet) means the list is stale.
    if (!state.loaded || state.owner !== token()) {
      if (state.owner !== token()) set({ briefs: [], usage: null, loaded: false, owner: null });
      refreshBriefs();
    } else {
      schedulePoll();
    }
    return () => { subs.delete(setS); if (!subs.size) clearTimeout(pollTimer); };
  }, []);
  return s;
}
