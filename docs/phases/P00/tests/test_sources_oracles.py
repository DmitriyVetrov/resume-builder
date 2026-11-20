"""Source sanity tests (green in every state). A failure here is a stop condition, not a red test."""
import unittest

import p00_checks as C
from p00_testkit import REAL, assert_clean, run


class SourceOracles(unittest.TestCase):
    def test_TC_P00_S_01_spec_sanity(self):
        assert_clean(self, run("TC-P00-S-01"))

    def test_TC_P00_S_02_format_constants_provenance(self):
        assert_clean(self, C.provenance_check(REAL))

    def test_TC_P00_01_04_plan_format_parse(self):
        assert_clean(self, run("TC-P00-01-04"))

    def test_TC_P00_04_04_spec_header_cells(self):
        assert_clean(self, run("TC-P00-04-04"))

    def test_TC_P00_05_01_reference_extractors_find_every_kind(self):
        from p00_sources import get_spec

        spec = get_spec(REAL)
        counts = {}
        for r in spec.refs:
            counts[r.kind] = counts.get(r.kind, 0) + 1
        print("reference counts: " + ", ".join("%s=%d" % (k, counts[k]) for k in sorted(counts)))
        assert_clean(self, run("TC-P00-05-01"))

    def test_TC_P00_10_04_anchor_provenance(self):
        assert_clean(self, run("TC-P00-10-04"))

    def test_TC_P00_11_03_normative_prefixes_are_spec_sections(self):
        assert_clean(self, run("TC-P00-11-03"))

    def test_TC_P00_14_03_snapshot_equals_required_set(self):
        assert_clean(self, run("TC-P00-14-03"))

    def test_TC_P00_14_04_register_sanity(self):
        assert_clean(self, run("TC-P00-14-04"))

    def test_TC_P00_16_02_deadline_anchor_provenance(self):
        for ids in C.no_quote_anchors(REAL):
            print("NO_QUOTE: " + ids)
        assert_clean(self, run("TC-P00-16-02"))

    def test_TC_P00_19_02_seed_format(self):
        assert_clean(self, run("TC-P00-19-02"))


if __name__ == "__main__":
    unittest.main()
