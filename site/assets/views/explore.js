import {
  state, esc, name, pid, rowOf, coverage, label, fingerprint, reviewBadge, profileChips, compareButton,
  wireCompareButtons, setQuery, maturityRank, markText, parseTerms,
} from "../core.js";

const FACETS = [
  { key: "category", title: "Category", get: (p) => [p.profile?.category, ...(p.profile?.secondary_categories || [])] },
  { key: "maturity", title: "Maturity", get: (p) => [p.profile?.maturity] },
  { key: "venue", title: "Developed at", get: (p) => [p.profile?.venue] },
  { key: "mechanisms", title: "Mechanism", get: (p) => p.profile?.mechanisms || [] },
  { key: "openness", title: "Openness", get: (p) => [p.profile?.openness] },
  { key: "review", title: "Review", get: (p) => [p.review?.status === "reviewed" ? "reviewed" : "draft"], labels: { reviewed: "Reviewed by a person", draft: "Draft analysis" } },
];
const SORTS = { coverage: "Coverage", name: "Name", maturity: "Maturity", recent: "Recently analysed" };
const GROUPS = { none: "No grouping", category: "Category", maturity: "Maturity", venue: "Developed at", mechanisms: "Mechanism" };

export function renderExplore(el, _parts, params) {
  document.title = "Explore | Protocol Explorer";
  const st = readState(params);

  el.innerHTML = `
  <div class="wrap page">
    <div class="page-head">
      <div><h1>Explore protocols</h1><p>Search, filter and group the analysed protocols. Add any of them to compare side by side.</p></div>
    </div>
    <div class="explore">
      <aside class="filters" id="filters" aria-label="Filters"></aside>
      <div>
        <div class="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="input" id="q" type="search" placeholder="Search names, summaries, answers and quotes" aria-label="Search protocols" value="${esc(st.q)}" autocomplete="off">
          <kbd aria-hidden="true">/</kbd>
        </div>
        <div class="toolbar">
          <span class="count" id="count" aria-live="polite"></span>
          <button class="btn small filter-toggle" type="button" id="ftoggle" aria-expanded="false" aria-controls="filters">Filters</button>
          <label>Sort <select class="input" id="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${st.sort === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Group <select class="input" id="group">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${st.group === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        </div>
        <div id="results" class="results"></div>
      </div>
    </div>
  </div>`;

  const update = () => {
    writeState(st);
    drawFilters(el.querySelector("#filters"), st, update);
    drawResults(el.querySelector("#results"), el.querySelector("#count"), st, update);
  };

  const q = el.querySelector("#q");
  q.addEventListener("input", () => { st.q = q.value.trim(); update(); });
  el.querySelector("#sort").addEventListener("change", (e) => { st.sort = e.target.value; update(); });
  el.querySelector("#group").addEventListener("change", (e) => { st.group = e.target.value; update(); });
  el.querySelector("#ftoggle").addEventListener("click", (e) => {
    const f = el.querySelector("#filters");
    f.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", f.classList.contains("open"));
  });
  update();
}

function readState(params) {
  const st = { q: params.get("q") || "", sort: params.get("sort") || "coverage", group: params.get("group") || "none", sel: {}, addresses: params.get("addresses") || "", strict: params.get("strict") === "1" };
  FACETS.forEach((f) => { st.sel[f.key] = new Set((params.get(f.key) || "").split(",").filter(Boolean)); });
  if (!SORTS[st.sort]) st.sort = "coverage";
  if (!GROUPS[st.group]) st.group = "none";
  return st;
}

function writeState(st) {
  const p = new URLSearchParams();
  if (st.q) p.set("q", st.q);
  FACETS.forEach((f) => { if (st.sel[f.key].size) p.set(f.key, [...st.sel[f.key]].join(",")); });
  if (st.addresses) p.set("addresses", st.addresses);
  if (st.strict) p.set("strict", "1");
  if (st.sort !== "coverage") p.set("sort", st.sort);
  if (st.group !== "none") p.set("group", st.group);
  setQuery(p);
}

function matches(p, st, skipFacet) {
  for (const f of FACETS) {
    if (f.key === skipFacet) continue;
    const sel = st.sel[f.key];
    if (sel.size && !f.get(p).some((v) => sel.has(v))) return false;
  }
  if (st.addresses) {
    const r = rowOf(p, st.addresses).rating;
    if (!(r === "green" || (!st.strict && r === "yellow"))) return false;
  }
  if (st.q) {
    const hay = [name(p), p.protocol?.full_name, ...(p.summary || []), ...(p.rows || []).flatMap((r) => [r.short, r.answer, ...(r.claims || []).map((c) => c.quote)]),
      ...(p.profile?.building_blocks || [])].join(" ").toLowerCase();
    if (!parseTerms(st.q).every((t) => hay.includes(t))) return false;
  }
  return true;
}

function drawFilters(box, st, update) {
  const ps = state.current;
  const facetHtml = FACETS.map((f) => {
    const values = new Set();
    ps.forEach((p) => f.get(p).forEach((v) => v && values.add(v)));
    if (!values.size) return "";
    const opts = [...values].sort((a, b) => (f.labels?.[a] || label(f.key === "mechanisms" ? "mechanisms" : f.key, a)).localeCompare(f.labels?.[b] || label(f.key, b)))
      .map((v) => {
        const n = ps.filter((p) => matches(p, st, f.key) && f.get(p).includes(v)).length;
        const lab = f.labels?.[v] || label(f.key, v);
        return `<label class="opt ${n ? "" : "zero"}"><input type="checkbox" data-f="${f.key}" value="${esc(v)}" ${st.sel[f.key].has(v) ? "checked" : ""}> ${esc(lab)}<span class="n">${n}</span></label>`;
      }).join("");
    return `<fieldset><legend>${f.title}</legend>${opts}</fieldset>`;
  }).join("");
  const propOpts = state.rated.filter((p) => p.id !== "status_adoption")
    .map((p) => `<option value="${esc(p.id)}" ${st.addresses === p.id ? "selected" : ""}>${esc(p.property)}</option>`).join("");
  const any = st.q || st.addresses || FACETS.some((f) => st.sel[f.key].size);
  box.innerHTML = `
    <fieldset><legend>Addresses</legend>
      <select class="input" id="addr" style="width:100%" aria-label="Show protocols that address this property"><option value="">Any property</option>${propOpts}</select>
      <label class="opt" style="margin-top:6px"><input type="checkbox" id="partly" ${st.strict ? "checked" : ""} ${st.addresses ? "" : "disabled"}> Remove partly addressed</label>
    </fieldset>
    ${facetHtml}
    ${any ? `<button class="btn small" type="button" id="clear">Clear all filters</button>` : ""}`;
  box.querySelectorAll("input[data-f]").forEach((cb) => cb.addEventListener("change", () => {
    const s = st.sel[cb.dataset.f];
    cb.checked ? s.add(cb.value) : s.delete(cb.value);
    update();
  }));
  box.querySelector("#addr").addEventListener("change", (e) => { st.addresses = e.target.value; update(); });
  box.querySelector("#partly").addEventListener("change", (e) => { st.strict = e.target.checked; update(); });
  const clear = box.querySelector("#clear");
  if (clear) clear.addEventListener("click", () => {
    st.q = ""; st.addresses = ""; st.strict = false; FACETS.forEach((f) => st.sel[f.key].clear());
    document.getElementById("q").value = "";
    update();
  });
}

function sortFn(st) {
  return {
    coverage: (a, b) => coverage(b) - coverage(a) || name(a).localeCompare(name(b)),
    name: (a, b) => name(a).localeCompare(name(b)),
    maturity: (a, b) => maturityRank(a) - maturityRank(b) || name(a).localeCompare(name(b)),
    recent: (a, b) => String(b.analysed_on).localeCompare(String(a.analysed_on)) || name(a).localeCompare(name(b)),
  }[st.sort];
}

function highlight(text, q) {
  return markText(text, parseTerms(q).filter((t) => t.length > 1));
}

function snippet(p, q) {
  const first = (p.summary && p.summary[0]) || "";
  if (!q) return first.split(/(?<=\.)\s/)[0];
  const t = parseTerms(q)[0] || "";
  const texts = [...(p.summary || []), ...(p.rows || []).map((r) => r.answer)];
  const hit = texts.find((x) => (x || "").toLowerCase().includes(t)) || first;
  const sentences = hit.split(/(?<=\.)\s/);
  return sentences.find((s) => s.toLowerCase().includes(t)) || sentences[0];
}

function rowHtml(p, st) {
  const id = pid(p);
  return `<article class="row">
    <div>
      <div class="title"><a href="#/p/${esc(id)}">${highlight(name(p), st.q)}</a>${p.protocol?.full_name && p.protocol.full_name !== name(p) ? `<small>${esc(p.protocol.full_name)}</small>` : ""}</div>
      <p>${highlight(snippet(p, st.q), st.q)}</p>
      <div class="chips">${profileChips(p, ["category", "maturity", "venue"])}${reviewBadge(p)}</div>
    </div>
    <div class="side">
      <div class="cov" title="Share of the rated properties this protocol addresses (partly addressed counts as half)"><b>${coverage(p)}%</b> coverage</div>
      ${fingerprint(p, { size: 12 })}
      ${compareButton(id)}
    </div>
  </article>`;
}

function drawResults(box, countEl, st, update) {
  const list = state.current.filter((p) => matches(p, st)).sort(sortFn(st));
  countEl.textContent = `${list.length} of ${state.current.length} protocol${state.current.length === 1 ? "" : "s"}`;
  if (!list.length) {
    box.innerHTML = `<div class="empty"><h3>No protocols match</h3><p>Try fewer filters or a shorter search. <button class="btn small" type="button" id="clear2">Clear all filters</button></p></div>`;
    box.querySelector("#clear2").addEventListener("click", () => {
      st.q = ""; st.addresses = ""; st.strict = false; FACETS.forEach((f) => st.sel[f.key].clear());
      document.getElementById("q").value = ""; update();
    });
    return;
  }
  if (st.group === "none") {
    box.innerHTML = list.map((p) => rowHtml(p, st)).join("");
  } else {
    const f = FACETS.find((x) => x.key === st.group);
    const groups = {};
    list.forEach((p) => {
      const vals = st.group === "category" ? [p.profile?.category] : f.get(p);
      vals.forEach((v) => (groups[v] = groups[v] || []).push(p));
    });
    box.innerHTML = Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([v, ps]) => `<h2 class="group-title">${esc(label(st.group, v))}<span class="n">${ps.length}</span></h2><div>${ps.map((p) => rowHtml(p, st)).join("")}</div>`)
      .join("");
  }
  wireCompareButtons(box);
}
