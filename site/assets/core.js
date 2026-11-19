// Shared state, data access and small UI helpers.

export const state = {
  data: null,          // the whole dataset
  all: [],             // every analysis (all versions)
  current: [],         // latest version of each protocol
  props: [],           // rubric properties (from the dataset)
  rated: [],           // rated properties, in rubric order
  compare: [],         // protocol ids in the compare tray
  server: null,        // true when the local upload server is available
};

const DATA_URL = "../data/protocols.json";

export async function loadData() {
  const res = await fetch(DATA_URL + "?t=" + Date.now());
  if (!res.ok) throw new Error(`Could not load the dataset (${res.status}).`);
  const data = await res.json();
  state.data = data;
  state.all = data.protocols || [];
  state.current = state.all.filter((p) => p._meta && p._meta.current).sort((a, b) => name(a).localeCompare(name(b)));
  state.props = data.properties || [];
  state.rated = state.props.filter((p) => p.rated);
  state.compare = state.compare.filter((id) => byId(id));
  return data;
}

export async function checkServer() {
  if (state.server !== null) return state.server;
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    state.server = r.ok && (await r.json()).upload === true;
  } catch (e) {
    state.server = false;
  }
  return state.server;
}

// ---------- accessors ----------
export const name = (p) => p.protocol?.name || p.profile?.id || "Protocol";
export const pid = (p) => p.profile?.id;
export const byId = (id) => state.current.find((p) => pid(p) === id);
export const versionsOf = (id) => state.all.filter((p) => pid(p) === id);
export const rowOf = (p, id) => (p.rows || []).find((r) => r.id === id) || {};
export const isReviewed = (p) => p.review?.status === "reviewed";

// Short column labels for the matrix and compare views
const SHORT = {
  status_adoption: "Status", identifier: "Identifier", instance_identifier: "Instance ID", acting_for: "Acting for",
  credential_type: "Credential", credential_lifetime: "Lifetime", validity: "Validity", authentication: "Authentication",
  authorization: "Authorization", human_approval: "Human approval", trust: "Trust", revocation: "Revocation",
  contact_escalation: "Contact", cross_party_signalling: "Signalling", model_identity: "Model identity",
};
export const shortLabel = (prop) => SHORT[prop.id] || prop.property;

export const RATING = { green: "Addressed", yellow: "Partly addressed", red: "Not addressed", "n/a": "Descriptive" };
const RANK = { green: 1, yellow: 0.5, red: 0 };

// Coverage: share of rated properties addressed (partly counts half). Status is maturity, not coverage.
export function coverage(p) {
  const props = scoredProps();
  if (!props.length) return 0;
  const s = props.reduce((acc, x) => acc + (RANK[rowOf(p, x.id).rating] ?? 0), 0);
  return Math.round((100 * s) / props.length);
}

// ---------- goals, weights and scores ----------
// Properties that count towards coverage and scores (status describes maturity instead).
export const scoredProps = () => state.rated.filter((x) => x.id !== "status_adoption");
export const goals = () => state.data?.goals || [];
export const goalLabel = (id) => goals().find((g) => g.id === id)?.label || id;

export const GOAL_LEVELS = [
  { v: 0, label: "Ignore" }, { v: 1, label: "Low" }, { v: 2, label: "Normal" }, { v: 3, label: "High" },
];
export const PROP_LEVELS = [{ v: 0, label: "Ignore" }, { v: 1, label: "Normal" }, { v: 2, label: "Double" }];
export const PARTLY_LEVELS = [{ v: 0, label: "Nothing" }, { v: 0.5, label: "Half" }, { v: 1, label: "Full" }];
const GOAL_ORDER = ["access_control", "incident_response", "accountability"];
export const PRESETS = {
  balanced: { label: "Balanced", goals: { access_control: 2, incident_response: 2, accountability: 2 } },
  access: { label: "Access control first", goals: { access_control: 3, incident_response: 1, accountability: 1 } },
  incident: { label: "Incident response first", goals: { access_control: 1, incident_response: 3, accountability: 1 } },
  accountability: { label: "Accountability first", goals: { access_control: 1, incident_response: 1, accountability: 3 } },
};
export const defaultWeights = () => ({ goals: { ...PRESETS.balanced.goals }, props: {}, partly: 0.5 });

export function presetOf(w) {
  if (Object.keys(w.props).length || w.partly !== 0.5) return null;
  return Object.keys(PRESETS).find((k) => GOAL_ORDER.every((g) => PRESETS[k].goals[g] === w.goals[g])) || null;
}

// Weights live in the URL when shared, and in this browser otherwise.
export function readWeights(params) {
  const w = store.get("pe-weights", null) || defaultWeights();
  w.goals = { ...defaultWeights().goals, ...(w.goals || {}) };
  w.props = { ...(w.props || {}) };
  if (typeof w.partly !== "number") w.partly = 0.5;
  if (params && params.get("w")) {
    const g = params.get("w").split(".").map(Number);
    GOAL_ORDER.forEach((id, i) => { if ([0, 1, 2, 3].includes(g[i])) w.goals[id] = g[i]; });
    w.props = {};
    (params.get("x") || "").split(",").filter(Boolean).forEach((kv) => {
      const [k, v] = kv.split(":");
      if (k && [0, 2].includes(Number(v))) w.props[k] = Number(v);
    });
    const pt = Number(params.get("partly"));
    w.partly = [0, 0.5, 1].includes(pt) && params.get("partly") !== null ? pt : 0.5;
  }
  return w;
}
export function saveWeights(w) { store.set("pe-weights", w); }
export function weightsQuery(w) {
  const q = new URLSearchParams();
  q.set("w", GOAL_ORDER.map((g) => w.goals[g]).join("."));
  const x = Object.entries(w.props).filter(([, v]) => v !== 1).map(([k, v]) => `${k}:${v}`);
  if (x.length) q.set("x", x.join(","));
  if (w.partly !== 0.5) q.set("partly", String(w.partly));
  return q;
}

const ratingValue = (r, partly = 0.5) => (r === "green" ? 1 : r === "yellow" ? partly : 0);

// A property's weight: the average weight of the goals it serves, times its own multiplier.
export function propWeight(prop, w) {
  const gs = prop.goals || [];
  if (!gs.length) return 0;
  const m = w.props[prop.id] ?? 1;
  return (m * gs.reduce((a, g) => a + (w.goals[g] ?? 2), 0)) / gs.length;
}

// Weighted score out of 100, with the per-property parts behind it.
export function score(p, w) {
  let num = 0, den = 0;
  const parts = [];
  for (const prop of scoredProps()) {
    const wt = propWeight(prop, w);
    const r = rowOf(p, prop.id).rating;
    const earned = wt * ratingValue(r, w.partly);
    parts.push({ prop, rating: r, weight: wt, earned, lost: wt - earned });
    num += earned; den += wt;
  }
  return { score: den ? (100 * num) / den : 0, parts };
}

// How well a protocol serves one goal: the average over the properties that serve it.
export function goalScore(p, goalId, partly = 0.5) {
  const props = scoredProps().filter((x) => (x.goals || []).includes(goalId));
  if (!props.length) return 0;
  return (100 * props.reduce((a, x) => a + ratingValue(rowOf(p, x.id).rating, partly), 0)) / props.length;
}

export function label(field, value) {
  const list = state.data?.vocab?.[field] || [];
  const hit = list.find((v) => v.value === value);
  return hit ? hit.label : String(value || "").replace(/-/g, " ");
}

// What a profile value means, as one sentence (from the skill's vocabulary).
export function describe(field, value) {
  const hit = (state.data?.vocab?.[field] || []).find((v) => v.value === value);
  const d = hit?.description || (value === "other" ? "anything that does not fit the other values" : "");
  return d ? d.charAt(0).toUpperCase() + d.slice(1) + (d.endsWith(".") ? "" : ".") : "";
}

const MATURITY_ORDER = ["standard", "stable", "draft", "proposal", "deprecated"];
export const maturityRank = (p) => {
  const i = MATURITY_ORDER.indexOf(p.profile?.maturity);
  return i < 0 ? 99 : i;
};

// ---------- html helpers ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Search terms: words and "quoted phrases", lower case.
export function parseTerms(q) {
  const out = [];
  String(q || "").replace(/"([^"]+)"|(\S+)/g, (_, phrase, word) => { const t = (phrase || word || "").toLowerCase().replace(/"/g, "").trim(); if (t) out.push(t); });
  return out;
}

// Escape text and wrap every occurrence of the terms in <mark>, matching on the raw text.
export function markText(text, terms) {
  const s = String(text ?? "");
  const pats = (terms || []).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  if (!pats.length) return esc(s);
  return s.split(new RegExp(`(${pats.join("|")})`, "gi")).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
}

export function fingerprint(p, { size = 14, gap = true } = {}) {
  let html = "", group = null;
  for (const prop of state.rated) {
    if (gap && group && prop.group !== group) html += `<span class="gap"></span>`;
    group = prop.group;
    const r = rowOf(p, prop.id);
    html += `<span class="cell ${esc(r.rating)}" style="width:${size}px;height:${size}px" title="${esc(prop.property)}: ${esc(RATING[r.rating] || "")}. ${esc(r.short || "")}"></span>`;
  }
  return `<span class="fp" role="img" aria-label="Ratings for ${esc(name(p))}">${html}</span>`;
}

export function reviewBadge(p) {
  return isReviewed(p)
    ? `<span class="badge-reviewed">Reviewed</span>`
    : `<span class="badge-draft" title="Produced by the analysis skill and not yet checked by a person">Draft analysis</span>`;
}

export function profileChips(p, fields = ["category", "maturity", "venue"]) {
  const pr = p.profile || {};
  return fields
    .filter((f) => pr[f])
    .map((f) => `<span class="chip" title="${esc(f)}">${esc(label(f, pr[f]))}</span>`)
    .join("");
}

export function pill(rating) {
  return rating && rating !== "n/a" ? `<span class="pill ${esc(rating)}">${esc(RATING[rating])}</span>` : "";
}

// ---------- query string in the hash ----------
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  return { parts: path.split("/").filter(Boolean), params };
}

export function setQuery(params, replace = true) {
  const { parts } = parseHash();
  const q = params.toString();
  const url = `#/${parts.join("/")}${q ? "?" + q : ""}`;
  if (replace) history.replaceState(null, "", url);
  else location.hash = url;
}

// ---------- storage (optional; works without it) ----------
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

// ---------- toast ----------
let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- tooltip ----------
export function showTip(target, html) {
  const tip = document.getElementById("tip");
  tip.innerHTML = html;
  tip.classList.add("show");
  const r = target.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
  let top = r.top - th - 10;
  if (top < 70) top = r.bottom + 10;
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}
export function hideTip() { document.getElementById("tip").classList.remove("show"); }

// ---------- compare tray ----------
export const MAX_COMPARE = 4;
// "2025-04" -> "Apr 2025"; "2025" -> "2025"; anything else as given.
export function monthYear(v) {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(v || ""));
  if (!m) return v ? String(v) : "";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m[2] ? `${names[Number(m[2]) - 1]} ${m[1]}` : m[1];
}
// Where people can download the protocol-analyzer skill.
export const SKILL_URL = "https://drive.google.com/drive/folders/1QaKJ1ngJ2Dw5tPssELHjXJTAfV73cUz-?usp=drive_link";
export function toggleCompare(id) {
  const i = state.compare.indexOf(id);
  if (i >= 0) state.compare.splice(i, 1);
  else if (state.compare.length >= MAX_COMPARE) { toast(`You can compare up to ${MAX_COMPARE} protocols.`); return false; }
  else state.compare.push(id);
  store.set("pe-compare", state.compare);
  renderTray();
  document.dispatchEvent(new CustomEvent("compare-changed"));
  return true;
}
export const inCompare = (id) => state.compare.includes(id);

export function renderTray() {
  const tray = document.getElementById("tray");
  const onCompare = parseHash().parts[0] === "compare";
  if (!state.compare.length || onCompare) { tray.classList.remove("show"); return; }
  tray.innerHTML = `<span class="label">Compare</span><span class="items">${state.compare
    .map((id) => `<span class="it">${esc(name(byId(id) || { profile: { id } }))}<button type="button" data-rm="${esc(id)}" aria-label="Remove ${esc(id)} from compare">×</button></span>`)
    .join("")}</span><a class="btn primary small" href="#/compare?ids=${encodeURIComponent(state.compare.join(","))}">${state.compare.length < 2 ? "Open compare" : `Compare ${state.compare.length}`}</a>`;
  tray.classList.add("show");
  tray.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => toggleCompare(b.dataset.rm)));
}

export function compareButton(id) {
  const on = inCompare(id);
  return `<button class="btn small" type="button" data-compare="${esc(id)}" aria-pressed="${on}">${on ? "Added to compare" : "Add to compare"}</button>`;
}

export function wireCompareButtons(root) {
  root.querySelectorAll("[data-compare]").forEach((b) => {
    b.addEventListener("click", () => {
      toggleCompare(b.dataset.compare);
      const on = inCompare(b.dataset.compare);
      b.setAttribute("aria-pressed", on);
      b.textContent = on ? "Added to compare" : "Add to compare";
    });
  });
}
