import {
  state, esc, name, pid, label, coverage, score, goalScore, goals, goalLabel, readWeights, setQuery,
  showTip, hideTip, maturityRank,
} from "../core.js";

const ROWS = { maturity: "Maturity", category: "Category", venue: "Developed at", mechanisms: "Mechanism" };
const MEASURES = { coverage: "Coverage", score: "Your ranking score" };
const R = 7;            // dot radius (14px marker)
const LANE = 28;        // vertical space per lane of dots

let onResize = null;

export function renderLandscape(el, _parts, params) {
  document.title = "Landscape | Protocol Explorer";
  const gids = goals().map((g) => g.id);
  const st = {
    rows: ROWS[params.get("rows")] ? params.get("rows") : "maturity",
    measure: MEASURES[params.get("m")] ? params.get("m") : "coverage",
    gx: gids.includes(params.get("x")) ? params.get("x") : "access_control",
    gy: gids.includes(params.get("y")) ? params.get("y") : "accountability",
  };
  const w = readWeights();
  const ps = state.current;
  const val = (p) => (st.measure === "score" ? score(p, w).score : coverage(p));

  const goalOpts = (sel) => goals().map((g) => `<option value="${esc(g.id)}" ${sel === g.id ? "selected" : ""}>${esc(g.label)}</option>`).join("");
  el.innerHTML = `<div class="wrap page" id="lscape">
    <div class="page-head"><div><h1>Landscape</h1>
      <p>Where each protocol sits: how much of the rubric it covers, how mature it is, and which goals it serves best. Select a dot to open the protocol.</p></div></div>

    <section>
      <div class="chart-head">
        <h2>Coverage by ${esc(ROWS[st.rows].toLowerCase())}</h2>
        <div class="toolbar" style="margin:0">
          <label>Show <select class="input" id="m">${Object.entries(MEASURES).map(([k, v]) => `<option value="${k}" ${st.measure === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Rows <select class="input" id="rows">${Object.entries(ROWS).map(([k, v]) => `<option value="${k}" ${st.rows === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        </div>
      </div>
      <p class="lede muted">${st.measure === "score" ? `Scores use your weights from the <a href="#/rank">Rank</a> page.` : "Coverage is the share of rated properties a protocol addresses, with partly addressed counting as half."}</p>
      <div class="chart" id="strip"></div>
    </section>

    <section class="section">
      <div class="chart-head">
        <h2>Goal map</h2>
        <div class="toolbar" style="margin:0">
          <label>Across <select class="input" id="gx">${goalOpts(st.gx)}</select></label>
          <label>Up <select class="input" id="gy">${goalOpts(st.gy)}</select></label>
        </div>
      </div>
      <p class="lede muted">Each goal's score is the share of the properties serving that goal a protocol addresses. Protocols towards the top right serve both goals well.</p>
      <div class="chart" id="scatter"></div>
    </section>

    <details class="section table-view">
      <summary>Show the numbers as a table</summary>
      <div class="cmp-wrap" style="max-height:none"><table class="cmp">
        <thead><tr><th scope="col" class="rowh">Protocol</th><th scope="col">Coverage</th><th scope="col">Your score</th>${goals().map((g) => `<th scope="col">${esc(g.label)}</th>`).join("")}<th scope="col">Maturity</th><th scope="col">Category</th></tr></thead>
        <tbody>${[...ps].sort((a, b) => coverage(b) - coverage(a)).map((p) => `<tr><th scope="row" class="rowh"><a href="#/p/${esc(pid(p))}">${esc(name(p))}</a></th>
          <td>${coverage(p)}%</td><td>${Math.round(score(p, w).score)}</td>${goals().map((g) => `<td>${Math.round(goalScore(p, g.id))}</td>`).join("")}
          <td>${esc(label("maturity", p.profile?.maturity))}</td><td>${esc(label("category", p.profile?.category))}</td></tr>`).join("")}</tbody>
      </table></div>
    </details>
  </div>`;

  const sync = () => {
    const q = new URLSearchParams();
    if (st.measure !== "coverage") q.set("m", st.measure);
    if (st.rows !== "maturity") q.set("rows", st.rows);
    if (st.gx !== "access_control") q.set("x", st.gx);
    if (st.gy !== "accountability") q.set("y", st.gy);
    setQuery(q, false);
  };
  ["m", "rows", "gx", "gy"].forEach((k) => el.querySelector("#" + k).addEventListener("change", (e) => {
    st[{ m: "measure", rows: "rows", gx: "gx", gy: "gy" }[k]] = e.target.value; sync();
  }));

  const draw = () => {
    const strip = el.querySelector("#strip"), sc = el.querySelector("#scatter");
    if (!strip || !sc || !strip.isConnected) return;
    strip.innerHTML = stripPlot(ps, st, val, strip.clientWidth);
    sc.innerHTML = goalMap(ps, st, sc.clientWidth);
    wireDots(strip, (p) => `<b>${esc(name(p))}</b><div>${st.measure === "score" ? "Your score" : "Coverage"}: ${Math.round(val(p))}${st.measure === "score" ? "" : "%"}</div><div class="muted-t">${esc(label("maturity", p.profile?.maturity))}, ${esc(label("category", p.profile?.category).toLowerCase())}</div>`);
    wireDots(sc, (p) => `<b>${esc(name(p))}</b><div>${esc(goalLabel(st.gx))}: ${Math.round(goalScore(p, st.gx))}</div><div>${esc(goalLabel(st.gy))}: ${Math.round(goalScore(p, st.gy))}</div>`);
  };
  draw();

  if (onResize) window.removeEventListener("resize", onResize);
  let t;
  onResize = () => {
    if (!document.getElementById("lscape")) { window.removeEventListener("resize", onResize); onResize = null; return; }
    clearTimeout(t); t = setTimeout(draw, 120);
  };
  window.addEventListener("resize", onResize);
}

function wireDots(root, tipHtml) {
  root.querySelectorAll("a.dot").forEach((a) => {
    const p = state.current.find((x) => pid(x) === a.dataset.id);
    const show = () => showTip(a.querySelector("circle"), tipHtml(p));
    a.addEventListener("pointerenter", show);
    a.addEventListener("focus", show);
    a.addEventListener("pointerleave", hideTip);
    a.addEventListener("blur", hideTip);
  });
}

const textW = (s) => s.length * 7.1 + 6;

// ---------- strip plot: one row per group, x = coverage or score ----------
function stripPlot(ps, st, val, width) {
  const narrow = width < 560;
  const left = narrow ? 104 : 168, right = 18, top = 8, axisH = 34;
  const x0 = left, x1 = width - right;
  const sx = (v) => x0 + ((x1 - x0) * v) / 100;
  const showLabels = ps.length <= 24;

  // groups in a meaningful order
  const vals = (p) => st.rows === "mechanisms" ? (p.profile?.mechanisms || []) : [p.profile?.[st.rows]];
  const groups = new Map();
  ps.forEach((p) => vals(p).filter(Boolean).forEach((v) => { if (!groups.has(v)) groups.set(v, []); groups.get(v).push(p); }));
  let entries = [...groups.entries()];
  if (st.rows === "maturity") entries.sort((a, b) => maturityRank(a[1][0]) - maturityRank(b[1][0]));
  else entries.sort((a, b) => b[1].length - a[1].length || label(st.rows, a[0]).localeCompare(label(st.rows, b[0])));

  // lay out each row's dots in lanes so dots and labels never overlap
  let y = top, rowsSvg = "", dotsSvg = "";
  for (const [g, list] of entries) {
    const items = list.map((p) => ({ p, v: val(p), x: sx(val(p)), text: name(p) })).sort((a, b) => a.x - b.x);
    const lanes = [];
    for (const it of items) {
      const lw = showLabels ? textW(it.text) : 0;
      it.side = it.x + R + 4 + lw > x1 ? "left" : "right";
      it.box = it.side === "right" ? [it.x - R - 2, it.x + R + 4 + lw] : [it.x - R - 4 - lw, it.x + R + 2];
      let lane = lanes.findIndex((boxes) => boxes.every((b) => it.box[0] > b[1] + 4 || it.box[1] < b[0] - 4));
      if (lane < 0) { lanes.push([]); lane = lanes.length - 1; }
      lanes[lane].push(it.box);
      it.lane = lane;
    }
    const h = Math.max(1, lanes.length) * LANE + 14;
    const cy0 = y + 7 + LANE / 2;
    rowsSvg += `<line x1="0" x2="${x1}" y1="${y + h}" y2="${y + h}" class="row-rule"/>
      <text x="0" y="${cy0 + 4}" class="row-label">${esc(trim(label(st.rows, g), narrow ? 13 : 22))}<title>${esc(label(st.rows, g))}</title></text>`;
    for (const it of items) {
      const cy = cy0 + it.lane * LANE;
      const lab = showLabels
        ? `<text x="${it.side === "right" ? it.x + R + 5 : it.x - R - 5}" y="${cy + 4}" text-anchor="${it.side === "right" ? "start" : "end"}" class="dot-label">${esc(it.text)}</text>` : "";
      dotsSvg += `<a href="#/p/${esc(pid(it.p))}" class="dot" data-id="${esc(pid(it.p))}" aria-label="${esc(it.text)}, ${Math.round(it.v)}${st.measure === "score" ? " points" : " percent coverage"}">
        <circle cx="${it.x}" cy="${cy}" r="${R}"/>${lab}</a>`;
    }
    y += h;
  }
  const H = y + axisH;
  const ticks = [0, 25, 50, 75, 100].map((v) => `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top}" y2="${y}" class="grid"/>
    <text x="${sx(v)}" y="${y + 20}" text-anchor="middle" class="tick">${v}${st.measure === "score" ? "" : "%"}</text>`).join("");
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="group" aria-label="Protocols by ${esc(ROWS[st.rows].toLowerCase())} and ${esc(MEASURES[st.measure].toLowerCase())}">
    ${ticks}${rowsSvg}${dotsSvg}</svg>`;
}

// ---------- goal map: scatter of two goal scores ----------
function goalMap(ps, st, width) {
  const narrow = width < 520;
  const m = { l: 46, r: 16, t: 30, b: 46 };
  const plotW = width - m.l - m.r;
  const plotH = Math.max(240, Math.min(plotW * 0.72, 460));
  const H = m.t + plotH + m.b;
  const sx = (v) => m.l + (plotW * v) / 100;
  const sy = (v) => m.t + plotH - (plotH * v) / 100;
  const showLabels = ps.length <= 30;

  // points; protocols at the same spot are fanned out around it
  const pts = ps.map((p) => ({ p, vx: goalScore(p, st.gx), vy: goalScore(p, st.gy), text: name(p) }));
  const spots = new Map();
  pts.forEach((pt) => { const k = `${Math.round(pt.vx)}:${Math.round(pt.vy)}`; if (!spots.has(k)) spots.set(k, []); spots.get(k).push(pt); });
  spots.forEach((list) => list.forEach((pt, i) => {
    const n = list.length, a = (2 * Math.PI * i) / n - Math.PI / 2, d = n > 1 ? R + 3 : 0;
    pt.x = sx(pt.vx) + d * Math.cos(a); pt.y = sy(pt.vy) + d * Math.sin(a);
  }));

  // labels: try right, left, above, below; skip when nothing fits (the tooltip still names it)
  const placed = pts.map((pt) => [pt.x - R, pt.y - R, pt.x + R, pt.y + R]);
  const overlaps = (b) => placed.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]));
  const inside = (b) => b[0] >= 0 && b[2] <= width && b[1] >= 0 && b[3] <= H - m.b + 10;
  let labels = "";
  if (showLabels) {
    for (const pt of [...pts].sort((a, b) => a.x - b.x)) {
      const lw = textW(pt.text), lh = 16;
      const cands = [
        { b: [pt.x + R + 4, pt.y - lh / 2, pt.x + R + 4 + lw, pt.y + lh / 2], x: pt.x + R + 5, y: pt.y + 4, a: "start" },
        { b: [pt.x - R - 4 - lw, pt.y - lh / 2, pt.x - R - 4, pt.y + lh / 2], x: pt.x - R - 5, y: pt.y + 4, a: "end" },
        { b: [pt.x - lw / 2, pt.y - R - 4 - lh, pt.x + lw / 2, pt.y - R - 4], x: pt.x, y: pt.y - R - 8, a: "middle" },
        { b: [pt.x - lw / 2, pt.y + R + 4, pt.x + lw / 2, pt.y + R + 4 + lh], x: pt.x, y: pt.y + R + 16, a: "middle" },
      ];
      const c = cands.find((c) => inside(c.b) && !overlaps(c.b));
      if (c) { placed.push(c.b); pt.label = `<text x="${c.x}" y="${c.y}" text-anchor="${c.a}" class="dot-label">${esc(pt.text)}</text>`; }
    }
  }
  const ticks = [0, 25, 50, 75, 100].map((v) => `
    <line x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${m.t + plotH}" class="grid"/>
    <line x1="${m.l}" x2="${m.l + plotW}" y1="${sy(v)}" y2="${sy(v)}" class="grid"/>
    <text x="${sx(v)}" y="${m.t + plotH + 18}" text-anchor="middle" class="tick">${v}</text>
    <text x="${m.l - 8}" y="${sy(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join("");
  const dots = pts.map((pt) => `<a href="#/p/${esc(pid(pt.p))}" class="dot" data-id="${esc(pid(pt.p))}"
    aria-label="${esc(pt.text)}: ${esc(goalLabel(st.gx))} ${Math.round(pt.vx)}, ${esc(goalLabel(st.gy))} ${Math.round(pt.vy)}">
    <circle cx="${pt.x}" cy="${pt.y}" r="${R}"/>${pt.label || ""}</a>`).join("");
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="group" aria-label="${esc(goalLabel(st.gx))} score against ${esc(goalLabel(st.gy))} score">
    ${ticks}
    <text x="${m.l}" y="${m.t - 12}" class="axis-title">${esc(goalLabel(st.gy))} score</text>
    <text x="${m.l + plotW}" y="${H - 6}" text-anchor="end" class="axis-title">${esc(goalLabel(st.gx))} score</text>
    ${dots}</svg>`;
}

function trim(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
