// ─────────────────────────────────────────────────────────────────────────────
// safetyStockStore.js
// FOR-C v3 · Live Safety Stock monitoring for Control Tower
//
// Deliberately separate from safety_stock_engine.py / SimulationDashboard's
// optimizer. That's a heavyweight POST-based recommendation engine tied to a
// specific simulation run's uploaded CSVs (lanes/demand/bom/etc.) — this is
// meant to be Control Tower's real, ground-truth "where do things actually
// stand right now" monitor. Per direction: Control Tower = real data,
// Simulation Dashboard = simulated data. These should never feed each other.
//
// PLACEHOLDER PERSISTENCE: snapshots live in localStorage for now. This is
// explicitly a stand-in until either (a) users upload periodic CSVs against
// a real backend endpoint, or (b) a live ERP feed exists. The adapter seam
// is loadLatestSnapshot()/saveSnapshot() below — when real persistence
// exists, only the internals of those two functions need to change. Nothing
// in the alert-derivation logic or the UI layer needs to know or care where
// a snapshot actually came from.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "forc_safety_stock_snapshots";
const MAX_SNAPSHOTS_KEPT = 2; // current + previous, for % change comparison. v1 is intentionally simple — see note below on why this isn't more.

export const DEFAULT_DOH_FLOOR = 8; // matches the default used in SimulationDashboard's optimizer for consistency, though this monitor computes independently

// v1 alert thresholds — single-snapshot comparison, no multi-snapshot
// confirmation. This means a single noisy delta (e.g. a big PO receipt or a
// heavy consumption day) can trigger WATCH/ACT on its own. Deliberately
// accepted for v1 rather than adding multi-snapshot confirmation logic
// up front — revisit once real data shows what's actually noisy vs.
// meaningful. Percentages tightened once already (15/25 -> 20/30) before
// any real data existed to calibrate against; treat these as a starting
// point, not a calibrated constant.
export const WATCH_DROP_PCT = 20;
export const ACT_DROP_PCT = 30;

// ── Adapter seam ────────────────────────────────────────────────────────────
export function loadSnapshots() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadLatestSnapshot() {
  const snapshots = loadSnapshots();
  return snapshots[snapshots.length - 1] || null;
}

export function loadPreviousSnapshot() {
  const snapshots = loadSnapshots();
  return snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
}

// Persists a new snapshot, keeping only the most recent MAX_SNAPSHOTS_KEPT.
// `source` is always disclosed alongside the data it produces — "csv_upload"
// today, "erp_live" reserved for when that integration exists — so the UI
// never has to guess whether a number is real-time or a manual upload.
export function saveSnapshot({ rows, source = "csv_upload" }) {
  const snapshots = loadSnapshots();
  const next = [...snapshots, { timestamp: new Date().toISOString(), source, rows }].slice(-MAX_SNAPSHOTS_KEPT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("❌ Failed to persist safety stock snapshot:", e);
  }
  return next[next.length - 1];
}

export function clearSnapshots() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ── CSV parsing ──────────────────────────────────────────────────────────────
// Mirrors the case-insensitive field lookup already used in
// SimulationDashboard.jsx's buildSafetyStockPayload — different CSV exports
// use inconsistent header casing/naming, so match defensively rather than
// assume one fixed schema.
const pickField = (row, candidates) => {
  const keys = Object.keys(row || {});
  for (const candidate of candidates) {
    const match = keys.find((k) => k.toLowerCase().trim() === candidate.toLowerCase());
    if (match !== undefined && row[match] !== undefined && row[match] !== "") return row[match];
  }
  return undefined;
};

// Converts parsed CSV rows (from Papa.parse) into the internal snapshot row
// shape. Returns { rows, skipped } — skipped rows (missing facility/sku/DOH)
// are reported so the upload UI can tell the user something didn't parse
// instead of silently dropping rows.
export function normalizeCsvRows(parsedRows) {
  const rows = [];
  let skipped = 0;

  for (const r of parsedRows || []) {
    const facility = pickField(r, ["facility", "location", "plant"]);
    const sku = pickField(r, ["sku", "material", "part_number", "part"]);
    const current_doh = Number(pickField(r, ["current_doh", "doh", "days_on_hand", "days on hand"]));
    const doh_floor = Number(pickField(r, ["doh_floor", "floor", "safety_stock_floor_days", "min_doh"]));

    if (!facility || !sku || !Number.isFinite(current_doh)) {
      skipped++;
      continue;
    }

    rows.push({
      facility: String(facility).trim(),
      sku: String(sku).trim(),
      current_doh,
      doh_floor: Number.isFinite(doh_floor) ? doh_floor : null, // null = fall back to DEFAULT_DOH_FLOOR at alert-derivation time
    });
  }

  return { rows, skipped };
}

// ── Alert derivation ─────────────────────────────────────────────────────────
// v1 only alerts on DROPS. A DOH rise is a different problem (excess
// inventory / tied-up working capital), not a shortage risk, and
// deliberately doesn't share ACT/ESCALATE urgency with shortage alerts —
// explicitly out of scope for v1 rather than silently ignored.
//
// Floor breach is evaluated independent of trend — being currently below
// floor is actionable on its own even on a first upload with no previous
// snapshot to compare against. The % drop check requires a previous
// snapshot; without one, only floor-breach alerts are possible.
export function deriveSafetyStockAlerts(currentSnapshot, previousSnapshot) {
  if (!currentSnapshot?.rows?.length) return [];

  const prevByKey = {};
  (previousSnapshot?.rows || []).forEach((r) => {
    prevByKey[`${r.facility}::${r.sku}`] = r;
  });

  const alerts = [];

  for (const row of currentSnapshot.rows) {
    const floor = row.doh_floor ?? DEFAULT_DOH_FLOOR;
    const belowFloor = row.current_doh < floor;

    const prev = prevByKey[`${row.facility}::${row.sku}`];
    let dropPct = null;
    if (prev && prev.current_doh > 0) {
      const pctChange = ((row.current_doh - prev.current_doh) / prev.current_doh) * 100;
      if (pctChange < 0) dropPct = Math.abs(pctChange);
    }

    let severity = null;
    if (belowFloor && dropPct != null && dropPct > ACT_DROP_PCT) severity = "escalate";
    else if (belowFloor || (dropPct != null && dropPct > ACT_DROP_PCT)) severity = "act";
    else if (dropPct != null && dropPct >= WATCH_DROP_PCT) severity = "watch";

    if (!severity) continue;

    alerts.push({
      id: `ss:${row.facility}::${row.sku}`,
      severity,
      facility: row.facility,
      sku: row.sku,
      current_doh: row.current_doh,
      floor,
      belowFloor,
      dropPct,
      source: currentSnapshot.source,
    });
  }

  // Escalate > act > watch, consistent with everywhere else this vocabulary is used.
  const order = { escalate: 0, act: 1, watch: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return alerts;
}
