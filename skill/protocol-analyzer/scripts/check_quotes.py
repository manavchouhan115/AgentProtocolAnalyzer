#!/usr/bin/env python3
"""Check that every quote in a protocol analysis appears, word for word, in its source.

Usage:
    python check_quotes.py analysis.json
    python check_quotes.py analysis.json --write                 # store each result in claim["check"]
    python check_quotes.py analysis.json --local spec=spec.md    # use a saved copy for one source
    python check_quotes.py analysis.json --snapshots DIR         # use DIR/<source-id>.(txt|md|html) when present
    python check_quotes.py analysis.json --save-snapshots DIR    # save what was downloaded

For each source it downloads `fetch_url` (or `url`), turns it into plain text, and looks
for each quote, ignoring case, spacing, Markdown/HTML markup, curly quotes and dashes.

Results per quote:
    OK           found exactly
    NEAR         most of the quote found (wording differs): fix the quote
    NOT FOUND    not in the source: fix it, or change the claim to inference/silent
    UNREACHABLE  the source could not be downloaded: re-open it with your web tool,
                 confirm each quote, then run again with --web-ok SOURCE_ID
Also flags quotes over 40 words and quotes that contain an ellipsis.
Exit code 1 if any quote is NOT FOUND or NEAR.
"""
import argparse
import difflib
import hashlib
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (protocol-analyzer quote checker)"
MAX_WORDS = 40


def looks_like_html(raw):
    head = raw[:3000].lower()
    return "<html" in head or "<!doctype html" in head or "<body" in head


def to_text(raw):
    if looks_like_html(raw):
        raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
        raw = re.sub(r"</?[a-zA-Z][^<>]{0,1000}>", " ", raw)
        raw = html.unescape(raw)
    # Markdown: [text](url) -> text, ![alt](src) -> alt, {{ref}} kept, <tags> dropped
    raw = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", raw)
    raw = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", raw)
    raw = re.sub(r"</?[a-zA-Z][^<>]{0,200}>", " ", raw)
    return raw


def norm(text):
    text = text.lower()
    for a, b in {"“": '"', "”": '"', "‘": "'", "’": "'", "–": "-",
                 "—": "-", " ": " ", "`": "", "\\": ""}.items():
        text = text.replace(a, b)
    text = re.sub(r"[*_]", "", text)          # Markdown emphasis and underscores
    text = re.sub(r"^\s*[>#|-]+\s*", " ", text, flags=re.M)  # quote/heading/table/list markers
    return re.sub(r"\s+", " ", text).strip()


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8", errors="replace")


def near_score(quote, text):
    qw, tw = quote.split(), text.split()
    if not qw:
        return 0.0
    sm = difflib.SequenceMatcher(None, tw, qw, autojunk=False)
    m = sm.find_longest_match(0, len(tw), 0, len(qw))
    return m.size / len(qw)


def fingerprint(quote):
    """Short hash of the quote, stored next to the check result so a later edit is detected."""
    return hashlib.sha1(quote.encode("utf-8")).hexdigest()[:10]


def load_sources(data, local, snap_dir, save_dir):
    texts = {}
    for s in data.get("sources", []):
        sid = s["id"]
        raw = None
        try:
            if sid in local:
                raw = Path(local[sid]).read_text(encoding="utf-8", errors="replace")
            elif snap_dir and any((Path(snap_dir) / f"{sid}{ext}").exists() for ext in (".txt", ".md", ".html")):
                for ext in (".txt", ".md", ".html"):
                    p = Path(snap_dir) / f"{sid}{ext}"
                    if p.exists():
                        raw = p.read_text(encoding="utf-8", errors="replace")
                        break
            else:
                raw = fetch(s.get("fetch_url") or s["url"])
                if save_dir:
                    Path(save_dir).mkdir(parents=True, exist_ok=True)
                    (Path(save_dir) / f"{sid}.txt").write_text(raw, encoding="utf-8")
            texts[sid] = norm(to_text(raw))
        except Exception as ex:  # network limits, 404, etc.
            texts[sid] = None
            print(f"[source {sid}] UNREACHABLE: {ex.__class__.__name__}: {str(ex)[:120]}")
    return texts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("analysis")
    ap.add_argument("--local", action="append", default=[], help="source_id=path to a saved copy")
    ap.add_argument("--snapshots", default=None, help="folder with <source-id>.txt/.md/.html copies")
    ap.add_argument("--save-snapshots", default=None, help="folder to save downloaded sources into")
    ap.add_argument("--write", action="store_true", help="write results into claim['check']")
    ap.add_argument("--web-ok", action="append", default=[], metavar="SOURCE_ID",
                    help="after re-checking this source's quotes by hand with a web tool, mark its "
                         "unreachable quotes WEB-OK (implies --write)")
    args = ap.parse_args()
    path = Path(args.analysis)
    data = json.loads(path.read_text(encoding="utf-8"))
    if args.web_ok:
        args.write = True
    local = dict(x.split("=", 1) for x in args.local)
    texts = load_sources(data, local, args.snapshots, args.save_snapshots)

    counts = {"OK": 0, "NEAR": 0, "NOT FOUND": 0, "UNREACHABLE": 0, "WEB-OK (kept)": 0}
    warnings = []
    for r in data.get("rows", []):
        for c in r.get("claims", []):
            q = c.get("quote")
            if not q:
                continue
            if len(q.split()) > MAX_WORDS:
                warnings.append(f"{r.get('id')}: quote has {len(q.split())} words (max {MAX_WORDS})")
            if "..." in q or "…" in q:
                warnings.append(f"{r.get('id')}: quote contains an ellipsis; quote one continuous passage")
            t = texts.get(c.get("source"))
            if t is None:
                if c.get("source") in args.web_ok:
                    c["check"], c["check_fp"] = "WEB-OK", fingerprint(q)
                if c.get("check") == "WEB-OK" and c.get("check_fp") == fingerprint(q):
                    counts["WEB-OK (kept)"] += 1
                    continue
                status = "UNREACHABLE"
            else:
                nq = norm(to_text(q))
                if nq in t:
                    status = "OK"
                else:
                    status = "NEAR" if near_score(nq, t) >= 0.8 else "NOT FOUND"
            counts[status] += 1
            if args.write:
                c["check"], c["check_fp"] = status, fingerprint(q)
            if status != "OK":
                print(f"{status:11} {r.get('id')} [{c.get('source')} | {c.get('section', '')}]: \"{q[:100]}\"")
    for w in warnings:
        print(f"WARNING     {w}")
    print("\nSummary: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    if counts["UNREACHABLE"]:
        print("Re-check UNREACHABLE quotes with your web tool, then re-run with --web-ok SOURCE_ID for each source you checked.")
    if args.write:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Results written to {path}")
    sys.exit(1 if counts["NOT FOUND"] or counts["NEAR"] else 0)


if __name__ == "__main__":
    main()
