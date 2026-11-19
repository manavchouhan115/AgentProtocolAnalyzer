import { state, esc, name, pid, byId, rowOf, RATING, label, reviewBadge, setQuery, store, toast, MAX_COMPARE } from "../core.js";

export function renderCompare(el, _parts, params) {
  document.title = "Compare | Protocol Explorer";
  let ids = (params.get("ids") || "").split(",").filter((id) => byId(id));
  if (!ids.length && state.compare.length) ids = state.compare.filter((id) => byId(id));
  ids = [...new Set(ids)].slice(0, MAX_COMPARE);
  const opts = { full: params.get("full") === "1", diff: params.get("diff") === "1" };

  const sync = () => {
    state.compare = [...ids];
    store.set("pe-compare", state.compare);
    const q = new URLSearchParams();
    if (ids.length) q.set("ids", ids.join(","));
    if (opts.full) q.set("full", "1");
    if (opts.diff) q.set("diff", "1");
    setQuery(q);
    draw();
  };

  function draw() {
    const ps = ids.map(byId);
    const others = state.current.filter((p) => !ids.includes(pid(p)));
    const picker = `<div class="picker">
      ${ps.map((p) => `<span class="chip">${esc(name(p))}<button type="button" data-rm="${esc(pid(p))}" aria-label="Remove ${esc(name(p))}">×</button></span>`).join("")}
      ${ids.length < MAX_COMPARE && others.length ? `<select class="input" id="add" aria-label="Add a protocol"><option value="">Add a protocol</option>${others.map((p) => `<option value="${esc(pid(p))}">${esc(name(p))}</option>`).join("")}</select>` : ""}
    </div>`;

    let table = "";
    if (ps.length >= 2) {
      const profileRows = [
        ["Category", (p) => label("category", p.profile?.category)],
        ["Maturity", (p) => label("maturity", p.profile?.maturity)],
        ["Developed at", (p) => label("venue", p.profile?.venue)],
        ["Mechanism", (p) => (p.profile?.mechanisms || []).map((m) => label("mechanisms", m)).join(", ")],
        ["Openness", (p) => label("openness", p.profile?.openness)],
        ["Specification", (p) => `${p.protocol?.spec_version || ""} (${p.protocol?.spec_date || ""})`],
        ["Analysis", (p) => p.review?.status === "reviewed" ? "Reviewed by a person" : "Draft, not yet reviewed"],
      ];
      let body = `<tr class="grp"><td colspan="${ps.length + 1}">Profile</td></tr>`;
      body += profileRows.map(([lab, fn]) => {
        const vals = ps.map(fn);
        if (opts.diff && new Set(vals).size === 1) return "";
        return `<tr><th class="rowh" scope="row">${lab}</th>${vals.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`;
      }).join("");
      let group = null, groupRows = "", shown = 0;
      const flush = () => { if (groupRows) body += `<tr class="grp"><td colspan="${ps.length + 1}">${esc(group)}</td></tr>` + groupRows; groupRows = ""; };
      for (const prop of state.props) {
        if (prop.id === "summary") continue;
        if (prop.group !== group) { flush(); group = prop.group; }
        const rows = ps.map((p) => rowOf(p, prop.id));
        const same = new Set(rows.map((r) => r.rating)).size === 1;
        if (opts.diff && (!prop.rated || same)) continue;
        shown++;
        groupRows += `<tr><th class="rowh" scope="row"><a href="#/properties/${esc(prop.id)}" style="color:inherit;text-decoration:none">${esc(prop.property)}</a><small>${esc(prop.question)}</small></th>${rows.map((r, i) => {
          const cls = prop.rated ? esc(r.rating) : "";
          const lbl = prop.rated ? `<div class="lbl"><i class="cell ${esc(r.rating)}" style="width:10px;height:10px"></i>${esc(RATING[r.rating] || "")}</div>` : "";
          return `<td class="${cls}">${lbl}<div class="s">${esc(r.short)}</div>${opts.full ? `<div class="a">${esc(r.answer)}</div>` : ""}<div style="margin-top:6px"><a href="#/p/${esc(pid(ps[i]))}?prop=${esc(prop.id)}" style="font-size:13px">Evidence</a></div></td>`;
        }).join("")}</tr>`;
      }
      flush();
      if (opts.diff && !shown) body += `<tr><td colspan="${ps.length + 1}" class="muted">These protocols are rated the same on every property.</td></tr>`;
      table = `<div class="cmp-wrap"><table class="cmp"><thead><tr><th class="rowh" scope="col">Property</th>${ps.map((p) => `<th scope="col"><a href="#/p/${esc(pid(p))}">${esc(name(p))}</a></th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
    } else {
      table = `<div class="empty"><h3>${ps.length ? "Add one more protocol" : "Choose protocols to compare"}</h3><p>Pick ${ps.length ? "another protocol" : "two to four protocols"} from the list above, or use “Add to compare” on the Explore page.</p></div>`;
    }

    el.innerHTML = `<div class="wrap page">
      <div class="page-head"><div><h1>Compare protocols</h1><p>See how up to four protocols answer the same questions, side by side.</p></div></div>
      ${picker}
      ${ps.length >= 2 ? `<div class="toolbar" style="margin-top:18px">
        <label class="switch"><input type="checkbox" id="diff" ${opts.diff ? "checked" : ""}> Only show where ratings differ</label>
        <label class="switch"><input type="checkbox" id="full" ${opts.full ? "checked" : ""}> Show full answers</label>
        <button class="btn small ghost" type="button" id="copy" style="margin-left:auto">Copy link to this comparison</button>
      </div>` : ""}
      ${table}
    </div>`;

    el.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { ids = ids.filter((x) => x !== b.dataset.rm); sync(); }));
    const add = el.querySelector("#add");
    if (add) add.addEventListener("change", () => { if (add.value) { ids.push(add.value); sync(); } });
    const d = el.querySelector("#diff"), f = el.querySelector("#full");
    if (d) d.addEventListener("change", () => { opts.diff = d.checked; sync(); });
    if (f) f.addEventListener("change", () => { opts.full = f.checked; sync(); });
    const c = el.querySelector("#copy");
    if (c) c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch (e) { toast("Copy the address from the address bar"); } });
  }
  sync();
}
