import { state, esc, name, pid, label, setQuery, markText, parseTerms } from "../core.js";

const KINDS = {
  all: "Everything",
  answers: "Answers",
  quotes: "Quotes from specifications",
};
const EXAMPLES = ["revocation", "\"proof of possession\"", "nonce", "consent", "mTLS", "JWKS"];

// One searchable unit per summary paragraph, step, answer and quote.
function buildIndex() {
  const units = [];
  const propName = Object.fromEntries(state.props.map((p) => [p.id, p.property]));
  for (const p of state.current) {
    const id = pid(p);
    const srcs = Object.fromEntries((p.sources || []).map((s) => [s.id, s]));
    const add = (u) => units.push({ p, id, ...u, lower: `${u.head || ""} ${u.text}`.toLowerCase() });
    add({ kind: "answers", where: "Name", text: [name(p), p.protocol?.full_name, p.protocol?.maintainer].filter(Boolean).join(", "), href: `#/p/${id}`, weight: 3 });
    (p.summary || []).forEach((t) => add({ kind: "answers", where: "Summary", text: t, href: `#/p/${id}`, weight: 2 }));
    (p.how_it_works || []).forEach((t, i) => add({ kind: "answers", where: `How it works, step ${i + 1}`, text: t, href: `#/p/${id}`, weight: 1 }));
    for (const r of p.rows || []) {
      const where = propName[r.id] || r.id;
      add({ kind: "answers", where, head: r.short, text: [r.answer, r.rating_reason].filter(Boolean).join(" "), href: `#/p/${id}?prop=${r.id}`, weight: 1, rating: r.rating });
      for (const c of r.claims || []) {
        if (!c.quote) continue;
        const s = srcs[c.source] || {};
        add({ kind: "quotes", where: `${where}: ${s.title || c.source}${c.section ? `, ${c.section}` : ""}`, text: c.quote, href: `#/p/${id}?prop=${r.id}`, weight: 1, quote: true });
      }
    }
  }
  return units;
}

// Terms and "quoted phrases"; a unit matches when it contains all of them.
const parse = parseTerms;

const mark = (text, terms) => markText(text, terms);

function snippet(text, terms, len = 240) {
  if (text.length <= len) return text;
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  let start = Math.max(0, (isFinite(at) ? at : 0) - 70);
  if (start > 0) { const sp = text.indexOf(" ", start); if (sp > 0 && sp - start < 20) start = sp + 1; }
  let end = Math.min(text.length, start + len);
  if (end < text.length) { const sp = text.lastIndexOf(" ", end); if (sp > start + len / 2) end = sp; }
  return (start > 0 ? "… " : "") + text.slice(start, end) + (end < text.length ? " …" : "");
}

export function renderSearch(el, _parts, params) {
  document.title = "Search | Protocol Explorer";
  const st = { q: params.get("q") || "", kind: KINDS[params.get("in")] ? params.get("in") : "all" };
  const index = buildIndex();
  const expanded = new Set();

  el.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><h1>Search the analyses</h1>
      <p>Search every summary, answer and specification quote. Put a phrase in double quotes to match it exactly.</p></div></div>
    <form class="search big" id="sform" role="search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="input" id="sq" type="search" placeholder="Try revocation, nonce or &quot;proof of possession&quot;" aria-label="Search the analyses" value="${esc(st.q)}" autocomplete="off">
    </form>
    <div class="tabs" role="tablist" id="tabs"></div>
    <div id="sres" aria-live="polite"></div>
  </div>`;

  const input = el.querySelector("#sq");
  const tabs = el.querySelector("#tabs");
  const out = el.querySelector("#sres");
  el.querySelector("#sform").addEventListener("submit", (e) => e.preventDefault());
  input.addEventListener("input", () => { st.q = input.value; expanded.clear(); draw(); });
  requestAnimationFrame(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });

  function draw() {
    const q = new URLSearchParams();
    if (st.q.trim()) q.set("q", st.q.trim());
    if (st.kind !== "all") q.set("in", st.kind);
    setQuery(q);

    const terms = parse(st.q);
    if (!terms.length) {
      tabs.innerHTML = "";
      out.innerHTML = `<div class="empty"><h3>Type to search</h3><p>Some places to start:</p>
        <div class="chips">${EXAMPLES.map((x) => `<button class="chip as-btn" type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>`;
      out.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.ex; st.q = b.dataset.ex; draw(); input.focus(); }));
      return;
    }
    const hits = index.filter((u) => terms.every((t) => u.lower.includes(t)));
    const n = { all: hits.length, answers: hits.filter((h) => h.kind === "answers").length, quotes: hits.filter((h) => h.kind === "quotes").length };
    tabs.innerHTML = Object.entries(KINDS).map(([k, v]) =>
      `<button type="button" role="tab" data-k="${k}" aria-selected="${st.kind === k}">${esc(v)}<span class="n">${n[k]}</span></button>`).join("");
    tabs.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { st.kind = b.dataset.k; draw(); }));

    const shown = st.kind === "all" ? hits : hits.filter((h) => h.kind === st.kind);
    if (!shown.length) {
      out.innerHTML = `<div class="empty"><h3>No matches${st.kind !== "all" ? ` in ${esc(KINDS[st.kind].toLowerCase())}` : ""}</h3>
        <p>Check the spelling, use fewer words, or search ${st.kind === "all" ? "for a single term" : "everything"}.</p></div>`;
      return;
    }
    const byP = new Map();
    shown.forEach((h) => { if (!byP.has(h.id)) byP.set(h.id, []); byP.get(h.id).push(h); });
    const groups = [...byP.entries()].map(([id, hs]) => ({ id, p: hs[0].p, hs, w: hs.reduce((a, h) => a + h.weight, 0) }))
      .sort((a, b) => b.w - a.w || name(a.p).localeCompare(name(b.p)));
    const LIMIT = 5;
    out.innerHTML = `<p class="muted" style="margin:6px 0 4px">${shown.length} match${shown.length === 1 ? "" : "es"} in ${groups.length} protocol${groups.length === 1 ? "" : "s"}</p>` +
      groups.map((g) => {
        const all = expanded.has(g.id);
        const list = all ? g.hs : g.hs.slice(0, LIMIT);
        return `<section class="sr-group">
          <h2><a href="#/p/${esc(g.id)}">${esc(name(g.p))}</a><span class="muted">${esc(label("category", g.p.profile?.category))}</span><span class="n">${g.hs.length}</span></h2>
          ${list.map((h) => `<a class="sr ${h.quote ? "quote" : ""}" href="${esc(h.href)}">
            <span class="where">${h.rating && h.rating !== "n/a" ? `<i class="cell ${esc(h.rating)}"></i>` : ""}${esc(h.where)}</span>
            <span class="txt">${h.head ? `<b>${mark(h.head, terms)}.</b> ` : ""}${h.quote ? "“" : ""}${mark(snippet(h.text, terms), terms)}${h.quote ? "”" : ""}</span></a>`).join("")}
          ${g.hs.length > LIMIT ? `<button class="btn small ghost" type="button" data-more="${esc(g.id)}">${all ? "Show fewer" : `Show all ${g.hs.length} matches`}</button>` : ""}
        </section>`;
      }).join("");
    out.querySelectorAll("[data-more]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.more;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      draw();
    }));
  }
  draw();
}
