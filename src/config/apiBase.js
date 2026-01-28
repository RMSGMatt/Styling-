// src/config/apiBase.js
// Canonical API base resolver — production safe

function normalize(raw) {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const mode = import.meta?.env?.MODE;
  const envBase = normalize(
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    ""
  );

  // 1) If explicitly provided (prod / preview), ALWAYS use it
  if (envBase) {
    return envBase;
  }

  // 2) Production must NEVER fall back silently
  if (mode === "production") {
    throw new Error(
      "❌ VITE_API_BASE is not set in production. Refusing to fall back."
    );
  }

  // 3) Local dev only
  return "http://127.0.0.1:5000";
}
