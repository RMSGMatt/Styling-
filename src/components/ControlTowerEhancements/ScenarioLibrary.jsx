
import React, { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "../Toasts";
import { getApiBase } from "../../config/apiBase";

/* ---------------------------
   Local storage “DB”
---------------------------- */
const KEY = "forc_scenarios";

const SEED_FLAG = "forc_scenarios_seeded_v1";

function seedList() {
  const now = new Date().toISOString();
  const empty = { demandAdjustments: [], laneAdjustments: [], inventoryPolicies: [], disruptionScenarios: [] };
  const mk = (name, notes, tags, meta) => ({
    id: genId(), name, notes, tags, createdAt: now, updatedAt: now, seed: true,
    data: { name, ...empty, meta: { source: "library_seed", ...meta } },
  });
  return [
    mk("Taiwan fab outage, 60 days", "Full outage at FAB_TAIWAN_01 starting one week out. Runs on your loaded network, or the example network.", ["network", "outage"],
      { relative: { facility: "FAB_TAIWAN_01", offsetDays: 7, durationDays: 60, severity: 1 } }),
    mk("Taiwan fab degraded 50%, 30 days", "Half capacity at FAB_TAIWAN_01 for a month, starting one week out.", ["network", "partial"],
      { relative: { facility: "FAB_TAIWAN_01", offsetDays: 7, durationDays: 30, severity: 0.5 } }),
    mk("Distributor: Baseline", "Illustrative distributor network with no disruption.", ["distributor", "illustrative"], { sampleDir: "distributor/1_baseline" }),
    mk("Distributor: Allocation cut", "Supplier allocation is cut. Illustrative distributor network.", ["distributor", "illustrative"], { sampleDir: "distributor/2_allocation_cut" }),
    mk("Distributor: Allocation cut, repositioned stock", "Allocation cut with stock repositioned ahead of it.", ["distributor", "illustrative"], { sampleDir: "distributor/2b_allocation_cut_repositioned" }),
    mk("Distributor: End of life, stock only", "End-of-life part with existing stock only.", ["distributor", "illustrative"], { sampleDir: "distributor/3_eol_stock_only" }),
    mk("Distributor: End of life, last-time buy", "End-of-life part with a last-time buy placed.", ["distributor", "illustrative"], { sampleDir: "distributor/4_eol_last_time_buy" }),
  ];
}

function loadScenarios() {
  try {
    let list = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(list)) list = [];
    if (!localStorage.getItem(SEED_FLAG)) {
      localStorage.setItem(SEED_FLAG, "1");
      const have = new Set(list.map((x) => String(x?.name || "").toLowerCase()));
      list = [...list, ...seedList().filter((x) => !have.has(x.name.toLowerCase()))];
      localStorage.setItem(KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [];
  }
}
function persistScenarios(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/* ---------------------------
   Account storage (backend)
---------------------------- */
function authToken() {
  return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
}
async function api(path, options = {}) {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}`, ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}
function toEnvelope(item) {
  return { lib: 1, id: item.id, notes: item.notes || "", tags: item.tags || [], createdAt: item.createdAt || "", updatedAt: item.updatedAt || "", scenario: item.data || {} };
}
function fromRow(row) {
  const d = row?.data;
  if (d && d.lib === 1) {
    return { id: d.id || `srv-${row.id}`, serverId: row.id, name: row.name, notes: d.notes || "", tags: Array.isArray(d.tags) ? d.tags : [],
      data: d.scenario || {}, createdAt: d.createdAt || row.created_at || "", updatedAt: d.updatedAt || row.created_at || "" };
  }
  return { id: `srv-${row.id}`, serverId: row.id, name: row.name, notes: "", tags: [], data: d || {}, createdAt: row.created_at || "", updatedAt: row.created_at || "" };
}

function genId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}
function normalize(s = "") {
  return String(s || "").trim().toLowerCase();
}
function formatDate(iso) {
  try {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function useDebounced(value, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Esc close + basic tab trap for modal */
function useFocusTrap({ open, onClose }) {
  const modalRef = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setTimeout(() => firstRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const node = modalRef.current;
      const focusables = node?.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusables || []).filter((el) => el.offsetParent !== null);
      if (!list.length) return;

      const first = list[0];
      const last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return { modalRef, firstRef };
}

export default function ScenarioLibrary({ userPlan, getCurrentScenario, onApplyScenario }) {
  const [scenarios, setScenarios] = useState(loadScenarios());
  const scenariosRef = useRef(scenarios);
  scenariosRef.current = scenarios;
  const [accountSync, setAccountSync] = useState("idle"); // idle | ok | local

  // UI
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updatedDesc"); // updatedDesc | createdDesc | nameAsc
  const [activeTagFilters, setActiveTagFilters] = useState([]);
  const searchDebounced = useDebounced(search, 150);

  // modal edit/create
  const [editingId, setEditingId] = useState(null); // id | "NEW" | null
  const [draft, setDraft] = useState({
    id: "",
    name: "",
    notes: "",
    tags: [],
    data: {},
    createdAt: "",
    updatedAt: "",
  });
  const [tagInput, setTagInput] = useState("");

  const isPro = (userPlan || "").toLowerCase() !== "free";
  const BRAND = "#1D625B";

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setScenarios(loadScenarios());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ---------------------------
     CRUD helpers
  ---------------------------- */
  const NAME_MAX = 80;

  function validateName(name) {
    if (!name || !name.trim()) {
      showToast({ type: "error", message: "Scenario name is required." });
      return false;
    }
    if (name.length > NAME_MAX) {
      showToast({ type: "warn", message: `Name too long (>${NAME_MAX} chars).` });
      return false;
    }
    return true;
  }

  function nameConflicts(name, idToIgnore) {
    const n = normalize(name);
    return scenarios.some((s) => normalize(s.name) === n && s.id !== idToIgnore);
  }

  // Every change is kept on this device right away and sent to your account in the background.
  function commit(prev, next) {
    persistScenarios(next);
    setScenarios(next);
    syncDiff(prev, next);
  }

  async function syncDiff(prev, next) {
    if (!authToken()) return;
    try {
      const prevById = new Map(prev.map((x) => [x.id, x]));
      const nextIds = new Set(next.map((x) => x.id));
      for (const old of prev) {
        if (!nextIds.has(old.id) && old.serverId) await api(`/api/scenarios/${old.serverId}`, { method: "DELETE" });
      }
      for (const item of next) {
        const before = prevById.get(item.id);
        const serverId = item.serverId || before?.serverId || null;
        const changed = !before || before.updatedAt !== item.updatedAt || before.name !== item.name || !serverId;
        if (!changed) continue;
        if (before && before.name !== item.name && before.serverId) await api(`/api/scenarios/${before.serverId}`, { method: "DELETE" });
        const out = await api("/api/scenarios", { method: "POST", body: JSON.stringify({ name: item.name, data: toEnvelope(item) }) });
        setScenarios((cur) => {
          const upd = cur.map((x) => (x.id === item.id ? { ...x, serverId: out.id } : x));
          persistScenarios(upd);
          return upd;
        });
      }
      setAccountSync("ok");
    } catch (e) {
      setAccountSync("local");
      showToast({ type: "warn", message: "Saved on this device only. Could not reach your account." });
    }
  }

  function createScenario(payload) {
    commit(scenarios, [{ ...payload }, ...scenarios]);
  }

  function updateScenario(payload) {
    commit(scenarios, scenarios.map((s) => (s.id === payload.id ? { ...payload, serverId: s.serverId } : s)));
  }

  function deleteScenario(id) {
    commit(scenarios, scenarios.filter((s) => s.id !== id));
  }

  // Pull your saved scenarios from your account when the library opens, and upload any that only exist here.
  useEffect(() => {
    if (!authToken()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const out = await api("/api/scenarios");
        if (cancelled) return;
        const server = (out.scenarios || []).map(fromRow);
        const names = new Set(server.map((x) => String(x.name || "").toLowerCase()));
        const localOnly = scenariosRef.current.filter((x) => !x.serverId && !names.has(String(x.name || "").toLowerCase()));
        const toUpload = server.length > 0 ? localOnly.filter((x) => !x.seed) : localOnly;
        let merged = [...server, ...toUpload];
        setScenarios(merged);
        persistScenarios(merged);
        for (const item of toUpload) {
          const res = await api("/api/scenarios", { method: "POST", body: JSON.stringify({ name: item.name, data: toEnvelope(item) }) });
          if (cancelled) return;
          merged = merged.map((x) => (x.id === item.id ? { ...x, serverId: res.id } : x));
          setScenarios(merged);
          persistScenarios(merged);
        }
        setAccountSync("ok");
      } catch (e) {
        if (!cancelled) setAccountSync("local");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------------------------
     Open/close modal
  ---------------------------- */
  function openEdit(s) {
    setEditingId(s?.id || null);
    setDraft({
      id: s?.id || "",
      name: s?.name || "",
      notes: s?.notes || "",
      tags: Array.isArray(s?.tags) ? s.tags : [],
      data: s?.data || {},
      createdAt: s?.createdAt || "",
      updatedAt: s?.updatedAt || "",
    });
    setTagInput("");
  }

  function openNewFromCurrent() {
    const current = (() => {
      try {
        return getCurrentScenario?.();
      } catch {
        return null;
      }
    })();

    setEditingId("NEW");
    setDraft({
      id: "",
      name: "",
      notes: "",
      tags: [],
      data: current || {},
      createdAt: "",
      updatedAt: "",
    });
    setTagInput("");
  }

  function closeEdit() {
    setEditingId(null);
    setDraft({ id: "", name: "", notes: "", tags: [], data: {}, createdAt: "", updatedAt: "" });
    setTagInput("");
  }

  /* ---------------------------
     Save handlers
  ---------------------------- */
  async function onSaveChanges() {
    if (!isPro) return;

    const d = draft;
    if (!validateName(d.name)) return;

    if (nameConflicts(d.name, d.id)) {
      showToast({
        type: "warn",
        message: "Name already exists. Choose another name or use Save as New.",
      });
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      ...d,
      id: d.id || genId(),
      createdAt: d.createdAt || now,
      updatedAt: now,
    };

    if (!d.id) {
      createScenario(payload);
      showToast({ type: "success", message: "Scenario saved" });
    } else {
      updateScenario(payload);
      showToast({ type: "success", message: "Scenario updated" });
    }

    closeEdit();
  }

  async function onSaveAsNew() {
    if (!isPro) return;

    const d = { ...draft };
    if (!validateName(d.name)) return;

    let name = d.name;
    if (nameConflicts(name)) {
      const base = name.replace(/\s+\(\d+\)$/, "");
      let i = 2;
      while (nameConflicts(`${base} (${i})`)) i++;
      name = `${base} (${i})`;
      showToast({ type: "info", message: `Name in use. Saved as “${name}”.` });
    }

    const now = new Date().toISOString();
    const payload = {
      ...d,
      id: genId(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    createScenario(payload);
    showToast({ type: "success", message: "Saved as new" });
    closeEdit();
  }

  function onApply(s) {
    try {
      onApplyScenario?.(s.data, { name: s.name, id: s.id });
      showToast({ type: "success", message: `Applied: ${s.name}` });
    } catch (e) {
      showToast({ type: "error", message: e?.message || "Failed to apply scenario." });
    }
  }

  /* ---------------------------
     Search / filter / sort
  ---------------------------- */
  const allTags = useMemo(() => {
    const set = new Set();
    for (const s of scenarios) (s.tags || []).forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scenarios]);

  const filtered = useMemo(() => {
    const q = searchDebounced.trim().toLowerCase();
    const tagSet = new Set(activeTagFilters);

    let list = scenarios.filter((s) => {
      const matchQ =
        q.length === 0 ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q) ||
        (s.tags || []).some((t) => (t || "").toLowerCase().includes(q));

      const matchTags = tagSet.size === 0 || (s.tags || []).some((t) => tagSet.has(t));
      return matchQ && matchTags;
    });

    if (sort === "updatedDesc") {
      list = list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    } else if (sort === "createdDesc") {
      list = list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    } else if (sort === "nameAsc") {
      list = list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return list;
  }, [scenarios, searchDebounced, activeTagFilters, sort]);

  function toggleTag(tag) {
    setActiveTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function clearFilters() {
    setSearch("");
    setActiveTagFilters([]);
  }

  const { modalRef, firstRef } = useFocusTrap({ open: !!editingId, onClose: closeEdit });

  /* ---------------------------
     UI helpers (UPDATED: no gray fog)
  ---------------------------- */
  const cardShell =
    "rounded-2xl border border-emerald-900/40 bg-[#020617] shadow-[0_0_0_1px_rgba(16,185,129,0.25)]";
  const titleText = "text-slate-100";
  const subtleText = "text-slate-300";
  const btnBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const btnPrimary = `${btnBase} text-white hover:brightness-110`;
  const btnGhost = `${btnBase} bg-[#020617] text-slate-100 border border-emerald-900/40 hover:bg-[#04120e]`;
  const btnDanger = `${btnBase} bg-red-950/40 text-red-200 border border-red-900/40 hover:bg-red-950/60`;

  const activeScenarioLoaded = (() => {
    try {
      return !!getCurrentScenario?.();
    } catch {
      return false;
    }
  })();

  return (
    <div className="w-full">
      <div className={`${cardShell} p-5`}>
        {/* Header row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND }} aria-hidden="true" />
              <h2 className={`text-xl font-bold ${titleText}`}>Scenario Library</h2>

              <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-900/40 bg-[#04120e] text-emerald-100">
                Plan: {isPro ? "Pro" : "Free"}
              </span>

              {accountSync !== "idle" && (
                <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-900/30 bg-[#020617] text-slate-300">
                  {accountSync === "ok" ? "Saved to your account" : "This device only"}
                </span>
              )}

              {activeScenarioLoaded ? (
                <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-800/60 bg-emerald-950/30 text-emerald-200">
                  Active scenario loaded
                </span>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-full border border-emerald-900/30 bg-[#020617] text-slate-300">
                  No scenario active
                </span>
              )}
            </div>

            <p className={`text-sm ${subtleText} mt-1`}>
              Save, manage, and apply scenario configurations to simulation runs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isPro && (
              <span className="text-xs px-2 py-1 rounded-full border border-amber-800/50 bg-amber-950/30 text-amber-200">
                Saving/editing is Pro-gated
              </span>
            )}

            <button
              onClick={openNewFromCurrent}
              className={btnPrimary}
              style={{ background: BRAND }}
              title="Create a new saved scenario from your current scenario configuration"
              disabled={!isPro}
            >
              ➕ Save Current
            </button>
          </div>
        </div>

        {/* Controls row */}
        <div className="mt-4 grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-emerald-900/40 bg-[#020617] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-700/40"
              placeholder="Search name, notes, or tags…"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-xl border border-emerald-900/40 bg-[#020617] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-700/40"
            >
              <option value="updatedDesc">Sort: Updated (newest)</option>
              <option value="createdDesc">Sort: Created (newest)</option>
              <option value="nameAsc">Sort: Name (A → Z)</option>
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-2">
            {(search.trim() || activeTagFilters.length > 0) && (
              <button className={btnGhost} onClick={clearFilters} title="Clear search & tag filters">
                Clear
              </button>
            )}

            <div className="text-xs text-slate-400">
              Showing{" "}
              <span className="text-slate-200 font-semibold">{filtered.length}</span> /{" "}
              <span className="text-slate-200 font-semibold">{scenarios.length}</span>
            </div>
          </div>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {allTags.map((t) => {
              const active = activeTagFilters.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition ${
                    active
                      ? "bg-emerald-900/40 text-emerald-100 border-emerald-700/60"
                      : "bg-[#020617] text-slate-200 border-emerald-900/30 hover:bg-[#04120e]"
                  }`}
                  aria-pressed={active}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}

        {/* List header */}
        <div className="mt-5 rounded-xl border border-emerald-900/40 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 bg-[#04120e] px-3 py-2 text-[11px] text-emerald-200 border-b border-emerald-900/40">
            <div className="col-span-5 font-semibold">Scenario</div>
            <div className="col-span-3 font-semibold">Tags</div>
            <div className="col-span-2 font-semibold">Updated</div>
            <div className="col-span-2 font-semibold text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-emerald-900/30 bg-[#020617]">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-300">
                No scenarios found. Try clearing filters or saving your current scenario.
              </div>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-12 gap-2 px-3 py-3 bg-[#020617] hover:bg-[#04120e] transition"
                >
                  {/* Scenario */}
                  <div className="col-span-5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full" style={{ background: BRAND }} aria-hidden="true" />
                      <div className="text-sm font-bold text-slate-100 truncate">
                        {s.name || "Untitled Scenario"}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 line-clamp-1">
                      {s.notes ? s.notes : "No notes"}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="col-span-3 flex flex-wrap gap-2 items-start">
                    {(s.tags || []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-1 rounded-full border border-emerald-900/30 bg-[#04120e] text-slate-100"
                      >
                        #{t}
                      </span>
                    ))}
                    {(s.tags || []).length > 3 && (
                      <span className="text-[11px] text-slate-400">+{(s.tags || []).length - 3}</span>
                    )}
                    {(s.tags || []).length === 0 && <span className="text-[11px] text-slate-500">—</span>}
                  </div>

                  {/* Updated */}
                  <div className="col-span-2 text-[11px] text-slate-300">
                    {formatDate(s.updatedAt)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      className={btnPrimary}
                      style={{ background: BRAND }}
                      onClick={() => onApply(s)}
                      title="Apply this scenario"
                    >
                      Apply
                    </button>

                    <button
                      className={btnGhost}
                      onClick={() => openEdit(s)}
                      disabled={!isPro}
                      title={!isPro ? "Upgrade to edit scenarios" : "Edit scenario"}
                    >
                      Edit
                    </button>

                    <button
                      className={btnDanger}
                      disabled={!isPro}
                      onClick={() => {
                        if (!isPro) return;
                        const ok = window.confirm(`Delete scenario "${s.name}"? This cannot be undone.`);
                        if (!ok) return;
                        deleteScenario(s.id);
                        showToast({ type: "success", message: "Deleted" });
                      }}
                      title={!isPro ? "Upgrade to delete scenarios" : "Delete scenario"}
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {!!editingId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={closeEdit} aria-hidden="true" />

          <div
            ref={modalRef}
            className="relative w-full max-w-2xl rounded-2xl border border-emerald-900/40 bg-[#020617] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Scenario editor"
          >
            <div className="p-4 border-b border-emerald-900/40 flex items-center justify-between bg-[#04120e]">
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-100">
                  {draft.id ? "Edit Scenario" : "New Scenario"}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Save Changes updates the existing scenario. Save as New creates a copy.
                </div>
              </div>

              <button className={btnGhost} onClick={closeEdit}>
                ✖ Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-300">Scenario name</label>
                <input
                  ref={firstRef}
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-emerald-900/40 bg-[#020617] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-700/40"
                  placeholder="e.g., Mexico tariff shock + supplier switch"
                  disabled={!isPro}
                />
              </div>

              <div>
                <label className="text-xs text-slate-300">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 w-full min-h-[90px] rounded-xl border border-emerald-900/40 bg-[#020617] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-700/40"
                  placeholder="What changed? What risk is this testing?"
                  disabled={!isPro}
                />
              </div>

              <div>
                <label className="text-xs text-slate-300">Tags</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="w-full rounded-xl border border-emerald-900/40 bg-[#020617] px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-700/40"
                    placeholder="Type a tag, press Enter"
                    disabled={!isPro}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!isPro) return;
                        const raw = tagInput.trim();
                        if (!raw) return;
                        if ((draft.tags || []).includes(raw)) {
                          setTagInput("");
                          return;
                        }
                        setDraft((p) => ({ ...p, tags: [...(p.tags || []), raw] }));
                        setTagInput("");
                      }
                    }}
                  />
                  <button
                    className={btnPrimary}
                    style={{ background: BRAND }}
                    disabled={!isPro}
                    onClick={() => {
                      if (!isPro) return;
                      const raw = tagInput.trim();
                      if (!raw) return;
                      if ((draft.tags || []).includes(raw)) {
                        setTagInput("");
                        return;
                      }
                      setDraft((p) => ({ ...p, tags: [...(p.tags || []), raw] }));
                      setTagInput("");
                    }}
                  >
                    Add
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(draft.tags || []).length === 0 ? (
                    <span className="text-[11px] text-slate-500">No tags</span>
                  ) : (
                    (draft.tags || []).map((t) => (
                      <button
                        key={t}
                        className="text-[11px] px-2 py-1 rounded-full border border-emerald-900/30 bg-[#04120e] text-slate-100 hover:bg-emerald-900/30"
                        onClick={() => {
                          if (!isPro) return;
                          setDraft((p) => ({ ...p, tags: (p.tags || []).filter((x) => x !== t) }));
                        }}
                        disabled={!isPro}
                        title={!isPro ? "Upgrade to edit tags" : "Remove tag"}
                      >
                        #{t} ✕
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-900/30 bg-[#020617] p-3">
                <div className="text-xs text-slate-200 font-semibold">Scenario payload</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Stored exactly as your current scenario configuration object (used by Apply).
                </div>
                <pre className="mt-2 max-h-52 overflow-auto text-[11px] text-slate-200 bg-black/40 rounded-xl p-3 border border-emerald-900/30">
{JSON.stringify(draft.data || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-emerald-900/40 flex items-center justify-end gap-2 bg-[#020617]">
              <button className={btnGhost} onClick={closeEdit}>
                Cancel
              </button>

              <button
                className={btnGhost}
                onClick={onSaveAsNew}
                disabled={!isPro}
                title={!isPro ? "Upgrade to save scenarios" : "Create a new scenario copy"}
              >
                Save as New
              </button>

              <button
                className={btnPrimary}
                style={{ background: BRAND }}
                onClick={onSaveChanges}
                disabled={!isPro}
                title={!isPro ? "Upgrade to save/edit scenarios" : "Save changes"}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
