import axios from "axios";

import { getApiBase } from "./config/apiBase";
const API_BASE = getApiBase();

let upgradeHandler = null;

export function setUpgradeHandler(fn) {
  upgradeHandler = fn;
}

export const api = axios.create({
  baseURL: API_BASE,
  // IMPORTANT: do NOT force JSON globally; it breaks FormData uploads
  // headers: { "Content-Type": "application/json" },
});

// Attach JWT automatically
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token");

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // ✅ If this request is FormData, remove any Content-Type so axios sets boundary correctly
  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isFormData) {
    delete config.headers["Content-Type"];
    delete config.headers["content-type"];
  } else {
    // Default JSON for non-FormData requests
    if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
      config.headers["Content-Type"] = "application/json";
    }
  }

  return config;
});

// Global “revenue gate” handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data || {};

    // ✅ Broaden detection so it works with various backend shapes
    const isUpgrade =
      status === 402 &&
      (data?.error === "upgrade_required" ||
        data?.code === "upgrade_required" ||
        data?.message === "upgrade_required" ||
        data?.upgrade_required === true);

    if (isUpgrade && typeof upgradeHandler === "function") {
      upgradeHandler({
        required: data.required || ["pro"],
        plan: data.plan || "free",
        status,
      });
    }

    return Promise.reject(err);
  }
);
