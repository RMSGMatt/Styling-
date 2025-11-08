import React, { useEffect, useState } from "react";

/** ====== CONFIG ====== */
const API_BASE = import.meta?.env?.VITE_API_BASE || `${window.location.origin}/api`;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/** ====== SMALL UI ====== */
function Card({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-[#E5ECE7] transition-all">
      <div className="px-5 py-3 border-b border-[#E5ECE7] flex items-center justify-between">
        <h3 className="font-semibold text-[#1D625B] text-lg flex items-center gap-2">
          {title}
        </h3>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function Button({ children, onClick, variant = "primary", disabled }) {
  const base = "px-3 py-2 rounded-lg font-semibold transition disabled:opacity-60";
  const variantClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "ghost"
      ? "bg-white border border-[#1D625B]/30 text-[#1D625B] hover:bg-[#ABFA7D]/10"
      : "bg-[#1D625B] hover:bg-[#174F47] text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass}`}
    >
      {children}
    </button>
  );
}
function ToolbarInput({ placeholder, value, onChange, className = "" }) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 border rounded-lg w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-[#1D625B]/50 ${className}`}
    />
  );
}

/** ====== MAIN ====== */
export default function AdminPanel() {
  console.log("🔌 AdminPanel LIVE mounted", API_BASE);
  const [tab, setTab] = useState("stats");

  const tabs = [
    { key: "stats", label: "📈 Stats" },
    { key: "users", label: "👥 Users" },
    { key: "simulations", label: "🧪 Simulations" },
    { key: "scenarios", label: "📁 Scenarios" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAF9] p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white rounded-2xl shadow-md p-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">🛡️ Admin Panel</h1>
          <p className="text-sm opacity-90 mt-1">
            Manage users, simulations, and scenarios across your organization.
          </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "primary" : "ghost"}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === "stats" && <StatsSection />}
      {tab === "users" && <UsersSection />}
      {tab === "simulations" && <SimulationsSection />}
      {tab === "scenarios" && <ScenariosSection />}
    </div>
  );
}

/** ====== STATS ====== */
function StatsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = await res.json();
        if (mounted) setData(j);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const totals = data?.totals || {};
  const byPlan = data?.by_plan || {};
  const byRole = data?.by_role || {};
  const recent = data?.recent_activity || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Totals">
        {loading ? (
          <div className="animate-pulse h-6 bg-gray-100 rounded w-32" />
        ) : err ? (
          <div className="text-red-600 text-sm">{err}</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Stat value={totals.users} label="Users" />
            <Stat value={totals.simulations} label="Simulations" />
            <Stat value={totals.scenarios} label="Scenarios" />
          </div>
        )}
      </Card>

      <Card title="By Plan">
        <div className="space-y-2">
          {Object.entries(byPlan).map(([k, v]) => (
            <Row key={k} left={k} right={v} />
          ))}
        </div>
      </Card>

      <Card title="By Role">
        <div className="space-y-2">
          {Object.entries(byRole).map(([k, v]) => (
            <Row key={k} left={k} right={v} />
          ))}
        </div>
      </Card>

      <Card title="Recent Activity">
        <div className="space-y-2">
          {recent.length ? (
            recent.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{r.user_email}</span>
                <span className="text-gray-500">{r.timestamp}</span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm italic">No activity yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
function Stat({ value, label }) {
  return (
    <div className="bg-[#F2FBF0] border border-[#E5ECE7] rounded-xl p-4 text-center shadow-sm">
      <div className="text-2xl font-extrabold text-[#1D625B]">
        {value ?? "—"}
      </div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
function Row({ left, right }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{left}</span>
      <span className="text-gray-900 font-semibold">{right}</span>
    </div>
  );
}

/** ====== USERS ====== */
function UsersSection() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const u = new URL(`${API_BASE}/admin/users`);
      if (q) u.searchParams.set("q", q);
      u.searchParams.set("limit", String(limit));
      u.searchParams.set("offset", String(offset));
      const res = await fetch(u.toString(), { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = await res.json();
      setRows(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [q, limit, offset]);

  const saveRow = async (row) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${row.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ plan: row.plan, role: row.role }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      await load();
    } catch (e) {
      alert(`Save failed: ${e}`);
    }
  };

  return (
    <Card
      title="Users"
      right={
        <div className="flex gap-2 items-center">
          <ToolbarInput placeholder="Search email…" value={q} onChange={setQ} />
          <select
            className="px-2 py-2 border rounded-lg"
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(parseInt(e.target.value, 10));
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600 text-sm">{err}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <UserRow key={r.id} row={r} onSave={saveRow} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="ghost"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              ◀ Prev
            </Button>
            <div className="text-sm text-gray-600">
              Offset <code>{offset}</code> • Limit <code>{limit}</code>
            </div>
            <Button
              variant="ghost"
              onClick={() => setOffset(offset + limit)}
              disabled={rows.length < limit}
            >
              Next ▶
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
function UserRow({ row, onSave }) {
  const [plan, setPlan] = useState(row.plan?.toLowerCase() || "free");
  const [role, setRole] = useState(row.role?.toLowerCase() || "user");
  useEffect(() => {
    setPlan(row.plan?.toLowerCase() || "free");
    setRole(row.role?.toLowerCase() || "user");
  }, [row.id]);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">{row.id}</td>
      <td className="py-2 pr-4">{row.email}</td>
      <td className="py-2 pr-4">
        <select
          className="border rounded px-2 py-1"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
        >
          {["free", "pro", "enterprise"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4">
        <select
          className="border rounded px-2 py-1"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {["user", "admin"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4">
        <Button onClick={() => onSave({ ...row, plan, role })}>Save</Button>
      </td>
    </tr>
  );
}

/** ====== SIMULATIONS ====== */
function SimulationsSection() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const u = new URL(`${API_BASE}/admin/simulations`);
      if (q) u.searchParams.set("q", q);
      u.searchParams.set("limit", String(limit));
      u.searchParams.set("offset", String(offset));
      const res = await fetch(u.toString(), { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = await res.json();
      setRows(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [q, limit, offset]);

  return (
    <Card
      title="Simulations"
      right={
        <div className="flex gap-2 items-center">
          <ToolbarInput placeholder="Filter by email…" value={q} onChange={setQ} />
          <select
            className="px-2 py-2 border rounded-lg"
            value={limit}
            onChange={(e) => {
              setOffset(0);
              setLimit(parseInt(e.target.value, 10));
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600 text-sm">{err}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Timestamp</th>
                  <th className="py-2 pr-4">Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4">{r.id}</td>
                    <td className="py-2 pr-4">{r.user_email}</td>
                    <td className="py-2 pr-4">{r.timestamp}</td>
                    <td className="py-2 pr-4 space-y-1">
                      {Object.entries(r.outputUrls || {})
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <a
                              className="text-[#1D625B] underline hover:text-[#174F47]"
                              href={v}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {k}
                            </a>
                          </div>
                        ))}
                      {!Object.values(r.outputUrls || {}).some(Boolean) && (
                        <span className="text-gray-500">No files.</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="ghost"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              ◀ Prev
            </Button>
            <div className="text-sm text-gray-600">
              Offset <code>{offset}</code> • Limit <code>{limit}</code>
            </div>
            <Button
              variant="ghost"
              onClick={() => setOffset(offset + limit)}
              disabled={rows.length < limit}
            >
              Next ▶
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** ====== SCENARIOS ====== */
function ScenariosSection() {
  const [rows, setRows] = useState([]);
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const u = new URL(`${API_BASE}/admin/scenarios`);
      if (owner) u.searchParams.set("owner_email", owner);
      const res = await fetch(u.toString(), { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = await res.json();
      setRows(j);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [owner]);

  const del = async (id) => {
    if (!confirm(`Delete scenario ${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/scenarios/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      await load();
    } catch (e) {
      alert(`Delete failed: ${e}`);
    }
  };

  return (
    <Card
      title="Scenarios"
      right={
        <div className="flex gap-2 items-center">
          <ToolbarInput placeholder="Filter by owner email…" value={owner} onChange={setOwner} />
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600 text-sm">{err}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.id}</td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.owner_email}</td>
                  <td className="py-2 pr-4">{r.created_at}</td>
                  <td className="py-2 pr-4">
                    <Button variant="danger" onClick={() => del(r.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="py-3 text-gray-500 italic" colSpan={5}>
                    No scenarios found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
