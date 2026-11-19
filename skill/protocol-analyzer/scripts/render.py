#!/usr/bin/env python3
"""Turn a protocol analysis (JSON) into a single, self-contained HTML report.

The HTML file is the only output the user needs. It also embeds the analysis data
(in a <script type="application/json"> block the browser does not display), so the
report can be re-rendered or compared later without the JSON file.

Usage:
    python render.py analysis.json                    # writes analysis.html next to it
    python render.py analysis.json --out report.html
    python render.py a.html b.json c.html --compare --out comparison.html
        # side-by-side table; only when the user asks for a comparison.
        # Accepts JSON files or HTML reports made by this script.
    python render.py analysis.json --with-examples --compare --out vs-examples.html
        # adds the three calibration examples to a comparison
    python render.py analysis.json --markdown --out report.md
        # Markdown version (used for the no-code reference example only)

Run scripts/lint.py first; this script only renders.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "references"
EXAMPLES = REFS / "examples"
RUBRIC = REFS / "properties.md"

LABEL = {"green": "Addressed", "yellow": "Partly addressed", "red": "Not addressed", "n/a": ""}
DOT = {"green": "🟢", "yellow": "🟡", "red": "🔴", "n/a": ""}
COVERAGE_TEXT = {
    "required": "Required by the specification", "default": "Part of the normal flow",
    "optional": "Optional in the specification", "extension": "Only in an extension or companion specification",
    "outside": "Handled outside the protocol", "none": "Not addressed by the specification",
    "out_of_scope": "Explicitly out of scope", "n/a": "",
}
GOALS = [("access_control", "Access control",
          "the agent can only reach the resources and perform the actions it is allowed to."),
         ("incident_response", "Incident response",
          "if an agent causes harm, its access can be limited or stopped."),
         ("accountability", "Accountability",
          "an action can be traced back to the parties responsible for it.")]
CHECK_TEXT = {"OK": "quote verified against the source", "WEB-OK": "quote verified against the source",
              "NEAR": "quote NOT verified (wording differs)", "NOT FOUND": "quote NOT verified (not found)",
              "UNREACHABLE": "quote not verified (source unreachable)"}
DATA_ID = "protocol-analysis-data"
NICE = {"ietf-wg": "IETF working group", "ietf-individual": "IETF individual draft", "w3c": "W3C",
        "oidf": "OpenID Foundation", "other-sdo": "Other standards body", "mtls": "mTLS",
        "pop-token": "Proof-of-possession token", "http-message-signature": "HTTP Message Signatures",
        "x509-certificate": "X.509 certificate", "did": "DID", "api-key": "API key",
        "http-header": "HTTP header", "http-body": "HTTP body"}


def nice(v):
    return NICE.get(v, str(v).replace("-", " ").capitalize())


# ------------------------------------------------------------------ loading
def load(path):
    """Load analysis data from a JSON file or from an HTML report made by this script."""
    text = Path(path).read_text(encoding="utf-8")
    if str(path).lower().endswith((".html", ".htm")):
        m = re.search(r'<script type="application/json" id="%s">(.*?)</script>' % DATA_ID, text, re.S)
        if not m:
            sys.exit(f"{path}: no embedded analysis data found")
        text = m.group(1).replace("<\\/", "</")
    return json.loads(text)


def questions():
    """Property id -> question text from properties.md, shown under each property name."""
    out, cur = {}, None
    for line in RUBRIC.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^### (\w+)\s*$", line)
        if m:
            cur = m.group(1)
            continue
        m = re.match(r"^- \*\*Question:\*\* (.+?)\s*$", line)
        if m and cur:
            out[cur] = m.group(1)
            cur = None
    return out


def src_map(d):
    return {s["id"]: s for s in d.get("sources", [])}


def summary_paras(d):
    s = d.get("summary", [])
    return s if isinstance(s, list) else [s]


# ------------------------------------------------------------------ HTML
CSS = """
:root{--bg:#ffffff;--fg:#1d2127;--muted:#5d6470;--line:#d5d9df;--soft:#f5f6f8;--head:#1f3a5f;--headfg:#ffffff;
--group:#e3eaf4;--green:#cfe8c4;--yellow:#fbecb3;--red:#f6c9c4;--link:#1a5bb8;--accent:#1f3a5f}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#14171b;--fg:#e5e7ea;--muted:#a2a9b3;
--line:#343a42;--soft:#1c2026;--head:#2a4a75;--group:#212b38;--green:#284a2b;--yellow:#55481a;--red:#5a2a27;
--link:#8db8f5;--accent:#8db8f5}}
:root[data-theme="dark"]{--bg:#14171b;--fg:#e5e7ea;--muted:#a2a9b3;--line:#343a42;--soft:#1c2026;--head:#2a4a75;
--group:#212b38;--green:#284a2b;--yellow:#55481a;--red:#5a2a27;--link:#8db8f5;--accent:#8db8f5}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 16px 64px}
header{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:8px}
.kicker{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
h1{font-size:30px;line-height:1.2;margin:0 0 6px}h1 small{display:block;font-size:17px;font-weight:400;color:var(--muted);margin-top:4px}
h2{font-size:21px;margin:40px 0 12px;padding-top:4px}
.facts{display:flex;flex-wrap:wrap;gap:8px 18px;margin:14px 0 0;padding:0;list-style:none;font-size:14px;color:var(--muted)}
.facts b{color:var(--fg);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}.chip{font-size:12.5px;padding:2px 9px;border-radius:12px;
border:1px solid var(--line);background:var(--soft)}.chip b{font-weight:600}
.review{display:inline-block;font-size:12.5px;font-weight:600;padding:2px 9px;border-radius:12px;margin-top:10px}
.review.draft{background:var(--yellow)}.review.reviewed{background:var(--green)}
nav{font-size:14px;margin:14px 0 0;display:flex;flex-wrap:wrap;gap:6px 14px}nav a{color:var(--link);text-decoration:none}
a{color:var(--link)}p{margin:0 0 12px;max-width:760px}
ol.steps{padding-left:22px;max-width:780px}ol.steps li{margin:6px 0;padding-left:4px}
.wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:15px}
th,td{border:1px solid var(--line);padding:9px 11px;vertical-align:top;text-align:left}
th{background:var(--head);color:var(--headfg);font-weight:600}
tr.group td{background:var(--group);font-weight:700;font-size:14px;letter-spacing:.02em}
td.prop{width:27%;font-weight:600}td.prop .q{display:block;font-weight:400;font-size:13px;color:var(--muted);margin-top:3px}
td.green{background:var(--green)}td.yellow{background:var(--yellow)}td.red{background:var(--red)}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:1px 7px;border-radius:10px;margin-bottom:5px;
border:1px solid currentColor;opacity:.85}
.meta{font-size:13px;color:var(--fg);opacity:.8;margin-top:7px}
details{margin-top:8px}summary{cursor:pointer;font-size:13px;color:var(--fg);opacity:.85}
.claim{font-size:13px;margin:8px 0 0}.claim blockquote{margin:4px 0 0;padding:6px 9px;background:var(--soft);
border-left:3px solid var(--line);color:var(--fg)}.claim .chk{font-size:11.5px;opacity:.75}.claim .bad{color:#b3261e;opacity:1;font-weight:700}
.legend{display:flex;flex-wrap:wrap;gap:8px;font-size:13px;margin:6px 0}.legend span{padding:2px 9px;border-radius:3px}
.goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.goal{border:1px solid var(--line);border-radius:6px;padding:12px 14px;background:var(--soft)}
.goal h3{margin:0 0 4px;font-size:16px}.goal .def{font-size:13px;color:var(--muted);margin-bottom:6px}
ul.plain{padding-left:20px;max-width:820px}ul.plain li{margin:4px 0}
.about{font-size:14px;color:var(--muted);border-top:1px solid var(--line);margin-top:44px;padding-top:16px}
.about p{max-width:none}
@media (max-width:640px){h1{font-size:25px}td.prop{width:auto}th,td{padding:7px 8px}table{font-size:14px}}
@media print{nav,details summary{display:none}details{display:block}details>*{display:block}}
"""

LEGEND = ('<div class="legend"><span style="background:var(--green)">Addressed</span>'
          '<span style="background:var(--yellow)">Partly addressed</span>'
          '<span style="background:var(--red)">Not addressed (may be out of scope by design)</span></div>')


def page(title, body, data=None):
    embed = ""
    if data is not None:
        raw = json.dumps(data, ensure_ascii=False, indent=1).replace("</", "<\\/")
        embed = f'<script type="application/json" id="{DATA_ID}">{raw}</script>'
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{html.escape(title)}</title><style>{CSS}</style></head>'
            f'<body><main>{body}</main>{embed}</body></html>')


def claims_html(r, srcs):
    e = html.escape
    out = []
    for c in r.get("claims", []):
        s = srcs.get(c.get("source"), {})
        link = f'<a href="{e(s.get("url", ""))}">{e(s.get("title", c.get("source", "")))}</a>' if s else "unknown source"
        sec = f", {e(str(c['section']))}" if c.get("section") else ""
        kind = {"fact": "Source states", "inference": "Inferred from", "silent": "Not found in",
                "out_of_scope": "Out of scope per"}.get(c.get("type"), c.get("type", ""))
        chk = ""
        if c.get("quote"):
            st = c.get("check")
            cls = "chk bad" if st in ("NEAR", "NOT FOUND") else "chk"
            chk = f' <span class="{cls}">({e(CHECK_TEXT.get(st, "quote not verified"))})</span>'
        q = f"<blockquote>“{e(c['quote'])}”</blockquote>" if c.get("quote") else ""
        out.append(f'<div class="claim">{e(c.get("text", ""))} <i>{kind}</i> {link}{sec}.{chk}{q}</div>')
    return "".join(out)


def report_html(d):
    e = html.escape
    p = d.get("protocol", {})
    srcs = src_map(d)
    qs = questions()
    name = p.get("name", "Protocol")
    full = p.get("full_name", "")

    facts = [("Specification", f'{p.get("spec_version", "")}'), ("Date", p.get("spec_date", "")),
             ("Maintainer", p.get("maintainer", "")), ("Analysed", d.get("analysed_on", ""))]
    facts_html = "".join(f"<li><b>{k}:</b> {e(str(v))}</li>" for k, v in facts if v)
    if p.get("newer_version_note"):
        facts_html += f"<li><b>Version note:</b> {e(p['newer_version_note'])}</li>"

    prof = d.get("profile", {}) or {}
    chips = []
    if prof.get("category"):
        chips.append(("Category", nice(prof["category"])))
    for c in prof.get("secondary_categories", []) or []:
        chips.append(("Also", nice(c)))
    if prof.get("mechanisms"):
        chips.append(("Mechanism", ", ".join(nice(m) for m in prof["mechanisms"])))
    for k in ("venue", "maturity", "openness"):
        if prof.get(k):
            chips.append((k.capitalize(), nice(prof[k])))
    chips_html = "".join(f'<span class="chip"><b>{e(k)}:</b> {e(v)}</span>' for k, v in chips)
    rev = d.get("review", {}) or {}
    if rev.get("status") == "reviewed":
        review_html = (f'<span class="review reviewed">Reviewed by {e(rev.get("reviewed_by", ""))}'
                       f'{", " + e(rev.get("reviewed_on", "")) if rev.get("reviewed_on") else ""}</span>')
    else:
        review_html = '<span class="review draft">Draft: not yet reviewed by a person</span>'
    summary = "".join(f"<p>{e(x)}</p>" for x in summary_paras(d))
    steps = "".join(f"<li>{e(x)}</li>" for x in d.get("how_it_works", []))

    glance, table = [], []
    group = None
    for r in d.get("rows", []):
        if r.get("group") != group:
            group = r.get("group")
            glance.append(f'<tr class="group"><td colspan="2">{e(group or "")}</td></tr>')
            table.append(f'<tr class="group"><td colspan="2">{e(group or "")}</td></tr>')
        rt = r.get("rating", "n/a")
        cls = rt if rt in LABEL and rt != "n/a" else ""
        glance.append(f'<tr><td class="prop">{e(r.get("property", ""))}</td><td class="{cls}">{e(r.get("short", ""))}</td></tr>')
        badge = f'<span class="badge">{LABEL[rt]}</span><br>' if cls else ""
        meta = []
        if COVERAGE_TEXT.get(r.get("coverage")):
            meta.append(COVERAGE_TEXT[r["coverage"]])
        if r.get("requirement") and r["requirement"] != "none":
            meta.append(f'requirement level: {r["requirement"]}')
        meta_html = f'<div class="meta">{e(" · ".join(meta))}</div>' if meta else ""
        reason = re.sub(r"^\s*(green|yellow|red)\s*:\s*", "", r.get("rating_reason") or "", flags=re.I)
        reason = reason[:1].upper() + reason[1:]
        why = f'<div class="meta">Why this rating: {e(reason)}</div>' if reason else ""
        n = len(r.get("claims", []))
        ev = f'<details><summary>Evidence ({n})</summary>{claims_html(r, srcs)}</details>' if n else ""
        q = f'<span class="q">{e(qs.get(r.get("id"), ""))}</span>' if qs.get(r.get("id")) else ""
        table.append(f'<tr><td class="prop">{e(r.get("property", ""))}{q}</td>'
                     f'<td class="{cls}">{badge}{e(r.get("answer", ""))}{meta_html}{why}{ev}</td></tr>')

    g = d.get("goals_reading", {})
    goals = "".join(f'<div class="goal"><h3>{lab}</h3><div class="def">Goal: {defn}</div>{e(g.get(k, ""))}</div>'
                    for k, lab, defn in GOALS)
    gaps = [r for r in d.get("rows", []) if r.get("rating") == "red"]
    gaps_html = "".join(
        f'<li><b>{e(r.get("property", ""))}:</b> {e(r.get("short", ""))} '
        f'({e(COVERAGE_TEXT.get(r.get("coverage"), "").lower())})</li>' for r in gaps)
    srcl = "".join(
        f'<li><a href="{e(s.get("url", ""))}">{e(s.get("title", ""))}</a>'
        f'{" (" + e(", ".join(x for x in [s.get("version"), s.get("date")] if x)) + ")" if (s.get("version") or s.get("date")) else ""}'
        f'{"" if s.get("kind") == "primary" else " <i>(secondary source)</i>"}</li>' for s in d.get("sources", []))
    notes = "".join(f"<li>{e(x)}</li>" for x in d.get("notes", []))
    oq = "".join(f"<li>{e(x)}</li>" for x in d.get("open_questions", []))
    nquotes = sum(1 for r in d.get("rows", []) for c in r.get("claims", []) if c.get("quote"))
    nver = sum(1 for r in d.get("rows", []) for c in r.get("claims", []) if c.get("check") in ("OK", "WEB-OK"))

    body = (
        f'<header><p class="kicker">Protocol analysis</p><h1>{e(name)}'
        f'{"<small>" + e(full) + "</small>" if full and full != name else ""}</h1>'
        f'<ul class="facts">{facts_html}</ul>'
        f'{"<div class=chips>" + chips_html + "</div>" if chips_html else ""}{review_html}'
        '<nav><a href="#summary">Summary</a><a href="#how">How it works</a><a href="#glance">At a glance</a>'
        '<a href="#goals">Against the goals</a><a href="#analysis">Full analysis</a><a href="#sources">Sources</a>'
        '<a href="#about">About this analysis</a></nav></header>'
        f'<h2 id="summary">Summary</h2>{summary}'
        f'<h2 id="how">How it works</h2><ol class="steps">{steps}</ol>'
        f'<h2 id="glance">At a glance</h2>{LEGEND}<div class="wrap"><table><thead><tr><th>Property</th>'
        f'<th>{e(name)}</th></tr></thead><tbody>{"".join(glance)}</tbody></table></div>'
        f'<h2 id="goals">Against the three goals</h2><div class="goals">{goals}</div>'
        + (f'<h2>Not addressed</h2><ul class="plain">{gaps_html}</ul>' if gaps_html else "")
        + f'<h2 id="analysis">Full analysis</h2>{LEGEND}<div class="wrap"><table><thead><tr><th>Property</th>'
        f'<th>{e(name)}</th></tr></thead><tbody>{"".join(table)}</tbody></table></div>'
        f'<h2 id="sources">Sources</h2><ul class="plain">{srcl}</ul>'
        + (f'<h2>Notes</h2><ul class="plain">{notes}</ul>' if notes else "")
        + (f'<h2>Open questions</h2><ul class="plain">{oq}</ul>' if oq else "")
        + '<section class="about" id="about"><h2>About this analysis</h2>'
        '<p>The protocol is assessed from the side of the service that receives an AI agent\'s request '
        '(e.g. a website, an API or a merchant), against three goals: access control, incident response '
        'and accountability. Each property is rated by what the protocol\'s own specification defines; '
        'features that other standards or parties could add are described but not counted. '
        '"Not addressed" does not mean the protocol is flawed: many protocols leave things out on purpose.</p>'
        f'<p>Every statement is backed by evidence from the sources ({nver} of {nquotes} quotes verified word for word '
        f'against the source). Ratings use rubric v{e(str(d.get("rubric_version", "")))}, '
        f'analysed on {e(d.get("analysed_on", ""))}. This report was generated with the protocol-analyzer skill '
        'and should be reviewed by a person before it is relied on.</p></section>')
    return page(f"{name}: protocol analysis", body, d)


def compare_html(ds):
    e = html.escape
    names = [d.get("protocol", {}).get("name", "?") for d in ds]
    maps = [{r["id"]: r for r in d.get("rows", [])} for d in ds]
    rows_s, rows_f = [], []
    group = None
    for r0 in ds[0].get("rows", []):
        if r0.get("group") != group:
            group = r0.get("group")
            for t in (rows_s, rows_f):
                t.append(f'<tr class="group"><td colspan="{len(ds) + 1}">{e(group or "")}</td></tr>')
        sc, fc = [], []
        for m in maps:
            r = m.get(r0["id"], {})
            rt = r.get("rating", "n/a")
            cls = rt if rt in ("green", "yellow", "red") else ""
            sc.append(f'<td class="{cls}" title="{e(r.get("answer", ""))}">{e(r.get("short", ""))}</td>')
            fc.append(f'<td class="{cls}">{e(r.get("answer", ""))}</td>')
        rows_s.append(f'<tr><td class="prop">{e(r0.get("property", ""))}</td>{"".join(sc)}</tr>')
        rows_f.append(f'<tr><td class="prop">{e(r0.get("property", ""))}</td>{"".join(fc)}</tr>')
    head = "<tr><th>Property</th>" + "".join(f"<th>{e(n)}</th>" for n in names) + "</tr>"
    vers = "".join(f"<li><b>{e(d['protocol'].get('name', ''))}:</b> {e(d['protocol'].get('spec_version', ''))} "
                   f"({e(d['protocol'].get('spec_date', ''))}), analysed {e(d.get('analysed_on', ''))}</li>" for d in ds)
    body = (f'<header><p class="kicker">Protocol comparison</p><h1>{e(", ".join(names))}</h1></header>'
            f'<h2>At a glance</h2>{LEGEND}<div class="wrap"><table><thead>{head}</thead><tbody>{"".join(rows_s)}</tbody></table></div>'
            f'<h2>Full answers</h2><div class="wrap"><table><thead>{head}</thead><tbody>{"".join(rows_f)}</tbody></table></div>'
            f'<h2>Versions analysed</h2><ul class="plain">{vers}</ul>'
            '<section class="about"><p>Each protocol is assessed from the side of the service that receives an AI '
            'agent\'s request, against access control, incident response and accountability. Generated with the '
            'protocol-analyzer skill; review before relying on it.</p></section>')
    return page("Protocol comparison: " + ", ".join(names), body, {"comparison": ds})


# ------------------------------------------------------------------ Markdown (reference only)
def mdx(t):
    return str(t or "").replace("|", "\\|").replace("\n", " ")


def report_md(d):
    p = d.get("protocol", {})
    srcs = src_map(d)
    o = [f"# {p.get('name', 'Protocol')}: protocol analysis", ""]
    o += [f"**Specification:** {p.get('spec_version', '')} ({p.get('spec_date', '')}) · **Maintainer:** "
          f"{p.get('maintainer', '')} · **Analysed:** {d.get('analysed_on', '')}", ""]
    o += ["## Summary", ""] + [x + "\n" for x in summary_paras(d)]
    o += ["## How it works", ""] + [f"{i}. {x}" for i, x in enumerate(d.get("how_it_works", []), 1)] + [""]
    o += ["## At a glance", "", "| Property | Rating | Answer |", "|---|---|---|"]
    group = None
    for r in d.get("rows", []):
        if r.get("group") != group:
            group = r.get("group")
            o.append(f"| **{mdx(group)}** | | |")
        rt = r.get("rating", "n/a")
        o.append(f"| {mdx(r.get('property'))} | {DOT.get(rt, '')} {LABEL.get(rt, '')} | {mdx(r.get('short'))} |")
    o += ["", "## Against the three goals", ""]
    g = d.get("goals_reading", {})
    o += [f"- **{lab}:** {g.get(k, '')}" for k, lab, _ in GOALS] + [""]
    o += ["## Full analysis", ""]
    for r in d.get("rows", []):
        rt = r.get("rating", "n/a")
        o.append(f"### {r.get('property')}" + (f" ({DOT[rt]} {LABEL[rt]})" if rt != "n/a" else ""))
        o += ["", r.get("answer", ""), ""]
        if r.get("rating_reason"):
            o += [f"*Why this rating:* {r['rating_reason']}", ""]
        for c in r.get("claims", []):
            s = srcs.get(c.get("source"), {})
            o.append(f"- {c.get('text', '')} ({c.get('type')}: [{s.get('title', '')}]({s.get('url', '')}), {c.get('section', '')})")
            if c.get("quote"):
                o.append(f"  > \"{c['quote']}\"")
        o.append("")
    o += ["## Sources", ""] + [f"- [{s.get('title')}]({s.get('url')})" for s in d.get("sources", [])]
    return "\n".join(o) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="analysis JSON files, or HTML reports made by this script")
    ap.add_argument("--out", default=None, help="output file (default: next to the first input)")
    ap.add_argument("--compare", action="store_true", help="side-by-side comparison (only when asked for)")
    ap.add_argument("--with-examples", action="store_true", help="add the three calibration examples to --compare")
    ap.add_argument("--markdown", action="store_true", help="write Markdown instead of HTML (single report)")
    args = ap.parse_args()
    paths = [Path(a) for a in args.inputs]
    data = [load(p) for p in paths]
    if args.with_examples:
        data += [load(f) for f in sorted(EXAMPLES.glob("*.json"))]
    if args.compare:
        out = Path(args.out) if args.out else paths[0].with_name("comparison.html")
        out.write_text(compare_html(data), encoding="utf-8")
        print(f"Wrote {out}")
        return 0
    if len(paths) != 1:
        sys.exit("Give one analysis, or use --compare for several.")
    if args.markdown:
        out = Path(args.out) if args.out else paths[0].with_suffix(".md")
        out.write_text(report_md(data[0]), encoding="utf-8")
    else:
        out = Path(args.out) if args.out else paths[0].with_suffix(".html")
        out.write_text(report_html(data[0]), encoding="utf-8")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
