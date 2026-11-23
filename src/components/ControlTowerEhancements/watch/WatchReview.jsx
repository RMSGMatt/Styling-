/**
 * Admin: the incident watcher's review queue for the shadow run. Approve publishes an entry to the customer's
 * watch log; reject hides it. The scorecard tracks the Phase 3 targets: at least four in five escalations judged
 * relevant, and no real event at a network site dismissed by the model.
 */
import React, { useEffect, useMemo, useState } from "react";
import { fetchReviewQueue, reviewEntry, LEVEL_LABEL, IMPACT_LABEL, shortDate, outageText } from "./watchApi";

const FILTERS = [
  { id: "pending_review", label: "Waiting for review" },
  { id: "published", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "dismissed", label: "Dismissed by the model" },
  { id: "all", label: "All" },
];
const LEVEL_TONE = { direct: "bg-red-50 text-red-700 border-red-200", supplier: "bg-amber-50 text-amber-700 border-amber-200", commodity: "bg-gray-50 text-gray-600 border-gray-200" };

function rate(n, d) {
  return d ? `${n} of ${d} (${Math.round((100 * n) / d)}%)` : "none reviewed yet";
}

export default function WatchReview() {
  const [filter, setFilter] = useState("pending_review");
  const [all, setAll] = useState([]);
  const [reviewOn, setReviewOn] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = () => fetchReviewQueue("all").then((b) => { setAll(b.entries || []); setReviewOn(b.review_on); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const shown = filter === "all" ? all : all.filter((e) => e.status === filter);
  const score = useMemo(() => {
    const decided = (e) => e.review && (e.review.action === "approve" || e.review.action === "reject");
    const modelYes = all.filter((e) => e.judge?.reviewed && e.judge?.relevant && decided(e));
    const esc = all.filter((e) => e.escalation && decided(e));
    const dismissed = all.filter((e) => e.status === "dismissed" || (e.judge?.reviewed && !e.judge?.relevant));
    const missed = dismissed.filter((e) => e.review?.action === "approve");
    return {
      relevance: rate(modelYes.filter((e) => e.review.action === "approve").length, modelYes.length),
      escalations: rate(esc.filter((e) => e.review.action === "approve").length, esc.length),
      missedSite: missed.filter((e) => e.level !== "commodity").length,
      missed: missed.length,
      pending: all.filter((e) => e.status === "pending_review").length,
    };
  }, [all]);

  async function act(e, action) {
    setBusy(e.id);
    try {
      const got = await reviewEntry(e.id, action, notes[e.id] || "");
      setAll((xs) => xs.map((x) => (x.id === e.id ? got : x)));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white border border-[#E5ECE7] rounded-3xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#E5ECE7]">
        <div className="text-xs uppercase tracking-widest text-gray-400">Incident watcher</div>
        <div className="text-lg sm:text-xl font-bold text-[#1D625B] mt-2">Review queue</div>
        <p className="text-sm text-gray-600 mt-1">
          {reviewOn
            ? "Shadow run: customers see an entry only after you approve it. Approving an entry the model dismissed counts as a miss."
            : "Review is off: entries publish to customers as they are found. This list is for audit."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Waiting" value={score.pending} />
          <Stat label="Model said relevant, you approved" value={score.relevance} hint="target 80%" />
          <Stat label="Escalations you approved" value={score.escalations} hint="target 80%" />
          <Stat label="Model dismissed, you approved" value={`${score.missed} (${score.missedSite} at a site)`} hint="target 0 at a site" />
        </div>
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      </div>
      <div className="px-6 pt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={"text-sm rounded-xl px-3 py-1.5 border " + (filter === f.id ? "bg-[#1D625B] text-white border-[#1D625B]" : "bg-white text-gray-700 border-[#E5ECE7] hover:bg-[#F9FAF9]")}>
            {f.label} ({f.id === "all" ? all.length : all.filter((e) => e.status === f.id).length})
          </button>
        ))}
        <button type="button" onClick={load} className="ml-auto text-sm rounded-xl px-3 py-1.5 border bg-white text-gray-700 border-[#E5ECE7] hover:bg-[#F9FAF9]">Refresh</button>
      </div>
      <div className="p-6 space-y-3">
        {!shown.length && <div className="text-sm text-gray-500">Nothing here.</div>}
        {shown.map((e) => {
          const j = e.judge || {};
          return (
            <div key={e.id} className="border border-[#E5ECE7] rounded-2xl p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className={"text-xs font-semibold border rounded-lg px-2 py-0.5 " + (LEVEL_TONE[e.level] || "")}>{LEVEL_LABEL[e.level] || e.level}</span>
                {e.link ? <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 hover:underline">{e.title}</a>
                  : <span className="font-semibold text-gray-900">{e.title}</span>}
                <span className="ml-auto text-xs text-gray-500">{e.source} · {shortDate(e.event_date || e.created_at)} · {e.account}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{e.why}</div>
              <div className="text-sm mt-1">
                {j.reviewed ? (
                  <span>
                    <span className={j.relevant ? "text-[#1D625B] font-semibold" : "text-gray-500 font-semibold"}>
                      Model: {j.relevant ? IMPACT_LABEL[j.impact] || j.impact : "not relevant"}
                    </span>
                    <span className="text-gray-500"> · {j.confidence} confidence</span>
                    {j.reason ? <span className="text-gray-700"> · {j.reason}</span> : null}
                  </span>
                ) : <span className="text-gray-500">{j.note || "Not reviewed by the model."}</span>}
              </div>
              {e.escalation && (
                <div className="text-sm text-amber-700 mt-1">
                  {e.escalation.mode === "shadow" ? "Would start" : e.escalation.queued ? "Started" : "Not started (already run this week)"}: {e.escalation.trigger?.label}, {outageText(e.escalation.trigger)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {e.review ? (
                  <span className="text-xs text-gray-500">
                    {e.review.action === "approve" ? "Approved" : "Rejected"} by {e.review.by} {shortDate(e.review.at)}{e.review.note ? `: ${e.review.note}` : ""}
                  </span>
                ) : null}
                <input value={notes[e.id] || ""} onChange={(x) => setNotes((n) => ({ ...n, [e.id]: x.target.value }))}
                  placeholder="Note (optional)" className="ml-auto text-sm border border-[#E5ECE7] rounded-xl px-3 py-1.5 w-56" />
                <button type="button" disabled={busy === e.id || e.status === "published"} onClick={() => act(e, "approve")}
                  className="text-sm rounded-xl px-3 py-1.5 bg-[#1D625B] text-white disabled:opacity-40">Approve</button>
                <button type="button" disabled={busy === e.id || e.status === "rejected"} onClick={() => act(e, "reject")}
                  className="text-sm rounded-xl px-3 py-1.5 border border-[#E5ECE7] text-gray-700 disabled:opacity-40">Reject</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#E5ECE7] bg-[#F9FAF9] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-base font-semibold text-[#1D625B] mt-1">{value}</div>
      {hint ? <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}
