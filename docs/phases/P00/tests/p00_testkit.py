"""Shared helpers for the P00 test modules."""
import p00_checks
from p00_repo import Repo, find_real_root

REAL = Repo(find_real_root())


def run(tc_id, repo=None):
    kind, fn = p00_checks.CHECKS[tc_id]
    return fn(repo if repo is not None else REAL)


def assert_clean(case, findings):
    """Fail the test case with a deterministic message when findings exist."""
    if findings:
        case.fail("%d finding(s):\n%s" % (len(findings), p00_checks.format_findings(findings)))
