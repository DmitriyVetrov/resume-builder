"""GOV-01 source inventory: TC-P00-02 ... TC-P00-06."""
import unittest

from p00_testkit import assert_clean, run


class RealGov01(unittest.TestCase):
    def test_TC_P00_02_01_inventory_completeness(self):
        assert_clean(self, run("TC-P00-02-01"))

    def test_TC_P00_03_01_inventory_integrity(self):
        assert_clean(self, run("TC-P00-03-01"))

    def test_TC_P00_04_01_classification_vocabularies(self):
        assert_clean(self, run("TC-P00-04-01"))

    def test_TC_P00_04_02_authority_rules(self):
        assert_clean(self, run("TC-P00-04-02"))

    def test_TC_P00_04_03_baseline_block(self):
        assert_clean(self, run("TC-P00-04-03"))

    def test_TC_P00_05_02_source_references_resolve(self):
        assert_clean(self, run("TC-P00-05-02"))

    def test_TC_P00_06_01_id_census(self):
        assert_clean(self, run("TC-P00-06-01"))


if __name__ == "__main__":
    unittest.main()
