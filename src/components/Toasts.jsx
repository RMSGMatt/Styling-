import React, { useEffect, useState } from "react";

/** Fire a toast anywhere: showToast({ type: 'success'|'error'|'warn'|'info', message }) */
export function showToast({ type = "info", message = "" }) {
  window.dispatchEvent(new CustomEvent("toast", { detail: { type, message } }));
}

/** Mount once (e.g., inside App.jsx root). */
export default function ToastsHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, ...e.detail }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 2200);
    };
    window.addEventListener("toast", onToast);
    return () => window.removeEventListener("toast", onToast);
  }, []);

  const color = (type) =>
    type === "success" ? "bg-emerald-600" :
    type === "error"   ? "bg-red-600" :
    type === "warn"    ? "bg-amber-600" : "bg-gray-800";

  return (
    <div className="fixed z-[9999] top-4 right-4 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`text-white px-3 py-2 rounded-xl shadow ${color(t.type)}`}
          role="status"
          aria-live="polite"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
