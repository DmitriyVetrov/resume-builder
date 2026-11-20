"""GOV-04 decision-owner register: TC-P00-14 ... TC-P00-17."""
import unittest

from p00_testkit import assert_clean, run


class RealGov04(unittest.TestCase):
    def test_TC_P00_14_01_required_id_set(self):
        assert_clean(self, run("TC-P00-14-01"))

    def test_TC_P00_14_02_mirrors_and_source_sections(self):
        assert_clean(self, run("TC-P00-14-02"))

    def test_TC_P00_15_01_decider(self):
        assert_clean(self, run("TC-P00-15-01"))

    def test_TC_P00_15_02_preparer(self):
        assert_clean(self, run("TC-P00-15-02"))

    def test_TC_P00_15_03_needed_by_and_deadline(self):
        assert_clean(self, run("TC-P00-15-03"))

    def test_TC_P00_15_04_release_blocker(self):
        assert_clean(self, run("TC-P00-15-04"))

    def test_TC_P00_15_05_assignment(self):
        assert_clean(self, run("TC-P00-15-05"))

    def test_TC_P00_16_01_deadline_anchors(self):
        assert_clean(self, run("TC-P00-16-01"))

    def test_TC_P00_17_01_status_unchanged(self):
        assert_clean(self, run("TC-P00-17-01"))

    def test_TC_P00_17_02_recommendation_prefix(self):
        assert_clean(self, run("TC-P00-17-02"))


if __name__ == "__main__":
    unittest.main()
