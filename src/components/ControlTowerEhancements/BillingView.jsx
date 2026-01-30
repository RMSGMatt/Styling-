import React, { useEffect, useMemo, useState } from "react";

/**
 * BillingView – polished UI
 * - All logic preserved
 * - Enhanced card design, spacing, hover & brand colors
 */

import { getApiBase } from "../../config/apiBase";

const API_BASE = getApiBase();


const PRICE_PRO = import.meta.env.VITE_STRIPE_PRICE_PRO || "";
const PRICE_ENT =
  import.meta.env.VITE_STRIPE_PRICE_ENT ||
  import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE ||
  "";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    ...(opts.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return null;
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = body?.message || body?.error || body?.msg || res.statusText;
    const e = new Error(msg);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

const Check = () => (
  <span className="inline-block w-4 text-[#1D625B] font-bold">✔</span>
);
const Dot = () => (
  <span className="inline-block w-2 h-2 rounded-full bg-[#1D625B]" />
);

function Badge({ children, tone = "info" }) {
  const tones = {
    info: "bg-[#1D625B]/10 text-[#1D625B] border border-[#1D625B]/20",
    warn: "bg-amber-50 text-amber-700 border border-amber-200",
    err: "bg-red-50 text-red-700 border border-red-200",
    ok: "bg-[#ABFA7D]/20 text-[#1D625B] border border-[#ABFA7D]/40",
  };
  return (
    <span
      className={classNames(
        "text-xs px-2 py-0.5 rounded font-semibold",
        tones[tone] || tones.info
      )}
    >
      {children}
    </span>
  );
}

function ErrorBar({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 text-red-700 px-4 py-2 text-sm flex items-start justify-between shadow-sm">
      <div className="pr-3">⚠️ {msg}</div>
      <button
        onClick={onClose}
        className="text-red-700/70 hover:text-red-900 font-semibold"
      >
        Dismiss
      </button>
    </div>
  );
}

function InfoBar({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-2 text-sm shadow-sm">
      {children}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-[#1D625B]">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Feature({ children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-gray-700">
      <Check />
      <span>{children}</span>
    </li>
  );
}

function PlanBadge({ plan }) {
  const label = String(plan || "free").toUpperCase();
  const tones = {
    FREE: "bg-gray-100 text-gray-700 border border-gray-200",
    PRO: "bg-[#ABFA7D]/20 text-[#1D625B] border border-[#1D625B]/20",
    ENTERPRISE:
      "bg-gradient-to-r from-[#1D625B]/10 to-[#ABFA7D]/10 text-[#1D625B] border border-[#1D625B]/20",
  };
  const tone = tones[label] || tones.FREE;
  return (
    <span
      className={classNames(
        "px-2 py-0.5 text-xs rounded font-semibold shadow-sm",
        tone
      )}
    >
      {label}
    </span>
  );
}

function PricingCard({
  name,
  price,
  period = "/mo",
  cta,
  onClick,
  features = [],
  highlight = false,
  disabled = false,
  foot,
}) {
  const gradient =
    name === "Free"
      ? "bg-gradient-to-b from-gray-50 to-white"
      : name === "Pro"
      ? "bg-gradient-to-b from-[#E9F8EE] to-white"
      : "bg-gradient-to-b from-[#F2FBF0] to-white";

  return (
    <div
      className={classNames(
        "rounded-2xl border p-6 flex flex-col transition-all duration-200",
        gradient,
        highlight
          ? "border-[#1D625B] ring-2 ring-[#1D625B]/30 shadow-md"
          : "border-gray-200 shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-2xl font-bold text-[#1D625B]">{name}</h4>
        {highlight && <Badge tone="ok">Current</Badge>}
      </div>

      <div className="mt-3">
        <div className="text-4xl font-extrabold text-gray-900">
          {price}
          <span className="text-base font-medium text-gray-500">{period}</span>
        </div>
      </div>

      <ul className="mt-5 space-y-2 flex-1">{features.map((f, i) => <Feature key={i}>{f}</Feature>)}</ul>

      <button
        className={classNames(
          "mt-6 w-full rounded-lg px-4 py-2.5 font-semibold shadow-sm transition-all",
          disabled
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-[#1D625B] text-white hover:bg-[#174F47] hover:shadow-md"
        )}
        disabled={disabled}
        onClick={onClick}
        aria-disabled={disabled}
      >
        {cta}
      </button>

      {foot && <div className="mt-4 text-xs text-gray-500">{foot}</div>}
    </div>
  );
}

export default function BillingView() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [routes, setRoutes] = useState([]);

  const currentPlan = useMemo(() => (me?.plan || "free").toLowerCase(), [me]);
  const isAdmin = useMemo(() => (me?.role || "user") === "admin", [me]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch("/auth/me");
        if (alive) setMe(data);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load your account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("success")) {
      setInfo("✅ Billing action completed successfully.");
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.pathname);
    } else if (url.searchParams.get("canceled")) {
      setError("Payment was canceled.");
      url.searchParams.delete("canceled");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  async function openPortal() {
    setError("");
    setInfo("");
    try {
      setBusy("portal");
      const { url } = await apiFetch("/api/customer-portal", { method: "POST" });
      if (url) window.location.assign(url);
      else throw new Error("No portal URL in response.");
    } catch (e) {
      setError(e?.message || "Failed to open billing portal.");
    } finally {
      setBusy("");
    }
  }

  async function startCheckout(plan) {
    setError("");
    setInfo("");
    const priceId =
      plan === "pro"
        ? PRICE_PRO
        : plan === "enterprise"
        ? PRICE_ENT
        : "";
    if (!priceId) {
      setError(
        plan === "pro"
          ? "Missing VITE_STRIPE_PRICE_PRO"
          : "Missing VITE_STRIPE_PRICE_ENT"
      );
      return;
    }
    try {
      setBusy(plan);
      const success_url = window.location.origin + "/billing?success=1";
      const cancel_url = window.location.origin + "/billing?canceled=1";
      const { url } = await apiFetch("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ priceId, success_url, cancel_url }),
      });
      if (!url) throw new Error("No checkout URL returned.");
      window.location.assign(url);
    } catch (e) {
      setError(e?.message || "Failed to start checkout.");
    } finally {
      setBusy("");
    }
  }

  const canSelfServe = true;
  const busyPortal = busy === "portal";
  const busyPro = busy === "pro";
  const busyEnt = busy === "enterprise";

  if (loading)
    return (
      <div className="p-8">
        <div className="animate-pulse h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="animate-pulse h-40 rounded bg-gray-200" />
      </div>
    );

  return (
    <div className="p-8 space-y-8 bg-[#F9FAF9] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5ECE7]">
        <div>
          <h1 className="text-3xl font-bold text-[#1D625B]">Billing</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Manage your subscription, upgrade plans, and access invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge plan={me?.plan} />
          {isAdmin && <Badge tone="info">Admin</Badge>}
        </div>
      </div>

      <ErrorBar msg={error} onClose={() => setError("")} />
      <InfoBar>{info}</InfoBar>

      {/* Current plan */}
      <Section
        title="Your Subscription"
        right={
          <div className="flex items-center gap-2">
            {["pro", "enterprise"].includes(currentPlan) && (
              <button
                onClick={openPortal}
                disabled={busyPortal}
                className={classNames(
                  "rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all border",
                  busyPortal
                    ? "bg-gray-200 text-gray-500 cursor-wait"
                    : "bg-[#1D625B]/10 text-[#1D625B] border-[#1D625B]/20 hover:bg-[#1D625B]/20"
                )}
              >
                {busyPortal ? "Opening…" : "Open Billing Portal"}
              </button>
            )}
            <button
              onClick={() => setShowDebug((s) => !s)}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 shadow-sm"
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>
        }
      >
        <div className="flex items-center justify-between">
          <div className="text-gray-800">
            <div className="text-sm">Signed in as</div>
            <div className="font-semibold">{me?.email || "unknown"}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Current plan</div>
            <div className="text-lg font-bold text-[#1D625B] uppercase">
              {me?.plan || "free"}
            </div>
          </div>
        </div>
      </Section>

      {/* Plans */}
      <Section title="Plans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PricingCard
            name="Free"
            price="$0"
            cta={currentPlan === "free" ? "Current plan" : "Included"}
            onClick={() => {}}
            disabled
            highlight={currentPlan === "free"}
            features={[
              "Run sample simulations",
              "Scenario library (read-only)",
              "Community support",
            ]}
            foot="Use anytime. No credit card required."
          />

          <PricingCard
            name="Pro"
            price="$49"
            cta={
              currentPlan === "pro"
                ? busyPortal
                  ? "Opening…"
                  : "Manage subscription"
                : busyPro
                ? "Starting…"
                : "Upgrade to Pro"
            }
            onClick={
              currentPlan === "pro" ? openPortal : () => startCheckout("pro")
            }
            disabled={currentPlan === "pro" ? busyPortal : busyPro}
            highlight={currentPlan === "pro"}
            features={[
              "Unlimited simulations",
              "Upload your CSVs",
              "Priority email support",
              "Downloadable reports",
            ]}
            foot="Perfect for teams that need more volume and flexibility."
          />

          <PricingCard
            name="Enterprise"
            price="$199"
            cta={
              currentPlan === "enterprise"
                ? busyPortal
                  ? "Opening…"
                  : "Manage subscription"
                : busyEnt
                ? "Starting…"
                : "Upgrade to Enterprise"
            }
            onClick={
              currentPlan === "enterprise"
                ? openPortal
                : () => startCheckout("enterprise")
            }
            disabled={currentPlan === "enterprise" ? busyPortal : busyEnt}
            highlight={currentPlan === "enterprise"}
            features={[
              "Everything in Pro",
              "Role-based access control",
              "Dedicated success manager",
              "SLA + audit logs",
            ]}
            foot="For organizations with controls, scale, and support needs."
          />
        </div>
      </Section>

      {/* Help cards */}
      <Section title="How billing works">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm text-gray-700">
          <div className="bg-white border border-[#E5ECE7] rounded-2xl shadow-sm p-5 hover:shadow-md transition-all">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Dot /> Stripe test cards
            </div>
            <ul className="space-y-1">
              <li>
                <strong>Visa:</strong> 4242 4242 4242 4242 — any future date,
                any CVC, any ZIP
              </li>
              <li>
                <strong>3D Secure:</strong> 4000 0027 6000 3184 (will prompt for auth)
              </li>
              <li>
                <strong>Decline:</strong> 4000 0000 0000 9995
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[#E5ECE7] rounded-2xl shadow-sm p-5 hover:shadow-md transition-all">
            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Dot /> Need to downgrade?
            </div>
            <p>
              You can change plans or cancel anytime via the customer portal. If
              your account is managed by your organization, contact your
              administrator.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
