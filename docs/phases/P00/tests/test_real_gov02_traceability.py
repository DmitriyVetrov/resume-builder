"""GOV-02 requirement traceability: TC-P00-07 ... TC-P00-11."""
import unittest

from p00_testkit import assert_clean, run


class RealGov02(unittest.TestCase):
    def test_TC_P00_07_01_requirement_set_equality(self):
        assert_clean(self, run("TC-P00-07-01"))

    def test_TC_P00_08_01_priority_and_section(self):
        assert_clean(self, run("TC-P00-08-01"))

    def test_TC_P00_08_02_phases_and_primary_phase(self):
        assert_clean(self, run("TC-P00-08-02"))

    def test_TC_P00_08_03_verification_vocabulary_and_guard(self):
        assert_clean(self, run("TC-P00-08-03"))

    def test_TC_P00_08_04_summary_length(self):
        assert_clean(self, run("TC-P00-08-04"))

    def test_TC_P00_09_01_decision_deps_complete(self):
        assert_clean(self, run("TC-P00-09-01"))

    def test_TC_P00_09_02_decision_deps_valid_ids(self):
        assert_clean(self, run("TC-P00-09-02"))

    def test_TC_P00_10_01_phase_anchors(self):
        assert_clean(self, run("TC-P00-10-01"))

    def test_TC_P00_10_02_traceability_group_intersections(self):
        assert_clean(self, run("TC-P00-10-02"))

    def test_TC_P00_10_03_deviation_references(self):
        assert_clean(self, run("TC-P00-10-03"))

    def test_TC_P00_11_01_pagination_rules(self):
        assert_clean(self, run("TC-P00-11-01"))

    def test_TC_P00_11_02_normative_content_table(self):
        assert_clean(self, run("TC-P00-11-02"))


if __name__ == "__main__":
    unittest.main()
