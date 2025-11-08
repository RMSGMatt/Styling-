// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: false,
});

// Attach token on every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const Auth = {
  async login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    // some backends return token at data.token, others at data.access_token — support both:
    const token = data.token || data.access_token;
    if (token) localStorage.setItem("token", token);
    return data;
  },
  me() {
    return api.get("/auth/me").then((r) => r.data);
  },
  logout() {
    localStorage.removeItem("token");
  },
};

export const Sim = {
  list() {
    return api.get("/api/simulations").then((r) => r.data);
  },
  run(formData) {
    return api.post("/api/run", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
};

export default api;
