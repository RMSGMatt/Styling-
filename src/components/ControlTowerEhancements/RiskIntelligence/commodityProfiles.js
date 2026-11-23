// Loads the Risk Intelligence score for any commodity tracker, so other views (Control Tower) can show it next to parts.
// Scored on the server; see serverProfiles.js.
import { fetchServerProfiles } from "./serverProfiles";

// -> { key, score, label, color, source: "mock" | "mixed", live_keys, fallback_keys, triggers: [non-nominal, each with live_backed] }
export async function loadCommodityProfile(key) {
  const out = await loadCommodityProfiles([key]);
  return out[key] || null;
}

export async function loadCommodityProfiles(keys) {
  try {
    return await fetchServerProfiles(keys);
  } catch {
    return {}; // leave unscored, as before when signals failed
  }
}
