import api from "./api"; // IMPORTANT: shared axios instance

function getAuthToken() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt") ||
    sessionStorage.getItem("token") ||
    "";

  return typeof token === "string" ? token.trim() : "";
}

function requireAuthHeaders() {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No auth token found. Please login again.");
  }
  return { Authorization: `Bearer ${token}` };
}

export function listScenarios() {
  return api.get("/api/scenarios", {
    headers: requireAuthHeaders(),
  });
}

export function loadScenario(id) {
  return api.get(`/api/scenarios/${id}`, {
    headers: requireAuthHeaders(),
  });
}

export function saveScenario(payload) {
  return api.post("/api/scenarios", payload, {
    headers: requireAuthHeaders(),
  });
}

export function deleteScenario(id) {
  return api.delete(`/api/scenarios/${id}`, {
    headers: requireAuthHeaders(),
  });
}
