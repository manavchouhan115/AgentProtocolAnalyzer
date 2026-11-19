import { state, esc, name, pid, rowOf, RATING, label, pill, goalLabel } from "../core.js";
import { COVERAGE_TEXT, claimsHtml } from "./protocol.js";

const ORDER = ["green", "yellow", "red"];
const HEADINGS = { green: "Addressed", yellow: "Partly addressed", red: "Not addressed" };

export function renderProperties(el, parts) {
  if (parts[0]) return renderProperty(el, parts[0]);
  document.title = "Properties | Protocol Explorer";
  const ps = state.current;
  let html = "", group = null;
  for (const prop of state.props) {
    if (prop.group !== group) {
      if (group !== null) html += `</div>`;
      group = prop.group;
      html += `<h2 class="pi-group">${esc(group)}</h2><div class="pi-list">`;
    }
    const c = counts(prop);
    html += `<a class="pi" href="#/properties/${esc(prop.id)}">
      <div><b>${esc(prop.property)}</b><span class="q">${esc(prop.question)}</span>
        ${prop.goals?.length ? `<span class="serves">Serves ${esc(prop.goals.map(goalLabel).join(" and ").toLowerCase())}</span>` : ""}</div>
      <div class="pi-side">${prop.rated && prop.id !== "status_adoption"
        ? `${distBar(c, ps.length)}<span class="pi-n">${countText(c)}</span>`
        : prop.rated ? `${distBar(c, ps.length)}<span class="pi-n">Describes maturity; not counted in coverage</span>`
        : `<span class="pi-n">Descriptive, not rated</span>`}</div>
    </a>`;
  }
  html += `</div>`;
  el.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><h1>Properties</h1>
      <p>The ${state.props.length} questions every analysis answers. Open a property to see how every protocol answers it, side by side.</p></div></div>
    <div class="pi-wrap">${html}</div>
  </div>`;
}

function renderProperty(el, id) {
  const idx = state.props.findIndex((p) => p.id === id);
  const prop = state.props[idx];
  if (!prop) {
    el.innerHTML = `<div class="wrap page"><h1>Property not found</h1><p class="muted">There is no property called “${esc(id)}”. <a href="#/properties">See all properties</a>.</p></div>`;
    return;
  }
  document.title = `${prop.property} | Protocol Explorer`;
  const ps = state.current;
  const c = counts(prop);
  const prev = state.props[idx - 1], next = state.props[idx + 1];

  const item = (p) => {
    const r = rowOf(p, prop.id);
    const srcs = Object.fromEntries((p.sources || []).map((s) => [s.id, s]));
    const req = r.requirement && r.requirement !== "none"
      ? (r.requirement.endsWith("*") ? `requirement level ${r.requirement.slice(0, -1)} (written as an ordinary lowercase word)` : `requirement level ${r.requirement}`) : "";
    const meta = [COVERAGE_TEXT[r.coverage], req].filter(Boolean).join(", ");
    return `<article class="pv">
      <div class="pv-name"><a href="#/p/${esc(pid(p))}?prop=${esc(prop.id)}">${esc(name(p))}</a><small>${esc(label("category", p.profile?.category))}</small></div>
      <div>
        <div class="head">${prop.rated ? pill(r.rating) : ""}<span class="short">${esc(r.short || "")}</span></div>
        <div class="answer">${esc(r.answer || "No answer in this analysis.")}</div>
        ${meta ? `<div class="meta">${esc(meta.charAt(0).toUpperCase() + meta.slice(1))}.</div>` : ""}
        ${claimsHtml(r, srcs)}
      </div>
    </article>`;
  };

  const byRating = (rt) => ps.filter((p) => rowOf(p, prop.id).rating === rt);
  const sections = prop.rated
    ? ORDER.filter((rt) => byRating(rt).length).map((rt) => `<section class="pv-sec">
        <h2><i class="cell ${rt}"></i>${HEADINGS[rt]}<span class="n">${byRating(rt).length}</span></h2>
        ${byRating(rt).map(item).join("")}</section>`).join("")
      + (ps.some((p) => !ORDER.includes(rowOf(p, prop.id).rating)) ? `<section class="pv-sec"><h2>Not rated<span class="n"></span></h2>${ps.filter((p) => !ORDER.includes(rowOf(p, prop.id).rating)).map(item).join("")}</section>` : "")
    : `<section class="pv-sec">${ps.map(item).join("")}</section>`;

  el.innerHTML = `<div class="wrap page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/properties">Properties</a> / ${esc(prop.group)}</nav>
    <header class="pv-head">
      <h1>${esc(prop.property)}</h1>
      <p class="pv-q">${esc(prop.question)}</p>
      <div class="chips">${prop.goals?.length ? prop.goals.map((g) => `<span class="chip">Serves ${esc(goalLabel(g).toLowerCase())}</span>`).join("") : ""}
        ${!prop.rated ? `<span class="chip">Descriptive, not rated</span>` : prop.id === "status_adoption" ? `<span class="chip">Not counted in coverage</span>` : ""}</div>
      ${prop.rated ? `<div class="pv-dist">${distBar(c, ps.length, 14)}<div class="legend">${ORDER.map((rt) => `<span><i class="cell ${rt}"></i>${c[rt]} ${RATING[rt].toLowerCase()}</span>`).join("")}</div></div>` : ""}
    </header>
    ${sections}
    <nav class="pv-nav" aria-label="Other properties">
      ${prev ? `<a href="#/properties/${esc(prev.id)}"><small>Previous property</small>${esc(prev.property)}</a>` : "<span></span>"}
      ${next ? `<a href="#/properties/${esc(next.id)}" class="next"><small>Next property</small>${esc(next.property)}</a>` : ""}
    </nav>
  </div>`;
}

function counts(prop) {
  const c = { green: 0, yellow: 0, red: 0 };
  state.current.forEach((p) => { const r = rowOf(p, prop.id).rating; if (c[r] !== undefined) c[r]++; });
  return c;
}

function countText(c) {
  return `${c.green} addressed, ${c.yellow} partly, ${c.red} not`;
}

function distBar(c, n, h = 10) {
  n = n || 1;
  return `<span class="bar" style="height:${h}px" role="img" aria-label="${countText(c)}">${ORDER.map((rt) =>
    c[rt] ? `<span class="${rt[0]}" style="width:${(100 * c[rt]) / n}%"></span>` : "").join("")}</span>`;
}
