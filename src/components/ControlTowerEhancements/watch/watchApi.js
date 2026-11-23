// Incident watcher API and shared wording (Phase 3).
import { getApiBase } from "../../../config/apiBase";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}`, "Content-Type": "application/json" });

export async function fetchWatch() {
  const r = await fetch(`${getApiBase()}/api/watch`, { headers: headers() });
  if (!r.ok) throw new Error(`watch HTTP ${r.status}`);
  return (await r.json()).entries || [];
}

export async function fetchReviewQueue(status = "pending_review") {
  const r = await fetch(`${getApiBase()}/api/admin/watch?status=${encodeURIComponent(status)}`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 403 ? "Admins only." : `HTTP ${r.status}`);
  return r.json();
}

export async function reviewEntry(id, action, note = "") {
  const r = await fetch(`${getApiBase()}/api/admin/watch/${id}/review`, { method: "POST", headers: headers(), body: JSON.stringify({ action, note }) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`);
  return b.entry;
}

export const LEVEL_LABEL = { direct: "Near your site", supplier: "Names your site or supplier", commodity: "Your commodity" };
export const IMPACT_LABEL = { site_down: "Site may be down", logistics: "Logistics", market_tightening: "Market tightening", none: "Not relevant" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(s) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 16);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// "40% of output for 3 weeks"
export function outageText(t) {
  const p = (t && t.params) || {};
  if (p.supply_reduction_pct == null) return "";
  return `${Math.round(p.supply_reduction_pct * 100)}% of output for ${p.duration_weeks} weeks`;
}
