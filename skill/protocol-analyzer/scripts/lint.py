#!/usr/bin/env python3
"""Check a protocol analysis for schema problems, rating inconsistencies and style issues.

Usage:
    python lint.py analysis.json
    python lint.py analysis.json --calibrate     # also print the calibration ratings next to yours

ERROR lines must be fixed. WARN lines must be checked: fix them, or make sure
`rating_reason` explains why the row is an exception.
Exit code 1 if there are errors.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "references"
RUBRIC = REFS / "properties.md"
PROFILE = REFS / "profile.md"
EXAMPLES = REFS / "examples"

DESCRIPTIVE = {"summary", "use_cases", "actors", "building_blocks"}
RATINGS = {"green", "yellow", "red", "n/a"}
COVERAGE = {"required", "default", "optional", "extension", "outside", "none", "out_of_scope", "n/a"}
REQUIREMENTS = {"MUST", "SHOULD", "MAY", "MUST NOT", "SHOULD NOT", "MUST*", "SHOULD*", "MAY*", "none"}
TYPES = {"fact", "inference", "silent", "out_of_scope"}
CHECKS = {"OK", "WEB-OK", "NEAR", "NOT FOUND", "UNREACHABLE"}
BANNED = ["delve", "crucial", "pivotal", "robust", "seamless", "seamlessly", "leverage", "game-changer",
          "game changer", "unlock", "a testament to", "plays a key role", "in today's world", "cutting-edge",
          "state-of-the-art", "groundbreaking"]


def rubric_ids():
    return re.findall(r"^### (\w+)\s*$", RUBRIC.read_text(encoding="utf-8"), re.M)


def rubric_meta():
    """Map property id -> (group, property name) as written in properties.md."""
    meta, group, cur = {}, None, None
    for line in RUBRIC.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## Group \d+: (.+?)\s*$", line)
        if m:
            group = m.group(1)
            continue
        m = re.match(r"^### (\w+)\s*$", line)
        if m:
            cur = m.group(1)
            continue
        m = re.match(r"^- \*\*Property:\*\* (.+?)\s*$", line)
        if m and cur:
            meta[cur] = (group, m.group(1))
            cur = None
    return meta


def profile_vocab():
    """Allowed values per profile field, parsed from profile.md ('## field' then '- `value`' lines)."""
    vocab, cur = {}, None
    for line in PROFILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\w+)\s*$", line)
        if m:
            cur = m.group(1)
            continue
        if line.startswith("# "):
            cur = None
        if cur:
            for v in re.findall(r"`([a-z0-9-]+)`", line) if line.lstrip().startswith("- `") else []:
                vocab.setdefault(cur, set()).add(v)
    return vocab


def lint_profile(data, E, W):
    prof = data.get("profile")
    if not isinstance(prof, dict):
        E("missing 'profile' block (see references/profile.md)")
        return
    vocab = profile_vocab()
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(prof.get("id", ""))):
        E("profile.id must be a lowercase slug, e.g. 'web-bot-auth'")
    single = {"category": "category", "venue": "venue", "maturity": "maturity", "openness": "openness"}
    for field, vk in single.items():
        if prof.get(field) not in vocab.get(vk, set()):
            E(f"profile.{field} {prof.get(field)!r} is not an allowed value")
    for field, vk, need in (("secondary_categories", "category", False), ("mechanisms", "mechanisms", True),
                            ("layers", "layers", True)):
        vals = prof.get(field)
        if not isinstance(vals, list) or (need and not vals):
            E(f"profile.{field} must be a list" + (" with at least one value" if need else ""))
            continue
        for v in vals:
            if v not in vocab.get(vk, set()):
                E(f"profile.{field}: {v!r} is not an allowed value")
    if not isinstance(prof.get("building_blocks"), list) or not prof.get("building_blocks"):
        W("profile.building_blocks is empty")
    if not prof.get("website"):
        W("profile.website is empty")
    fp = prof.get("first_published", "")
    if fp and not re.fullmatch(r"\d{4}-\d{2}", fp):
        E("profile.first_published must be YYYY-MM or empty")
    rev = data.get("review")
    if not isinstance(rev, dict) or rev.get("status") not in ("draft", "reviewed"):
        E("missing 'review' block with status 'draft' or 'reviewed'")
    elif rev.get("status") == "reviewed" and not (rev.get("reviewed_by") and rev.get("reviewed_on")):
        W("review.status is 'reviewed' but reviewed_by or reviewed_on is empty")


def words(s):
    return len(str(s or "").split())


def lint(data):
    errors, warns = [], []
    E, W = errors.append, warns.append

    for key in ("schema_version", "rubric_version", "analysed_on", "protocol", "summary", "how_it_works",
                "sources", "rows", "goals_reading"):
        if key not in data:
            E(f"missing top-level field '{key}'")
    lint_profile(data, E, W)
    summ = data.get("summary")
    if not isinstance(summ, list) or len(summ) != 2:
        E("summary must be a list of exactly two paragraphs")
    else:
        for i, para in enumerate(summ, 1):
            if not 45 <= words(para) <= 160:
                W(f"summary paragraph {i} has {words(para)} words (aim for 60 to 130)")
    steps = data.get("how_it_works")
    if not isinstance(steps, list) or not 3 <= len(steps) <= 7:
        E("how_it_works must be a list of 3 to 7 steps")
    p = data.get("protocol", {})
    for key in ("name", "spec_version", "spec_date", "maintainer"):
        if not p.get(key):
            E(f"protocol.{key} is empty (pin the exact version and date)")

    src = {s.get("id"): s for s in data.get("sources", [])}
    for s in data.get("sources", []):
        if not s.get("url"):
            E(f"source {s.get('id')}: no url")
        if not (s.get("version") or s.get("date")):
            W(f"source {s.get('id')}: no version or date")
        if s.get("kind") not in ("primary", "secondary"):
            E(f"source {s.get('id')}: kind must be primary or secondary")
    used = set()

    ids = [r.get("id") for r in data.get("rows", [])]
    expected = rubric_ids()
    missing = [i for i in expected if i not in ids]
    extra = [i for i in ids if i not in expected]
    if missing:
        E("missing properties: " + ", ".join(missing))
    if extra:
        E("unknown properties: " + ", ".join(extra))
    if [i for i in ids if i in expected] != [i for i in expected if i in ids]:
        E("rows are not in rubric order")

    meta = rubric_meta()
    lowercase_req = False
    for r in data.get("rows", []):
        rid = r.get("id")
        if rid in meta:
            g, pname = meta[rid]
            if r.get("group") != g:
                E(f"{rid}: group should be {g!r}")
            if r.get("property") != pname:
                E(f"{rid}: property name should be {pname!r}")
        rating, cov, req = r.get("rating"), r.get("coverage"), r.get("requirement")
        if rating not in RATINGS:
            E(f"{rid}: rating {rating!r} not allowed")
        if cov not in COVERAGE:
            E(f"{rid}: coverage {cov!r} not allowed")
        if req not in REQUIREMENTS:
            E(f"{rid}: requirement {req!r} not allowed")
        if req and req.endswith("*"):
            lowercase_req = True
        if not r.get("short"):
            E(f"{rid}: 'short' is empty")
        elif words(r["short"]) > (14 if rid == "summary" else 10):
            W(f"{rid}: 'short' has {words(r['short'])} words (aim for 8 or fewer)")
        n = words(r.get("answer"))
        if n > 120:
            W(f"{rid}: answer has {n} words (aim for 40 to 110)")
        elif n < 20 and rid not in ("summary", "cross_party_signalling", "model_identity", "human_approval"):
            W(f"{rid}: answer has only {n} words: explain how the protocol does it, not just the verdict")

        rated = rid not in DESCRIPTIVE
        if rid in DESCRIPTIVE and rating != "n/a":
            E(f"{rid}: descriptive row must be rated n/a")
        if rated:
            if rating == "n/a":
                E(f"{rid}: rated row cannot be n/a")
            if not r.get("rating_reason"):
                E(f"{rid}: rating_reason is required")
            if rid != "status_adoption":
                if cov == "n/a":
                    E(f"{rid}: coverage is required for rated rows")
                # coverage vs colour (rules in properties.md, 'General rating rules')
                if cov in ("none", "out_of_scope", "outside") and rating != "red":
                    W(f"{rid}: coverage '{cov}' usually means red, not {rating}")
                if cov in ("optional", "extension") and rating == "green":
                    W(f"{rid}: coverage '{cov}' usually means yellow, not green")
                if cov in ("required", "default") and rating == "red":
                    W(f"{rid}: coverage '{cov}' with a red rating: is coverage about this property's question?")
                # coverage vs requirement level
                if cov == "optional" and req in ("MUST", "MUST*"):
                    W(f"{rid}: coverage optional but requirement {req}")
                if cov == "required" and req in ("MAY", "MAY*"):
                    W(f"{rid}: coverage required but requirement {req}")
                if cov in ("none", "out_of_scope") and req not in ("none", "MUST NOT", "SHOULD NOT"):
                    W(f"{rid}: coverage {cov} but requirement {req}")

        claims = r.get("claims", [])
        if not claims:
            E(f"{rid}: no claims")
        kinds = {c.get("type") for c in claims}
        if rated and not (kinds & {"fact", "out_of_scope"}) and not any(
                c.get("type") == "silent" and "search" in (c.get("text") or "").lower() for c in claims):
            E(f"{rid}: needs a fact/out_of_scope claim, or a silent claim saying what was searched")
        if cov == "out_of_scope" and "out_of_scope" not in kinds:
            E(f"{rid}: coverage out_of_scope needs an out_of_scope claim quoting the spec")
        for c in claims:
            t = c.get("type")
            if t not in TYPES:
                E(f"{rid}: claim type {t!r} not allowed")
            if c.get("source") not in src:
                E(f"{rid}: claim source {c.get('source')!r} not in sources")
            used.add(c.get("source"))
            q = c.get("quote", "")
            if t in ("fact", "out_of_scope") and not q:
                E(f"{rid}: {t} claim without a quote")
            if t == "silent" and q:
                E(f"{rid}: silent claim must have an empty quote")
            if t == "silent" and "search" not in (c.get("text") or "").lower():
                W(f"{rid}: silent claim should say what was searched")
            if q and words(q) > 40:
                E(f"{rid}: quote has {words(q)} words (max 40)")
            if q and ("..." in q or "…" in q):
                E(f"{rid}: quote contains an ellipsis")
            if not c.get("section"):
                W(f"{rid}: claim without a section or heading")
            elif re.fullmatch(r"\d+(\.\d+)*", str(c["section"])) and not src.get(c.get("source"), {}).get("url", "").startswith("https://www.rfc-editor.org"):
                W(f"{rid}: section '{c['section']}' is only a number: is it a real section number from the source?")
            if q:
                chk = c.get("check")
                if chk in CHECKS and c.get("check_fp") != hashlib.sha1(q.encode("utf-8")).hexdigest()[:10]:
                    E(f"{rid}: quote changed after it was checked (or check set by hand): re-run check_quotes.py --write")
                elif chk not in CHECKS:
                    W(f"{rid}: quote not verified yet (run check_quotes.py --write, or set check WEB-OK after a web re-check)")
                elif chk in ("NEAR", "NOT FOUND"):
                    E(f"{rid}: quote check is {chk}")
                elif chk == "UNREACHABLE":
                    W(f"{rid}: quote UNREACHABLE: re-check it with a web tool, then run check_quotes.py --web-ok SOURCE_ID")

    for sid in src:
        if sid not in used:
            W(f"source {sid} is not used by any claim")

    if lowercase_req and not any("2119" in n or "lowercase" in n.lower() for n in data.get("notes", [])):
        W("a requirement uses '*' but notes do not say the spec uses lowercase requirement words")

    g = data.get("goals_reading", {})
    for k in ("access_control", "incident_response", "accountability"):
        if not g.get(k):
            E(f"goals_reading.{k} is empty")

    # style
    texts = [(f"summary[{i}]", t) for i, t in enumerate(data.get("summary") or [])] + \
        [(f"how_it_works[{i}]", t) for i, t in enumerate(data.get("how_it_works") or [])] + \
        [(f"goals_reading.{k}", v) for k, v in g.items()]
    for r in data.get("rows", []):
        texts += [(f"{r.get('id')}.answer", r.get("answer", "")), (f"{r.get('id')}.short", r.get("short", "")),
                  (f"{r.get('id')}.rating_reason", r.get("rating_reason", ""))]
    for where, t in texts:
        t = str(t or "")
        if "—" in t or " – " in t or " -- " in t:
            E(f"{where}: em dash or spaced dash (use a comma, brackets or a new sentence)")
        low = t.lower()
        for b in BANNED:
            if re.search(r"\b" + re.escape(b) + r"\b", low):
                W(f"{where}: avoid the word '{b}'")
        if "!" in t:
            W(f"{where}: no exclamation marks")
        if re.search(r"\bfails?\b", low):
            W(f"{where}: avoid saying a protocol 'fails'; say what it does not cover")
    return errors, warns


def calibrate(data):
    refs = []
    for f in sorted(EXAMPLES.glob("*.json")):
        try:
            refs.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    name = data.get("protocol", {}).get("name", "yours")
    cols = [name] + [x.get("protocol", {}).get("name", "?") for x in refs]
    print("\nCalibration (your rating vs the calibration examples):")
    print("  " + "property".ljust(24) + "".join(c[:16].ljust(18) for c in cols))
    by_id = [{r["id"]: r for r in x.get("rows", [])} for x in [data] + refs]
    for rid in rubric_ids():
        if rid in DESCRIPTIVE:
            continue
        cells = []
        for m in by_id:
            r = m.get(rid, {})
            cells.append(f"{r.get('rating', '-')}/{r.get('coverage', '-')}"[:17].ljust(18))
        print("  " + rid.ljust(24) + "".join(cells))
    print("  (rating/coverage). Where you differ from an example that does the same thing, explain it in rating_reason.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("analysis")
    ap.add_argument("--calibrate", action="store_true")
    args = ap.parse_args()
    data = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    errors, warns = lint(data)
    for e in errors:
        print("ERROR  " + e)
    for w in warns:
        print("WARN   " + w)
    print(f"\n{len(errors)} error(s), {len(warns)} warning(s)")
    if args.calibrate:
        calibrate(data)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
