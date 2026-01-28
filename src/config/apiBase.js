// src/config/apiBase.js

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const mode = import.meta?.env?.MODE || "";
  const envBase = normalize(import.meta?.env?.VITE_API_BASE);

  // ✅ If env is set, always use it (dev/prod/preview)
  if (envBase) return envBase;

  // ✅ In production, NEVER fall back to localhost (prevents exactly this issue)
  // If env is missing in prod, default to your Render backend.
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  // ✅ Dev fallback only
  return "http://127.0.0.1:5000";
}
