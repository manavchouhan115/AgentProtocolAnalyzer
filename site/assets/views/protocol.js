import {
  state, esc, name, pid, byId, versionsOf, rowOf, RATING, label, reviewBadge, pill, compareButton,
  wireCompareButtons, toast, setQuery, monthYear,
} from "../core.js";

export const COVERAGE_TEXT = {
  required: "Required by the specification", default: "Part of the normal flow", optional: "Optional in the specification",
  extension: "Only in an extension or companion specification", outside: "Handled outside the protocol",
  none: "Not addressed by the specification", out_of_scope: "Explicitly out of scope",
};
export const CLAIM_KIND = { fact: "Stated in", inference: "Inferred from", silent: "Not found in", out_of_scope: "Out of scope per" };

export function renderProtocol(el, parts, params) {
  const id = parts[0];
  const versions = versionsOf(id);
  if (!versions.length) {
    el.innerHTML = `<div class="wrap page"><h1>Protocol not found</h1><p class="muted">There is no protocol called “${esc(id)}” in the dataset. <a href="#/explore">Browse all protocols</a>.</p></div>`;
    return;
  }
  const wanted = params.get("v");
  const p = versions.find((x) => x.protocol?.spec_version === wanted) || byId(id) || versions[versions.length - 1];
  const pr = p.profile || {};
  const srcs = Object.fromEntries((p.sources || []).map((s) => [s.id, s]));
  document.title = `${name(p)} | Protocol Explorer`;

  const facts = [
    ["Specification", `<span class="mono">${esc(p.protocol?.spec_version)}</span>`],
    ["This version", esc(p.protocol?.spec_date)],
    ["Maintainer", esc(p.protocol?.maintainer)],
    ["Mechanism", esc((pr.mechanisms || []).map((m) => label("mechanisms", m)).join(", "))],
    ["Builds on", esc((pr.building_blocks || []).join(", "))],
    ["First released", esc(monthYear(pr.first_published))],
    ["Analysed", esc(p.analysed_on)],
  ].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  const versionSelect = versions.length > 1
    ? `<label class="switch">Version <select class="input" id="ver">${versions.map((v) => `<option value="${esc(v.protocol?.spec_version)}" ${v === p ? "selected" : ""}>${esc(v.protocol?.spec_version)}${v._meta?.current ? " (latest)" : ""}</option>`).join("")}</select></label>`
    : "";

  // properties grouped
  let groupsHtml = "", group = null, toc = "";
  for (const prop of state.props) {
    const r = rowOf(p, prop.id);
    if (prop.group !== group) {
      if (group !== null) groupsHtml += `</div>`;
      group = prop.group;
      groupsHtml += `<div class="prop-group"><h3 id="g-${esc(slug(group))}">${esc(group)}</h3>`;
      toc += `<a href="#/p/${esc(id)}?prop=${esc(prop.id)}" data-scroll="g-${esc(slug(group))}">${esc(group)}</a>`;
    }
    const req = r.requirement && r.requirement !== "none"
      ? (r.requirement.endsWith("*") ? `requirement level ${r.requirement.slice(0, -1)} (written as an ordinary lowercase word in the specification)` : `requirement level ${r.requirement}`)
      : "";
    const meta = [COVERAGE_TEXT[r.coverage], req].filter(Boolean).join(", ");
    let reason = (r.rating_reason || "").replace(/^\s*(green|yellow|red)\s*:\s*/i, "");
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
    groupsHtml += `<article class="prop" id="prop-${esc(prop.id)}">
      <div><div class="name"><a href="#/properties/${esc(prop.id)}" title="See every protocol's answer">${esc(prop.property)}</a></div><div class="q">${esc(prop.question)}</div></div>
      <div>
        <div class="head">${pill(r.rating)}<span class="short">${esc(r.short)}</span></div>
        <div class="answer">${esc(r.answer)}</div>
        ${meta || reason ? `<div class="meta">${esc(meta)}${meta && reason ? ". " : ""}${reason ? "Why this rating: " + esc(reason) : ""}</div>` : ""}
        ${claimsHtml(r, srcs)}
      </div>
    </article>`;
  }
  groupsHtml += `</div>`;

  const fpV = state.rated.map((prop) => {
    const r = rowOf(p, prop.id);
    return `<a href="#/p/${esc(id)}?prop=${esc(prop.id)}" data-scroll="prop-${esc(prop.id)}" title="${esc(RATING[r.rating] || "")}"><i class="cell ${esc(r.rating)}"></i>${esc(prop.property)}</a>`;
  }).join("");

  const goals = (state.data.goals || []).map((g) => `<div><h3>${esc(g.label)}</h3><div class="def">Goal: ${esc(g.definition)}</div><p>${esc(p.goals_reading?.[g.id] || "")}</p></div>`).join("");
  const sources = (p.sources || []).map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.title)}</a>${[s.version, s.date].filter(Boolean).length ? ` <span class="muted">(${esc([s.version, s.date].filter(Boolean).join(", "))})</span>` : ""}${s.kind === "secondary" ? ` <span class="muted">secondary source</span>` : ""}</li>`).join("");
  const nQuotes = (p.rows || []).reduce((a, r) => a + (r.claims || []).filter((c) => c.quote).length, 0);
  const nOk = (p.rows || []).reduce((a, r) => a + (r.claims || []).filter((c) => c.quote && (c.check === "OK" || c.check === "WEB-OK")).length, 0);

  el.innerHTML = `
  <div class="wrap page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/explore">Explore</a> / ${esc(name(p))}</nav>
    <header class="p-head">
      <h1>${esc(name(p))}${p.protocol?.full_name && p.protocol.full_name !== name(p) ? `<small>${esc(p.protocol.full_name)}</small>` : ""}</h1>
      <div class="chips">${["category", "maturity", "venue", "openness"].filter((f) => pr[f]).map((f) => `<span class="chip">${esc(label(f, pr[f]))}</span>`).join("")}${(pr.secondary_categories || []).map((c) => `<span class="chip">Also ${esc(label("category", c).toLowerCase())}</span>`).join("")}${reviewBadge(p)}</div>
      <dl class="facts">${facts}</dl>
      ${p.protocol?.newer_version_note ? `<p class="muted" style="margin-top:12px;max-width:80ch">${esc(p.protocol.newer_version_note)}</p>` : ""}
      <div class="actions">
        ${compareButton(id)}
        <a class="btn small" href="../reports/${esc(p._meta?.file || "")}" target="_blank" rel="noopener">Open the original report</a>
        ${pr.website ? `<a class="btn small" href="${esc(pr.website)}" target="_blank" rel="noopener">Specification</a>` : ""}
        <button class="btn small ghost" type="button" id="copy">Copy link</button>
        ${versionSelect}
      </div>
    </header>

    <div class="p-layout">
      <div>
        <section id="summary"><h2 style="margin-bottom:14px">Summary</h2><div class="summary">${(p.summary || []).map((x) => `<p>${esc(x)}</p>`).join("")}</div></section>
        <section class="section" id="how"><h2 style="margin-bottom:18px">How it works</h2><ol class="steps">${(p.how_it_works || []).map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ol></section>
        <section class="section" id="goals"><h2 style="margin-bottom:14px">Against the three goals</h2><div class="goals">${goals}</div></section>
        <section class="section" id="analysis"><h2>Full analysis</h2><p class="lede muted" style="margin-top:6px">${nOk} of ${nQuotes} quotes verified word for word against their source. Select “Evidence” under an answer to see them.</p>${groupsHtml}</section>
        <section class="section" id="sources"><h2>Sources</h2><ul class="plain">${sources}</ul></section>
        ${(p.notes || []).length ? `<section class="section"><h2>Notes</h2><ul class="plain">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
        ${(p.open_questions || []).length ? `<section class="section"><h2>Open questions</h2><ul class="plain">${p.open_questions.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
      </div>
      <nav class="toc" aria-label="On this page">
        <a href="#/p/${esc(id)}" data-scroll="summary">Summary</a>
        <a href="#/p/${esc(id)}" data-scroll="how">How it works</a>
        <a href="#/p/${esc(id)}" data-scroll="goals">Against the goals</a>
        <a href="#/p/${esc(id)}" data-scroll="analysis">Full analysis</a>
        <div class="fp-v">${fpV}</div>
      </nav>
    </div>
  </div>`;

  wireCompareButtons(el);
  el.querySelectorAll("[data-scroll]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.scroll);
    if (t) { t.scrollIntoView({ behavior: "smooth", block: "start" }); flash(t); }
  }));
  el.querySelector("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch (e) { toast("Copy the address from the address bar"); }
  });
  const ver = el.querySelector("#ver");
  if (ver) ver.addEventListener("change", () => { const q = new URLSearchParams(); q.set("v", ver.value); setQuery(q, false); });

  const target = params.get("prop");
  if (target) {
    requestAnimationFrame(() => {
      const t = document.getElementById("prop-" + target);
      if (t) { t.scrollIntoView({ block: "start" }); flash(t); const ev = t.querySelector("details"); if (ev) ev.open = true; }
    });
  }
}

function flash(t) {
  if (!t.classList.contains("prop")) return;
  t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

export function claimsHtml(r, srcs) {
  const claims = r.claims || [];
  if (!claims.length) return "";
  const items = claims.map((c) => {
    const s = srcs[c.source] || {};
    const link = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || c.source)}</a>` : esc(c.source);
    const chk = c.quote ? (c.check === "OK" || c.check === "WEB-OK" ? `<span class="ok">Quote verified</span>` : c.check === "NEAR" || c.check === "NOT FOUND" ? `<span class="bad">Quote not verified</span>` : `<span class="src">Quote not checked</span>`) : "";
    return `<div class="claim">${esc(c.text)}<div class="src">${CLAIM_KIND[c.type] || ""} ${link}${c.section ? `, ${esc(c.section)}` : ""}. ${chk}</div>${c.quote ? `<blockquote>${esc(c.quote)}</blockquote>` : ""}</div>`;
  }).join("");
  return `<details class="ev"><summary>Evidence (${claims.length})</summary>${items}</details>`;
}
