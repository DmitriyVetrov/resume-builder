"""Determinism, stdlib-only, read-only and no-skip tests (TC-P00-22-04 ... 22-08, TC-P00-20-03)."""
import ast
import os
import subprocess
import sys
import unittest
from pathlib import Path

import p00_checks as C
import p00_fixtures as F
from p00_repo import Repo, find_real_root
from p00_testkit import REAL

TESTS_DIR = Path(__file__).resolve().parent
ALL_KINDS = ("sources", "real", "gate")
FORBIDDEN_IMPORTS = {
    "socket", "ssl", "http", "urllib", "ftplib", "smtplib", "poplib", "imaplib", "xmlrpc",
    "asyncio", "random", "secrets", "uuid", "time", "datetime", "zoneinfo", "locale",
}
SUBPROCESS_ALLOWED = {"test_selftest_determinism.py", "test_real_common.py"}
SKIP_NAMES = {"skip", "skipIf", "skipUnless", "SkipTest", "expectedFailure"}
WRITE_ATTRS = {"write_text", "write_bytes", "mkdir", "unlink", "rmdir", "rename"}


def py_files():
    return sorted(p for p in TESTS_DIR.rglob("*.py") if "__pycache__" not in p.parts)


def parse(path):
    return ast.parse(path.read_text(encoding="utf-8"), filename=path.name)


def imported_top_modules(tree):
    mods = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods += [a.name.split(".")[0] for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            mods.append(node.module.split(".")[0])
    return mods


def identifier_names(tree):
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
        elif isinstance(node, ast.alias):
            names.add(node.name.split(".")[-1])
    return names


class Determinism(unittest.TestCase):
    def test_TC_P00_22_04_in_process_determinism(self):
        cases = [("valid fixture", lambda: F.fixture_repo())]
        cases += [(m.nf, (lambda nf=m.nf: F.mutated_repo(nf))) for m in F.CATALOGUE]
        for label, make in cases:
            repo_a, repo_b = make(), make()
            for tc in sorted(C.CHECKS):
                fn = C.CHECKS[tc][1]
                first, second = fn(repo_a), fn(repo_b)
                if first != second:
                    self.fail("%s / %s differs between two runs" % (label, tc))
                if first != sorted(first):
                    self.fail("%s / %s is not sorted" % (label, tc))

    def test_TC_P00_22_05_subprocess_determinism(self):
        root = find_real_root()
        cli = str(TESTS_DIR / "p00_cli.py")
        fixture = str(F.FIXTURE_ROOT)
        runs = [
            (["--root", fixture], 0),
            (["--root", fixture, "--mutation", "NF-11a"], 1),
        ]
        envs = [
            {"PYTHONHASHSEED": "0", "LC_ALL": "C.UTF-8", "PYTHONIOENCODING": "utf-8"},
            {"PYTHONHASHSEED": "1", "LC_ALL": "C", "PYTHONIOENCODING": "utf-8"},
        ]
        for args, want_rc in runs:
            outputs = []
            for extra in envs:
                env = dict(os.environ)
                env.update(extra)
                proc = subprocess.run(
                    [sys.executable, "-B", cli] + args, cwd=str(root), env=env, capture_output=True
                )
                self.assertEqual(proc.returncode, want_rc, "exit code for %s" % " ".join(args[2:]))
                outputs.append(proc.stdout)
            self.assertEqual(outputs[0], outputs[1], "stdout differs between environments")
            self.assertNotIn(str(root).encode("utf-8"), outputs[0], "absolute path in output")
            self.assertIn(b"SUMMARY checks=", outputs[0])

    def test_TC_P00_22_06_stdlib_only_offline_no_skips(self):
        self.assertTrue(hasattr(sys, "stdlib_module_names"), "Python >= 3.10 is required")
        local = {p.stem for p in py_files()}
        files = py_files()
        self.assertGreater(len(files), 10)
        for path in files:
            tree = parse(path)
            for mod in imported_top_modules(tree):
                with self.subTest(file=path.name, module=mod):
                    self.assertTrue(
                        mod in sys.stdlib_module_names or mod in local,
                        "%s imports non-standard module %s" % (path.name, mod),
                    )
                    self.assertNotIn(mod, FORBIDDEN_IMPORTS, "%s imports forbidden %s" % (path.name, mod))
                    if mod == "subprocess":
                        self.assertIn(path.name, SUBPROCESS_ALLOWED)
            bad = sorted(identifier_names(tree) & SKIP_NAMES)
            self.assertEqual(bad, [], "%s uses skip or expected-failure constructs" % path.name)

    def test_TC_P00_22_07_checks_are_read_only(self):
        for path in sorted(TESTS_DIR.glob("p00_*.py")):
            tree = parse(path)
            problems = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    fn = node.func
                    if isinstance(fn, ast.Name) and fn.id == "open":
                        mode = None
                        if len(node.args) > 1 and isinstance(node.args[1], ast.Constant):
                            mode = node.args[1].value
                        for kw in node.keywords:
                            if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                                mode = kw.value.value
                        if isinstance(mode, str) and any(c in mode for c in "wax+"):
                            problems.append("open() with mode " + mode)
                if isinstance(node, ast.Attribute):
                    if node.attr in WRITE_ATTRS:
                        problems.append("." + node.attr)
                    if node.attr == "replace" and isinstance(node.value, ast.Name) and node.value.id == "os":
                        problems.append("os.replace")
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    for name in imported_top_modules(ast.Module(body=[node], type_ignores=[])):
                        if name in ("shutil", "tempfile"):
                            problems.append("import " + name)
            self.assertEqual(problems, [], "%s writes to disk" % path.name)

    def test_TC_P00_22_08_findings_and_listings_are_sorted(self):
        for label, repo in (("real", REAL), ("fixture", F.fixture_repo())):
            for tc in sorted(C.CHECKS):
                result = C.CHECKS[tc][1](repo)
                self.assertEqual(result, sorted(result), "%s / %s" % (label, tc))
            listing = repo.list_files("docs/source")
            self.assertEqual(listing, sorted(listing))
            self.assertEqual(len(listing), len(set(listing)))

    def test_TC_P00_20_03_gate_logic_and_static_gate_module(self):
        valid = F.fixture_repo()
        self.assertEqual(C.CHECKS["TC-P00-20-01"][1](valid), [])
        self.assertEqual(C.CHECKS["TC-P00-20-02"][1](valid), [])
        bad_a = F.mutated_repo("NF-38a")
        self.assertIn("GATE_OPEN_BLOCKER", [f.code for f in C.CHECKS["TC-P00-20-01"][1](bad_a)])
        bad_b = F.mutated_repo("NF-38b")
        self.assertIn("BLOCKER_FLAG_RULE", [f.code for f in C.CHECKS["TC-P00-20-02"][1](bad_b)])
        # a missing conflict log is never a vacuous pass
        gone = Repo(F.FIXTURE_ROOT, {"docs/phases/P00/governance/source-conflict-log.md": None})
        self.assertIn("MISSING_FILE", [f.code for f in C.CHECKS["TC-P00-20-01"][1](gone)])
        gate = TESTS_DIR / "gate_p00.py"
        self.assertTrue(gate.is_file())
        tree = parse(gate)
        defined = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
        for needle in ("test_TC_P00_20_01", "test_TC_P00_25_01"):
            self.assertTrue(any(d.startswith(needle) for d in defined), needle + " is not defined")
        self.assertEqual(sorted(identifier_names(tree) & SKIP_NAMES), [])


if __name__ == "__main__":
    unittest.main()
