import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000";

// 🔐 Token helpers
const token = () => localStorage.getItem("token");
const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });
const authMultipart = () => ({
  headers: {
    Authorization: `Bearer ${token()}`,
    "Content-Type": "multipart/form-data"
  }
});

// 📌 List scenarios for current user
export const listScenarios = () =>
  axios.get(`${API_BASE}/api/scenarios`, auth());

// 📌 Save or overwrite scenario
export const saveScenario = (name, data) =>
  axios.post(`${API_BASE}/api/scenarios`, { name, data }, auth());

// 📌 Load single scenario JSON
export const loadScenario = (id) =>
  axios.get(`${API_BASE}/api/scenarios/${id}`, auth());

// 📌 Run simulation with or without scenario
export const runSimulationWithScenario = (files, scenario = null) => {
  const fd = new FormData();
  Object.entries(files).forEach(([k, v]) => fd.append(k, v));
  if (scenario) fd.append("scenario", JSON.stringify(scenario));
  return axios.post(`${API_BASE}/api/run`, fd, authMultipart());
};
