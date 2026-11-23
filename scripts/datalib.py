"""Shared logic for the protocol dataset: reading skill reports, validating them,
detecting duplicates and building data/protocols.json.

Used by scripts/build_data.py, scripts/add_report.py and (later) the local server
behind the website's "Add a report" feature, so all three behave the same way.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
DATA = ROOT / "data" / "protocols.json"
SKILL = ROOT / "skill" / "protocol-analyzer"

sys.path.insert(0, str(SKILL / "scripts"))
import lint as skill_lint  # noqa: E402  (the skill's own linter is the validator)
import render as skill_render  # noqa: E402

DATA_ID = skill_render.DATA_ID
EMBED_RE = re.compile(r'<script type="application/json" id="%s">(.*?)</script>' % DATA_ID, re.S)


class ReportError(Exception):
    """A report that cannot be added (not a skill report, invalid data, ...)."""


# ------------------------------------------------------------------ reading
def extract(html_text, name="report"):
    """Return the analysis data embedded in a skill HTML report."""
    m = EMBED_RE.search(html_text)
    if not m:
        raise ReportError(f"{name}: this is not a protocol-analyzer report (no embedded analysis data).")
    try:
        data = json.loads(m.group(1).replace("<\\/", "</"))
    except json.JSONDecodeError as ex:
        raise ReportError(f"{name}: the embedded analysis data is not valid JSON ({ex}).")
    if "comparison" in data:
        raise ReportError(f"{name}: this is a comparison page, not a single-protocol report.")
    return data


def validate(data, name="report"):
    """Run the skill's linter. Returns (errors, warnings)."""
    errors, warns = skill_lint.lint(data)
    return [f"{name}: {e}" for e in errors], [f"{name}: {w}" for w in warns]


def key(data):
    """(protocol id, spec version) identifies one analysis."""
    return data.get("profile", {}).get("id", ""), data.get("protocol", {}).get("spec_version", "")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")[:60] or "x"


def load_reports():
    """All reports in reports/, as a list of (path, data). Raises ReportError on bad files."""
    out = []
    for path in sorted(REPORTS.glob("*.html")):
        out.append((path, extract(path.read_text(encoding="utf-8"), path.name)))
    return out


# ------------------------------------------------------------------ duplicates
def find_existing(data, reports=None):
    """Reports already in the dataset for the same protocol id (any version)."""
    pid, _ = key(data)
    reports = load_reports() if reports is None else reports
    return [(p, d) for p, d in reports if key(d)[0] == pid]


def target_name(data, keep_both):
    pid, ver = key(data)
    return f"{pid}--{slug(ver)}.html" if keep_both else f"{pid}.html"


def add(html_text, name, mode=None):
    """Add a report to reports/.

    mode: None (refuse if the protocol already exists), "replace" (remove the existing
    report(s) for this protocol) or "keep-both" (keep older versions alongside).
    Returns a dict describing what happened. Raises ReportError when it cannot add.
    """
    data = extract(html_text, name)
    errors, warns = validate(data, name)
    if errors:
        raise ReportError("The report has errors:\n  " + "\n  ".join(errors))
    existing = find_existing(data)
    pid, ver = key(data)
    if existing and mode is None:
        return {"status": "exists", "id": pid, "spec_version": ver,
                "existing": [{"file": p.name, "spec_version": key(d)[1], "analysed_on": d.get("analysed_on", "")}
                             for p, d in existing],
                "warnings": warns}
    if existing and mode == "keep-both":
        if any(key(d)[1] == ver for _, d in existing):
            raise ReportError(f"A report for {pid} version {ver} already exists. Use replace instead.")
        # rename the current file so every version has a versioned name
        for p, d in existing:
            if p.name == f"{pid}.html":
                p.rename(REPORTS / target_name(d, True))
        dest = REPORTS / target_name(data, True)
    else:
        if existing and mode == "replace":
            for p, _ in existing:
                p.unlink()
        dest = REPORTS / target_name(data, False)
    dest.write_text(html_text, encoding="utf-8")
    return {"status": "added", "id": pid, "spec_version": ver, "file": dest.name,
            "replaced": mode == "replace" and bool(existing), "warnings": warns}


# ------------------------------------------------------------------ dataset
# Which of the three goals each rated property mainly serves. This is the explorer's
# own reading, used only for ranking by goal weights; it is not part of the rubric.
# Status and adoption describes maturity, so it serves no goal and is never scored.
GOAL_MAP = {
    "identifier": ["access_control", "accountability"],
    "instance_identifier": ["incident_response", "accountability"],
    "acting_for": ["access_control", "accountability"],
    "credential_type": ["access_control"],
    "credential_lifetime": ["incident_response"],
    "validity": ["access_control"],
    "authentication": ["access_control"],
    "authorization": ["access_control"],
    "human_approval": ["access_control", "accountability"],
    "trust": ["access_control", "accountability"],
    "revocation": ["incident_response"],
    "contact_escalation": ["incident_response", "accountability"],
    "cross_party_signalling": ["incident_response"],
    "model_identity": ["accountability"],
}


def rubric():
    """Properties (id, group, name, question, goals) in rubric order, from the skill."""
    meta = skill_lint.rubric_meta()
    questions = skill_render.questions()
    return [{"id": pid, "group": meta[pid][0], "property": meta[pid][1], "question": questions.get(pid, ""),
             "rated": pid not in skill_lint.DESCRIPTIVE, "goals": GOAL_MAP.get(pid, [])}
            for pid in skill_lint.rubric_ids()]


def vocab_descriptions():
    """What each profile value means, from the skill's profile.md ('- `value`: text' lines)."""
    out, field, cur = {}, None, None
    for line in skill_lint.PROFILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\w+)\s*$", line)
        if m:
            field, cur = m.group(1), None
            continue
        m = re.match(r"^- `([a-z0-9-]+)`(?::\s*(.*))?$", line)
        if field and m:
            cur = (field, m.group(1))
            out[cur] = (m.group(2) or "").strip()
        elif cur and line.startswith("  ") and line.strip():
            out[cur] = (out[cur] + " " + line.strip()).strip()
        else:
            cur = None
    return out


def vocab():
    """Profile vocabularies with display labels and descriptions."""
    desc = vocab_descriptions()
    return {field: [{"value": v, "label": skill_render.nice(v), "description": desc.get((field, v), "")}
                    for v in sorted(values)]
            for field, values in skill_lint.profile_vocab().items()}


def build(strict=True, skip_invalid=False):
    """Build data/protocols.json from reports/. Returns (dataset, errors, warnings).

    skip_invalid: leave out any report with errors (listed in the dataset under "skipped")
    instead of failing, so one bad upload cannot block a deploy. Used by the Netlify build.
    """
    errors, warns, entries, skipped = [], [], [], []
    if skip_invalid:
        reports = []
        for path in sorted(REPORTS.glob("*.html")):
            try:
                reports.append((path, extract(path.read_text(encoding="utf-8"), path.name)))
            except ReportError as ex:
                errors.append(str(ex))
                skipped.append({"file": path.name, "errors": [str(ex)]})
    else:
        try:
            reports = load_reports()
        except ReportError as ex:
            return None, [str(ex)], []
    seen = {}
    for path, data in reports:
        e, w = validate(data, path.name)
        k = key(data)
        if k in seen:
            e.append(f"{path.name}: same protocol and version as {seen[k]} ({k[0]} {k[1]})")
        errors += e
        warns += w
        if e and skip_invalid:
            skipped.append({"file": path.name, "id": k[0], "spec_version": k[1], "errors": e})
            continue
        seen[k] = path.name
        entries.append({"file": path.name, "data": data})
    # mark the latest version of each protocol as current
    by_id = {}
    for ent in entries:
        by_id.setdefault(key(ent["data"])[0], []).append(ent)
    protocols = []
    for pid, group in sorted(by_id.items()):
        group.sort(key=lambda x: (x["data"].get("protocol", {}).get("spec_date", ""), x["data"].get("analysed_on", "")))
        for i, ent in enumerate(group):
            d = dict(ent["data"])
            d["_meta"] = {"file": ent["file"], "current": i == len(group) - 1, "versions": len(group)}
            protocols.append(d)
    if errors and strict and not skip_invalid:
        return None, errors, warns
    dataset = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rubric_version": sorted({p.get("rubric_version", "") for p in protocols}),
        "properties": rubric(),
        "goals": [{"id": k, "label": lab, "definition": d} for k, lab, d in skill_render.GOALS],
        "vocab": vocab(),
        "protocols": protocols,
        "skipped": skipped,
    }
    return dataset, errors, warns


def write(dataset):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(dataset, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return DATA
