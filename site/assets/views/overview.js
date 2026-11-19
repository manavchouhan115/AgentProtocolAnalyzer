import { state, esc, name, pid, rowOf, RATING, coverage, shortLabel, label, showTip, hideTip, store, SKILL_URL } from "../core.js";

export function renderOverview(el) {
  document.title = "Protocol Explorer";
  const ps = state.current;
  const rated = state.rated;

  // group headers for the matrix
  const groups = [];
  for (const prop of rated) {
    const last = groups[groups.length - 1];
    if (last && last.name === prop.group) last.n++;
    else groups.push({ name: prop.group, n: 1 });
  }
  const starts = new Set();
  let prev = null;
  rated.forEach((p) => { if (prev !== null && p.group !== prev) starts.add(p.id); prev = p.group; });

  const firstVisit = !store.get("pe-seen-matrix", false);
  store.set("pe-seen-matrix", true);

  const head1 = `<tr class="groups"><th class="blank"></th>${groups
    .map((g, i) => `<th colspan="${g.n}" class="${i ? "gs" : ""}">${esc(g.name)}</th>`)
    .join("")}<th class="blank"></th></tr>`;
  const head2 = `<tr><th class="name"><span class="visually-hidden">Protocol</span></th>${rated
    .map((p) => `<th class="mprop ${starts.has(p.id) ? "group-start" : ""}" scope="col" title="${esc(p.question)}"><span><a href="#/properties/${esc(p.id)}">${esc(shortLabel(p))}</a></span></th>`)
    .join("")}<th class="name" style="position:static;min-width:auto;font-size:13px;font-weight:500;color:var(--muted);vertical-align:bottom;padding-left:18px" scope="col">Coverage</th></tr>`;

  const sorted = [...ps].sort((a, b) => coverage(b) - coverage(a) || name(a).localeCompare(name(b)));
  const body = sorted
    .map((p, ri) => `<tr><th class="name" scope="row"><a href="#/p/${esc(pid(p))}">${esc(name(p))}</a><small>${esc(label("category", p.profile?.category))}</small></th>${rated
      .map((prop, ci) => {
        const r = rowOf(p, prop.id);
        return `<td class="c ${starts.has(prop.id) ? "group-start" : ""}"><button type="button" class="${esc(r.rating)}" data-p="${esc(pid(p))}" data-prop="${esc(prop.id)}"
          aria-label="${esc(name(p))}, ${esc(prop.property)}: ${esc(RATING[r.rating] || "")}. ${esc(r.short || "")}"
          style="animation-delay:${firstVisit ? ci * 35 + ri * 20 : 0}ms"></button></td>`;
      })
      .join("")}<td class="score">${coverage(p)}%</td></tr>`)
    .join("");

  // least covered properties
  const coverageRows = rated
    .filter((p) => p.id !== "status_adoption")
    .map((prop) => {
      const c = { green: 0, yellow: 0, red: 0 };
      ps.forEach((p) => { const r = rowOf(p, prop.id).rating; if (c[r] !== undefined) c[r]++; });
      return { prop, ...c };
    })
    .sort((a, b) => b.red - a.red || a.green - b.green);
  const n = ps.length || 1;
  const bars = coverageRows
    .map((x) => `<div class="bar-row"><a href="#/properties/${esc(x.prop.id)}" title="${esc(x.prop.question)}">${esc(x.prop.property)}</a>
      <div class="bar" role="img" aria-label="${x.green} addressed, ${x.yellow} partly, ${x.red} not addressed">
        <span class="g" style="width:${(100 * x.green) / n}%"></span><span class="y" style="width:${(100 * x.yellow) / n}%"></span><span class="r" style="width:${(100 * x.red) / n}%"></span>
      </div><span class="n" title="${x.red} of ${ps.length} protocols do not address this">${x.red} of ${ps.length}</span></div>`)
    .join("");

  const tallies = ["category", "maturity", "venue"].map((f) => {
    const counts = {};
    ps.forEach((p) => { const v = p.profile?.[f]; if (v) counts[v] = (counts[v] || 0) + 1; });
    const items = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const title = { category: "By category", maturity: "By maturity", venue: "By venue" }[f];
    return `<div><h3>${title}</h3><ul>${items
      .map(([v, c]) => `<li><a href="#/explore?${f}=${esc(v)}">${esc(label(f, v))}</a><span class="muted">${c}</span></li>`)
      .join("")}</ul></div>`;
  }).join("");

  el.innerHTML = `
  <div class="wrap">
    <section class="hero">
      <h1>How AI agent protocols identify, authorize and answer for agents</h1>
      <p>Each protocol is analysed on ${state.props.length} properties from the side of the service that receives an agent's request, and ${rated.length} of them get a colour rating. Every rating links to the quotes from the specification behind it.</p>
      <div class="actions"><a class="btn primary" href="#/explore">Explore each protocol</a><a class="btn" href="#/rank">Rank by what matters to you</a><a class="btn" href="#/landscape">See the landscape</a></div>
      <p class="skill-cta">Want to analyse a protocol yourself? <a href="${SKILL_URL}" target="_blank" rel="noopener">Get the protocol-analyzer skill</a> and <a href="#/about?s=analyse">follow these steps</a>.</p>
      <div class="stats">
        <div><b>${ps.length}</b><span>protocols</span></div>
      </div>
    </section>

    <div class="matrix-wrap">
      <table class="matrix ${firstVisit ? "animate" : ""}" aria-label="Ratings of every protocol on every property">
        <thead>${head1}${head2}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="legend" style="margin-top:14px">
      <span><i class="cell green"></i>Addressed</span><span><i class="cell yellow"></i>Partly addressed</span><span><i class="cell red"></i>Not addressed (may be out of scope by design)</span>
      <span class="muted">Select a square to see the answer.</span>
    </div>

    <div class="section two-col">
      <div>
        <h2>Which properties are least covered</h2>
        <p class="lede">How many protocols address each property, with the number that do not on the right. Select a property to see every protocol's answer.</p>
        <div class="bars">${bars}</div>
      </div>
      <div>
        <h2>What is in the dataset</h2>
        <p class="lede">Protocols by the problem they solve, how mature they are, and where they are developed.</p>
        <div class="tally">${tallies}</div>
      </div>
    </div>
  </div>`;

  const table = el.querySelector(".matrix");
  table.addEventListener("pointerover", (e) => {
    const b = e.target.closest("button[data-prop]");
    if (!b) return;
    tipFor(b);
  });
  table.addEventListener("focusin", (e) => { const b = e.target.closest("button[data-prop]"); if (b) tipFor(b); });
  table.addEventListener("pointerout", hideTip);
  table.addEventListener("focusout", hideTip);
  table.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-prop]");
    if (b) location.hash = `#/p/${b.dataset.p}?prop=${b.dataset.prop}`;
  });
}

function tipFor(b) {
  const p = state.current.find((x) => pid(x) === b.dataset.p);
  const prop = state.props.find((x) => x.id === b.dataset.prop);
  const r = rowOf(p, prop.id);
  showTip(b, `<b>${esc(name(p))}: ${esc(prop.property)}</b><span class="r"><i class="cell ${esc(r.rating)}"></i>${esc(RATING[r.rating] || "")}</span><div>${esc(r.short || "")}</div>`);
}
