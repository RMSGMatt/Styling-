// src/config/apiBase.js

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const mode = String(import.meta?.env?.MODE || "").trim();

  // Accept multiple env names (just in case different files used different ones)
  const envBase = normalize(
    import.meta?.env?.VITE_API_BASE ||
      import.meta?.env?.VITE_API_URL ||
      import.meta?.env?.VITE_BACKEND_URL ||
      import.meta?.env?.VITE_FLASK_BASE
  );

  // ✅ If env exists, always use it (dev/prod)
  if (envBase) return envBase;

  // ✅ PRODUCTION SAFETY:
  // Never allow localhost in production builds (prevents broken auth + gating).
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  // ✅ Local dev only
  return "http://127.0.0.1:5000";
}
