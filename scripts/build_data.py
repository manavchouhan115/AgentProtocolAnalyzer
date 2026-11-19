#!/usr/bin/env python3
"""Build data/protocols.json from the skill reports in reports/.

Usage:
    python scripts/build_data.py            # stop on any invalid report
    python scripts/build_data.py --lenient  # skip nothing, but write the dataset despite errors

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
    args = ap.parse_args()
    dataset, errors, warns = datalib.build(strict=not args.lenient)
    for w in warns:
        print("WARN   " + w)
    for e in errors:
        print("ERROR  " + e)
    if dataset is None:
        print(f"\nNot written: {len(errors)} error(s).")
        return 1
    path = datalib.write(dataset)
    current = sum(1 for p in dataset["protocols"] if p["_meta"]["current"])
    print(f"\nWrote {path.relative_to(datalib.ROOT)}: {current} protocol(s), "
          f"{len(dataset['protocols'])} analysis version(s), {len(errors)} error(s), {len(warns)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
