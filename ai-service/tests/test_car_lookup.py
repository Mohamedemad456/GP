import unittest
from pathlib import Path

from app.services.car_lookup import CarSpecsLookup, extract_year


class TestCarLookup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        csv_path = repo_root / "ml-service" / "data" / "lookups" / "AI_lookup.csv"
        aliases_path = repo_root / "ai-service" / "data" / "lookups" / "car_aliases.yaml"
        notes_path = repo_root / "ai-service" / "data" / "egypt_market_notes.yaml"

        cls.lookup = CarSpecsLookup(
            csv_path=csv_path,
            aliases_yaml_path=aliases_path,
            egypt_market_notes_yaml_path=notes_path,
        )
        cls.lookup.load()

    def test_extract_year(self):
        self.assertEqual(extract_year("سيراتو 2019"), 2019)
        self.assertEqual(extract_year("Kia Cerato 2020 specs"), 2020)
        self.assertIsNone(extract_year("Cerato"))

    def test_extract_mention_arabic_model_only(self):
        mention = self.lookup.extract_mention("ايه مواصفات سيراتو 2019؟")
        self.assertIsNotNone(mention)
        assert mention is not None
        self.assertEqual(mention.model.lower(), "cerato")
        self.assertEqual(mention.year, 2019)

    def test_extract_mention_arabic_alias(self):
        mention = self.lookup.extract_mention("عايز اعرف عن التوسان")
        self.assertIsNotNone(mention)
        assert mention is not None
        self.assertEqual(mention.model.lower(), "tucson")

    def test_search_filters(self):
        filters = self.lookup.parse_filters("عايز عربيات اوتوماتيك قبل 2015")
        self.assertEqual(filters.transmission, "Automatic")
        self.assertEqual(filters.year_max, 2015)

        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        self.assertGreaterEqual(len(summaries), 1)

    def test_egypt_notes_load(self):
        note = self.lookup.get_egypt_note("Toyota", "Corolla")
        self.assertIsNotNone(note)
        assert note is not None
        self.assertGreater(len(note.strip()), 10)

    def test_is_search_query_no_false_positive_on_moshkela(self):
        # Regression: "كل" must not match inside "مشكلة".
        self.assertFalse(self.lookup.is_search_query("عندي مشكلة في الفتيس"))

    def test_parse_filters_dsg_is_automatic(self):
        filters = self.lookup.parse_filters("عايز عربيات DSG")
        self.assertEqual(filters.transmission, "Automatic")


if __name__ == "__main__":
    unittest.main()
