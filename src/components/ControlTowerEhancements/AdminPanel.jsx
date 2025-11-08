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
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-[#1D625B]">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Button({ children, onClick, variant = "primary", disabled }) {
  const cls =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : variant === "ghost"
      ? "bg-white border text-[#1D625B] hover:bg-lime-50"
      : "bg-[#1D625B] hover:bg-[#134843] text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded font-semibold transition disabled:opacity-60 ${cls}`}
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
      className={`px-3 py-2 border rounded w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-[#1D625B] ${className}`}
    />
  );
}

/** ====== MAIN ====== */
export default function AdminPanel() {
  console.log("🔌 AdminPanel LIVE mounted", API_BASE);
  const [tab, setTab] = useState("stats"); // stats | users | simulations | scenarios

  return (
    <div className="space-y-6">
      <Card
        title="🛡️ Admin Panel"
        right={
          <div className="flex gap-2">
            {["stats", "users", "simulations", "scenarios"].map((t) => (
              <Button
                key={t}
                variant={tab === t ? "primary" : "ghost"}
                onClick={() => setTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        }
      >
        <p className="text-gray-600">
          Manage users, data, and visibility for your organization. Using <code>{API_BASE}</code>
        </p>
      </Card>

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
      setLoading(true);
      setErr("");
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
  const stripe = data?.stripe_linked || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Totals">
        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div className="text-red-600">Error: {err}</div>
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

      <Card title="Stripe Linkage">
        <div className="space-y-2">
          <Row left="linked" right={stripe.linked} />
          <Row left="unlinked" right={stripe.unlinked} />
        </div>
      </Card>

      <Card title="Recent Activity">
        <div className="space-y-2">
          {recent.slice(0, 10).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{r.user_email}</span>
              <span className="text-gray-500">{r.timestamp}</span>
            </div>
          ))}
          {!recent?.length && <div className="text-gray-500 text-sm">No activity.</div>}
        </div>
      </Card>
    </div>
  );
}
function Stat({ value, label }) {
  return (
    <div className="bg-gray-50 border rounded p-4 text-center">
      <div className="text-2xl font-extrabold text-[#1D625B]">{value ?? "—"}</div>
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
    setLoading(true);
    setErr("");
    try {
      const u = new URL(`${API_BASE}/admin/users`);
      if (q) u.searchParams.set("q", q);
      if (limit) u.searchParams.set("limit", String(limit));
      if (offset) u.searchParams.set("offset", String(offset));
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

  useEffect(() => { load(); /* eslint-disable-line */ }, [q, limit, offset]);

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
            className="px-2 py-2 border rounded"
            value={limit}
            onChange={(e) => { setOffset(0); setLimit(parseInt(e.target.value, 10)); }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600">Error: {err}</div>
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
            <Button variant="ghost" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
              ◀ Prev
            </Button>
            <div className="text-sm text-gray-600">
              Offset <code>{offset}</code> • Limit <code>{limit}</code>
            </div>
            <Button variant="ghost" onClick={() => setOffset(offset + limit)} disabled={rows.length < limit}>
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
  useEffect(() => { setPlan(row.plan?.toLowerCase() || "free"); setRole(row.role?.toLowerCase() || "user"); }, [row.id]);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">{row.id}</td>
      <td className="py-2 pr-4">{row.email}</td>
      <td className="py-2 pr-4">
        <select className="border rounded px-2 py-1" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {["free", "pro", "enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td className="py-2 pr-4">
        <select className="border rounded px-2 py-1" value={role} onChange={(e) => setRole(e.target.value)}>
          {["user", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
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
    setLoading(true);
    setErr("");
    try {
      const u = new URL(`${API_BASE}/admin/simulations`);
      if (q) u.searchParams.set("q", q);
      if (limit) u.searchParams.set("limit", String(limit));
      if (offset) u.searchParams.set("offset", String(offset));
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
  useEffect(() => { load(); /* eslint-disable-line */ }, [q, limit, offset]);

  return (
    <Card
      title="Simulations"
      right={
        <div className="flex gap-2 items-center">
          <ToolbarInput placeholder="Filter by email…" value={q} onChange={setQ} />
          <select
            className="px-2 py-2 border rounded"
            value={limit}
            onChange={(e) => { setOffset(0); setLimit(parseInt(e.target.value, 10)); }}
          >
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600">Error: {err}</div>
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
                            <a className="text-[#1D625B] underline" href={v} target="_blank" rel="noreferrer">
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
            <Button variant="ghost" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
              ◀ Prev
            </Button>
            <div className="text-sm text-gray-600">Offset <code>{offset}</code> • Limit <code>{limit}</code></div>
            <Button variant="ghost" onClick={() => setOffset(offset + limit)} disabled={rows.length < limit}>
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
    setLoading(true);
    setErr("");
    try {
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
  useEffect(() => { load(); /* eslint-disable-line */ }, [owner]);

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
          <Button variant="ghost" onClick={load}>Refresh</Button>
        </div>
      }
    >
      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div className="text-red-600">Error: {err}</div>
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
                    <Button variant="danger" onClick={() => del(r.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={5}>No scenarios found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
