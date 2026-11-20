"""Common checks against the real repository: TC-P00-01-*, TC-P00-21-01, TC-P00-23-*."""
import subprocess
import sys
import unittest

from p00_repo import find_real_root
from p00_testkit import assert_clean, run


class RealCommon(unittest.TestCase):
    def test_TC_P00_01_01_architect_artifacts(self):
        assert_clean(self, run("TC-P00-01-01"))

    def test_TC_P00_01_02_gov_files_structure(self):
        assert_clean(self, run("TC-P00-01-02"))

    def test_TC_P00_01_03_no_placeholder_tokens_in_gov_files(self):
        assert_clean(self, run("TC-P00-01-03"))

    def test_TC_P00_21_01_blueprint_structure_check(self):
        root = find_real_root()
        proc = subprocess.run(
            [sys.executable, "-B", "scripts/check-blueprint.py"],
            cwd=str(root),
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        self.assertEqual(proc.returncode, 0, "check-blueprint exit code %d" % proc.returncode)
        self.assertIn("Blueprint structure OK", proc.stdout)

    def test_TC_P00_23_01_no_pii_in_gov_files(self):
        assert_clean(self, run("TC-P00-23-01"))

    def test_TC_P00_23_02_no_pii_in_any_p00_markdown(self):
        assert_clean(self, run("TC-P00-23-02"))


if __name__ == "__main__":
    unittest.main()
