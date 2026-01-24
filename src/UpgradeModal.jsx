// src/UpgradeModal.js
import React, { useState } from "react";
import { api } from "./apiClient";

export default function UpgradeModal({
  open,
  required = ["pro"],
  plan = "free",
  onClose,
  onBackToControlTower,
}) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const requiredLabel = Array.isArray(required) ? required.join(" / ") : String(required);

  // Choose the right priceId based on what the backend says is required.
  // (Defaults to Pro if anything is unclear.)
  const priceId =
    (Array.isArray(required) && required.includes("enterprise")
      ? import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE
      : import.meta.env.VITE_STRIPE_PRICE_PRO) || import.meta.env.VITE_STRIPE_PRICE_PRO;

  async function startCheckout() {
    try {
      setBusy(true);

      // Backend wants a returnUrl (where Stripe sends the user back)
      // Prefer env var if you set it (Vercel), else fall back to current origin (local).
      const returnUrl =
        (import.meta.env.VITE_STRIPE_RETURN_URL || window.location.origin).replace(/\/$/, "");

      if (!priceId) {
        alert(
          "Missing Stripe price ID.\n\nSet VITE_STRIPE_PRICE_PRO (and optionally VITE_STRIPE_PRICE_ENTERPRISE) in your frontend .env."
        );
        return;
      }

      // Backend expects: { priceId, returnUrl }
      const res = await api.post("/api/create-checkout-session", { priceId, returnUrl });
      const url = res?.data?.url;

      if (!url) {
        alert("Checkout session did not return a URL.");
        return;
      }

      window.location.href = url;
    } catch (e) {
      console.error("❌ Checkout error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Unable to start checkout. Check backend logs.";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  async function openCustomerPortal() {
    try {
      setBusy(true);
      const returnUrl =
        (import.meta.env.VITE_STRIPE_RETURN_URL || window.location.origin).replace(/\/$/, "");

      const res = await api.post("/api/customer-portal", { returnUrl });
      const url = res?.data?.url;

      if (!url) {
        alert("Customer portal did not return a URL.");
        return;
      }

      window.location.href = url;
    } catch (e) {
      console.error("❌ Portal error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Unable to open billing portal.";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 16,
          background: "#0b1220",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#E6F7EF" }}>
              Upgrade required
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(230,247,239,0.75)" }}>
              Your current plan is{" "}
              <b style={{ color: "#E6F7EF" }}>{plan}</b>. This feature requires{" "}
              <b style={{ color: "#E6F7EF" }}>{requiredLabel}</b>.
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "rgba(230,247,239,0.85)",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: busy ? "not-allowed" : "pointer",
              height: 36,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            background: "rgba(86, 244, 177, 0.10)",
            border: "1px solid rgba(86, 244, 177, 0.22)",
            color: "#E6F7EF",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <b>FOR-C Pro</b> unlocks simulations, scenario save/load, and full report downloads. If
          you already subscribed, use <b>Manage Billing</b>.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={startCheckout}
            disabled={busy}
            style={{
              background: busy ? "rgba(86,244,177,0.55)" : "rgba(86,244,177,0.95)",
              border: "1px solid rgba(86,244,177,0.55)",
              color: "#062014",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working…" : "Upgrade"}
          </button>

          <button
            onClick={openCustomerPortal}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "rgba(230,247,239,0.90)",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Manage Billing
          </button>

          <button
            onClick={onBackToControlTower}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(230,247,239,0.75)",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Back to Control Tower
          </button>
        </div>
      </div>
    </div>
  );
}
