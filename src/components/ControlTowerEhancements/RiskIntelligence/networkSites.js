// The user's own sites, read from the loaded network, so a corridor scenario points at a real facility.
import Papa from "papaparse";
import { getApiBase } from "../../../config/apiBase";

export async function fetchNetworkSites() {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
    const res = await fetch(`${getApiBase()}/api/network-snapshot/sim-inputs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.files?.locations) return { ok: false, sites: [], start: null };
    const rows = Papa.parse(body.files.locations, { header: true, skipEmptyLines: true }).data || [];
    const sites = rows
      .map((r) => ({
        facility: String(r.Facility || r.facility || "").trim(),
        country: String(r.Country || r.country || "").trim(),
        tier: Number(String(r.Tier || r.tier || "").replace(/\D/g, "")) || null,
      }))
      .filter((s) => s.facility);
    return { ok: sites.length > 0, sites, start: body?.summary?.start ? String(body.summary.start).slice(0, 10) : null };
  } catch {
    return { ok: false, sites: [], start: null };
  }
}

const norm = (s) => String(s || "").trim().toLowerCase();

// A site in the origin country, preferring the most upstream tier.
export function pickSiteInCountry(sites, countryName) {
  const c = norm(countryName);
  if (!c) return null;
  const hits = (sites || []).filter((s) => {
    const sc = norm(s.country);
    return sc && (sc === c || sc.includes(c) || c.includes(sc));
  });
  if (!hits.length) return null;
  return [...hits].sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
}

// The site closest to the customer, used when the origin has no site of its own.
export function defaultReceivingSite(sites) {
  return [...(sites || [])].sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99))[0] || null;
}

// A disruption window that falls inside the loaded data: starts two weeks after the data does.
export function disruptionWindow(startIso, days = 60) {
  if (!startIso) return null;
  const d = new Date(`${String(startIso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 14);
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + days);
  return { start, end: d.toISOString().slice(0, 10) };
}
