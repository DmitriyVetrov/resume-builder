"""Self-tests of the checks on synthetic fixtures (TC-P00-22-01 ... 22-03, plus catalogue coverage).

The valid fixture must produce zero findings; every mutation must make its target check report
the expected code. Together they prove that each check can both pass and fail.
"""
import re
import unittest
from pathlib import Path

import p00_checks as C
import p00_fixtures as F
from p00_repo import Repo
from p00_sources import Plan
from p00_testkit import REAL, assert_clean

TESTS_DIR = Path(__file__).resolve().parent
PLAN_NF_ROW = re.compile(r"^\| (NF-\d+[a-z]?) \|")
ALL_KINDS = ("sources", "real", "gate")


def plan_nf_rows():
    """Rows of the mutation catalogue in test-plan.md section 8.3: {nf: (cells0, line)}."""
    rows = {}
    for ln in (TESTS_DIR / "test-plan.md").read_text(encoding="utf-8").split("\n"):
        m = PLAN_NF_ROW.match(ln)
        if m:
            rows[m.group(1)] = ln
    return rows


def catalogue_ids_for(plan_id):
    return [m.nf for m in F.CATALOGUE if m.nf == plan_id or re.fullmatch(re.escape(plan_id) + "[a-z]", m.nf)]


class SelfChecks(unittest.TestCase):
    def test_TC_P00_22_01_valid_fixture_has_zero_findings_in_every_check(self):
        repo = F.fixture_repo()
        for tc in sorted(C.CHECKS):
            kind, fn = C.CHECKS[tc]
            with self.subTest(tc=tc, kind=kind):
                assert_clean(self, fn(repo))

    def test_TC_P00_22_02_every_mutation_fails_its_target_check(self):
        for mut in F.CATALOGUE:
            repo = F.mutated_repo(mut.nf)
            for tc, code, needle in mut.targets:
                with self.subTest(nf=mut.nf, tc=tc, code=code):
                    found = C.CHECKS[tc][1](repo)
                    if code is None:
                        self.assertEqual(found, [], "boundary mutation must pass:\n" + C.format_findings(found))
                        continue
                    hits = [
                        f for f in found
                        if f.code == code and (needle is None or needle in f.location + " " + f.detail)
                    ]
                    self.assertTrue(
                        hits,
                        "expected %s %s from %s, got:\n%s" % (code, needle, tc, C.format_findings(found)),
                    )

    def test_TC_P00_22_02_catalogue_covers_every_plan_mutation(self):
        rows = plan_nf_rows()
        self.assertGreater(len(rows), 100, "plan mutation table not parsed")
        for plan_id, line in sorted(rows.items()):
            with self.subTest(nf=plan_id):
                mine = catalogue_ids_for(plan_id)
                self.assertTrue(mine, "no catalogue entry for " + plan_id)
                codes_mine = {c for m in mine for _tc, c, _n in F.BY_NF[m].targets if c}
                tcs_mine = {t for m in mine for t, _c, _n in F.BY_NF[m].targets}
                expected = line.rsplit(" | ", 1)[-1]
                for code in re.findall(r"`([A-Z][A-Z_]+)`", expected):
                    self.assertIn(code, codes_mine, "%s: expected code %s not asserted" % (plan_id, code))
                for tc in re.findall(r"TC-P00-\d\d-\d\d", line):
                    self.assertIn(tc, tcs_mine, "%s: target %s not asserted" % (plan_id, tc))

    def test_TC_P00_22_02_ac22_negative_classes_each_have_a_mutation(self):
        rows = plan_nf_rows()
        classes = [nf for nf, ln in rows.items() if "**" in ln.split(" | ")[1]]
        ac = (TESTS_DIR.parent / "acceptance-criteria.md").read_text(encoding="utf-8")
        m = re.search(r"fail: (.*?)\. A minimal valid fixture", ac)
        self.assertIsNotNone(m, "AC-P00-22 class list not found")
        listed = [c.strip() for c in m.group(1).split(", ")]
        self.assertEqual(len(classes), len(listed), "AC-22 class count differs from the marked mutations")
        for nf in classes:
            self.assertTrue(catalogue_ids_for(nf), nf)

    def test_TC_P00_22_03_fixture_plan_formats_equal_real_plan_formats(self):
        real = Plan(REAL).formats()
        fixture = Plan(F.fixture_repo()).formats()
        self.assertEqual(real, fixture)
        self.assertEqual(Plan(REAL).errors, [])
        self.assertEqual(Plan(F.fixture_repo()).errors, [])

    def test_fixture_is_closed_under_discovery(self):
        repo = F.fixture_repo()
        self.assertTrue(repo.exists("docs/source/TECHNICAL-SPEC.md"))
        self.assertFalse(repo.exists("scripts/check-blueprint.py"))
        self.assertFalse(Repo(F.FIXTURE_ROOT).is_dir(".claude"))


if __name__ == "__main__":
    unittest.main()
