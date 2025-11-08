console.log(">>> Loaded ScenarioLibrary from [components]");
console.log(">>> Loaded ScenarioLibrary from [ControlTowerEnhancements]");

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ScenarioLibrary.jsx — Live (edit + search + tag filters + PATCHED EDIT SAVE + debounce + a11y)
 * - Lists scenarios from /scenario/list (Pro/Enterprise only)
 * - Save current scenario by name via /scenario/save
 * - Edit (rename/notes/tags) existing via /scenario/save with { id, name, data, notes, tags }
 *   (We load scenario.data when opening the edit modal and include it on Save)
 * - Save as New via /scenario/save without id (cloned data)
 * - Load & Delete via /scenario/load/:id and /scenario/delete/:id
 * - Search by name/notes; filter by tags (multi-select)
 * - Debounced search; modal focus-trap + Esc
 */

const API_BASE =
  (import.meta?.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/$/, "")) ||
  `${window.location.origin}/api`;


const BRAND_BTN = "bg-[#1D625B] text-white hover:bg-[#144c45]";
const BTN = "px-3 py-2 rounded-xl border";
const CARD = "p-4 bg-white rounded-2xl shadow border border-gray-100";

export default function ScenarioLibrary({
  onApplyScenario,
  userPlan,
  getCurrentScenario,
  className = "",
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  // ---- Edit modal state ----
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null); // {id, name, ...}
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState([]); // array of strings
  const [tagInput, setTagInput] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editData, setEditData] = useState(null); // full scenario.data for Save Changes
  const [editDataLoading, setEditDataLoading] = useState(false);

  // ---- Search & Tag filters ----
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState([]); // unique tag strings

  // Debounced search (150ms)
  const [searchDebounced, setSearchDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  const token = localStorage.getItem("token");
  const plan = (userPlan || localStorage.getItem("plan") || "").toLowerCase();
  const isPro = useMemo(() => ["pro", "enterprise"].includes(plan), [plan]);

  useEffect(() => {
    if (isPro) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.msg || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function refreshList() {
    try {
      setLoading(true);
      const rows = await api("/scenario/list");
      const norm = (x) => ({
        ...x,
        notes: x?.notes ?? "",
        tags: Array.isArray(x?.tags) ? x.tags : [],
      });
      const sorted = Array.isArray(rows)
        ? [...rows]
            .map(norm)
            .sort((a, b) => {
              const da = new Date(a.updated_at || a.created_at || 0).getTime();
              const db = new Date(b.updated_at || b.created_at || 0).getTime();
              return db - da;
            })
        : [];
      setItems(sorted);
      setStatus("");
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!isPro) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("Please enter a name.");
      return;
    }
    // Prefer parent-provided scenario; fall back to Dashboard-wrote localStorage
    let payload =
      typeof getCurrentScenario === "function" ? (getCurrentScenario() || {}) : {};
    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      try {
        const raw = localStorage.getItem("currentScenario");
        if (raw) payload = JSON.parse(raw);
      } catch {}
    }
    try {
      setSaving(true);
      const out = await api("/scenario/save", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, data: payload }),
      });
      setStatus(`Saved: ${out.name} (${out.action || "created"})`);
      setName("");
      await refreshList();
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad(id) {
    try {
      setLoading(true);
      const out = await api(`/scenario/load/${id}`);

      // Normalize payload (object or JSON string)
      let payload = out?.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch {}
      }

      if (payload && typeof payload === "object" && Object.keys(payload).length) {
        if (typeof onApplyScenario === "function") {
          onApplyScenario(payload, { id: out.id, name: out.name });
        }
        try {
          localStorage.setItem("currentScenario", JSON.stringify(payload));
          localStorage.setItem("currentScenarioName", out.name || "");
        } catch {}
        setStatus(`Loaded: ${out.name}`);

        // Navigate to Simulation so it auto-applies on mount
        if (typeof window !== "undefined") {
          window.location.href = "/simulation";
        }
      } else {
        setStatus("No data in this scenario (empty). Try saving again after setting a preset/builder.");
      }
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this scenario?")) return;
    try {
      setDeletingId(id);
      await api(`/scenario/delete/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.id !== id));
      setStatus("Deleted.");
    } catch (e) {
      setStatus(`Delete failed: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString();
  }

  // ---------- Edit Modal handlers ----------
  async function openEdit(row) {
    if (!isPro) return;
    setEditRow(row);
    setEditName(row?.name || "");
    setEditNotes(row?.notes || "");
    setEditTags(Array.isArray(row?.tags) ? row.tags : []);
    setTagInput("");
    setEditError("");
    setEditOpen(true);

    // Load full scenario.data so Save Changes can include it
    try {
      setEditDataLoading(true);
      const loaded = await api(`/scenario/load/${row.id}`);
      let payload = loaded?.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch {}
      }
      setEditData(payload || {}); // even {} is fine; backend requires data present
    } catch (e) {
      setEditError(e.message || "Failed to load scenario data.");
      setEditData(null);
    } finally {
      setEditDataLoading(false);
    }
  }

  function closeEdit() {
    setEditOpen(false);
    setEditRow(null);
    setEditName("");
    setEditNotes("");
    setEditTags([]);
    setTagInput("");
    setEditError("");
    setEditData(null);
    setEditDataLoading(false);
  }

  function validateEdit() {
    const n = editName.trim();
    if (!n) return "Name is required.";
    if (n.length > 80) return "Name must be ≤ 80 characters.";
    for (const t of editTags) {
      if (!t || t.length > 24) return "Each tag must be 1–24 chars.";
      if (!/^[\w\- ]+$/.test(t)) return "Tags may contain letters, numbers, spaces, _ and - only.";
    }
    return "";
  }

  function addTagFromInput() {
    const raw = tagInput.trim();
    if (!raw) return;
    if (editTags.includes(raw)) { setTagInput(""); return; }
    if (raw.length > 24 || !/^[\w\- ]+$/.test(raw)) {
      setEditError("Tags may contain letters, numbers, spaces, _ and - only (≤24 chars).");
      return;
    }
    setEditTags((prev) => [...prev, raw]);
    setTagInput("");
  }

  function removeTag(tag) {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  }

  async function saveEditUpdate() {
    if (!editRow) return;
    const err = validateEdit();
    if (err) { setEditError(err); return; }

    try {
      setEditSaving(true);

      // Ensure we have data; if not yet loaded, fetch now
      let dataToSend = editData;
      if (dataToSend == null) {
        try {
          const loaded = await api(`/scenario/load/${editRow.id}`);
          let payload = loaded?.data;
          if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch {}
          }
          dataToSend = payload || {};
        } catch (e) {
          setEditError("Unable to fetch scenario data for update. Please try again.");
          setEditSaving(false);
          return;
        }
      }

      const body = {
        id: editRow.id,
        name: editName.trim(),
        data: dataToSend,
        notes: editNotes,
        tags: editTags,
      };

      const out = await api("/scenario/save", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setStatus(`Updated: ${out.name}`);
      // optimistic update
      setItems((prev) =>
        prev.map((r) =>
          r.id === editRow.id
            ? { ...r, name: editName.trim(), notes: editNotes, tags: editTags, updated_at: new Date().toISOString() }
            : r
        )
      );
      closeEdit();
    } catch (e) {
      setEditError(e.message || "Update failed.");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveAsNewFromExisting() {
    if (!editRow) return;
    const err = validateEdit();
    if (err) { setEditError(err); return; }
    try {
      setEditSaving(true);
      // Use already-loaded data if present, else load now
      let payload = editData;
      if (payload == null) {
        const loaded = await api(`/scenario/load/${editRow.id}`);
        payload = loaded?.data;
        if (typeof payload === "string") {
          try { payload = JSON.parse(payload); } catch {}
        }
      }
      const out = await api("/scenario/save", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim(),
          data: payload || {},
          notes: editNotes,
          tags: editTags,
        }),
      });
      setStatus(`Saved as new: ${out.name}`);
      await refreshList();
      closeEdit();
    } catch (e) {
      setEditError(e.message || "Save as new failed.");
    } finally {
      setEditSaving(false);
    }
  }

  // ---------- Search & Tag filtering ----------
  const allTags = useMemo(() => {
    const s = new Set();
    for (const r of items) (r.tags || []).forEach((t) => s.add(t));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchDebounced.trim().toLowerCase();
    const tagSet = new Set(activeTags);
    return items.filter((r) => {
      const matchQ =
        q.length === 0 ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q);
      const matchTags =
        tagSet.size === 0 || (r.tags || []).some((t) => tagSet.has(t));
      return matchQ && matchTags;
    });
  }, [items, searchDebounced, activeTags]);

  const filtersActive = searchDebounced.trim().length > 0 || activeTags.length > 0;
  function toggleTag(tag) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }
  function clearFilters() {
    setSearch("");
    setActiveTags([]);
  }

  // ---------- Modal Focus Trap (a11y) ----------
  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!editOpen) return;

    // Focus first control
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeEdit();
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const list = Array.from(focusables).filter(
          (el) => el.offsetParent !== null // visible
        );
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editOpen]);

  // ---------- Render ----------
  return (
    <div className={`w-full ${className}`}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Save Panel */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Scenario Library</h2>
            <PlanBadge plan={plan} />
          </div>

          {!isPro && <UpsellBanner />}

          <div className="mt-2">
            <label className="block text-sm mb-1">Scenario name</label>
            <input
              type="text"
              placeholder={isPro ? "e.g., Quarterly stress test" : "Pro required"}
              className="w-full px-3 py-2 border rounded-xl focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isPro}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSave}
                disabled={!isPro || saving}
                className={`px-4 py-2 rounded-xl shadow ${
                  isPro ? BRAND_BTN : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving…" : "Save Scenario"}
              </button>
              <button
                onClick={refreshList}
                disabled={!isPro || loading}
                className={`${BTN} ${!isPro ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                title="Refresh list"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {status && <p className="text-sm mt-2 opacity-80">{status}</p>}
          </div>
        </div>

        {/* List Panel */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">My Scenarios</h3>
            {loading && <span className="text-sm">Loading…</span>}
          </div>

          {/* Search + Tag Filters */}
          <div className="mb-2 space-y-2">
            <div className="flex gap-2">
              <label htmlFor="scenario-search" className="sr-only">Search scenarios</label>
              <input
                id="scenario-search"
                aria-label="Search scenarios by name or notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:outline-none"
                placeholder="Search by name or notes…"
              />
              {filtersActive && (
                <button onClick={clearFilters} className={`${BTN} hover:bg-gray-50`} title="Clear filters" aria-label="Clear search and tag filters">
                  Clear
                </button>
              )}
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map((t) => {
                  const active = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active ? "bg-[#1D625B] text-white border-[#1D625B]" : "bg-gray-50"
                      }`}
                      aria-pressed={active}
                      aria-label={active ? `Remove tag filter ${t}` : `Filter by tag ${t}`}
                      title={active ? "Click to remove filter" : "Click to filter by tag"}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-gray-500">
              {filteredItems.length} {filteredItems.length === 1 ? "scenario" : "scenarios"}
            </div>
          </div>

          {!isPro ? (
            <p className="text-sm text-gray-500">
              Upgrade to Pro to save and view scenarios.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-gray-500">
              {items.length === 0
                ? "No scenarios yet. Save one on the left."
                : "No scenarios match your filters."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((row) => (
                <li key={row.id} className="p-3 border rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <span className="truncate">{row.name}</span>
                        {/* edit pencil */}
                        <button
                          disabled={!isPro}
                          onClick={() => openEdit(row)}
                          className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50 disabled:opacity-50"
                          title="Edit"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                      {row.tags?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.tags.map((t) => (
                            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs opacity-70 mt-1">
                        {fmtDate(row.updated_at || row.created_at)}
                        {row.notes ? ` • ${row.notes.slice(0, 80)}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleLoad(row.id)}
                        className={`${BTN} hover:bg-gray-50`}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className={`${BTN} text-red-600 hover:bg-red-50 disabled:opacity-50`}
                      >
                        {deletingId === row.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ----- Edit Modal ----- */}
      {editOpen && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-scenario-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 id="edit-scenario-title" className="text-lg font-semibold">Edit Scenario</h4>
              <button className="text-gray-500 hover:text-black" onClick={closeEdit} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Name *</label>
                <input
                  ref={nameInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none"
                  maxLength={80}
                  placeholder="Scenario name"
                  aria-invalid={!!editError}
                  aria-describedby={editError ? "edit-error" : undefined}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none"
                  rows={3}
                  placeholder="Add optional notes"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Tags</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTagFromInput();
                      }
                    }}
                    className="flex-1 px-3 py-2 border rounded-xl focus:outline-none"
                    placeholder="Type a tag and press Enter"
                    maxLength={24}
                  />
                  <button onClick={addTagFromInput} className={`${BTN} hover:bg-gray-50`}>
                    Add
                  </button>
                </div>
                {editTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editTags.map((t) => (
                      <span key={t} className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                        #{t}{" "}
                        <button
                          onClick={() => removeTag(t)}
                          className="ml-1 text-gray-500 hover:text-black"
                          title="Remove tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {editDataLoading && <p className="text-sm text-gray-500">Loading scenario data…</p>}
              {editError && <p id="edit-error" className="text-sm text-red-600">{editError}</p>}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-500">
                  {editRow?.id ? `ID: ${editRow.id}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveAsNewFromExisting}
                    disabled={editSaving}
                    className={`${BTN} hover:bg-gray-50`}
                    title="Create a new scenario using the same data with updated metadata"
                  >
                    Save as New
                  </button>
                  <button
                    onClick={saveEditUpdate}
                    disabled={editSaving || editDataLoading}
                    className={`px-4 py-2 rounded-xl shadow ${BRAND_BTN}`}
                    title={editDataLoading ? "Please wait, loading scenario data…" : "Save changes to this scenario"}
                  >
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ----- /Edit Modal ----- */}
    </div>
  );
}

function PlanBadge({ plan }) {
  const label = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Unknown";
  return (
    <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">{label}</span>
  );
}

function UpsellBanner() {
  return (
    <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border">
      <div className="text-sm font-medium">Pro feature</div>
      <div className="text-xs opacity-80">
        Upgrade to save, load, and manage scenarios.
      </div>
    </div>
  );
}
