// src/config/apiBase.js

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const mode = import.meta?.env?.MODE || "";
  const envBase = normalize(import.meta?.env?.VITE_API_BASE);

  // 1) If env var exists, always use it
  if (envBase) return envBase;

  // 2) In production, NEVER allow localhost
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  // 3) Local dev only
  return "http://127.0.0.1:5000";
}
