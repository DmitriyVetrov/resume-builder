"""Gate items of P00 (test plan 10.3). Outside the test_*.py pattern on purpose.

These tests are never skipped and never marked as expected failures. While the owner has not
answered, they are honestly red. They are not counted in the pass total of the main suite.
"""
import unittest

from p00_testkit import assert_clean, run


class GateP00(unittest.TestCase):
    def test_TC_P00_20_01_no_open_p00_blocking_conflict(self):
        assert_clean(self, run("TC-P00-20-01"))

    def test_TC_P00_25_01_owner_acceptance_recorded(self):
        assert_clean(self, run("TC-P00-25-01"))


if __name__ == "__main__":
    unittest.main()
