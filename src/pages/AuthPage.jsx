// src/pages/AuthPage.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/**
 * AuthPage.jsx
 * - Single-source API base resolution via getApiBase()
 * - No localhost fallback in production (handled in config/apiBase.js)
 * - Tight request/response diagnostics
 * - Persists token/role/plan/userName to localStorage
 * - Keeps UI behavior unchanged
 */

// -----------------------------
// API base (canonical)
// -----------------------------
import { getApiBase } from "../config/apiBase";

const API_BASE = getApiBase();

// Expose for quick console verification
window.__API_BASE_DEBUG__ = API_BASE;

console.log(
  "AuthPage → API_BASE =",
  API_BASE,
  "| MODE =",
  import.meta.env.MODE,
  "| VITE_API_BASE =",
  import.meta.env.VITE_API_BASE
);

// -----------------------------
// Axios helper with tight diagnostics
// -----------------------------
async function postJson(url, body) {
  try {
    const res = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
      // withCredentials: true, // only if you later move to cookie auth
    });
    return res;
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message =
      data?.message ||
      data?.error ||
      err?.message ||
      "Request failed. Check console/server logs.";

    console.error("❌ Auth request failed:", {
      url,
      status,
      data,
      message: err?.message,
    });

    const e = new Error(message);
    e.status = status;
    e.data = data;
    throw e;
  }
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [error, setError] = useState("");
  const [signupError, setSignupError] = useState("");

  const navigate = useNavigate();

  // Build URLs in one place, safely
  const endpoints = useMemo(() => {
    const base = String(API_BASE || "").trim().replace(/\/+$/, "");
    return {
      login: `${base}/auth/login`,
      // ✅ Correct backend route
      signup: `${base}/auth/register`,
    };
  }, []);

  const saveAuthAndProceed = ({ token, role, plan, emailOrName }) => {
    if (!token) throw new Error("No token returned from server");

    // ✅ Persist auth for gating & API calls
    localStorage.setItem("token", token);
    if (role) localStorage.setItem("role", role);
    if (plan) localStorage.setItem("plan", plan);
    if (emailOrName) localStorage.setItem("userName", emailOrName);

    try {
      onLogin?.();
    } catch (e) {
      console.warn("onLogin callback threw:", e);
    }

    navigate("/control-tower");
  };

  const handleLogin = async () => {
    setError("");

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      setError("Please enter email + password");
      return;
    }

    try {
      console.log("POST →", endpoints.login);

      const res = await postJson(endpoints.login, { email, password });

      // Backend returns: { token, role, plan } (or { access_token })
      const token = res.data?.token || res.data?.access_token;
      const role = res.data?.role;
      const plan = res.data?.plan;

      if (!token) throw new Error(res.data?.message || "Login failed");

      saveAuthAndProceed({
        token,
        role,
        plan,
        emailOrName: email,
      });
    } catch (err) {
      setError(err.message || "Login error");
    }
  };

  const handleSignup = async () => {
    setSignupError("");

    const name = signupName.trim();
    const email = signupEmail.trim();
    const password = signupPassword;

    if (!name || !email || !password) {
      setSignupError("Please fill out all fields");
      return;
    }

    try {
      console.log("POST →", endpoints.signup);

      // Backend register
      await postJson(endpoints.signup, { email, password });

      // If register doesn’t return a token, auto-login
      console.log("POST →", endpoints.login);

      const loginRes = await postJson(endpoints.login, { email, password });

      const token = loginRes.data?.token || loginRes.data?.access_token;
      const role = loginRes.data?.role;
      const plan = loginRes.data?.plan;

      if (!token)
        throw new Error(loginRes.data?.message || "Signup/login failed");

      saveAuthAndProceed({
        token,
        role,
        plan,
        emailOrName: name || email,
      });
    } catch (err) {
      setSignupError(err.message || "Signup error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFDF8] px-4">
      <style>{`
        @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        .blinking-eye { animation: blink 5s infinite; transform-origin: center; }
      `}</style>

      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6 space-y-3">
          <div className="bg-white p-2 rounded-full">
            <img
              src="/eye-logo.png"
              alt="Eye Logo"
              className="h-16 w-16 object-contain blinking-eye"
            />
          </div>
          <img
            src="/logo.png"
            alt="FOR-C Logo"
            className="h-10 object-contain"
          />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">
          {mode === "login" ? "Log In to FOR-C" : "Create Your FOR-C Account"}
        </h2>

        {mode === "signup" && (
          <input
            type="text"
            placeholder="Full Name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            className="border w-full p-2 mb-3 rounded"
          />
        )}

        <input
          type="email"
          placeholder="Email Address"
          value={mode === "login" ? loginEmail : signupEmail}
          onChange={(e) =>
            mode === "login"
              ? setLoginEmail(e.target.value)
              : setSignupEmail(e.target.value)
          }
          className="border w-full p-2 mb-3 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={mode === "login" ? loginPassword : signupPassword}
          onChange={(e) =>
            mode === "login"
              ? setLoginPassword(e.target.value)
              : setSignupPassword(e.target.value)
          }
          className="border w-full p-2 mb-4 rounded"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              mode === "login" ? handleLogin() : handleSignup();
            }
          }}
        />

        {mode === "login" && error && (
          <div className="text-red-600 text-sm mb-2">{error}</div>
        )}
        {mode === "signup" && signupError && (
          <div className="text-red-600 text-sm mb-2">{signupError}</div>
        )}

        <button
          onClick={mode === "login" ? handleLogin : handleSignup}
          className="w-full bg-[#1D625B] text-white py-2 rounded hover:bg-[#155248]"
        >
          {mode === "login" ? "Log In" : "Sign Up"}
        </button>

        <div className="mt-4 text-sm text-center">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => {
                  setError("");
                  setSignupError("");
                  setMode("signup");
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => {
                  setError("");
                  setSignupError("");
                  setMode("login");
                }}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
