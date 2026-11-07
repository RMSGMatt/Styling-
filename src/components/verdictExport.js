// Export helpers for the Verdict view: CSV download and a printable one-page report (save as PDF).

const STATUS_LABEL = { good: "On target", watch: "Watch", bad: "At risk", info: "Context", na: "n/a" };

function fmtValue(v, unit, row) {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  const n = (x) => Math.round(Number(x) || 0).toLocaleString("en-US");
  switch (unit) {
    case "%": return `${Number(v).toFixed(Number(v) % 1 === 0 ? 0 : 1)}%`;
    case "days": return `${n(v)} days`;
    case "hours": return `${n(v)} hrs`;
    case "$": return `$${n(v)}`;
    case "x": return `${Number(v).toFixed(1)}x`;
    case "count": return row && row.of ? `${n(v)} of ${n(row.of)}` : n(v);
    default: return n(v);
  }
}

export function allRows(scorecard, revenue) {
  const groups = (scorecard && scorecard.groups) || [];
  const out = [];
  if (revenue > 0) {
    out.push({ group: "Customer service", row: { key: "revenue", label: "Estimated revenue at risk", unit: "$", before: null, during: null, overall: revenue, worst: null, status: "info", hint: "Estimate based on unit values where provided." } });
  }
  groups.forEach((g) => g.rows.forEach((r) => out.push({ group: g.name, row: r })));
  return out;
}

const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv({ runName, headline, sub, scorecard, clock, revenue }) {
  const lines = [];
  lines.push(["FOR-C scenario summary"].map(esc).join(","));
  lines.push(["Run", runName || ""].map(esc).join(","));
  lines.push(["Headline", headline].map(esc).join(","));
  lines.push(["Summary", sub].map(esc).join(","));
  lines.push("");
  if (clock && clock.length) {
    lines.push(["Decision clock"].map(esc).join(","));
    lines.push(["Response", "Days to arrive", "Order by"].map(esc).join(","));
    clock.forEach((c) => lines.push([c.label, c.days, c.orderBy].map(esc).join(",")));
    lines.push("");
  }
  lines.push(["KPI scorecard"].map(esc).join(","));
  lines.push(["Group", "Measure", "Before disruption", "During disruption", "Whole run", "Worst point", "Status", "Names", "Definition"].map(esc).join(","));
  allRows(scorecard, revenue).forEach(({ group, row }) => {
    lines.push([
      group, row.label,
      fmtValue(row.before, row.unit, row), fmtValue(row.during, row.unit, row), fmtValue(row.overall, row.unit, row),
      row.worst !== null && row.worst !== undefined ? `${fmtValue(row.worst, row.unit, row)}${row.worst_label ? ` (${row.worst_label})` : ""}` : "",
      STATUS_LABEL[row.status] || "", (row.names || []).join("; "), row.hint || "",
    ].map(esc).join(","));
  });
  lines.push("");
  lines.push(["Simulated results. Status uses common default targets and may differ from yours."].map(esc).join(","));
  return lines.join("\r\n");
}

export function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const h = (s) => String(s === null || s === undefined ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildReportHtml({ runName, headline, sub, scorecard, clock, revenue, firstShortage, dateLabel }) {
  const groups = {};
  allRows(scorecard, revenue).forEach(({ group, row }) => { (groups[group] = groups[group] || []).push(row); });
  const tableRows = Object.entries(groups).map(([g, rows]) => `
    <tr class="grp"><td colspan="6">${h(g)}</td></tr>
    ${rows.map((r) => `<tr>
      <td>${h(r.label)}<div class="hint">${h(r.hint || "")}</div>${r.names && r.names.length ? `<div class="names">${r.names.map((n) => h(n)).join(", ")}</div>` : ""}</td>
      <td>${h(fmtValue(r.before, r.unit, r)) || "&ndash;"}</td>
      <td><b>${h(fmtValue(r.during, r.unit, r)) || "&ndash;"}</b></td>
      <td>${h(fmtValue(r.overall, r.unit, r)) || "&ndash;"}</td>
      <td>${r.worst !== null && r.worst !== undefined ? h(fmtValue(r.worst, r.unit, r)) : "&ndash;"}</td>
      <td><span class="chip ${h(r.status)}">${h(STATUS_LABEL[r.status] || "")}</span></td>
    </tr>`).join("")}`).join("");
  const clockRows = (clock || []).map((c) => `<tr><td>${h(c.label)}</td><td>${h(c.days)} days</td><td><b>${h(c.orderBy)}</b>${c.beforeDisruption ? " (before the disruption starts)" : ""}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>FOR-C scenario summary</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:32px;max-width:900px}
 h1{font-size:22px;margin:4px 0 6px} .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b}
 .sub{font-size:14px;color:#334155;line-height:1.5} h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#475569;margin:26px 0 8px}
 table{border-collapse:collapse;width:100%;font-size:12.5px} th{text-align:left;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #cbd5e1;padding:6px 8px 6px 0}
 td{border-bottom:1px solid #e2e8f0;padding:7px 8px 7px 0;vertical-align:top} tr.grp td{background:#f1f5f9;font-weight:bold;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#334155;padding:6px 8px}
 .hint{font-size:10.5px;color:#64748b;margin-top:2px;max-width:340px} .chip{display:inline-block;border:1px solid #94a3b8;border-radius:999px;padding:1px 8px;font-size:10.5px}
 .chip.good{border-color:#059669;color:#047857}.chip.watch{border-color:#d97706;color:#b45309}.chip.bad{border-color:#e11d48;color:#be123c}
 .names{font-size:11px;color:#0f172a;margin-top:3px;max-width:340px;font-weight:bold}
 .foot{margin-top:24px;font-size:10.5px;color:#64748b} @media print{body{margin:14mm}}
</style></head><body>
<div class="eyebrow">FOR-C scenario summary${runName ? ` &middot; ${h(runName)}` : ""}</div>
<h1>${h(headline)}</h1>
<div class="sub">${h(sub)}</div>
${clockRows ? `<h2>Decision clock</h2><div class="sub">First customer shortage: <b>${h(firstShortage || "none")}</b>. Order-by date is the first shortage date minus the time the fix takes to arrive.</div>
<table style="margin-top:8px"><thead><tr><th>Response</th><th>Days to arrive</th><th>Order by</th></tr></thead><tbody>${clockRows}</tbody></table>` : ""}
<h2>KPI scorecard</h2>
<table><thead><tr><th>Measure</th><th>Before</th><th>During</th><th>Whole run</th><th>Worst point</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
<div class="foot">Simulated results from FOR-C. Status uses common default targets and may differ from yours.${dateLabel ? ` Generated ${h(dateLabel)}.` : ""}</div>
</body></html>`;
}

export function openReport(html) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { /* user can print manually */ } }, 400);
  return true;
}
