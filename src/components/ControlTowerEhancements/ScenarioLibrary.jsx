/* eslint-disable no-console */
console.log(">>> Loaded ScenarioLibrary from [ControlTowerEnhancements]");

import React, { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "../Toasts";

/* ---------------------------
   Local storage “DB”
---------------------------- */
const KEY = "forc_scenarios";

function loadScenarios() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function persistScenarios(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
function genId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}

/* ---------------------------
   Hooks: debounce + focus trap
---------------------------- */
function useDebounced(value, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Basic focus trap + Esc close for a modal */
function useFocusTrap({ open, onClose }) {
  const modalRef = useRef(null);
  const firstRef = useRef(null);
  const lastRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const node = modalRef.current;
    setTimeout(() => firstRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = node?.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(focusables || []);
      if (list.length === 0) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return { modalRef, firstRef, lastRef };
}

/* ---------------------------
   Component
---------------------------- */
export default function ScenarioLibrary({
  userPlan,
  getCurrentScenario,
  onApplyScenario,
}) {
  const [scenarios, setScenarios] = useState(loadScenarios());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // the scenario being edited
  const [draft, setDraft] = useState({ id: "", name: "", notes: "", tags: [], data: {} });
  const [tagInput, setTagInput] = useState("");

  const debouncedSearch = useDebounced(search, 150);

  // filter by name/notes/tags
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return scenarios;
    return scenarios.filter((s) =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q) ||
      (s.tags || []).some((t) => (t || "").toLowerCase().includes(q))
    );
  }, [scenarios, debouncedSearch]);

  const resultCount = filtered.length;

  // active scenario (surface in header)
  const activeScenario = (() => {
    try { return getCurrentScenario?.(); } catch { return null; }
  })();

  useEffect(() => {
    // reflect storage updates from elsewhere
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
  const normalize = (s = "") => s.trim().toLowerCase();

  function validateName(name) {
    if (!name || !name.trim()) {
      showToast({ type: "error", message: "Name is required." });
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

  function openEdit(s) {
    setEditing(s?.id || null);
    setDraft({
      id: s?.id || "",
      name: s?.name || "",
      notes: s?.notes || "",
      tags: Array.isArray(s?.tags) ? s.tags : [],
      data: s?.data || {},
    });
    setTagInput("");
  }

  function closeEdit() {
    setEditing(null);
    setDraft({ id: "", name: "", notes: "", tags: [], data: {} });
    setTagInput("");
  }

  function createScenario(payload) {
    const next = [{ ...payload }, ...scenarios];
    persistScenarios(next);
    setScenarios(next);
  }

  function updateScenario(payload) {
    const next = scenarios.map((s) => (s.id === payload.id ? { ...payload } : s));
    persistScenarios(next);
    setScenarios(next);
  }

  function deleteScenario(id) {
    const next = scenarios.filter((s) => s.id !== id);
    persistScenarios(next);
    setScenarios(next);
  }

  /* ---------------------------
     Save handlers
  ---------------------------- */
  async function onSaveChanges() {
    const d = draft;
    if (!validateName(d.name)) return;
    if (nameConflicts(d.name, d.id)) {
      showToast({
        type: "warn",
        message: "Name already exists. Choose another name or use Save as New.",
      });
      return;
    }
    const payload = {
      ...d,
      id: d.id || genId(),
      updatedAt: new Date().toISOString(),
    };
    updateScenario(payload);
    showToast({ type: "success", message: "Updated" });
    closeEdit();
  }

  async function onSaveAsNew() {
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
    const payload = {
      ...d,
      id: genId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createScenario(payload);
    showToast({ type: "success", message: "Saved as new" });
    closeEdit();
  }

  function onConfirmDelete(id) {
    if (!window.confirm("Delete this scenario?")) return;
    deleteScenario(id);
    showToast({ type: "success", message: "Deleted" });
    if (editing && editing === id) closeEdit();
  }

  /* ---------------------------
     Tag UX
  ---------------------------- */
  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!(draft.tags || []).includes(t)) {
      setDraft((prev) => ({ ...prev, tags: [...(prev.tags || []), t] }));
    }
    setTagInput("");
  }
  function removeTag(idx) {
    const next = [...(draft.tags || [])];
    next.splice(idx, 1);
    setDraft((prev) => ({ ...prev, tags: next }));
  }
  function onTagKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
    if (e.key === "Backspace" && !tagInput) {
      e.preventDefault();
      if ((draft.tags || []).length > 0) removeTag((draft.tags || []).length - 1);
    }
  }

  /* ---------------------------
     Apply scenario (calls parent)
  ---------------------------- */
  function applyScenario(s) {
    try {
      onApplyScenario?.(s?.data || {}, { id: s.id, name: s.name, notes: s.notes, tags: s.tags });
      showToast({ type: "success", message: `Applied “${s.name}”` });
    } catch (e) {
      showToast({ type: "error", message: "Failed to apply scenario" });
    }
  }

  /* ---------------------------
     Modal A11y hook
  ---------------------------- */
  const isModalOpen = !!editing;
  const { modalRef, firstRef, lastRef } = useFocusTrap({
    open: isModalOpen,
    onClose: closeEdit,
  });

  /* ---------------------------
     Render
  ---------------------------- */
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1D625B] to-[#174F47] text-white rounded-2xl shadow-md p-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">📁 Scenario Library</h1>
          <p className="text-sm opacity-90">
            Save, edit, and apply what-if scenarios. Search by name, notes, or tags.
          </p>
        </div>
        <div className="mt-2 md:mt-0 bg-[#ABFA7D]/20 text-[#ABFA7D] font-semibold px-4 py-2 rounded-lg border border-[#ABFA7D]/30">
  {userPlan || "Free"} Plan
</div>
      </div>

      {/* Active scenario pill (from Control Tower) */}
      {activeScenario?.name && (
        <div className="mb-3 text-sm">
          Active scenario:{" "}
          <span className="font-medium">{activeScenario.name}</span>
        </div>
      )}

      {/* Search + count */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by name, notes, or tag…"
className="border rounded-xl px-3 py-2 w-full md:w-80 shadow-sm"
          aria-label="Search scenarios"
        />
        <span
          className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
          aria-live="polite"
        >
          {resultCount}
        </span>
        <button
  className="bg-[#1D625B] hover:bg-[#174F47] text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
  onClick={() => openEdit({ id: "", name: "", notes: "", tags: [], data: {} })}
>
  + New Scenario
</button>

      </div>

      {/* ===================== Unassigned Runs (no scenario) ===================== */}
      {(() => {
        let all = [];
        try { all = JSON.parse(localStorage.getItem("reports") || "[]"); } catch {}
        const unassigned = all.filter(r => !r.scenario?.name);

        if (unassigned.length === 0) return null;

        const openTopOutput = (r) => {
          const u = r.urls || {};
          const url =
            u.projected_impact_output_file_url ||
            u.inventory_output_file_url ||
            u.production_output_file_url ||
            u.flow_output_file_url ||
            u.occurrence_output_file_url;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        };

        const goToReports = () => {
          if (typeof window.__FORC_SWITCHVIEW === "function") {
            window.__FORC_SWITCHVIEW("reports");
          } else {
            window.location.href = "/";
          }
        };

        const recent = unassigned
          .slice()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 3);

        return (
          <div className="mb-4 p-4 bg-white border border-amber-200 rounded-2xl shadow-sm">
            <div className="text-sm font-semibold text-amber-800">Unassigned Runs</div>
            <div className="text-xs text-amber-700/80">
              These runs were created without a scenario applied.
            </div>

            <ul className="mt-2 text-xs text-gray-700 space-y-1">
              {recent.map((r) => (
                <li key={`${r.id}-${r.timestamp}`} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={r.timestamp}>{r.timestamp}</span>
                  <button
                    className="px-2 py-1 rounded-lg border border-gray-300"
                    onClick={() => openTopOutput(r)}
                    title="Open a top output"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Total:</span>
              <span className="text-xs font-medium">{unassigned.length}</span>
              <button
                className="ml-auto px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-xs"
                onClick={goToReports}
              >
                View all in Reports →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ===================== List ===================== */}
      {filtered.length === 0 ? (
        <div className="p-4 rounded-xl border border-gray-200 bg-white text-gray-600">
          No scenarios yet. Click <strong>+ New</strong> to create one.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  {s.notes && (
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2" title={s.notes}>
                      {s.notes}
                    </div>
                  )}
                  {(s.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.tags.map((t, i) => (
                        <span
                          key={t + i}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={t}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ✅ Recent Runs (from Reports) — strictly by scenario name */}
                  {(() => {
                    let all = [];
                    try { all = JSON.parse(localStorage.getItem("reports") || "[]"); } catch {}
                    const runs = all.filter(r => r.scenario?.name === s.name);
                    if (runs.length === 0) return null;

                    const recent = runs
                      .slice()
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .slice(0, 3);

                    const openTopOutput = (r) => {
                      const u = r.urls || {};
                      const url =
                        u.projected_impact_output_file_url ||
                        u.inventory_output_file_url ||
                        u.production_output_file_url ||
                        u.flow_output_file_url ||
                        u.occurrence_output_file_url;
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    };

                    const goToReports = () => {
                      try { localStorage.setItem("reportsScenarioFilter", s.name); } catch {}
                      if (typeof window.__FORC_SWITCHVIEW === "function") {
                        window.__FORC_SWITCHVIEW("reports");
                      } else {
                        window.location.href = "/";
                      }
                    };

                    return (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Recent Runs: <span className="font-medium">{runs.length}</span>
                        </div>
                        <ul className="text-xs text-gray-700 space-y-1">
                          {recent.map((r) => (
                            <li
                              key={`${r.id}-${r.timestamp}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate" title={r.timestamp}>
                                {r.timestamp}
                              </span>
                              <button
                                className="px-2 py-1 rounded-lg border border-gray-300"
                                onClick={() => openTopOutput(r)}
                                title="Open a top output"
                              >
                                Open
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2">
                          <button
                            className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-xs"
                            onClick={goToReports}
                          >
                            View all in Reports →
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    onClick={() => applyScenario(s)}
                    title="Apply to dashboard"
                  >
                    Apply
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    onClick={() => openEdit(s)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm"
                    onClick={() => onConfirmDelete(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== Edit/Rename Modal ===================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          aria-hidden={!isModalOpen}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-edit-title"
            className="w-[95vw] max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between">
              <h2 id="scenario-edit-title" className="text-lg font-semibold">
                {editing ? "Edit Scenario" : "New Scenario"}
              </h2>
              <button
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                onClick={closeEdit}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Name */}
            <label htmlFor="scenario-name" className="text-sm font-medium mt-4 block">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstRef}
              id="scenario-name"
              aria-required="true"
              maxLength={NAME_MAX + 10}
              className="w-full border rounded-xl px-3 py-2 mt-1"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Max {NAME_MAX} characters. Use a unique name.</p>

            {/* Notes */}
            <label htmlFor="scenario-notes" className="text-sm font-medium mt-4 block">
              Notes
            </label>
            <textarea
              id="scenario-notes"
              rows={3}
              className="w-full border rounded-xl px-3 py-2 mt-1"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />

            {/* Tags */}
            <div className="mt-4">
              <label className="text-sm font-medium block">Tags</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={onTagKeyDown}
                  placeholder="Type a tag and press Enter"
                  aria-label="Add tag"
                  className="flex-1 border rounded-xl px-3 py-2"
                />
                <button
                  className="px-3 py-2 rounded-xl border border-gray-300 text-sm"
                  onClick={addTag}
                >
                  Add
                </button>
              </div>
              {(draft.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {draft.tags.map((t, i) => (
                    <button
                      key={t + i}
                      className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none focus:ring-2"
                      onClick={() => removeTag(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Delete") removeTag(i);
                      }}
                      aria-label={`Remove tag ${t}`}
                    >
                      {t} ⌫
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              {editing && (
                <button
                  className="px-3 py-2 rounded-xl border border-gray-300 text-sm"
                  onClick={onSaveChanges}
                >
                  Save Changes
                </button>
              )}
              <button
                className="px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm"
                onClick={onSaveAsNew}
                ref={lastRef}
              >
                Save as New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
