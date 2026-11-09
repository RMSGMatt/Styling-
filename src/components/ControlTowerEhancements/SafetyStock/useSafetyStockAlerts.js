// ─────────────────────────────────────────────────────────────────────────────
// useSafetyStockAlerts.js
// FOR-C v3 · Reactive access to Safety Stock alerts for Control Tower
//
// localStorage has no built-in reactivity within the same tab, so this
// exposes a refresh() the upload flow calls after saving a new snapshot,
// plus listens for the browser's cross-tab "storage" event as a bonus (e.g.
// if a user has Control Tower open in two tabs and uploads in one).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { loadLatestSnapshot, loadPreviousSnapshot, deriveSafetyStockAlerts, fetchNetworkSafetyStock } from "./safetyStockStore";

export function useSafetyStockAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [latestSnapshot, setLatestSnapshot] = useState(null);

  // A CSV the user uploaded wins; otherwise the days on hand come from the loaded network.
  const refresh = useCallback(async () => {
    let current = loadLatestSnapshot();
    let previous = loadPreviousSnapshot();
    if (!current) {
      const net = await fetchNetworkSafetyStock();
      if (net) { current = net.current; previous = net.previous; }
    }
    setLatestSnapshot(current);
    setAlerts(current ? deriveSafetyStockAlerts(current, previous) : []);
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e) => {
      if (e.key === "forc_safety_stock_snapshots") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return { alerts, latestSnapshot, refresh };
}
