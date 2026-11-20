#!/usr/bin/env python3
"""Deterministic step and gate check for one phase (ADR-051 S-8).

Usage (from any directory):
  phase-handoff-check.py --phase P06 --step red|green [--worktree PATH] [--base main]
  phase-handoff-check.py --phase P06 --gate [--worktree PATH] [--base main]
  phase-handoff-check.py --phase P07+P08+P09 --gate        (batch, ADR-051 S-6)

A batch runs several consecutive phases on one branch with one gate: the phase scope is the
union of their folders and allowed paths, every phase's suite.cmd must hold, and the gate
checks each phase's artifacts and verdicts separately.

Checks:
  1. Test integrity (--step green): warns when a test file that existed before the
     green step has uncommitted edits. Fixing a harness is legitimate, weakening a
     test is not, so this is a warning that must be explained in test-results.md and
     is checked again by the external review (ADR-051 S-3, S-4).
  2. Phase scope: every file changed since the merge-base with --base must be inside
     the phase scope. docs/source/** is never allowed.
  3. Secrets: no .env/.pem/.key files and no obvious tokens in changed files.
  4. scripts/check-blueprint.py exits 0.
  5. Suite: commands in docs/phases/<P>/tests/suite.cmd (one per line, '#' comments).
     --step red expects failures (reported, not an error); green and the gate need
     every command to exit 0.
  6. Gate only: the required artifacts of ADR-051 S-7 exist, review verdict PASS,
     QA verdict PASS.

Phase scope = docs/phases/<P>/** + docs/blueprint/** + the backticked globs in the
"## Allowed paths" section of architecture/phase-plan.md.

Prints one line per finding and a final "RESULT PASS" or "RESULT FAIL"; exit 0/1.
Stdlib only.
"""
import argparse
import fnmatch
import os
import re
import subprocess
import sys

STEPS = ["red", "green", "gate"]

TEST_GLOBS = ["tests/**", "backend/tests/**", "backend/**/*Tests/**", "backend/**/*.Tests/**",
              "frontend/tests/**", "frontend/**/__tests__/**", "frontend/**/*.test.*",
              "frontend/**/*.spec.*", "docs/phases/*/tests/**"]

GATE_ARTIFACTS = ["PHASE-STATUS.md", "architecture/phase-plan.md", "decisions.md",
                  "acceptance-criteria.md", "tests/test-plan.md", "tests/test-results.md",
                  "review/code-review.md", "qa-report.md"]


SECRET_RE = re.compile(r"(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----"
                       r"|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})")


class Report:
    def __init__(self):
        self.fail = False

    def ok(self, msg):
        print("OK   " + msg)

    def warn(self, msg):
        print("WARN " + msg)

    def bad(self, code, msg=""):
        self.fail = True
        print("FAIL %s %s" % (code, msg))


def git(wt, *args):
    r = subprocess.run(["git", "-C", wt] + list(args), capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("git %s failed: %s" % (" ".join(args), r.stderr.strip()))
    return r.stdout


def match(path, globs):
    for g in globs:
        if g.endswith("/**"):
            if path.startswith(g[:-3] + "/") or path == g[:-3]:
                return True
        if fnmatch.fnmatchcase(path, g):
            return True
        if "**/" in g and fnmatch.fnmatchcase(path, g.replace("**/", "")):
            return True
    return False


def uncommitted(wt):
    """Paths changed since HEAD, with status letters (incl. untracked)."""
    out = {}
    for ln in git(wt, "status", "--porcelain=v1", "-uall", "--no-renames").splitlines():
        st, path = ln[:2], ln[3:].strip().strip('"')
        out[path] = st.strip() or "?"
    return out


def changed_since_base(wt, base):
    mb = git(wt, "merge-base", base, "HEAD").strip()
    paths = set(git(wt, "diff", "--name-only", mb).split())
    paths |= set(uncommitted(wt))
    return paths


def phase_plan_scope(wt, p):
    """Phase globs from phase-plan.md '## Allowed paths'."""
    path = os.path.join(wt, "docs/phases/%s/architecture/phase-plan.md" % p)
    globs = []
    if not os.path.exists(path):
        return globs
    sec, on = [], False
    for ln in open(path, encoding="utf-8"):
        if re.match(r"^#{2,3} ", ln):
            on = "allowed paths" in ln.lower()
            continue
        if on:
            sec.append(ln)
    for ln in sec:
        globs.extend(re.findall(r"`([^`]+)`", ln))
    return [g.rstrip("/") + "/**" if g.endswith("/") else g for g in globs]


def run_suite(wt, p):
    path = os.path.join(wt, "docs/phases/%s/tests/suite.cmd" % p)
    if not os.path.exists(path):
        return None
    results = []
    for ln in open(path, encoding="utf-8"):
        cmd = ln.strip()
        if not cmd or cmd.startswith("#"):
            continue
        r = subprocess.run(["bash", "-lc", cmd], cwd=wt, capture_output=True, text=True)
        tail = (r.stdout + r.stderr).strip().splitlines()[-1:] or [""]
        results.append((cmd, r.returncode, tail[0][:200]))
    return results


def verdict(path):
    if not os.path.exists(path):
        return None
    v = None
    for ln in open(path, encoding="utf-8"):
        if re.search(r"verdict", ln, re.I):
            m = re.findall(r"\b(PASS|FAIL|BLOCKED)\b", ln)
            if m:
                v = m[0]
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", required=True)
    ap.add_argument("--step", choices=STEPS, help="red: suite expected red; green: suite must pass")
    ap.add_argument("--gate", action="store_true", help="same as --step gate, plus artifacts/verdicts")
    ap.add_argument("--worktree", default=".")
    ap.add_argument("--base", default="main")
    a = ap.parse_args()
    if not a.step and not a.gate:
        ap.error("--step or --gate is required")
    if a.gate:
        a.step = "gate"
    wt = os.path.abspath(a.worktree)
    # One phase, or a batch of consecutive phases run on one branch with one gate (ADR-051 S-6).
    phases = a.phase.split("+")
    if not phases or not all(re.fullmatch(r"P\d{2}", x) for x in phases):
        ap.error("--phase must look like P04, or P07+P08+P09 for a batch")
    p = a.phase
    rep = Report()

    plan_globs = [g for x in phases for g in phase_plan_scope(wt, x)]
    phase_scope = ["docs/phases/%s/**" % x for x in phases] + ["docs/blueprint/**"] + plan_globs
    if any(g.startswith("contracts") for g in plan_globs):
        phase_scope += ["contracts/**"]

    # 1. Test integrity: pre-existing tests edited during the green step (ADR-051 S-4)
    head_files = set(git(wt, "ls-files").split())
    unc = uncommitted(wt)
    if a.step == "green":
        touched = [f for f in sorted(unc)
                   if match(f, TEST_GLOBS) and f in head_files
                   and not f.endswith(("test-results.md", "test-plan.md", "suite.cmd"))]
        for f in touched:
            rep.warn("TEST_TOUCHED %s existed before the green step (status %s) -- "
                     "explain in test-results.md; the external review checks test integrity"
                     % (f, unc[f]))
        if not touched:
            rep.ok("no pre-existing test file edited during green")

    # 2. Phase scope (since merge-base)
    changed = changed_since_base(wt, a.base)
    out = sorted(f for f in changed if not match(f, phase_scope) or f.startswith("docs/source/"))
    for f in out:
        rep.bad("PHASE_SCOPE", "%s outside phase %s scope" % (f, p))
    if not out:
        rep.ok("phase scope: %d changed file(s) since %s" % (len(changed), a.base))

    # 3. Secrets
    for f in sorted(changed):
        base = os.path.basename(f)
        if (base.startswith(".env") and base != ".env.example") or base.endswith((".pem", ".key")):
            rep.bad("SECRET_FILE", f)
        fp = os.path.join(wt, f)
        if os.path.isfile(fp) and os.path.getsize(fp) < 2_000_000:
            try:
                if SECRET_RE.search(open(fp, encoding="utf-8", errors="ignore").read()):
                    rep.bad("SECRET_PATTERN", f)
            except OSError:
                pass

    # 4. Blueprint structure
    r = subprocess.run([sys.executable, "-B", "scripts/check-blueprint.py"], cwd=wt,
                       capture_output=True, text=True)
    if r.returncode == 0:
        rep.ok("check-blueprint exit 0")
    else:
        rep.bad("BLUEPRINT", (r.stdout + r.stderr).strip().splitlines()[-1:])

    # 5. Suite -- every phase in the batch has its own suite.cmd and all of them must hold.
    suite = []
    for x in phases:
        part = run_suite(wt, x)
        if part is None:
            rep.bad("NO_SUITE", "docs/phases/%s/tests/suite.cmd" % x)
        else:
            suite += part
    if not suite:
        pass
    else:
        red = [s for s in suite if s[1] != 0]
        for cmd, code, tail in suite:
            print("     suite exit=%d  %s  | %s" % (code, cmd, tail))
        if a.step == "red":
            (rep.ok if red else rep.warn)("red state: %d of %d command(s) fail" % (len(red), len(suite)))
        elif red:
            rep.bad("SUITE_RED", "%d of %d command(s) fail" % (len(red), len(suite)))
        else:
            rep.ok("suite green (%d command(s))" % len(suite))

    # 6. Gate
    if a.gate:
      for phase in phases:
        d = os.path.join(wt, "docs/phases", phase)
        req = GATE_ARTIFACTS
        missing = [x for x in req if not os.path.exists(os.path.join(d, x))]
        for x in missing:
            rep.bad("MISSING_ARTIFACT", "docs/phases/%s/%s" % (phase, x))
        if not missing:
            rep.ok("%s: required artifacts present (%d)" % (phase, len(req)))
        for name, f in (("review", "review/code-review.md"), ("qa", "qa-report.md")):
            v = verdict(os.path.join(d, f))
            if v == "PASS":
                rep.ok("%s: %s verdict: PASS" % (phase, name))
            else:
                rep.bad("VERDICT", "%s %s=%s" % (phase, name, v))

    print("RESULT " + ("FAIL" if rep.fail else "PASS"))
    return 1 if rep.fail else 0


if __name__ == "__main__":
    sys.exit(main())
