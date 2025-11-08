// src/components/BillingView.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * BillingView
 * - Reads current user (plan/role) from /auth/me using the JWT in localStorage.
 * - Starts Stripe Checkout via POST /api/create-checkout-session.
 * - Opens Stripe Customer Portal via POST /api/customer-portal.
 * - Shows rich plan cards, status + error banners, and a debug readiness panel.
 *
 * ENV (vite):
  *  - VITE_API_BASE (optional)  -> default ${window.location.origin}/api
 *  - VITE_STRIPE_PRICE_PRO     -> price_xxx for Pro
 *  - VITE_STRIPE_PRICE_ENT     -> price_xxx for Enterprise
 */

const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || `${window.location.origin}/api`;


const PRICE_PRO = import.meta.env.VITE_STRIPE_PRICE_PRO || "";
const PRICE_ENT = import.meta.env.VITE_STRIPE_PRICE_ENT || import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || "";

/* ----------------------------- tiny helpers ----------------------------- */

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
  // 204 means OK but no content (CORS preflights, some PATCH, etc.)
  if (res.status === 204) return null;

  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON, propagate
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

const Check = () => <span className="inline-block w-4 text-[#1D625B]">✔</span>;
const Dot  = () => <span className="inline-block w-2 h-2 rounded-full bg-[#1D625B]" />;

/* ----------------------------- UI fragments ----------------------------- */

function Badge({ children, tone = "info" }) {
  const tones = {
    info: "bg-[#1D625B]/10 text-[#1D625B] border border-[#1D625B]/20",
    warn: "bg-amber-50 text-amber-700 border border-amber-200",
    err:  "bg-red-50 text-red-700 border border-red-200",
    ok:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  return (
    <span className={classNames("text-xs px-2 py-0.5 rounded font-semibold", tones[tone] || tones.info)}>
      {children}
    </span>
  );
}

function ErrorBar({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm flex items-start justify-between">
      <div className="pr-3">⚠️ {msg}</div>
      <button onClick={onClose} className="text-red-700/70 hover:text-red-900">Dismiss</button>
    </div>
  );
}

function InfoBar({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#1D625B]">{title}</h3>
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
    PRO: "bg-blue-50 text-blue-700 border border-blue-200",
    ENTERPRISE: "bg-purple-50 text-purple-700 border border-purple-200",
  };
  const tone = tones[label] || tones.FREE;
  return <span className={classNames("px-2 py-0.5 text-xs rounded font-semibold", tone)}>{label}</span>;
}

/* ------------------------------ Pricing card ---------------------------- */

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
  return (
    <div
      className={classNames(
        "rounded-2xl border p-5 flex flex-col shadow-sm bg-white",
        highlight ? "border-[#1D625B] ring-2 ring-[#1D625B]/30" : "border-gray-200"
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-[#1D625B]">{name}</h4>
        {highlight ? <Badge tone="ok">Current</Badge> : null}
      </div>

      <div className="mt-3">
        <div className="text-3xl font-extrabold text-gray-900">
          {price} <span className="text-base font-medium text-gray-500">{period}</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2">{features.map((f, i) => <Feature key={i}>{f}</Feature>)}</ul>

      <button
        className={classNames(
          "mt-5 w-full rounded-lg px-4 py-2.5 font-semibold shadow-sm transition-colors",
          disabled
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-[#1D625B] text-white hover:bg-[#15534d]"
        )}
        disabled={disabled}
        onClick={onClick}
        aria-disabled={disabled}
      >
        {cta}
      </button>

      {foot ? <div className="mt-3 text-xs text-gray-500">{foot}</div> : null}
    </div>
  );
}

/* ------------------------------ Main component -------------------------- */

export default function BillingView() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(""); // "pro" | "enterprise" | "portal" | ""
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // For an optional diagnostics panel
  const [showDebug, setShowDebug] = useState(false);
  const [routes, setRoutes] = useState([]);

  const currentPlan = useMemo(() => (me?.plan || "free").toLowerCase(), [me]);
  const isAdmin = useMemo(() => (me?.role || "user") === "admin", [me]);

  /* --------------------------- initial data load ------------------------ */
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
    return () => {
      alive = false;
    };
  }, []);

  // Optional: success/cancel flags coming back from Stripe redirects
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

  /* ------------------------------ actions ------------------------------ */

  async function openPortal() {
    setError("");
    setInfo("");
    try {
      setBusy("portal");
      const { url } = await apiFetch("/api/customer-portal", { method: "POST" });
      if (url) {
        window.location.assign(url);
      } else {
        throw new Error("No portal URL in response.");
      }
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
      plan === "pro" ? PRICE_PRO :
      plan === "enterprise" ? PRICE_ENT :
      "";

    if (!priceId) {
      setError(
        plan === "pro"
          ? "Missing VITE_STRIPE_PRICE_PRO in your frontend .env"
          : "Missing VITE_STRIPE_PRICE_ENT (or VITE_STRIPE_PRICE_ENTERPRISE) in your frontend .env"
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

  /* ----------------------------- diagnostics --------------------------- */

  async function refreshRoutes() {
    try {
      const list = await apiFetch("/__routes");
      setRoutes(Array.isArray(list) ? list : []);
    } catch (e) {
      setRoutes([`(error) ${e?.message || "route list unavailable"}`]);
    }
  }

  /* ------------------------------ rendering ---------------------------- */

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-6 w-44 rounded bg-gray-200 mb-4" />
        <div className="animate-pulse h-40 rounded bg-gray-200" />
      </div>
    );
  }

  const canSelfServe = true; // keep true; your backend will gate as needed
  const busyPortal = busy === "portal";
  const busyPro = busy === "pro";
  const busyEnt = busy === "enterprise";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1D625B]">Billing</h1>
          <p className="text-gray-600 mt-1">
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

      {/* Current plan + quick actions */}
      <Section
        title="Your Subscription"
        right={
          <div className="flex items-center gap-2">
            {["pro", "enterprise"].includes(currentPlan) ? (
              <button
                onClick={openPortal}
                disabled={busyPortal}
                className={classNames(
                  "rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-colors",
                  busyPortal
                    ? "bg-gray-200 text-gray-500 cursor-wait"
                    : "bg-white text-[#1D625B] border border-[#1D625B]/40 hover:bg-[#1D625B]/5"
                )}
              >
                {busyPortal ? "Opening…" : "Open Billing Portal"}
              </button>
            ) : null}
            <button
              onClick={() => setShowDebug((s) => !s)}
              className="rounded-lg px-3 py-2 text-sm font-semibold shadow-sm bg-white text-gray-700 border hover:bg-gray-50"
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
            <div className="text-lg font-bold text-[#1D625B]">
              {String(me?.plan || "free").toUpperCase()}
            </div>
          </div>
        </div>
      </Section>

      {/* Plans grid */}
      <Section title="Plans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free */}
          <PricingCard
            name="Free"
            price="$0"
            period=""
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

          {/* Pro */}
          <PricingCard
            name="Pro"
            price="$49"
            period="/mo"
            cta={
              currentPlan === "pro"
                ? canSelfServe
                  ? busyPortal ? "Opening…" : "Manage subscription"
                  : "Contact sales"
                : busyPro
                ? "Starting…"
                : "Upgrade to Pro"
            }
            onClick={
              currentPlan === "pro"
                ? canSelfServe
                  ? openPortal
                  : undefined
                : () => startCheckout("pro")
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

          {/* Enterprise */}
          <PricingCard
            name="Enterprise"
            price="$199"
            period="/mo"
            cta={
              currentPlan === "enterprise"
                ? canSelfServe
                  ? busyPortal ? "Opening…" : "Manage subscription"
                  : "Contact sales"
                : busyEnt
                ? "Starting…"
                : "Upgrade to Enterprise"
            }
            onClick={
              currentPlan === "enterprise"
                ? canSelfServe
                  ? openPortal
                  : undefined
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

      {/* Help / Test cards */}
      <Section title="How billing works">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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

      {/* Optional debug / readiness */}
      {showDebug && (
        <Section
          title="Debug / Readiness"
          right={
            <button
              onClick={refreshRoutes}
              className="rounded-md border px-3 py-1.5 text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh routes
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="font-semibold text-gray-900 mb-2">Frontend ENV</div>
              <ul className="space-y-1">
                <li>
                  API_BASE:{" "}
                  <code className="bg-white px-1 py-0.5 border rounded">{API_BASE}</code>
                </li>
                <li>
                  PRICE_PRO:{" "}
                  {PRICE_PRO ? (
                    <Badge tone="ok">{PRICE_PRO}</Badge>
                  ) : (
                    <Badge tone="warn">missing</Badge>
                  )}
                </li>
                <li>
                  PRICE_ENT:{" "}
                  {PRICE_ENT ? (
                    <Badge tone="ok">{PRICE_ENT}</Badge>
                  ) : (
                    <Badge tone="warn">missing</Badge>
                  )}
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="font-semibold text-gray-900 mb-2">Auth</div>
              <ul className="space-y-1">
                <li>
                  Logged in:{" "}
                  {me?.email ? <Badge tone="ok">{me.email}</Badge> : <Badge tone="err">no</Badge>}
                </li>
                <li>
                  Role: <Badge tone="info">{me?.role || "user"}</Badge>
                </li>
                <li>
                  Plan: <Badge tone="info">{me?.plan || "free"}</Badge>
                </li>
                <li className="truncate">
                  Token:{" "}
                  {getToken() ? (
                    <span className="text-gray-600">
                      {getToken().slice(0, 18)}…
                    </span>
                  ) : (
                    <Badge tone="warn">missing</Badge>
                  )}
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 md:col-span-1">
              <div className="font-semibold text-gray-900 mb-2">Backend routes</div>
              <div className="max-h-40 overflow-auto leading-tight">
                {!routes.length ? (
                  <div className="text-gray-500">Click “Refresh routes”.</div>
                ) : (
                  <ul className="space-y-1">
                    {routes.map((r, idx) => (
                      <li key={idx} className="font-mono text-xs">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
