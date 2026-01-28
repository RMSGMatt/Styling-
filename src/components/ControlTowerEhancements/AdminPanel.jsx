import React, { useEffect, useState } from "react";

/** ====== CONFIG ====== */
import { getApiBase } from "../../config/apiBase";

// Canonical API base (single source of truth)
const API_BASE = getApiBase();

// Local helper (keep, since file uses normalizeBase in many places)
const normalizeBase = (s) => String(s || "").replace(/\/+$/, "");

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/**
 * Admin endpoints sometimes live under:
 *   - /admin/...
 *   - /api/admin/...
 *
 * We try NON-/api first to avoid repeated 404 spam.
 * Fallback only on 404 (do not mask 401/403).
 */
async function adminFetch(path, options = {}) {
  const base = normalizeBase(API_BASE);

  // ✅ Non-/api first
  const candidates = [base, `${base}/api`];

  // Ensure path starts with "/"
  const p = path.startsWith("/") ? path : `/${path}`;

  let lastRes = null;
  let lastErr = null;

  for (const b of candidates) {
    const url = `${normalizeBase(b)}${p}`;
    try {
      const res = await fetch(url, options);
      lastRes = res;

      if (res.ok) return res;

      // If unauthorized/forbidden, do not fallback (real auth signal)
      if (res.status === 401 || res.status === 403) return res;

      // Only fallback if missing
      if (res.status !== 404) return res;
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr) throw lastErr;
  return lastRes;
}

/** ====== FRIENDLY ERROR MESSAGES ====== */
function explainAdminError(status) {
  if (status === 401) {
    return "Unauthorized (401): your session token is missing/expired. Log out and log back in, then retry.";
  }
  if (status === 403) {
    return "Forbidden (403): this account is not an Admin. Promote your user to role=admin in the backend DB, then log out/in so a new token is issued.";
  }
  if (status === 404) {
    return "Not Found (404): the backend route isn’t available at this base URL. Confirm your Flask server routes include /admin/* and that API_BASE points to the backend.";
  }
  return `HTTP ${status}`;
}

/** ====== PREMIUM UI PRIMITIVES ====== */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#F9FAF9] px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-6">{children}</div>
    </div>
  );
}

function Panel({ children }) {
  return (
    <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function PanelHeader({ title, subtitle, right }) {
  return (
    <div className="p-6 border-b border-[#E5ECE7] flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest text-gray-400">
          {title}
        </div>
        <div className="text-lg sm:text-xl font-bold text-[#1D625B] mt-2">
          {subtitle}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-[#1D625B] text-white shadow-sm">
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="text-sm font-semibold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function SoftChip({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-white border border-[#D8E5DD] text-[#1D625B] shadow-sm">
      <div className="text-[11px] uppercase tracking-wide opacity-60">
        {label}
      </div>
      <div className="text-sm font-semibold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, title, className = "" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "bg-[#ABFA7D] hover:bg-[#93EB6C] text-[#1D625B] font-semibold px-4 py-2 rounded-xl shadow-sm transition whitespace-nowrap " +
        className
      }
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, title, className = "" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "bg-white hover:bg-[#F2F6F3] text-[#1D625B] font-semibold px-4 py-2 rounded-xl border border-[#D8E5DD] shadow-sm transition whitespace-nowrap " +
        className
      }
    >
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, title, className = "" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-3 py-2 rounded-xl border border-red-200 transition whitespace-nowrap " +
        className
      }
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={
        "w-full rounded-xl border border-[#D8E5DD] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ABFA7D] " +
        className
      }
    />
  );
}

function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={
        "rounded-xl border border-[#D8E5DD] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ABFA7D] " +
        className
      }
    >
      {children}
    </select>
  );
}

function Divider() {
  return <div className="h-px bg-[#E5ECE7]" />;
}

/** ====== ADMIN NAV ====== */
const TABS = [
  { id: "stats", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "simulations", label: "Simulations", icon: "🧪" },
  { id: "scenarios", label: "Scenarios", icon: "🧩" },
];

/** ====== MAIN ====== */
export default function AdminPanelLive({ switchView }) {
  const [tab, setTab] = useState("stats");

  // Header stats (SINGLE SOURCE OF TRUTH)
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsErr, setStatsErr] = useState("");
  const [stats, setStats] = useState(null);

  const refreshStats = async () => {
    setStatsLoading(true);
    setStatsErr("");
    try {
      const r = await adminFetch(`/admin/stats`, { headers: authHeaders() });
      if (!r?.ok) throw new Error(explainAdminError(r?.status));
      const j = await r.json();
      setStats(j);
    } catch (e) {
      setStatsErr(String(e?.message || e));
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = stats?.totals || {};
  const stripe = stats?.stripe_linked || {};

  return (
    <Shell>
      {/* HERO */}
      <div className="rounded-3xl overflow-hidden shadow-md border border-[#E5ECE7]">
        <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white p-6 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest opacity-80">
                FOR-C • Admin Console
              </div>

              <div className="flex items-start gap-3 mt-3">
                <div className="text-3xl leading-none">🛡️</div>
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                    Admin
                  </h1>
                  <p className="text-sm sm:text-base opacity-90 mt-2 leading-relaxed max-w-3xl">
                    Manage users, entitlements, simulation activity, and scenario
                    governance. Using{" "}
                    <span className="font-semibold">{API_BASE}</span>
                  </p>
                </div>
              </div>

              {statsErr ? (
                <div className="mt-3 text-sm text-red-100 whitespace-pre-line">
                  ⚠️ <span className="font-semibold">{statsErr}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap lg:flex-nowrap gap-3 justify-start lg:justify-end items-stretch">
              {statsLoading ? (
                <>
                  <Chip label="Users" value="…" />
                  <Chip label="Runs" value="…" />
                  <Chip label="Scenarios" value="…" />
                </>
              ) : (
                <>
                  <Chip label="Users" value={totals.users ?? "—"} />
                  <Chip label="Runs" value={totals.simulations ?? "—"} />
                  <Chip label="Scenarios" value={totals.scenarios ?? "—"} />
                </>
              )}

              <PrimaryButton onClick={refreshStats} title="Refresh admin stats">
                Refresh
              </PrimaryButton>
            </div>
          </div>
        </div>

        <div className="bg-white px-6 sm:px-7 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700 leading-relaxed">
            <span className="font-semibold text-[#1D625B]">Tip:</span>{" "}
            Use Admin to validate plan gating and ensure Stripe-linked accounts are
            correctly provisioned.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SoftChip label="Stripe Linked" value={stripe?.linked ?? "—"} />
            <SoftChip label="Unlinked" value={stripe?.unlinked ?? "—"} />
            <SecondaryButton
              onClick={() => switchView?.("control")}
              title="Back to Control Tower"
            >
              ← Back to Control Tower
            </SecondaryButton>
          </div>
        </div>
      </div>

      {/* BODY LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
        {/* LEFT NAV (desktop) */}
        <div className="hidden lg:block">
          <Panel>
            <div className="p-4">
              <div className="text-xs uppercase tracking-widest text-gray-400 px-2">
                Navigation
              </div>

              <div className="mt-3 space-y-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={
                      "w-full flex items-center gap-3 rounded-2xl px-4 py-3 border transition text-left " +
                      (tab === t.id
                        ? "bg-[#F2F6F3] border-[#D8E5DD] text-[#1D625B] shadow-sm"
                        : "bg-white border-transparent hover:bg-[#F9FAF9] hover:border-[#E5ECE7] text-gray-700")
                    }
                  >
                    <div className="text-xl">{t.icon}</div>
                    <div className="min-w-0">
                      <div className="font-semibold">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t.id === "stats" && "Org health + governance"}
                        {t.id === "users" && "Plans, roles, access"}
                        {t.id === "simulations" && "Runs + downloadable files"}
                        {t.id === "scenarios" && "Library + cleanup"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Divider />

              <div className="px-2 py-4 text-xs text-gray-500 leading-relaxed">
                <div className="font-semibold text-[#1D625B] mb-1">
                  Revenue-ready checklist
                </div>
                • Admin visibility gated by role
                <br />
                • Plan changes update UI gates
                <br />
                • Stripe linkage validated
                <br />
                • Audit deletion actions
              </div>
            </div>
          </Panel>
        </div>

        {/* MOBILE TAB BAR */}
        <div className="lg:hidden">
          <Panel>
            <div className="p-3 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "px-3 py-2 rounded-xl border text-sm font-semibold transition " +
                    (tab === t.id
                      ? "bg-[#1D625B] border-[#1D625B] text-white"
                      : "bg-white border-[#D8E5DD] text-[#1D625B] hover:bg-[#F2F6F3]")
                  }
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* MAIN CONTENT */}
        <div className="space-y-6">
          {tab === "stats" && (
            <StatsSection
              stats={stats}
              loading={statsLoading}
              err={statsErr}
              onRefreshStats={refreshStats}
            />
          )}
          {tab === "users" && <UsersSection />}
          {tab === "simulations" && <SimulationsSection />}
          {tab === "scenarios" && <ScenariosSection />}
        </div>
      </div>

      <footer className="text-center text-xs text-gray-500 mt-12 pt-6 border-t border-[#E5ECE7]">
        © {new Date().getFullYear()} FOR-C • Admin
      </footer>
    </Shell>
  );
}

/** ====== SECTIONS ====== */

function StatsSection({ stats, loading, err, onRefreshStats }) {
  const totals = stats?.totals || {};
  const byPlan = stats?.by_plan || {};
  const byRole = stats?.by_role || {};
  const recent = stats?.recent_activity || [];
  const stripe = stats?.stripe_linked || {};

  return (
    <Panel>
      <PanelHeader
        title="Overview"
        subtitle="Organization health & monetization readiness"
        right={
          <div className="flex gap-2">
            <SecondaryButton onClick={onRefreshStats} title="Refresh header stats">
              Refresh Header
            </SecondaryButton>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="font-semibold">Admin stats unavailable</div>
            <div className="mt-1 whitespace-pre-line">{err}</div>
            <div className="mt-2 text-xs text-gray-600">
              If you just changed your role to admin, log out and log back in to
              re-issue your JWT.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Users" value={totals.users ?? "—"} icon="👥" />
              <KpiCard
                title="Total Simulations"
                value={totals.simulations ?? "—"}
                icon="🧪"
              />
              <KpiCard
                title="Total Scenarios"
                value={totals.scenarios ?? "—"}
                icon="🧩"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MiniCard title="Users by Plan" icon="💳">
                <KeyValueList obj={byPlan} empty="No plan data yet." />
              </MiniCard>

              <MiniCard title="Users by Role" icon="🧷">
                <KeyValueList obj={byRole} empty="No role data yet." />
              </MiniCard>

              <MiniCard title="Stripe Linkage" icon="🔗">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Linked</span>
                    <span className="font-semibold text-[#1D625B]">
                      {stripe.linked ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Unlinked</span>
                    <span className="font-semibold text-[#1D625B]">
                      {stripe.unlinked ?? "—"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 pt-2">
                    Stripe linkage should match plan gating experience in Control
                    Tower.
                  </div>
                </div>
              </MiniCard>
            </div>

            <Divider />

            <div className="space-y-3">
              <div className="text-sm font-semibold text-[#1D625B]">
                Recent Activity
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 pr-4">{r.timestamp}</td>
                        <td className="py-2 pr-4">{r.user_email}</td>
                        <td className="py-2 pr-4">{r.event_type}</td>
                        <td className="py-2 pr-4">{r.details}</td>
                      </tr>
                    ))}
                    {!recent.length && (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={4}>
                          No recent activity found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function UsersSection() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const base = normalizeBase(API_BASE);

      // Try non-/api first, then /api
      const urlA = new URL(`${base}/admin/users`);
      const urlB = new URL(`${base}/api/admin/users`);

      const build = (u) => {
        if (q) u.searchParams.set("q", q);
        if (limit) u.searchParams.set("limit", String(limit));
        if (offset) u.searchParams.set("offset", String(offset));
        return u.toString();
      };

      let res = await fetch(build(urlA), { headers: authHeaders() });
      if (!res.ok && res.status === 404) {
        res = await fetch(build(urlB), { headers: authHeaders() });
      }

      if (!res.ok) throw new Error(explainAdminError(res.status));
      const j = await res.json();
      setRows(j.rows || j || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, limit, offset]);

  const patchUser = async (row, patch) => {
    const ok = window.confirm(`Update ${row.email}?`);
    if (!ok) return;

    try {
      const base = normalizeBase(API_BASE);
      const urlA = `${base}/admin/users/${row.id}`;
      const urlB = `${base}/api/admin/users/${row.id}`;

      let r = await fetch(urlA, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });

      if (!r.ok && r.status === 404) {
        r = await fetch(urlB, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(patch),
        });
      }

      if (!r.ok) throw new Error(explainAdminError(r.status));
      await load();
    } catch (e) {
      alert(`Failed: ${String(e?.message || e)}`);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Users"
        subtitle="Plans, roles, and entitlements"
        right={
          <div className="flex gap-2">
            <SecondaryButton onClick={load} title="Reload users">
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px_140px_140px] gap-3 items-center">
          <Input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Search users (email, plan, role...)"
          />

          <Select
            value={String(limit)}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={String(n)}>
                Limit {n}
              </option>
            ))}
          </Select>

          <SecondaryButton
            onClick={() => setOffset(Math.max(0, offset - limit))}
            title="Previous page"
            className="w-full"
          >
            ← Prev
          </SecondaryButton>
          <SecondaryButton
            onClick={() => setOffset(offset + limit)}
            title="Next page"
            className="w-full"
          >
            Next →
          </SecondaryButton>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="font-semibold">Unable to load users</div>
            <div className="mt-1 whitespace-pre-line">{err}</div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E5ECE7] rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAF9]">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 w-[240px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3 px-4">{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#1D625B]">
                      {r.email}
                    </td>
                    <td className="py-3 px-4">{r.plan}</td>
                    <td className="py-3 px-4">{r.role}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={r.plan || "free"}
                          onChange={(e) => patchUser(r, { plan: e.target.value })}
                        >
                          {["free", "pro", "enterprise"].map((p) => (
                            <option key={p} value={p}>
                              Plan: {p}
                            </option>
                          ))}
                        </Select>

                        <Select
                          value={r.role || "user"}
                          onChange={(e) => patchUser(r, { role: e.target.value })}
                        >
                          {["user", "admin"].map((role) => (
                            <option key={role} value={role}>
                              Role: {role}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 px-4 text-gray-500" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-gray-500">
          Offset:{" "}
          <span className="font-semibold text-[#1D625B]">{offset}</span>
        </div>
      </div>
    </Panel>
  );
}

function SimulationsSection() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const base = normalizeBase(API_BASE);

      const urlA = new URL(`${base}/admin/simulations`);
      const urlB = new URL(`${base}/api/admin/simulations`);

      const build = (u) => {
        if (q) u.searchParams.set("q", q);
        if (limit) u.searchParams.set("limit", String(limit));
        if (offset) u.searchParams.set("offset", String(offset));
        return u.toString();
      };

      let res = await fetch(build(urlA), { headers: authHeaders() });
      if (!res.ok && res.status === 404) {
        res = await fetch(build(urlB), { headers: authHeaders() });
      }

      if (!res.ok) throw new Error(explainAdminError(res.status));
      const j = await res.json();
      setRows(j.rows || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, limit, offset]);

  return (
    <Panel>
      <PanelHeader
        title="Simulations"
        subtitle="Inspect runs and downloadable artifacts"
        right={
          <div className="flex gap-2">
            <SecondaryButton onClick={load} title="Reload simulations">
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px_140px_140px] gap-3 items-center">
          <Input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Search simulations (user email, timestamp, file url...)"
          />

          <Select
            value={String(limit)}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={String(n)}>
                Limit {n}
              </option>
            ))}
          </Select>

          <SecondaryButton
            onClick={() => setOffset(Math.max(0, offset - limit))}
            title="Previous page"
            className="w-full"
          >
            ← Prev
          </SecondaryButton>
          <SecondaryButton
            onClick={() => setOffset(offset + limit)}
            title="Next page"
            className="w-full"
          >
            Next →
          </SecondaryButton>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="font-semibold">Unable to load simulations</div>
            <div className="mt-1 whitespace-pre-line">{err}</div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E5ECE7] rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAF9]">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-3 px-4">{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#1D625B]">
                      {r.user_email}
                    </td>
                    <td className="py-3 px-4">{r.timestamp}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 text-xs">
                        {Object.entries(r.output_urls || r.outputUrls || {})
                          .filter(([, v]) => !!v)
                          .map(([k, v]) => (
                            <a
                              key={k}
                              href={v}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1D625B] font-semibold hover:underline break-all"
                            >
                              {k}
                            </a>
                          ))}
                        {!Object.keys(r.output_urls || r.outputUrls || {}).length && (
                          <span className="text-gray-400">No files</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 px-4 text-gray-500" colSpan={4}>
                      No simulations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-gray-500">
          Offset:{" "}
          <span className="font-semibold text-[#1D625B]">{offset}</span>
        </div>
      </div>
    </Panel>
  );
}

function ScenariosSection() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const base = normalizeBase(API_BASE);

      const urlA = new URL(`${base}/admin/scenarios`);
      const urlB = new URL(`${base}/api/admin/scenarios`);

      const build = (u) => {
        if (q) u.searchParams.set("q", q);
        if (limit) u.searchParams.set("limit", String(limit));
        if (offset) u.searchParams.set("offset", String(offset));
        return u.toString();
      };

      let res = await fetch(build(urlA), { headers: authHeaders() });
      if (!res.ok && res.status === 404) {
        res = await fetch(build(urlB), { headers: authHeaders() });
      }

      if (!res.ok) throw new Error(explainAdminError(res.status));
      const j = await res.json();
      setRows(j.rows || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, limit, offset]);

  const deleteScenario = async (id) => {
    const ok = window.confirm("Delete this scenario? This cannot be undone.");
    if (!ok) return;

    try {
      const base = normalizeBase(API_BASE);
      const urlA = `${base}/admin/scenarios/${id}`;
      const urlB = `${base}/api/admin/scenarios/${id}`;

      let r = await fetch(urlA, { method: "DELETE", headers: authHeaders() });
      if (!r.ok && r.status === 404) {
        r = await fetch(urlB, { method: "DELETE", headers: authHeaders() });
      }

      if (!r.ok) throw new Error(explainAdminError(r.status));
      await load();
    } catch (e) {
      alert(`Failed: ${String(e?.message || e)}`);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Scenarios"
        subtitle="Library governance and cleanup"
        right={
          <div className="flex gap-2">
            <SecondaryButton onClick={load} title="Reload scenarios">
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px_140px_140px] gap-3 items-center">
          <Input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            placeholder="Search scenarios (name, owner email...)"
          />

          <Select
            value={String(limit)}
            onChange={(e) => {
              setOffset(0);
              setLimit(Number(e.target.value));
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={String(n)}>
                Limit {n}
              </option>
            ))}
          </Select>

          <SecondaryButton
            onClick={() => setOffset(Math.max(0, offset - limit))}
            title="Previous page"
            className="w-full"
          >
            ← Prev
          </SecondaryButton>
          <SecondaryButton
            onClick={() => setOffset(offset + limit)}
            title="Next page"
            className="w-full"
          >
            Next →
          </SecondaryButton>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="font-semibold">Unable to load scenarios</div>
            <div className="mt-1 whitespace-pre-line">{err}</div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E5ECE7] rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAF9]">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3 px-4">{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#1D625B]">
                      {r.name}
                    </td>
                    <td className="py-3 px-4">{r.owner_email}</td>
                    <td className="py-3 px-4">{r.created_at}</td>
                    <td className="py-3 px-4">
                      <DangerButton
                        onClick={() => deleteScenario(r.id)}
                        title="Delete scenario"
                      >
                        Delete
                      </DangerButton>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 px-4 text-gray-500" colSpan={5}>
                      No scenarios found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-gray-500">
          Offset:{" "}
          <span className="font-semibold text-[#1D625B]">{offset}</span>
        </div>
      </div>
    </Panel>
  );
}

/** ====== SMALL DISPLAY COMPONENTS ====== */

function KpiCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-[#E5ECE7] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-400">
            {title}
          </div>
          <div className="text-3xl font-bold text-[#1D625B] mt-2">{value}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#F2F6F3] border border-[#D8E5DD] flex items-center justify-center text-2xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-[#E5ECE7] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F2F6F3] border border-[#D8E5DD] flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="text-sm font-semibold text-[#1D625B]">{title}</div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function KeyValueList({ obj, empty }) {
  const entries = Object.entries(obj || {});
  if (!entries.length)
    return <div className="text-sm text-gray-500">{empty}</div>;

  return (
    <div className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="text-gray-600">{k}</span>
          <span className="font-semibold text-[#1D625B]">{v}</span>
        </div>
      ))}
    </div>
  );
}
