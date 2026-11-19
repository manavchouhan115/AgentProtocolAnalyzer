import {
  state, esc, name, pid, label, fingerprint, reviewBadge, pill, RATING, goals, goalLabel, scoredProps,
  GOAL_LEVELS, PROP_LEVELS, PARTLY_LEVELS, PRESETS, defaultWeights, presetOf, readWeights, saveWeights,
  weightsQuery, propWeight, score, goalScore, setQuery, toast, compareButton, wireCompareButtons,
} from "../core.js";

const fmt = (n) => Math.round(n);

export function renderRank(el, _parts, params) {
  document.title = "Rank | Protocol Explorer";
  const w = readWeights(params);
  const open = new Set();
  let fineOpen = Object.values(w.props).some((v) => v !== 1);

  el.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><h1>Rank protocols by what matters to you</h1>
      <p>Say how much each goal matters for your service. The ranking updates as you go, and your settings are kept in this browser.</p></div></div>
    <div class="rank">
      <aside class="weights panel" id="weights" aria-label="Ranking settings"></aside>
      <div>
        <div class="toolbar" style="margin-top:0"><span class="count" id="rank-count"></span>
          <button class="btn small ghost" type="button" id="copy">Copy link to this ranking</button></div>
        <ol class="ranked" id="ranked"></ol>
      </div>
    </div>
  </div>`;

  const panel = el.querySelector("#weights");
  const list = el.querySelector("#ranked");

  function seg(name, levels, value, labelText) {
    return `<div class="seg" role="radiogroup" aria-label="${esc(labelText)}">${levels.map((l) =>
      `<button type="button" role="radio" data-seg="${esc(name)}" data-v="${l.v}" aria-checked="${l.v === value}">${esc(l.label)}</button>`).join("")}</div>`;
  }

  function drawPanel() {
    const preset = presetOf(w);
    const changedProps = Object.values(w.props).filter((v) => v !== 1).length;
    panel.innerHTML = `
      <div class="w-block">
        <div class="w-title">Start from</div>
        <div class="presets">${Object.entries(PRESETS).map(([k, p]) =>
          `<button type="button" class="btn small" data-preset="${k}" aria-pressed="${preset === k}">${esc(p.label)}</button>`).join("")}</div>
      </div>
      ${goals().map((g) => `<div class="w-block">
        <div class="w-title">${esc(g.label)}</div>
        <p class="w-def">${esc(g.definition.charAt(0).toUpperCase() + g.definition.slice(1))}</p>
        ${seg("goal:" + g.id, GOAL_LEVELS, w.goals[g.id], g.label + " weight")}
      </div>`).join("")}
      <div class="w-block">
        <div class="w-title">A partly addressed property earns</div>
        ${seg("partly", PARTLY_LEVELS, w.partly, "Credit for partly addressed")}
      </div>
      <details class="w-block fine" ${fineOpen ? "open" : ""}>
        <summary>Fine-tune single properties${changedProps ? ` (${changedProps} changed)` : ""}</summary>
        <div class="fine-list">${scoredProps().map((prop) => `<div class="fine-row">
          <div><a href="#/property/${esc(prop.id)}">${esc(prop.property)}</a><small>${(prop.goals || []).map(goalLabel).map(esc).join(", ")}</small></div>
          ${seg("prop:" + prop.id, PROP_LEVELS, w.props[prop.id] ?? 1, prop.property + " weight")}
        </div>`).join("")}</div>
      </details>
      <button class="btn small ghost" type="button" id="reset" ${preset === "balanced" ? "disabled" : ""}>Reset to balanced</button>`;

    panel.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      Object.assign(w, defaultWeights(), { goals: { ...PRESETS[b.dataset.preset].goals } });
      changed();
      panel.querySelector(`[data-preset="${b.dataset.preset}"]`)?.focus();
    }));
    panel.querySelectorAll("[data-seg]").forEach((b) => b.addEventListener("click", () => {
      const [kind, id] = b.dataset.seg.split(":");
      const v = Number(b.dataset.v);
      if (kind === "goal") w.goals[id] = v;
      else if (kind === "partly") w.partly = v;
      else if (v === 1) delete w.props[id];
      else w.props[id] = v;
      changed();
      panel.querySelector(`[data-seg="${CSS.escape(b.dataset.seg)}"][data-v="${b.dataset.v}"]`)?.focus();
    }));
    panel.querySelector("details.fine").addEventListener("toggle", (e) => { fineOpen = e.target.open; });
    panel.querySelectorAll(".seg").forEach(wireArrowKeys);
    panel.querySelector("#reset").addEventListener("click", () => { Object.assign(w, defaultWeights()); changed(); });
  }

  function drawList() {
    const allZero = scoredProps().every((p) => propWeight(p, w) === 0);
    const rows = state.current.map((p) => ({ p, ...score(p, w) }))
      .sort((a, b) => b.score - a.score || name(a.p).localeCompare(name(b.p)));
    el.querySelector("#rank-count").textContent = allZero
      ? "Every goal is set to Ignore, so nothing is scored."
      : `${rows.length} protocol${rows.length === 1 ? "" : "s"}, highest score first`;

    let prevScore = null, prevRank = 0;
    const before = positions(list);
    list.innerHTML = rows.map((x, i) => {
      const s = fmt(x.score);
      const rank = s === prevScore ? prevRank : i + 1;
      const tie = s === prevScore || (rows[i + 1] && fmt(rows[i + 1].score) === s);
      prevScore = s; prevRank = rank;
      const id = pid(x.p);
      const gl = goals().map((g) => {
        const v = fmt(goalScore(x.p, g.id, w.partly));
        const off = w.goals[g.id] === 0;
        return `<div class="meter ${off ? "off" : ""}" title="${esc(g.label)}: ${v} out of 100${off ? " (ignored in your ranking)" : ""}">
          <span class="m-l">${esc(g.label)}</span><span class="m-v">${v}</span>
          <span class="m-bar"><i style="width:${v}%"></i></span></div>`;
      }).join("");
      const gaps = x.parts.filter((pt) => pt.weight > 0 && pt.lost > 0).sort((a, b) => b.lost - a.lost || a.prop.property.localeCompare(b.prop.property));
      const top = gaps.slice(0, 3).map((pt) => pt.prop.property);
      return `<li class="rk" data-id="${esc(id)}">
        <div class="rk-pos" aria-label="Rank ${rank}${tie ? ", tied" : ""}">${tie ? "=" : ""}${rank}</div>
        <div class="rk-main">
          <div class="title"><a href="#/p/${esc(id)}">${esc(name(x.p))}</a>
            <span class="chips">${p_chips(x.p)}${reviewBadge(x.p)}</span></div>
          ${fingerprint(x.p, { size: 11 })}
          <p class="rk-gaps">${top.length ? `Loses most points on ${esc(listText(top))}.` : "Addresses every property you weighted."}</p>
          <details class="rk-why" data-id="${esc(id)}" ${open.has(id) ? "open" : ""}><summary>Why this score</summary>${breakdown(x, w)}</details>
        </div>
        <div class="rk-goals">${gl}</div>
        <div class="rk-score"><b>${allZero ? "–" : s}</b><span>score</span>${compareButton(id)}</div>
      </li>`;
    }).join("");
    list.querySelectorAll("details.rk-why").forEach((d) => d.addEventListener("toggle", () => { d.open ? open.add(d.dataset.id) : open.delete(d.dataset.id); }));
    wireCompareButtons(list);
    animateFrom(list, before);
  }

  function changed() {
    saveWeights(w);
    setQuery(weightsQuery(w));
    drawPanel();
    drawList();
  }

  el.querySelector("#copy").addEventListener("click", async () => {
    setQuery(weightsQuery(w));
    try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch (e) { toast("Copy the address from the address bar"); }
  });

  if (params.get("w")) saveWeights(w);
  drawPanel();
  drawList();
}

function p_chips(p) {
  return ["category", "maturity"].filter((f) => p.profile?.[f]).map((f) => `<span class="chip">${esc(label(f, p.profile[f]))}</span>`).join("");
}

function listText(items) {
  if (items.length < 2) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function breakdown(x, w) {
  const rows = [...x.parts].sort((a, b) => b.lost - a.lost || b.weight - a.weight || a.prop.property.localeCompare(b.prop.property));
  const total = rows.reduce((a, r) => a + r.weight, 0);
  const earned = rows.reduce((a, r) => a + r.earned, 0);
  const n = (v) => (Math.round(v * 100) / 100).toString();
  return `<table class="bd">
    <thead><tr><th scope="col">Property</th><th scope="col">Rating</th><th scope="col" class="num">Weight</th><th scope="col" class="num">Points</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.weight ? "" : "off"}">
      <th scope="row"><a href="#/p/${esc(pid(x.p))}?prop=${esc(r.prop.id)}">${esc(r.prop.property)}</a></th>
      <td>${pill(r.rating) || esc(RATING[r.rating] || "")}</td>
      <td class="num">${r.weight ? n(r.weight) : "Ignored"}</td>
      <td class="num">${r.weight ? `${n(r.earned)} of ${n(r.weight)}` : ""}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row" colspan="3">Score: ${n(earned)} of ${n(total)} points, scaled to 100</th><td class="num"><b>${total ? Math.round((100 * earned) / total) : "–"}</b></td></tr></tfoot>
  </table>
  <p class="muted" style="font-size:13px;margin:8px 0 0">A property's weight is the average weight of the goals it serves, times its own setting. Addressed earns the full weight${w.partly ? `, partly addressed earns ${w.partly === 1 ? "the full weight" : "half"}` : ", partly addressed earns nothing"}.</p>`;
}

// Arrow keys move between the options of a segmented control.
function wireArrowKeys(group) {
  group.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = [...group.querySelectorAll("button")];
    const i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
    next.click();
  });
}

// Rows glide to their new place when the ranking changes.
function positions(list) {
  const m = new Map();
  list.querySelectorAll("li[data-id]").forEach((li) => m.set(li.dataset.id, li.getBoundingClientRect().top));
  return m;
}
function animateFrom(list, before) {
  if (!before.size || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  list.querySelectorAll("li[data-id]").forEach((li) => {
    const old = before.get(li.dataset.id);
    if (old === undefined) return;
    const dy = old - li.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
}
