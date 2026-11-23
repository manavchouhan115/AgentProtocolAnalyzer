// Upload API for the Netlify-hosted Protocol Explorer.
//
//   GET  /api/status   -> {"upload": true, "auth": "password"} when uploads are set up
//   POST /api/reports?mode=<none|replace|keep-both>
//        body: the report's HTML; headers X-Filename and X-Upload-Key (the upload password)
//
// A report is checked here, then committed to reports/ in the GitHub repository. The commit
// triggers a normal Netlify build, which runs the skill's full linter (scripts/build_data.py)
// and publishes the new dataset. Same file names and duplicate rules as scripts/datalib.py.
//
// Environment variables (Netlify site settings):
//   UPLOAD_PASSWORD  password people must enter on the Add a report page
//   GITHUB_TOKEN     fine-grained token with Contents: read and write on the repository only
//   GITHUB_REPO      owner/name, e.g. manavchouhan115/AgentProtocolAnalyzer
//   GITHUB_BRANCH    branch Netlify deploys from (default: main)

const DATA_ID = "protocol-analysis-data";
const EMBED_RE = new RegExp(`<script[^>]*id=["']${DATA_ID}["'][^>]*>([\\s\\S]*?)</script>`, "i");
const MAX_UPLOAD = 5 * 1024 * 1024;

const env = (k, d = "") => (typeof Netlify !== "undefined" && Netlify.env?.get(k)) || process.env[k] || d;
const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const fail = (status, message, extra = {}) => json(status, { status: "error", message, ...extra });

class ReportError extends Error {}

// ------------------------------------------------------------------ reading (as datalib.py)
export function extract(html, name = "report") {
  const m = EMBED_RE.exec(html);
  if (!m) throw new ReportError(`${name}: this is not a protocol-analyzer report (no embedded analysis data).`);
  let data;
  try { data = JSON.parse(m[1].replace(/<\\\//g, "</")); } catch (e) {
    throw new ReportError(`${name}: the embedded analysis data is not valid JSON.`);
  }
  if (data && data.comparison) throw new ReportError(`${name}: this is a comparison page, not a single-protocol report.`);
  return data;
}
export const key = (d) => [d?.profile?.id || "", d?.protocol?.spec_version || ""];
export const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
export const targetName = (d, keepBoth) => (keepBoth ? `${key(d)[0]}--${slug(key(d)[1])}.html` : `${key(d)[0]}.html`);

// Structural checks against the live dataset's rubric and vocabularies. The full linter
// runs in the build; a report that fails it is left out of the site (see the build log).
export function check(d, dataset) {
  const E = [];
  const str = (v) => typeof v === "string" && v.trim() !== "";
  if (!str(d?.protocol?.name)) E.push("protocol.name is missing");
  if (!str(d?.protocol?.spec_version)) E.push("protocol.spec_version is missing");
  const pr = d?.profile;
  if (!pr || typeof pr !== "object") E.push("the profile block is missing; the report was probably made with an older version of the skill");
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(pr.id || ""))) E.push("profile.id must be a lowercase slug such as web-bot-auth");
    const vocab = dataset?.vocab || {};
    const allowed = (f) => new Set((vocab[f] || []).map((v) => v.value));
    for (const f of ["category", "maturity", "venue", "openness"]) {
      if (vocab[f] && !allowed(f).has(pr[f])) E.push(`profile.${f} "${pr[f] ?? ""}" is not an allowed value`);
    }
    for (const f of ["mechanisms", "layers", "secondary_categories"]) {
      const vf = f === "secondary_categories" ? "category" : f;
      if (pr[f] !== undefined && !Array.isArray(pr[f])) E.push(`profile.${f} must be a list`);
      else if (vocab[vf]) (pr[f] || []).filter((v) => !allowed(vf).has(v)).forEach((v) => E.push(`profile.${f} "${v}" is not an allowed value`));
    }
  }
  if (!["draft", "reviewed"].includes(d?.review?.status)) E.push("review.status must be draft or reviewed");
  if (!Array.isArray(d?.summary) || !d.summary.length || !d.summary.every(str)) E.push("summary is missing");
  if (!Array.isArray(d?.rows)) E.push("the property rows are missing");
  else if (dataset?.properties) {
    const byId = new Map(d.rows.map((r) => [r?.id, r]));
    for (const p of dataset.properties) {
      const r = byId.get(p.id);
      if (!r) { E.push(`property "${p.property}" is missing`); continue; }
      if (p.rated && !["green", "yellow", "red"].includes(r.rating)) E.push(`property "${p.property}" has no rating`);
      if (!str(r.answer)) E.push(`property "${p.property}" has no answer`);
    }
    const known = new Set(dataset.properties.map((p) => p.id));
    d.rows.filter((r) => !known.has(r?.id)).forEach((r) => E.push(`unknown property id "${r?.id}" (a different rubric version?)`));
  }
  return E;
}

// ------------------------------------------------------------------ GitHub
function gh() {
  const token = env("GITHUB_TOKEN"), repo = env("GITHUB_REPO"), branch = env("GITHUB_BRANCH", "main");
  const call = async (path, opts = {}) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "protocol-explorer-upload", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) },
    });
    if (!r.ok) throw new Error(`GitHub ${opts.method || "GET"} ${path} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return opts.raw ? r.text() : r.json();
  };
  return {
    branch,
    async listReports() {
      try { return (await call(`/contents/reports?ref=${encodeURIComponent(branch)}`)).filter((f) => f.type === "file" && f.name.endsWith(".html")); }
      catch (e) { if (String(e.message).includes(" 404 ")) return []; throw e; }
    },
    readFile: (path) => call(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
      { raw: true, headers: { Accept: "application/vnd.github.raw+json" } }),
    // One commit with every change, so a replace triggers a single deploy.
    async commit(message, changes) {
      const ref = await call(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const head = ref.object.sha;
      const base = (await call(`/git/commits/${head}`)).tree.sha;
      const tree = [];
      for (const c of changes) {
        if (c.content !== undefined) {
          const blob = await call("/git/blobs", { method: "POST", body: JSON.stringify({ content: c.content, encoding: "utf-8" }) });
          tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
        } else if (c.sha !== undefined) {
          tree.push({ path: c.path, mode: "100644", type: "blob", sha: c.sha });   // sha null deletes the file
        }
      }
      const t = await call("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base, tree }) });
      const cm = await call("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: cm.sha }) });
      return cm.sha;
    },
  };
}

// Every report in the repository with its (id, version): from the published dataset, plus any
// report committed since the last deploy (read from GitHub).
async function existingReports(repo, dataset) {
  const files = await repo.listReports();
  const known = new Map();
  for (const p of dataset?.protocols || []) if (p._meta?.file) known.set(p._meta.file, { data: p });
  const out = [];
  for (const f of files) {
    let data = known.get(f.name)?.data;
    if (!data) {
      try { data = extract(await repo.readFile(f.path), f.name); } catch (e) { continue; }
    }
    out.push({ name: f.name, path: f.path, sha: f.sha, data });
  }
  return out;
}

function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// ------------------------------------------------------------------ handler
export default async function handler(req) {
  const url = new URL(req.url);
  const configured = !!(env("UPLOAD_PASSWORD") && env("GITHUB_TOKEN") && env("GITHUB_REPO"));

  if (url.pathname === "/api/status") {
    return json(200, configured ? { upload: true, auth: "password", deploys: true } : { upload: false });
  }
  if (url.pathname !== "/api/reports") return fail(404, "Not found");
  if (req.method !== "POST") return fail(405, "Use POST to upload a report.");
  if (!configured) return fail(503, "Uploading is not set up on this site yet.");
  if (!sameSecret(req.headers.get("x-upload-key") || "", env("UPLOAD_PASSWORD"))) {
    return fail(401, "The upload password is not correct.", { auth: true });
  }

  const html = await req.text();
  if (!html || html.length > MAX_UPLOAD) return fail(400, "The file is empty or too large (max 5 MB).");
  const name = (req.headers.get("x-filename") || "report.html").slice(0, 200);
  const mode = ["replace", "keep-both"].includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : null;

  let data;
  try { data = extract(html, name); } catch (e) { return fail(400, e.message); }

  let dataset = null;
  try {
    const r = await fetch(new URL("/data/protocols.json", url.origin), { headers: { "Cache-Control": "no-cache" } });
    if (r.ok) dataset = await r.json();
  } catch (e) { /* checked below */ }
  if (!dataset) return fail(502, "Could not read the current dataset to check the report. Try again in a minute.");

  const problems = check(data, dataset);
  if (problems.length) return fail(400, "The report has errors:\n  " + problems.join("\n  "), { errors: problems });

  const repo = gh();
  const [pid, ver] = key(data);
  try {
    const existing = (await existingReports(repo, dataset)).filter((x) => key(x.data)[0] === pid);
    if (existing.length && !mode) {
      return json(200, { status: "exists", id: pid, spec_version: ver,
        existing: existing.map((x) => ({ file: x.name, spec_version: key(x.data)[1], analysed_on: x.data.analysed_on || "" })) });
    }
    const changes = [];
    let dest;
    if (existing.length && mode === "keep-both") {
      if (existing.some((x) => key(x.data)[1] === ver)) return fail(409, `A report for ${pid} version ${ver} already exists. Use replace instead.`);
      for (const x of existing) {                    // give the current file a versioned name too
        if (x.name === `${pid}.html`) {
          changes.push({ path: `reports/${targetName(x.data, true)}`, sha: x.sha });
          changes.push({ path: x.path, sha: null });
        }
      }
      dest = targetName(data, true);
    } else {
      if (existing.length && mode === "replace") existing.forEach((x) => { if (x.name !== targetName(data, false)) changes.push({ path: x.path, sha: null }); });
      dest = targetName(data, false);
    }
    changes.push({ path: `reports/${dest}`, content: html });
    const verb = mode === "replace" && existing.length ? "Replace" : "Add";
    const sha = await repo.commit(`${verb} report: ${data.protocol?.name || pid} (${ver})\n\nUploaded through the Protocol Explorer website (${name}).`, changes);
    return json(200, { status: "added", id: pid, spec_version: ver, file: dest, replaced: verb === "Replace",
      deploying: true, commit: sha });
  } catch (e) {
    console.error(e);
    return fail(502, "The report passed the checks but could not be saved to GitHub. Check the GITHUB_TOKEN and GITHUB_REPO settings.");
  }
}

export const config = { path: ["/api/status", "/api/reports"] };
