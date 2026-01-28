// src/config/apiBase.js

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const mode = String(import.meta?.env?.MODE || "").trim();

  const rawEnv =
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    import.meta?.env?.VITE_BACKEND_URL ||
    import.meta?.env?.VITE_FLASK_BASE ||
    "";

  const envBase = normalize(rawEnv);

  // Build fingerprint (baked into bundle)
  const fingerprint = {
    mode,
    rawEnv: rawEnv ? `${String(rawEnv).slice(0, 40)}…` : "",
    hasEnv: Boolean(envBase),
  };

  // Log once
  if (!window.__API_BASE_FINGERPRINT__) {
    window.__API_BASE_FINGERPRINT__ = fingerprint;
    console.log("[apiBase] fingerprint:", fingerprint);
  }

  if (envBase) return envBase;

  // Production safety fallback
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  return "http://127.0.0.1:5000";
}
