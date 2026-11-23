// Risk profiles scored on the server (GET /api/risk/profile). The browser no longer scores signals itself:
// one engine, the same numbers on every page and in the scheduler. Concurrent callers share one request,
// and results are reused for a minute so several cards loading at once cost one call.
import { API_BASE } from "./signalSources";

const TTL_MS = 60 * 1000;
const cache = new Map(); // "keys|detail" -> { at, promise }

export function fetchServerProfiles(keys, { detail = false } = {}) {
  const list = [...new Set((keys || []).filter(Boolean))].sort();
  const sig = `${list.join(",")}|${detail ? 1 : 0}`;
  const hit = cache.get(sig);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const qs = new URLSearchParams();
  if (list.length) qs.set("commodities", list.join(","));
  if (detail) qs.set("detail", "1");
  const promise = fetch(`${API_BASE}/api/risk/profile?${qs}`)
    .then((r) => { if (!r.ok) throw new Error(`risk profile HTTP ${r.status}`); return r.json(); })
    .then((d) => d.profiles || {});
  promise.catch(() => cache.delete(sig));
  cache.set(sig, { at: Date.now(), promise });
  return promise;
}

// Shapes a server profile (detail=1) like the old fetchForwardSignals/fetchRegimeSignals results,
// for code that still reads { signals, liveKeys }.
export function signalSetsFromProfile(p) {
  const fwdKeys = Object.keys(p.signals.forward || {});
  const live = p.live_keys || [];
  return {
    fwd: { signals: p.signals.forward, liveKeys: live.filter((k) => fwdKeys.includes(k)), source: p.source },
    reg: { signals: p.signals.regime, liveKeys: live.filter((k) => !fwdKeys.includes(k)), source: p.source },
  };
}
