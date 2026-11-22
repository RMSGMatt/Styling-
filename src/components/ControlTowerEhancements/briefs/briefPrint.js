/**
 * A print-ready copy of a brief in a new window; the browser's Save as PDF does the rest.
 * Plain HTML and its own styles, so the PDF reads well in black on white.
 */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v) => (v == null ? "n/a" : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => (iso && iso.length >= 10 ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : iso || "");
const pretty = (s) => String(s || "").replace(/_/g, " ");
const STATUS = { does_not_help: "Does not help", not_tested: "Not tested" };

export function printBrief(b) {
  const t = b.text || {};
  const tr = b.trigger || {};
  const dn = b.do_nothing || {};
  const opts = b.options || [];
  const sec = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
  const p = (x) => (x ? `<p>${esc(x)}</p>` : "");

  const rows = opts.map((o) => {
    const rec = o.key === b.recommended;
    if (o.status !== "ok") {
      return `<tr><td><b>${esc(o.title)}</b><div class="sub">${esc(o.what)}</div></td><td colspan="5" class="sub">${esc(STATUS[o.status] || pretty(o.status))}. ${esc(o.note || "")}</td></tr>`;
    }
    return `<tr class="${rec ? "rec" : ""}"><td><b>${esc(o.title)}</b>${rec ? ' <span class="tag">Recommended</span>' : ""}<div class="sub">${esc(o.what)}</div></td>
      <td>${money(o.revenue_protected)}${o.margin_protected != null ? `<div class="sub">${money(o.margin_protected)} margin</div>` : ""}</td><td>${money(o.cost)}</td><td>${money(o.net)}</td><td>${esc(day(o.act_by))}</td><td>${o.first_shortage_date ? esc(day(o.first_shortage_date)) : "None"}</td></tr>`;
  }).join("");

  const d = b.decision;
  const decision = d
    ? `<p><b>${d.decision === "accepted" ? "Accepted" : "Dismissed"}</b>${d.option ? `: ${esc(opts.find((o) => o.key === d.option)?.title || pretty(d.option))}` : ""}, ${esc(day(d.at))}${d.by ? `, by ${esc(d.by)}` : ""}.${d.reason ? ` ${esc(d.reason)}` : ""}</p>`
    : "<p>No decision recorded yet.</p>";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Decision brief: ${esc(tr.label || pretty(tr.scenario))}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.45; max-width: 7.3in; margin: 0 auto; }
  .brand { font-size: 9pt; letter-spacing: .12em; text-transform: uppercase; color: #3f6212; font-weight: 700; }
  h1 { font-size: 18pt; line-height: 1.25; margin: 6px 0 4px; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 8px; }
  h2 { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #555; margin: 16px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  p { margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #555; border-bottom: 1px solid #bbb; padding: 4px 6px; }
  td { vertical-align: top; border-bottom: 1px solid #e5e5e5; padding: 5px 6px; }
  tr.rec td { background: #f3f9e6; }
  .tag { font-size: 7.5pt; font-weight: 700; background: #65a30d; color: #fff; border-radius: 8px; padding: 1px 6px; }
  .sub { color: #555; font-size: 8.5pt; }
  ul { margin: 0; padding-left: 18px; font-size: 9.5pt; color: #333; }
  .foot { margin-top: 18px; font-size: 8pt; color: #777; }
</style></head><body>
<div class="brand">FOR-C · Decision brief</div>
<h1>${esc(t.headline || b.headline)}</h1>
<div class="meta">${esc(tr.label || pretty(tr.scenario))} · ${esc(day(b.created_at))}${b.auto ? " · automatic" : ""}${b.simulations ? ` · ${b.simulations} simulations` : ""}</div>
${sec("Situation", p(t.situation))}
${sec("If nothing is done", p(t.impact) + (dn.revenue_at_risk != null ? `<p class="sub">Revenue at risk ${money(dn.revenue_at_risk)} · first shortage ${dn.first_shortage_date ? esc(day(dn.first_shortage_date)) : "none"}${dn.first_shortage_part ? `, ${esc(pretty(dn.first_shortage_part))}` : ""}${dn.first_shortage_at ? ` at ${esc(pretty(dn.first_shortage_at))}` : ""}</p>` : ""))}
${sec("Recommendation", p(t.recommendation))}
${opts.length ? sec("Responses tested", `<table><thead><tr><th>Response</th><th>Revenue protected</th><th>Cost</th><th>Net</th><th>Act by</th><th>First shortage</th></tr></thead><tbody>${rows}</tbody></table>
<p class="sub" style="margin-top:4px">${opts.some((o) => o.margin_protected != null) ? "Margin protected is revenue at risk avoided times the account's gross margin. Net is margin protected less the cost of the response." : "Revenue protected is revenue at risk avoided, not margin. Net is revenue protected less the cost of the response."}</p>`) : ""}
${(b.ruled_out || []).length ? sec("Ruled out", (b.ruled_out || []).map((r) => `<p><b>${esc(r.title)}.</b> ${esc(r.note)}</p>`).join("")) : ""}
${sec("What would change this", p(t.watch))}
${sec("Decision", decision)}
${(b.assumptions || []).length ? sec("Assumptions", `<ul>${b.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}${b.defaults_used ? "<li>Costs use FOR-C defaults until replaced with your own.</li>" : ""}</ul>`) : ""}
<div class="foot">Every figure comes from simulations of your network in FOR-C. Generated ${esc(day(b.finished_at || b.created_at))}.</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
