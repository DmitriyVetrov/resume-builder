"""GOV-03 exclusion register: TC-P00-12."""
import unittest

from p00_testkit import assert_clean, run


class RealGov03(unittest.TestCase):
    def test_TC_P00_12_01_exclusion_id_set(self):
        assert_clean(self, run("TC-P00-12-01"))

    def test_TC_P00_12_02_status_and_linked_decision(self):
        assert_clean(self, run("TC-P00-12-02"))

    def test_TC_P00_12_03_source_section_guard_boundary(self):
        assert_clean(self, run("TC-P00-12-03"))

    def test_TC_P00_12_04_w_ids_guarded_in_matrix(self):
        assert_clean(self, run("TC-P00-12-04"))

    def test_TC_P00_12_05_implied_exclusions(self):
        assert_clean(self, run("TC-P00-12-05"))


if __name__ == "__main__":
    unittest.main()
