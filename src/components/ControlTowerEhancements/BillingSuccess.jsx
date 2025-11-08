// src/components/ControlTowerEnhancements/BillingSuccess.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;

export default function BillingSuccess() {
  const nav = useNavigate();
  const [status, setStatus] = useState("Finalizing your upgrade…");
  const [tries, setTries] = useState(0);

  // Grab the session id in case you want to show it or log it
  const sessionId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("session_id") || "";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    async function checkMe() {
      // poll up to ~12 seconds total (8 * 1.5s)
      for (let i = 0; i < 8 && !cancelled; i++) {
        setTries((t) => t + 1);
        try {
          const res = await fetch(`${API}/auth/me`, {
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
              "Content-Type": "application/json",
            },
          });
          const me = await res.json();
          if (res.ok && (me?.plan === "pro" || me?.plan === "enterprise")) {
            setStatus(`✅ Upgrade complete — your plan is now ${me.plan.toUpperCase()}. Redirecting…`);
            await sleep(1000);
            nav("/billing", { replace: true });
            return;
          }
        } catch {
          // ignore and retry
        }
        if (!cancelled) {
          setStatus("Waiting for confirmation from Stripe…");
          await sleep(1500);
        }
      }

      if (!cancelled) {
        setStatus("Still processing. You can manage your subscription or refresh the page.");
      }
    }

    checkMe();
    return () => { cancelled = true; };
  }, [nav]);

  return (
    <div className="max-w-xl mx-auto p-8 text-center space-y-4">
      <h1 className="text-2xl font-bold">Payment successful</h1>
      <p className="text-gray-600">{status}</p>
      {sessionId ? (
        <p className="text-xs text-gray-400">Session ID: {sessionId}</p>
      ) : null}
      <div className="pt-4 space-x-3">
        <a
          href="/billing"
          className="inline-block rounded-xl px-4 py-2 border"
        >
          Go to Billing
        </a>
        <a
          href="/"
          className="inline-block rounded-xl px-4 py-2 border"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
