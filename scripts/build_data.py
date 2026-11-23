#!/usr/bin/env python3
"""Build data/protocols.json from the skill reports in reports/.

Usage:
    python scripts/build_data.py            # stop on any invalid report
    python scripts/build_data.py --lenient  # skip nothing, but write the dataset despite errors
    python scripts/build_data.py --skip-invalid  # leave out reports with errors (used on Netlify)

Each report is checked with the skill's linter. Two reports for the same protocol and
the same specification version are an error. Several versions of one protocol are
allowed; the latest is marked current.
"""
import argparse
import sys

import datalib


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lenient", action="store_true", help="write the dataset even if some reports have errors")
    ap.add_argument("--skip-invalid", action="store_true",
                    help="leave out reports with errors instead of failing (the site still deploys)")
    args = ap.parse_args()
    dataset, errors, warns = datalib.build(strict=not args.lenient, skip_invalid=args.skip_invalid)
    for w in warns:
        print("WARN   " + w)
    for e in errors:
        print("ERROR  " + e)
    if dataset is None:
        print(f"\nNot written: {len(errors)} error(s).")
        return 1
    for s in dataset.get("skipped", []):
        print(f"SKIPPED {s['file']}: left out of the site because it has errors")
    path = datalib.write(dataset)
    current = sum(1 for p in dataset["protocols"] if p["_meta"]["current"])
    print(f"\nWrote {path.relative_to(datalib.ROOT)}: {current} protocol(s), "
          f"{len(dataset['protocols'])} analysis version(s), {len(errors)} error(s), {len(warns)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
