import { state, loadData, parseHash, renderTray, store, hideTip, esc } from "./core.js";
import { renderOverview } from "./views/overview.js";
import { renderExplore } from "./views/explore.js";
import { renderProtocol } from "./views/protocol.js";
import { renderCompare } from "./views/compare.js";
import { renderAdd } from "./views/add.js";
import { renderAbout } from "./views/about.js";
import { renderRank } from "./views/rank.js";
import { renderProperties } from "./views/properties.js";
import { renderLandscape } from "./views/landscape.js";
import { renderSearch } from "./views/search.js";

const view = document.getElementById("view");
let lastPath = null;

const routes = {
  "": renderOverview,
  explore: renderExplore,
  p: renderProtocol,
  compare: renderCompare,
  rank: renderRank,
  properties: renderProperties,
  landscape: renderLandscape,
  search: renderSearch,
  add: renderAdd,
  about: renderAbout,
};

async function route() {
  hideTip();
  const { parts, params } = parseHash();
  const key = parts[0] || "";
  const fn = routes[key] || notFound;
  document.querySelectorAll(".nav a").forEach((a) => {
    const on = a.dataset.route === (key === "p" ? "explore" : key === "search" ? "-" : key);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  // on narrow screens the menu scrolls sideways; keep the current page in view
  const nav = document.querySelector(".nav"), cur = nav.querySelector("[aria-current]");
  if (cur && nav.scrollWidth > nav.clientWidth) {
    const l = cur.offsetLeft - nav.offsetLeft, r = l + cur.offsetWidth;
    if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = l - 12;
  }
  const path = parts.join("/");
  const changed = path !== lastPath;
  lastPath = path;
  await fn(view, parts.slice(1), params, { changed });
  if (changed && !params.get("prop") && !params.get("s")) window.scrollTo(0, 0);
  renderTray();
}

function notFound(el) {
  el.innerHTML = `<div class="wrap page"><h1>Page not found</h1><p class="muted">This address does not match any page. <a href="#/">Go to the overview</a>.</p></div>`;
  document.title = "Not found | Protocol Explorer";
}

function setupTheme() {
  const btn = document.getElementById("theme");
  btn.addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("pe-theme", root.dataset.theme); } catch (e) { /* ignore */ }
  });
}

async function start() {
  setupTheme();
  state.compare = store.get("pe-compare", []);
  try {
    await loadData();
  } catch (e) {
    view.innerHTML = `<div class="wrap page"><h1>The dataset could not be loaded</h1>
      <p class="prose">${esc(e.message)}</p>
      <p class="prose muted">Start the site with <code>python scripts/serve.py</code> from the project folder, then open <code>http://localhost:8000</code>. Opening the HTML file directly does not work, because the browser blocks it from reading the dataset.</p></div>`;
    return;
  }
  const n = state.current.length;
  document.getElementById("foot-data").textContent = `${n} protocol${n === 1 ? "" : "s"}, dataset built ${(state.data.generated_at || "").slice(0, 10)}`;
  window.addEventListener("hashchange", route);
  // "/" focuses the search box on the page, or opens search from anywhere else.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (/input|select|textarea/i.test(a.tagName) || a.isContentEditable)) return;
    e.preventDefault();
    const box = document.getElementById("q") || document.getElementById("sq");
    if (box) box.focus(); else location.hash = "#/search";
  });
  document.addEventListener("data-reloaded", () => { lastPath = null; route(); });
  route();
}

start();
