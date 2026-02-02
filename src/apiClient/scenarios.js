function getAuthToken() {
  const t =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    sessionStorage.getItem("token") ||
    "";
  return typeof t === "string" ? t.trim() : "";
}

function requireToken() {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token found. Please login again.");
  return token;
}

function getApiBase() {
  // Your logs show API_BASE = https://supply-chain-simulator.onrender.com
  return (
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    "https://supply-chain-simulator.onrender.com"
  );
}

async function safeJson(res) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { _raw: txt };
  }
}

async function request(path, options = {}) {
  const token = requireToken();
  const base = getApiBase();
  const url = `${base}${path}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await safeJson(res);

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return { data };
}

export function listScenarios() {
  return request("/api/scenarios");
}

export function loadScenario(id) {
  return request(`/api/scenarios/${id}`);
}

export function saveScenario(payload) {
  return request("/api/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteScenario(id) {
  return request(`/api/scenarios/${id}`, { method: "DELETE" });
}
