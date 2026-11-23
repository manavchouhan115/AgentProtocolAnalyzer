import { state, esc, checkServer, loadData, fingerprint, label, toast, SKILL_URL } from "../core.js";

const DATA_ID = "protocol-analysis-data";

export async function renderAdd(el) {
  document.title = "Add a report | Protocol Explorer";
  el.innerHTML = `<div class="wrap page">
    <div class="page-head"><div><h1>Add a report</h1>
      <p>Add a protocol by uploading the HTML report the protocol-analyzer skill produced. The report is checked before it is added.</p>
      <p>Don't have a report yet? <a href="${SKILL_URL}" target="_blank" rel="noopener">Download the protocol-analyzer skill</a>, add it to Claude, and ask it to analyse a protocol, for example “Analyse AAuth using the protocol analyzer skill”.</p></div></div>
    <div id="add-body" class="prose" style="max-width:760px"><p class="muted">Checking whether uploads are available</p></div>
  </div>`;
  const body = el.querySelector("#add-body");
  const server = await checkServer();
  const info = state.serverInfo || {};
  const needsKey = info.auth === "password";
  const KEY = "pe-upload-key";
  const getKey = () => { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const setKey = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } };

  body.innerHTML = `
    ${server ? "" : `<div class="notice" style="margin-bottom:18px"><b>Uploading is not available on this copy of the site.</b> You can still check a report here. To add reports, run the site from the project folder with <code>python scripts/serve.py</code>, or add the file with <code>python scripts/add_report.py report.html</code>.</div>`}
    ${server && needsKey ? `<label class="key-field">Upload password
      <input class="input" type="password" id="key" autocomplete="current-password" value="${esc(getKey())}" placeholder="Ask the site's maintainers for it">
    </label>` : ""}
    <label class="drop" id="drop" tabindex="0">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
      <b>Drop a report here, or select a file</b>
      <span class="muted">An .html file produced by the protocol-analyzer skill</span>
      <input type="file" id="file" accept=".html,.htm,text/html" class="visually-hidden">
    </label>
    <div id="result"></div>
    <dialog id="dup" aria-labelledby="dup-title"></dialog>`;

  const drop = body.querySelector("#drop");
  const file = body.querySelector("#file");
  const result = body.querySelector("#result");
  const keyInput = body.querySelector("#key");
  if (keyInput) keyInput.addEventListener("change", () => setKey(keyInput.value.trim()));
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handle(f); });
  file.addEventListener("change", () => { if (file.files[0]) handle(file.files[0]); file.value = ""; });

  async function handle(f) {
    const text = await f.text();
    let data;
    try {
      data = extract(text);
    } catch (err) {
      result.innerHTML = `<div class="notice error" style="margin-top:18px">${esc(err.message)}</div>`;
      return;
    }
    const id = data.profile?.id;
    const existing = state.all.filter((p) => p.profile?.id === id);
    const missing = ["profile", "review", "rows", "summary"].filter((k) => !data[k]);
    result.innerHTML = `<div class="panel preview">
      <h3>${esc(data.protocol?.name || "Unnamed protocol")}</h3>
      <p class="muted" style="margin:4px 0 12px">${esc(data.protocol?.spec_version || "")}${data.analysed_on ? `, analysed ${esc(data.analysed_on)}` : ""}${id ? `, id <span class="mono">${esc(id)}</span>` : ""}</p>
      ${data.rows ? fingerprint(data, { size: 14 }) : ""}
      <div class="chips" style="margin-top:12px">${data.profile?.category ? `<span class="chip">${esc(label("category", data.profile.category))}</span>` : ""}${data.profile?.maturity ? `<span class="chip">${esc(label("maturity", data.profile.maturity))}</span>` : ""}</div>
      ${missing.length ? `<div class="notice error" style="margin-top:14px">This report is missing ${esc(missing.join(", "))}. It was probably made with an older version of the skill; re-run the analysis with the current skill.</div>` : ""}
      ${existing.length && !missing.length ? `<p style="margin:14px 0 0"><b>${esc(data.protocol?.name)}</b> is already in the explorer (${existing.map((p) => esc(p.protocol?.spec_version)).join(", ")}). You will be asked what to do.</p>` : ""}
      <div class="actions"><button class="btn primary" type="button" id="send" ${!server || missing.length ? "disabled" : ""}>Add to the explorer</button>
      <button class="btn ghost" type="button" id="cancel">Choose another file</button></div>
    </div>`;
    result.querySelector("#cancel").addEventListener("click", () => { result.innerHTML = ""; drop.focus(); });
    const send = result.querySelector("#send");
    send.addEventListener("click", () => upload(text, f.name, null, data));
  }

  async function upload(text, filename, mode, data) {
    const send = result.querySelector("#send");
    if (send) { send.disabled = true; send.textContent = "Adding"; }
    let res;
    try {
      if (needsKey && !(keyInput?.value || "").trim()) {
        res = { status: "error", message: "Enter the upload password first." };
      } else {
        const headers = { "Content-Type": "text/html; charset=utf-8", "X-Filename": filename };
        if (needsKey) { headers["X-Upload-Key"] = keyInput.value.trim(); setKey(keyInput.value.trim()); }
        const r = await fetch(`/api/reports${mode ? "?mode=" + mode : ""}`, { method: "POST", headers, body: text });
        res = await r.json();
        if (r.status === 401) { setKey(""); keyInput?.focus(); }
      }
    } catch (e) {
      res = { status: "error", message: info.deploys ? "The upload service did not respond. Try again in a minute." : "The local server did not respond. Check that scripts/serve.py is still running." };
    }
    if (res.status === "exists") return askDuplicate(res, text, filename, data);
    if (res.status !== "added") {
      result.insertAdjacentHTML("beforeend", `<div class="notice error" style="margin-top:14px">${esc(res.message || "The report could not be added.")}</div>`);
      if (send) { send.disabled = false; send.textContent = "Add to the explorer"; }
      return;
    }
    const verb = res.replaced ? "Replaced" : "Added";
    if (res.deploying) return waitForDeploy(res, data, verb);
    await loadData();
    toast(`${verb} ${data.protocol?.name}`);
    result.innerHTML = `<div class="notice ok" style="margin-top:18px">${verb} <b>${esc(data.protocol?.name)}</b> (${esc(res.spec_version)}).
      <a href="#/p/${esc(res.id)}">View it</a> or add another report.</div>`;
    const n = state.current.length;
    document.getElementById("foot-data").textContent = `${n} protocol${n === 1 ? "" : "s"}, dataset built ${(state.data.generated_at || "").slice(0, 10)}`;
  }

  // On the hosted site the upload becomes a commit, and the site rebuilds itself.
  // Poll the published dataset until the report shows up, or the build leaves it out.
  async function waitForDeploy(res, data, verb) {
    const nm = esc(data.protocol?.name);
    result.innerHTML = `<div class="notice ok" style="margin-top:18px" aria-live="polite">
      <b>${verb === "Replaced" ? "Replacing" : "Adding"} ${nm}.</b> The report was saved and the site is rebuilding. It usually appears in one or two minutes.
      <span class="muted" id="wait-status">Checking</span></div>`;
    const status = result.querySelector("#wait-status");
    const started = Date.now();
    for (let i = 0; Date.now() - started < 5 * 60 * 1000; i++) {
      await new Promise((r) => setTimeout(r, 12000));
      if (!result.isConnected) return;               // the visitor left the page
      let ds;
      try { ds = await (await fetch(`../data/protocols.json?t=${Date.now()}`, { cache: "no-store" })).json(); } catch (e) { continue; }
      const hit = (ds.protocols || []).find((p) => p.profile?.id === res.id && p.protocol?.spec_version === res.spec_version && p._meta?.file === res.file);
      const left = (ds.skipped || []).find((s) => s.file === res.file);
      if (hit) {
        await loadData();
        toast(`${verb} ${data.protocol?.name}`);
        result.innerHTML = `<div class="notice ok" style="margin-top:18px">${verb} <b>${nm}</b> (${esc(res.spec_version)}). <a href="#/p/${esc(res.id)}">View it</a> or add another report.</div>`;
        const n = state.current.length;
        document.getElementById("foot-data").textContent = `${n} protocol${n === 1 ? "" : "s"}, dataset built ${(state.data.generated_at || "").slice(0, 10)}`;
        return;
      }
      if (left) {
        result.innerHTML = `<div class="notice error" style="margin-top:18px"><b>${nm} was saved but left out of the site</b>, because the full check found errors:
          <ul>${left.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>Fix the analysis with the skill and upload it again, choosing Replace.</div>`;
        return;
      }
      status.textContent = `Still rebuilding (${Math.round((Date.now() - started) / 1000)} s)`;
    }
    status.textContent = "This is taking longer than usual. Reload the page in a few minutes to see it.";
  }

  function askDuplicate(res, text, filename, data) {
    const dlg = body.querySelector("#dup");
    const sameVersion = res.existing.some((x) => x.spec_version === res.spec_version);
    dlg.innerHTML = `<h2 id="dup-title">${esc(data.protocol?.name)} is already in the explorer</h2>
      <p>The explorer has ${res.existing.map((x) => `<b>${esc(x.spec_version)}</b> (analysed ${esc(x.analysed_on)})`).join(", ")}. The new report is <b>${esc(res.spec_version)}</b>${data.analysed_on ? `, analysed ${esc(data.analysed_on)}` : ""}.</p>
      <p class="muted">${sameVersion ? "It is the same version, so you can replace the existing analysis or cancel." : "Replace removes the existing analysis. Keep both keeps every version, and the newest one is shown by default."}</p>
      <div class="btns">
        <button class="btn" type="button" value="cancel">Cancel</button>
        ${sameVersion ? "" : `<button class="btn" type="button" value="keep-both">Keep both versions</button>`}
        <button class="btn primary" type="button" value="replace">Replace</button>
      </div>`;
    dlg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      dlg.close();
      if (b.value === "cancel") {
        const send = result.querySelector("#send");
        if (send) { send.disabled = false; send.textContent = "Add to the explorer"; }
        toast("Nothing was changed");
        return;
      }
      upload(text, filename, b.value, data);
    }));
    dlg.showModal();
  }
}

function extract(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const node = doc.getElementById(DATA_ID);
  if (!node) throw new Error("This file is not a protocol-analyzer report. Select the HTML report the skill produced for one protocol.");
  let data;
  try { data = JSON.parse(node.textContent); } catch (e) { throw new Error("The report's embedded data is damaged and cannot be read."); }
  if (data.comparison) throw new Error("This is a comparison page. Select a report for a single protocol.");
  return data;
}
