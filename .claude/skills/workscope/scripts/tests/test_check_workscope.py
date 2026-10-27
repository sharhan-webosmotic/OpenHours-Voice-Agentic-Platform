"""Unit tests for check_workscope.py. Run: python3 -m unittest discover -s scripts/tests"""
import contextlib
import importlib.util
import io
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
_SPEC = importlib.util.spec_from_file_location("check_workscope", HERE.parent / "check_workscope.py")
check_workscope = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(check_workscope)

FIXTURE = HERE / "fixture_workscope.md"
ESTIMATE = HERE / "fixture_estimate.json"
ESTIMATE_V61 = HERE / "fixture_estimate_v61.json"


def run(*args):
    """Run the checker's main() and return (exit code, printed lines)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = check_workscope.main([str(a) for a in args])
    return code, buf.getvalue().splitlines()


class CheckWorkscopeTest(unittest.TestCase):
    """Formatting checks and the estimate cross-check on the bundled fixture."""

    def test_missing_acceptance_line_fails(self):
        """Milestone 2 has no Accepted when line, so the run fails on exactly that."""
        code, lines = run(FIXTURE)
        fails = [l for l in lines if l.startswith("FAIL")]
        self.assertEqual(code, 1)
        self.assertEqual(len(fails), 1)
        self.assertIn("Milestone 2: Launch", fails[0])

    def test_estimate_mismatches_are_review_only(self):
        """The estimate adds REVIEW lines but does not change the exit code."""
        code, lines = run(FIXTURE, "--estimate", ESTIMATE)
        reviews = [l for l in lines if l.startswith("REVIEW")]
        self.assertEqual(code, 1)
        joined = "\n".join(reviews)
        self.assertIn("'Loyalty Wallet' matches only non-Included", joined)
        self.assertIn("F03 'Push notifications' does not appear in Section 3", joined)
        self.assertIn("Excluded feature F04 'Loyalty wallet' is promised in Section 3", joined)
        self.assertNotIn("F05", joined)
        self.assertEqual(len(reviews), 3)

    def test_fixture_layout_is_clean(self):
        """The fixture carries closing: and a standalone \\newpage before # 5., so no layout line prints."""
        _, lines = run(FIXTURE)
        self.assertFalse([l for l in lines if "layout" in l])

    def test_layout_reminders_are_warn_only(self):
        """Missing closing:, a body THANK YOU line and a missing \\newpage only WARN."""
        text = FIXTURE.read_text(encoding="utf-8")
        text = text.replace('closing: "THANK YOU"\n', "").replace("\\newpage\n\n# 5.", "# 5.")
        text += "\n**THANK YOU**\n"
        fails, warns, _ = check_workscope.scan(text, False)
        self.assertEqual(len(fails), 1)
        joined = "\n".join(warns)
        self.assertIn("no 'closing:' key", joined)
        self.assertIn("before '# 5.'", joined)
        self.assertIn("closing line belongs in the frontmatter", joined)

    def test_inline_page_break_fails(self):
        """A \\newpage that shares its line with text prints literally, so it is a FAIL."""
        text = FIXTURE.read_text(encoding="utf-8").replace("\\newpage\n\n# 5.", "Next page \\newpage\n\n# 5.")
        fails, _, _ = check_workscope.scan(text, False)
        self.assertTrue(any("page-break token inside a line" in f for f in fails))

    def test_normalize_and_match(self):
        """Names compare without case, punctuation or parenthesised qualifiers."""
        self.assertEqual(check_workscope.normalize("Booking & Payments (Phase 2)"), "booking and payments")
        self.assertTrue(check_workscope.names_match("online payments", "online payments and refunds"))
        self.assertFalse(check_workscope.names_match("wallet", "loyalty wallet"))


class BallparkVariantTest(unittest.TestCase):
    """Ballpark rules and the release-aware estimate cross-check (workscope 3.0.0)."""

    def test_case_a_full_quote_passes(self):
        """Case A: one Full scope release, no future phases, clean."""
        code, lines = run(HERE / "fixture_ballpark_case_a.md")
        self.assertEqual(code, 0)
        self.assertEqual(lines, ["check_workscope (ballpark): PASS"])

    def test_case_b_client_mvp_passes(self):
        """Case B: client-named MVP plus two tentative phases, clean."""
        code, lines = run(HERE / "fixture_ballpark_case_b.md")
        self.assertEqual(code, 0)
        self.assertEqual(lines, ["check_workscope (ballpark): PASS"])

    def test_case_c_mvp_first_matches_estimate(self):
        """Case C: MVP features match Committed milestones, the phase matches Tentative ones."""
        code, lines = run(HERE / "fixture_ballpark_case_c.md", "--estimate", ESTIMATE_V61)
        self.assertEqual(code, 0)
        self.assertEqual(lines, ["check_workscope (ballpark): PASS, 0 REVIEW"])

    def test_variant_read_from_frontmatter(self):
        """The frontmatter variant: key selects the ballpark rules without a flag."""
        text = (HERE / "fixture_ballpark_case_c.md").read_text(encoding="utf-8")
        self.assertEqual(check_workscope.frontmatter_value(text, "variant"), "ballpark")

    def test_flag_overrides_frontmatter(self):
        """--variant final on a ballpark file warns and applies the final rules."""
        _, lines = run(HERE / "fixture_ballpark_case_a.md", "--variant", "final")
        self.assertTrue(any("overrides frontmatter" in l for l in lines))
        self.assertTrue(lines[-1].startswith("check_workscope (final)"))

    def test_bad_ballpark_rules(self):
        """Payment table, risks section and missing note FAIL, tech question and untagged phase WARN."""
        code, lines = run(HERE / "fixture_ballpark_bad.md")
        fails = [l for l in lines if l.startswith("FAIL")]
        warns = chr(10).join(l for l in lines if l.startswith("WARN"))
        self.assertEqual(code, 1)
        self.assertEqual(len(fails), 3)
        self.assertTrue(any("payment table" in f for f in fails))
        self.assertTrue(any("Technical Challenges" in f for f in fails))
        self.assertTrue(any("ballpark note is missing" in f for f in fails))
        self.assertIn("names build technology", warns)
        self.assertIn("flutter", warns)
        self.assertIn("'Phase 2: Loyalty' carries no tentative label", warns)

    def test_conflicting_pair_reports_release_mismatches(self):
        """A ballpark and an estimate that disagree on releases produce REVIEW lines only."""
        code, lines = run(HERE / "fixture_ballpark_conflict.md", "--estimate", ESTIMATE_V61)
        reviews = chr(10).join(l for l in lines if l.startswith("REVIEW"))
        self.assertEqual(code, 0)
        self.assertIn("'Shared Notes' sits in a Tentative milestone", reviews)
        self.assertIn("'Teacher View' sits in a Committed milestone", reviews)
        self.assertIn("Tentative feature F04 'Shared notes' is promised in the MVP block", reviews)
        self.assertIn("committed figure of 125 hours includes tentative hours", reviews)
        self.assertNotIn("F05", reviews)

    def test_final_with_priced_future_phase(self):
        """Final variant: Section 3 committed, Section 10 phase block tentative, both match the estimate."""
        code, lines = run(HERE / "fixture_final_releases.md", "--estimate", ESTIMATE_V61)
        self.assertEqual(code, 0)
        self.assertEqual(lines, ["check_workscope (final): PASS, 0 REVIEW"])

    def test_defaulted_commitment_is_reviewed(self):
        """A milestone without commitment, next to ones that carry it, is reported as defaulted."""
        import json
        import tempfile
        data = json.loads(ESTIMATE_V61.read_text(encoding="utf-8"))
        del data["milestones"][1]["commitment"]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "est.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            _, lines = run(HERE / "fixture_ballpark_case_c.md", "--estimate", path)
        self.assertTrue(any("milestone M2 has no release or commitment" in l for l in lines))

    def test_hour_sums_split_by_commitment(self):
        """Committed and Tentative task hours are summed apart, Deferred features are not counted."""
        data = __import__("json").loads(ESTIMATE_V61.read_text(encoding="utf-8"))
        commitment = {m["id"]: m["commitment"] for m in data["milestones"]}
        sums = check_workscope.hour_sums(data, commitment)
        self.assertEqual(sums["Committed"][:2], [70.0, 90.0])
        self.assertEqual(sums["Tentative"][:2], [25.0, 35.0])


if __name__ == "__main__":
    unittest.main()
