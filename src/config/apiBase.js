// src/config/apiBase.js
// Canonical API base resolver.
// - Prod MUST never fall back to localhost.
// - Local dev can use localhost when env is unset.

export function getApiBase() {
  const env =
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    "";

  const mode = import.meta?.env?.MODE || "development";

  // If env is provided, always trust it.
  if (env && typeof env === "string") return env.replace(/\/$/, "");

  // Hard-safe defaults
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  return "http://127.0.0.1:5000";
}
