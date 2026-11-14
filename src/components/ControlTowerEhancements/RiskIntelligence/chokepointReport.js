// One-page chokepoint exposure report, rendered as a self-contained printable HTML document.
// Opened in a new window from the Chokepoints panel; the user prints or saves it as PDF.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (iso) => {
  if (!iso) return "n/a";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const scoreCls = (s) => (s >= 15 ? "s4" : s >= 10 ? "s3" : s >= 6 ? "s2" : "s1");
const list = (a, n = 4) => (a || []).slice(0, n).join(", ") + ((a || []).length > n ? ` +${a.length - n}` : "");

export function renderReportHtml(r, title) {
  const h = r.headline || {};
  const f = h.first;
  const name = title ? esc(title) : "Your network";
  const top = (r.top || []).map((c) => `
    <tr><td><span class="sc ${scoreCls(c.score)}">${c.score}</span></td>
      <td><b>${esc(c.name)}</b><div class="mut">${esc(c.edition_label)} · ${esc(c.structure)} · supply ${esc(String(c.supply || "").toLowerCase())} · policy ${esc(String(c.geo || "").toLowerCase())}</div></td>
      <td>${esc(list(c.parts))}<div class="mut">${(c.sites || []).length} site${(c.sites || []).length === 1 ? "" : "s"}</div></td>
      <td class="${c.min_days_cover != null && c.min_days_cover < 14 ? "red" : ""}">${c.min_days_cover != null ? `${c.min_days_cover} d` : "n/a"}</td></tr>`).join("");
  const cases = (r.cases || []).map((c) => `
    <div class="case"><div class="ct">${esc(c.edition_label)}: cut ${esc(c.cut_names.join(", "))} <span class="mut" style="font-weight:400">(${c.critical ? "every critical chokepoint you route through" : "your highest-scoring chokepoint; none critical"})</span></div>
      <div>${c.parts_hit} part${c.parts_hit === 1 ? "" : "s"} at ${c.sites_hit} site${c.sites_hit === 1 ? "" : "s"}${c.finished_goods_hit ? `, ${c.finished_goods_hit} finished good${c.finished_goods_hit === 1 ? "" : "s"}` : ""}.
      ${c.first_date ? `First short: <b>${esc(c.first_part)}</b> at ${esc(c.first_site)} on <b>${fmt(c.first_date)}</b> (day ${c.first_day}).` : "No part runs short on current cover."}
      ${c.worst_recovery_months ? `Alternative qualification up to ${c.worst_recovery_months} months.` : c.worst_outage_days ? `Longest gap ${c.worst_outage_days} days.` : ""}</div></div>`).join("");
  const trig = (r.triggers || []).map((t) => `<li><b>${t.approx ? esc(t.approx) : `${fmt(t.date)} (${t.days} d)`}</b> ${esc(t.label)} <span class="mut">· ${esc(t.chokepoint)} · ${esc(list(t.parts, 3))}</span></li>`).join("");
  const ds = Object.values(r.datasets || {}).map((d) => `${esc(d.label)} ${fmt(d.updated)}`).join(" · ");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Chokepoint exposure report | ${name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#111B21;background:#fff;font-size:12.5px;line-height:1.45}
.page{max-width:780px;margin:0 auto;padding:28px 32px}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #9FD63A;padding-bottom:10px;margin-bottom:14px}
.brand{font-weight:800;font-size:15px;letter-spacing:.04em}.brand span{color:#2EC4A6}
h1{font-size:20px;margin-top:2px}.mut{color:#5F6B72;font-size:11.5px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
.k{border:1px solid #DDE3E6;border-radius:8px;padding:8px 10px}.k b{font-size:20px;display:block}
.lead{background:#F4F9EC;border-left:4px solid #9FD63A;padding:10px 12px;border-radius:6px;font-size:13.5px;margin-bottom:12px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#3A4A52;margin:14px 0 6px}
table{width:100%;border-collapse:collapse}td,th{padding:6px 6px;border-bottom:1px solid #E6EBED;vertical-align:top;text-align:left}th{font-size:11px;color:#5F6B72;text-transform:uppercase;letter-spacing:.05em}
.sc{display:inline-block;min-width:28px;text-align:center;border-radius:5px;padding:2px 5px;font-weight:700}
.s4{background:#FDE2E2;color:#B42318}.s3{background:#FDEBD3;color:#A15C07}.s2{background:#FEF7C3;color:#8A6A00}.s1{background:#EEF1F3;color:#3A4A52}
.red{color:#B42318;font-weight:600}
.cases{display:grid;gap:6px}.case{border:1px solid #E6EBED;border-radius:8px;padding:8px 10px}.ct{font-weight:700;margin-bottom:2px}
ul{padding-left:16px}li{margin:3px 0}
.foot{margin-top:16px;border-top:1px solid #E6EBED;padding-top:8px;font-size:10.5px;color:#5F6B72}
.bar{position:sticky;top:0;background:#111B21;color:#E8F2EC;padding:8px 16px;display:flex;gap:10px;align-items:center;justify-content:center;font-size:13px}
.bar button{background:#9FD63A;border:0;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer}
@media print{.bar{display:none}.page{padding:0}@page{size:letter;margin:14mm}}
</style></head><body>
<div class="bar">Use Print and choose "Save as PDF" to keep or send this report. <button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <div class="top"><div><div class="brand">FOR<span>-C</span></div><h1>Chokepoint exposure report</h1><div class="mut">${name} · generated ${fmt(r.generated)}</div></div>
    <div class="mut" style="text-align:right">Chokepoint Watch datasets reviewed<br>${ds}</div></div>
  <div class="kpis">
    <div class="k"><b>${h.exposed ?? 0}</b>chokepoints your parts and lanes route through</div>
    <div class="k"><b style="color:#B42318">${h.critical ?? 0}</b>of them critical (score 15+)</div>
    <div class="k"><b>${h.thin_cover ?? 0}</b>scoring 10+ with under 14 days of cover</div>
    <div class="k"><b>${h.parts ?? 0}</b>parts exposed</div>
  </div>
  <div class="lead">${f ? `${f.critical ? "If your critical chokepoints are cut" : "In the worst cases tested"}, the first part to run short is <b>${esc(f.first_part)}</b> at ${esc(f.first_site)} on <b>${fmt(f.first_date)}</b>, day ${f.first_day} (${esc(f.edition_label)}: cut ${esc(f.cut_names.join(", "))}).` : "No part runs short on current cover in the worst cases tested."}</div>
  <h2>Top ${(r.top || []).length} chokepoints in your network</h2>
  <table><thead><tr><th>Score</th><th>Chokepoint</th><th>Your parts</th><th>Thinnest cover</th></tr></thead><tbody>${top}</tbody></table>
  <h2>Worst case by edition</h2><div class="cases">${cases || '<div class="mut">No exposure in any edition.</div>'}</div>
  ${trig ? `<h2>Dates to watch (next 120 days)</h2><ul>${trig}</ul>` : ""}
  <div class="foot">Scores combine current supply and policy exposure (likelihood) with breadth, time to qualify an alternative and North American options (impact), each 1 to 5; 15 or more is critical. Worst case cuts every exposed critical chokepoint per edition: materials run dry after pipeline weeks plus on-hand cover; routes delay or stop lanes by reroute estimates. Switching and reroute times are FOR-C estimates from public sources, not a forecast. for-c.com/chokepoints</div>
</div></body></html>`;
}
