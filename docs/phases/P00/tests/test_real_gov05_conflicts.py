"""GOV-05 source-conflict log: TC-P00-18, TC-P00-19, TC-P00-20-02."""
import unittest

from p00_testkit import assert_clean, run


class RealGov05(unittest.TestCase):
    def test_TC_P00_18_01_sequential_ids(self):
        assert_clean(self, run("TC-P00-18-01"))

    def test_TC_P00_18_02_vocabularies(self):
        assert_clean(self, run("TC-P00-18-02"))

    def test_TC_P00_18_03_citations(self):
        assert_clean(self, run("TC-P00-18-03"))

    def test_TC_P00_18_04_affected_ids(self):
        assert_clean(self, run("TC-P00-18-04"))

    def test_TC_P00_18_05_status_rules(self):
        assert_clean(self, run("TC-P00-18-05"))

    def test_TC_P00_18_06_open_row_ownership(self):
        assert_clean(self, run("TC-P00-18-06"))

    def test_TC_P00_19_01_seeds_recorded(self):
        assert_clean(self, run("TC-P00-19-01"))

    def test_TC_P00_20_02_anti_bypass_blocker_flag(self):
        assert_clean(self, run("TC-P00-20-02"))


if __name__ == "__main__":
    unittest.main()
