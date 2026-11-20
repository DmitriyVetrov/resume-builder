"""Report CLI for the P00 checks (test plan 3, C-7).

Usage: python3 -B p00_cli.py --root PATH [--gate] [--mutation NF-xx]

Prints one line per finding "<TC-ID>\\t<CODE>\\t<location>\\t<detail>" (sorted), then
"SUMMARY checks=<n> failed=<k> findings=<m>". Exit codes: 0 no finding, 1 at least one finding,
2 usage error. The output holds no timestamps and no absolute paths.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import p00_checks  # noqa: E402
import p00_fixtures  # noqa: E402
from p00_repo import Repo  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser(prog="p00_cli.py")
    ap.add_argument("--root", required=True, help="repository root (or a fixture root)")
    ap.add_argument("--gate", action="store_true", help="also run the gate checks")
    ap.add_argument("--mutation", help="apply mutation NF-xx in memory before checking")
    args = ap.parse_args(argv)
    if not os.path.isdir(args.root):
        print("error: --root is not a directory", file=sys.stderr)
        return 2
    repo = Repo(args.root)
    if args.mutation:
        mut = p00_fixtures.BY_NF.get(args.mutation)
        if mut is None:
            print("error: unknown mutation", file=sys.stderr)
            return 2
        repo = Repo(args.root, mut.overrides(repo))
    kinds = ("sources", "real", "gate") if args.gate else ("sources", "real")
    results = p00_checks.run_checks(repo, kinds)
    lines = []
    failed = 0
    for tc in sorted(results):
        if results[tc]:
            failed += 1
        for f in results[tc]:
            clean = [str(x).replace("\t", " ").replace("\n", " ") for x in f]
            lines.append("\t".join(clean))
    for ln in sorted(lines):
        print(ln)
    print("SUMMARY checks=%d failed=%d findings=%d" % (len(results), failed, len(lines)))
    return 1 if lines else 0


if __name__ == "__main__":
    sys.exit(main())
