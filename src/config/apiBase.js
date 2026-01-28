// src/config/apiBase.js

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  // IMPORTANT:
  // Do NOT use optional chaining here.
  // Vite only injects env values for direct `import.meta.env.*` access.
  const mode = String(import.meta.env.MODE || "").trim();

  const rawEnv =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_FLASK_BASE ||
    "";

  const envBase = normalize(rawEnv);

  // Debug once
  if (!window.__API_BASE_FINGERPRINT__) {
    window.__API_BASE_FINGERPRINT__ = {
      mode,
      rawEnv: rawEnv ? `${String(rawEnv).slice(0, 60)}…` : "",
      hasEnv: Boolean(envBase),
    };
    console.log("[apiBase] fingerprint:", window.__API_BASE_FINGERPRINT__);
  }

  // 1) If env exists, always use it
  if (envBase) return envBase;

  // 2) Production safety fallback
  if (mode === "production") {
    return "https://supply-chain-simulator.onrender.com";
  }

  // 3) Local dev only
  return "http://127.0.0.1:5000";
}
