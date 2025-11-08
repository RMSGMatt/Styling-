// lib/runResultsStore.js
const KEY = "simulation_runs";

export function getRuns() {
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}
export function saveRun(run) {
  const runs = getRuns();
  runs.unshift(run);
  localStorage.setItem(KEY, JSON.stringify(runs));
}
export function deleteRun(id) {
  const runs = getRuns().filter(r => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(runs));
}
export function clearRuns() {
  localStorage.removeItem(KEY);
}
