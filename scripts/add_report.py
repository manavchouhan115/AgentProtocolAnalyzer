#!/usr/bin/env python3
"""Add a protocol-analyzer HTML report to the dataset, then rebuild data/protocols.json.

Usage:
    python scripts/add_report.py path/to/report.html             # asks if the protocol exists
    python scripts/add_report.py path/to/report.html --replace
    python scripts/add_report.py path/to/report.html --keep-both

If the protocol is already in the dataset, you choose: replace it, keep both versions,
or cancel. The website's "Add a report" feature uses the same rules.
"""
import argparse
import sys
from pathlib import Path

import datalib


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--replace", action="store_true")
    g.add_argument("--keep-both", action="store_true")
    args = ap.parse_args()
    path = Path(args.report)
    text = path.read_text(encoding="utf-8")
    mode = "replace" if args.replace else "keep-both" if args.keep_both else None
    try:
        res = datalib.add(text, path.name, mode)
        if res["status"] == "exists":
            print(f"'{res['id']}' is already in the dataset:")
            for ex in res["existing"]:
                print(f"  - {ex['file']} (version {ex['spec_version']}, analysed {ex['analysed_on']})")
            print(f"The new report is version {res['spec_version']}.")
            if not sys.stdin.isatty():
                print("Run again with --replace or --keep-both.")
                return 1
            choice = input("Replace it [r], keep both versions [k], or cancel [c]? ").strip().lower()
            if choice not in ("r", "k"):
                print("Cancelled. Nothing was changed.")
                return 1
            res = datalib.add(text, path.name, "replace" if choice == "r" else "keep-both")
    except datalib.ReportError as ex:
        print(f"Not added. {ex}")
        return 1
    for w in res.get("warnings", []):
        print("WARN   " + w)
    print(f"{'Replaced' if res.get('replaced') else 'Added'} {res['id']} ({res['spec_version']}) as reports/{res['file']}.")
    dataset, errors, _ = datalib.build()
    if dataset is None:
        print("Dataset not rebuilt:\n  " + "\n  ".join(errors))
        return 1
    datalib.write(dataset)
    print("Rebuilt data/protocols.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
