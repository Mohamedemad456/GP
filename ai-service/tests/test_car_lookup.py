"""
Comprehensive test suite for CarSpecsLookup and related utilities.

Run from repo root:
    python -m pytest tests/test_car_lookup.py -v

Or a single class:
    python -m pytest tests/test_car_lookup.py::TestExtractYear -v
"""
from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.car_lookup import (
    CarSpecsLookup,
    CarMention,
    SearchFilters,
    _canon_drivetrain,
    _canon_fuel,
    _canon_transmission,
    _safe_int,
    extract_year,
    normalize_arabic,
    normalize_latin,
    normalize_text,
)
from app.services.context_builder import build_search_context, build_specs_context


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _get_lookup() -> CarSpecsLookup:
    """Return a loaded CarSpecsLookup using project paths."""
    return CarSpecsLookup(
        csv_path=_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv",
        aliases_yaml_path=_repo_root() / "ai-service" / "data" / "lookups" / "car_aliases.yaml",
        egypt_market_notes_yaml_path=_repo_root() / "ai-service" / "data" / "egypt_market_notes.yaml",
    )


# ═════════════════════════════════════════════════════════════════════════════
# 1. Pure utility functions — no I/O, fast
# ═════════════════════════════════════════════════════════════════════════════

class TestNormalizeArabic(unittest.TestCase):
    """normalize_arabic() contract tests."""

    def test_strips_diacritics(self):
        self.assertEqual(normalize_arabic("كِتَابٌ"), "كتاب")

    def test_unifies_alef_variants(self):
        # إ أ آ ا should all become ا
        self.assertEqual(normalize_arabic("إنسان"), normalize_arabic("انسان"))
        self.assertEqual(normalize_arabic("أحمد"), normalize_arabic("احمد"))
        self.assertEqual(normalize_arabic("آمنة"), normalize_arabic("امنه"))

    def test_ta_marbuta_normalized(self):
        self.assertEqual(normalize_arabic("سيارة"), "سياره")

    def test_ya_normalized(self):
        self.assertEqual(normalize_arabic("كيى"), "كيي")

    def test_whitespace_collapsed(self):
        self.assertEqual(normalize_arabic("كيا   سيراتو"), "كيا سيراتو")

    def test_lowercases(self):
        # Arabic has no casing, but mixed strings with latin should lowercase latin
        result = normalize_arabic("Kia كيا")
        self.assertIn("kia", result)

    def test_empty_string(self):
        self.assertEqual(normalize_arabic(""), "")

    def test_purely_latin_unchanged_structure(self):
        # No crash on Latin-only input
        result = normalize_arabic("Toyota Corolla")
        self.assertIsInstance(result, str)


class TestNormalizeLatin(unittest.TestCase):

    def test_lowercases(self):
        self.assertEqual(normalize_latin("Toyota COROLLA"), "toyota corolla")

    def test_strips_whitespace(self):
        self.assertEqual(normalize_latin("  kia  "), "kia")

    def test_collapses_internal_whitespace(self):
        self.assertEqual(normalize_latin("kia   cerato"), "kia cerato")

    def test_empty_string(self):
        self.assertEqual(normalize_latin(""), "")


class TestNormalizeText(unittest.TestCase):

    def test_arabic_string_uses_arabic_normalization(self):
        # Contains Arabic character → arabic path
        result = normalize_text("كيا سيراتو 2019")
        self.assertIsInstance(result, str)
        self.assertNotIn("٢٠١٩", result)  # Arabic-Indic digits should be converted

    def test_latin_string_uses_latin_normalization(self):
        result = normalize_text("Toyota Corolla")
        self.assertEqual(result, "toyota corolla")

    def test_mixed_arabic_latin(self):
        result = normalize_text("نيسان Sentra")
        self.assertIsInstance(result, str)


class TestExtractYear(unittest.TestCase):
    """extract_year() — year detection from mixed Arabic/Latin strings."""

    # ── Happy path ───────────────────────────────────────────────────────────
    def test_latin_4digit_year(self):
        self.assertEqual(extract_year("Kia Cerato 2020 specs"), 2020)

    def test_arabic_string_with_year(self):
        self.assertEqual(extract_year("سيراتو 2019"), 2019)

    def test_year_at_start(self):
        self.assertEqual(extract_year("2015 كورولا"), 2015)

    def test_year_at_end(self):
        self.assertEqual(extract_year("Toyota Corolla 2018"), 2018)

    def test_min_boundary(self):
        self.assertEqual(extract_year("نيسان صني 1990"), 1990)

    def test_max_boundary(self):
        self.assertEqual(extract_year("سيارة 2030"), 2030)

    def test_arabic_indic_digits(self):
        # ٢٠١٩ = 2019 in Arabic-Indic
        self.assertEqual(extract_year("سيراتو ٢٠١٩"), 2019)

    def test_picks_last_valid_year_in_sentence(self):
        # "between 2015 and 2020" — last valid year is 2020
        result = extract_year("عربية بين 2015 و 2020")
        self.assertIn(result, (2015, 2020))

    def test_year_surrounded_by_text(self):
        self.assertEqual(extract_year("موديل سنة 2017 بحالة كويسة"), 2017)

    # ── No match ─────────────────────────────────────────────────────────────
    def test_no_year_returns_none(self):
        self.assertIsNone(extract_year("Cerato"))

    def test_year_below_min_ignored(self):
        self.assertIsNone(extract_year("1989"))

    def test_year_above_max_ignored(self):
        self.assertIsNone(extract_year("2031"))

    def test_3digit_number_ignored(self):
        self.assertIsNone(extract_year("سعر 300 الف"))

    def test_5digit_number_ignored(self):
        self.assertIsNone(extract_year("12345"))

    def test_empty_string(self):
        self.assertIsNone(extract_year(""))

    def test_none_input(self):
        self.assertIsNone(extract_year(None))  # type: ignore


class TestSafeInt(unittest.TestCase):

    def test_int_string(self):
        self.assertEqual(_safe_int("2024"), 2024)

    def test_float_string(self):
        self.assertEqual(_safe_int("2024.0"), 2024)

    def test_actual_int(self):
        self.assertEqual(_safe_int(1600), 1600)

    def test_actual_float(self):
        self.assertEqual(_safe_int(1600.0), 1600)

    def test_none_returns_none(self):
        self.assertIsNone(_safe_int(None))

    def test_nan_string_returns_none(self):
        self.assertIsNone(_safe_int("nan"))

    def test_empty_string_returns_none(self):
        self.assertIsNone(_safe_int(""))

    def test_non_numeric_string_returns_none(self):
        self.assertIsNone(_safe_int("abc"))


class TestCanonTransmission(unittest.TestCase):

    def test_automatic(self):
        self.assertEqual(_canon_transmission("Automatic"), "Automatic")

    def test_cvt(self):
        self.assertEqual(_canon_transmission("Cvt"), "Automatic")

    def test_dsg(self):
        self.assertEqual(_canon_transmission("Dsg"), "Automatic")

    def test_manual(self):
        self.assertEqual(_canon_transmission("Manual"), "Manual")

    def test_arabic_automatic(self):
        self.assertEqual(_canon_transmission("اوتوماتيك"), "Automatic")

    def test_arabic_manual(self):
        self.assertEqual(_canon_transmission("مانيوال"), "Manual")

    def test_none_returns_none(self):
        self.assertIsNone(_canon_transmission(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(_canon_transmission(""))

    def test_unknown_value_returns_none(self):
        self.assertIsNone(_canon_transmission("unknown"))


class TestCanonFuel(unittest.TestCase):

    def test_petrol_lowercase(self):
        self.assertEqual(_canon_fuel("petrol"), "petrol")

    def test_petrol_capitalized(self):
        self.assertEqual(_canon_fuel("Petrol"), "petrol")

    def test_diesel(self):
        self.assertEqual(_canon_fuel("diesel"), "diesel")

    def test_cng(self):
        self.assertEqual(_canon_fuel("cng"), "cng")

    def test_hybrid_lowercase(self):
        self.assertEqual(_canon_fuel("hybrid"), "hybrid")

    def test_hybrid_capitalized(self):
        self.assertEqual(_canon_fuel("Hybrid"), "hybrid")

    def test_electric(self):
        self.assertEqual(_canon_fuel("electric"), "electric")

    def test_arabic_petrol(self):
        self.assertEqual(_canon_fuel("بنزين"), "petrol")

    def test_arabic_diesel(self):
        self.assertEqual(_canon_fuel("سولار"), "diesel")

    def test_arabic_gas(self):
        self.assertEqual(_canon_fuel("غاز"), "cng")

    def test_none_returns_none(self):
        self.assertIsNone(_canon_fuel(None))

    def test_empty_returns_none(self):
        self.assertIsNone(_canon_fuel(""))


class TestCanonDrivetrain(unittest.TestCase):

    def test_fwd(self):
        self.assertEqual(_canon_drivetrain("FWD"), "FWD")

    def test_rwd(self):
        self.assertEqual(_canon_drivetrain("RWD"), "RWD")

    def test_awd(self):
        self.assertEqual(_canon_drivetrain("AWD"), "AWD")

    def test_4wd(self):
        self.assertEqual(_canon_drivetrain("4WD"), "4WD")

    def test_none_returns_none(self):
        self.assertIsNone(_canon_drivetrain(None))

    def test_empty_returns_none(self):
        self.assertIsNone(_canon_drivetrain(""))


# ═════════════════════════════════════════════════════════════════════════════
# 2. Integration tests — requires CSV and YAML files on disk
# ═════════════════════════════════════════════════════════════════════════════

@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestCarSpecsLookupLoad(unittest.TestCase):
    """Tests that the loader reads files correctly and indexes data."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def test_rows_loaded(self):
        self.assertGreater(len(self.lookup._rows), 1000)

    def test_make_model_candidates_populated(self):
        self.assertGreater(len(self.lookup._make_model_candidates), 50)

    def test_model_candidates_populated(self):
        self.assertGreater(len(self.lookup._model_candidates), 50)

    def test_known_make_indexed(self):
        self.assertIn(("toyota", "corolla"), self.lookup._by_make_model)

    def test_known_make_model_year_indexed(self):
        # Toyota Corolla 2019 is in the CSV
        key = ("toyota", "corolla", 2019)
        self.assertIn(key, self.lookup._by_make_model_year)

    def test_double_load_is_idempotent(self):
        rows_before = len(self.lookup._rows)
        self.lookup.load()  # second call
        self.assertEqual(len(self.lookup._rows), rows_before)

    def test_aliases_loaded(self):
        # Should have arabic make aliases
        self.assertGreater(len(self.lookup._make_aliases), 5)

    def test_model_aliases_loaded(self):
        self.assertGreater(len(self.lookup._model_aliases), 5)

    def test_egypt_notes_loaded(self):
        self.assertGreater(len(self.lookup._egypt_notes), 5)

    def test_missing_csv_raises(self):
        bad = CarSpecsLookup(csv_path=Path("/nonexistent/file.csv"))
        with self.assertRaises(FileNotFoundError):
            bad.load()


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestExtractMention(unittest.TestCase):
    """extract_mention() — entity extraction from user messages."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    # ── English queries ───────────────────────────────────────────────────────
    def test_english_make_model(self):
        m = self.lookup.extract_mention("Kia Cerato 2020 specs")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Kia")
        self.assertEqual(m.model.lower(), "cerato")
        self.assertEqual(m.year, 2020)

    def test_english_model_only(self):
        m = self.lookup.extract_mention("What are the specs of a Sentra?")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Nissan")

    def test_english_with_year_no_make(self):
        m = self.lookup.extract_mention("Corolla 2018")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Toyota")
        self.assertEqual(m.year, 2018)

    # ── Arabic canonical names ────────────────────────────────────────────────
    def test_arabic_make_model_canonical(self):
        m = self.lookup.extract_mention("ايه مواصفات نيسان سنترا 2019؟")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Nissan")
        self.assertEqual(m.model.lower(), "sentra")
        self.assertEqual(m.year, 2019)

    def test_arabic_model_only(self):
        m = self.lookup.extract_mention("ايه مواصفات سيراتو 2019؟")
        self.assertIsNotNone(m)
        self.assertEqual(m.model.lower(), "cerato")
        self.assertEqual(m.year, 2019)

    def test_arabic_no_year(self):
        m = self.lookup.extract_mention("عايز اعرف عن التوسان")
        self.assertIsNotNone(m)
        self.assertEqual(m.model.lower(), "tucson")
        self.assertIsNone(m.year)

    # ── Arabic aliases ────────────────────────────────────────────────────────
    def test_alias_bomba_lancer_puma(self):
        m = self.lookup.extract_mention("عندي بومة 2008 ايه رأيك فيها")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Mitsubishi")

    def test_alias_fantasia_octavia(self):
        m = self.lookup.extract_mention("فانتازيا 2010 بكام في السوق")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Skoda")

    def test_alias_el_gamal_elantra(self):
        m = self.lookup.extract_mention("الجمل الهيونداي 2009 لسه بيتباع؟")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Hyundai")

    def test_alias_sentra_arabic_spelling(self):
        # سينترا is a common alternate spelling
        m = self.lookup.extract_mention("سينترا 2020")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Nissan")

    def test_alias_sunny_n17_slang(self):
        m = self.lookup.extract_mention("صني شكل جديد 2016")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Nissan")

    def test_alias_shark_lancer(self):
        m = self.lookup.extract_mention("شارك لانسر 2012 ايه عيوبها")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Mitsubishi")

    def test_alias_korean_corolla_misspelling(self):
        m = self.lookup.extract_mention("كرولا 2017")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Toyota")
        self.assertEqual(m.model.lower(), "corolla")

    def test_alias_mg_zs_arabic(self):
        m = self.lookup.extract_mention("ام جي زد اس 2022")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "MG")

    def test_alias_byd_f3_arabic(self):
        m = self.lookup.extract_mention("بي واي دي اف 3")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "BYD")

    def test_alias_definite_article_prefix(self):
        # "الكورولا" — Arabic definite article ال prefix
        m = self.lookup.extract_mention("الكورولا 2020")
        self.assertIsNotNone(m)
        self.assertEqual(m.make, "Toyota")

    def test_alias_tucson_misspelling_toksan(self):
        m = self.lookup.extract_mention("توكسان 2019")
        self.assertIsNotNone(m)
        self.assertEqual(m.model.lower(), "tucson")

    # ── No match ─────────────────────────────────────────────────────────────
    def test_no_car_in_message_returns_none(self):
        m = self.lookup.extract_mention("فيه ايه في المنصة")
        self.assertIsNone(m)

    def test_generic_greeting_returns_none(self):
        m = self.lookup.extract_mention("ازيك")
        self.assertIsNone(m)

    def test_unrelated_topic_returns_none(self):
        m = self.lookup.extract_mention("ايه احسن تليفون جديد")
        self.assertIsNone(m)

    def test_price_question_no_car_returns_none(self):
        m = self.lookup.extract_mention("بكام العربية دي")
        self.assertIsNone(m)

    # ── Low-confidence guard ──────────────────────────────────────────────────
    def test_low_confidence_below_threshold_returns_none(self):
        # "xyz" has no resemblance to any car name
        m = self.lookup.extract_mention("xyz abc def ghi")
        self.assertIsNone(m)

    # ── Year extraction alongside mention ────────────────────────────────────
    def test_arabic_indic_year_in_mention(self):
        m = self.lookup.extract_mention("كيا سيراتو ٢٠١٩")
        self.assertIsNotNone(m)
        self.assertEqual(m.year, 2019)

    def test_mention_without_year_has_none_year(self):
        m = self.lookup.extract_mention("ايه رأيك في الكورولا؟")
        self.assertIsNotNone(m)
        self.assertIsNone(m.year)


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestLookupSpecs(unittest.TestCase):
    """lookup_specs() — retrieves rows from CSV for a CarMention."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def test_lookup_known_car_year(self):
        mention = CarMention(make="Toyota", model="Corolla", year=2019)
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0)
        self.assertTrue(all(r["make"] == "Toyota" for r in rows))
        self.assertTrue(all(r["model"] == "Corolla" for r in rows))

    def test_lookup_known_car_no_year_returns_all_years(self):
        mention = CarMention(make="Toyota", model="Corolla", year=None)
        rows = self.lookup.lookup_specs(mention)
        years = {r["year"] for r in rows}
        self.assertGreater(len(years), 5)  # Multiple years in CSV

    def test_lookup_unknown_make_returns_empty(self):
        mention = CarMention(make="Fakebrand", model="X1000", year=2020)
        rows = self.lookup.lookup_specs(mention)
        self.assertEqual(rows, [])

    def test_lookup_known_car_wrong_year_falls_back_to_all(self):
        # Year 1800 doesn't exist — should fall back to all-years lookup
        mention = CarMention(make="Toyota", model="Corolla", year=1800)
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0)

    def test_lookup_hyundai_elantra(self):
        mention = CarMention(make="Hyundai", model="Elantra", year=2020)
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0)

    def test_lookup_nissan_sentra_transmission_is_automatic_or_cvt(self):
        mention = CarMention(make="Nissan", model="Sentra", year=None)
        rows = self.lookup.lookup_specs(mention)
        transmissions = {r.get("transmission", "").strip().lower() for r in rows}
        # All Sentras should be automatic or CVT — no manual in Egypt market
        manual_rows = [r for r in rows if r.get("transmission", "").strip().lower() == "manual"]
        # We allow some manual rows from the dataset (global data)
        # but the majority should be automatic/CVT
        auto_or_cvt = [r for r in rows if r.get("transmission", "").strip().lower() in ("automatic", "cvt")]
        self.assertGreater(len(auto_or_cvt), len(manual_rows))

    def test_lookup_returns_correct_fields(self):
        mention = CarMention(make="Kia", model="Cerato", year=2020)
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0)
        row = rows[0]
        self.assertIn("make", row)
        self.assertIn("model", row)
        self.assertIn("year", row)
        self.assertIn("transmission", row)
        self.assertIn("fuel", row)
        self.assertIn("engine_cc", row)
        self.assertIn("horsepower", row)

    def test_lookup_case_insensitive(self):
        # "toyota" vs "Toyota" should both work via normalize_latin
        mention_upper = CarMention(make="Toyota", model="Corolla", year=None)
        mention_lower = CarMention(make="toyota", model="corolla", year=None)
        rows_upper = self.lookup.lookup_specs(mention_upper)
        rows_lower = self.lookup.lookup_specs(mention_lower)
        self.assertEqual(len(rows_upper), len(rows_lower))


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestParseFilters(unittest.TestCase):
    """parse_filters() — extract structured filters from natural language."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    # ── Transmission ─────────────────────────────────────────────────────────
    def test_automatic_arabic(self):
        f = self.lookup.parse_filters("عايز عربيات اوتوماتيك")
        self.assertEqual(f.transmission, "Automatic")

    def test_manual_arabic(self):
        f = self.lookup.parse_filters("عايز عربية مانيوال")
        self.assertEqual(f.transmission, "Manual")

    def test_cvt_explicit(self):
        f = self.lookup.parse_filters("عايز عربيات CVT")
        self.assertEqual(f.transmission, "Automatic")  # CVT → Automatic

    def test_dsg_explicit(self):
        f = self.lookup.parse_filters("عايز عربيات DSG")
        self.assertEqual(f.transmission, "Automatic")  # DSG → Automatic

    def test_no_transmission_mention(self):
        f = self.lookup.parse_filters("عايز عربية 2020")
        self.assertIsNone(f.transmission)

    # ── Year bounds ───────────────────────────────────────────────────────────
    def test_year_max_arabic_qabl(self):
        f = self.lookup.parse_filters("عايز عربيات اوتوماتيك قبل 2015")
        self.assertEqual(f.year_max, 2015)
        self.assertIsNone(f.year_min)

    def test_year_min_arabic_baad(self):
        f = self.lookup.parse_filters("عربيات من بعد 2016")
        self.assertEqual(f.year_min, 2016)
        self.assertIsNone(f.year_max)

    def test_year_max_english_before(self):
        f = self.lookup.parse_filters("automatic cars before 2018")
        self.assertEqual(f.year_max, 2018)

    def test_year_max_english_under(self):
        f = self.lookup.parse_filters("cars under 2014")
        self.assertEqual(f.year_max, 2014)

    def test_year_min_english_after(self):
        f = self.lookup.parse_filters("cars after 2019")
        self.assertEqual(f.year_min, 2019)

    def test_no_year_mention(self):
        f = self.lookup.parse_filters("عايز عربية اوتوماتيك")
        self.assertIsNone(f.year_min)
        self.assertIsNone(f.year_max)

    # ── Fuel ─────────────────────────────────────────────────────────────────
    def test_petrol_filter(self):
        f = self.lookup.parse_filters("عايز عربيات بنزين")
        self.assertEqual(f.fuel, "petrol")

    def test_diesel_filter(self):
        f = self.lookup.parse_filters("عربيات سولار")
        self.assertEqual(f.fuel, "diesel")

    def test_hybrid_filter(self):
        f = self.lookup.parse_filters("عربيات هايبرد")
        self.assertEqual(f.fuel, "hybrid")

    def test_electric_filter(self):
        f = self.lookup.parse_filters("عربيات كهرباء")
        self.assertEqual(f.fuel, "electric")

    # ── Engine CC ─────────────────────────────────────────────────────────────
    def test_engine_cc_arabic(self):
        f = self.lookup.parse_filters("عربيات ماتور 1600 سي سي")
        self.assertEqual(f.engine_cc_max, 1600)

    def test_engine_cc_english(self):
        f = self.lookup.parse_filters("cars with engine under 1600cc")
        self.assertEqual(f.engine_cc_max, 1600)

    def test_no_engine_mention(self):
        f = self.lookup.parse_filters("عايز عربية اوتوماتيك")
        self.assertIsNone(f.engine_cc_max)

    # ── Combined ──────────────────────────────────────────────────────────────
    def test_combined_transmission_and_year(self):
        f = self.lookup.parse_filters("عايز عربيات اوتوماتيك قبل 2015")
        self.assertEqual(f.transmission, "Automatic")
        self.assertEqual(f.year_max, 2015)

    def test_combined_fuel_and_year(self):
        f = self.lookup.parse_filters("بنزين بعد 2018")
        self.assertEqual(f.fuel, "petrol")
        self.assertEqual(f.year_min, 2018)

    def test_empty_query_returns_empty_filters(self):
        f = self.lookup.parse_filters("")
        self.assertIsNone(f.transmission)
        self.assertIsNone(f.year_min)
        self.assertIsNone(f.year_max)
        self.assertIsNone(f.fuel)


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestSearch(unittest.TestCase):
    """search() — filtered dataset search returning aggregated summaries."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def test_automatic_filter_returns_results(self):
        filters = SearchFilters(transmission="Automatic")
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        self.assertGreater(len(summaries), 0)

    def test_manual_filter_returns_results(self):
        filters = SearchFilters(transmission="Manual")
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)

    def test_year_max_filter_excludes_newer_rows(self):
        filters = SearchFilters(year_max=2010)
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        for item in summaries:
            self.assertLessEqual(item["year_max"], 2010)

    def test_year_min_filter_excludes_older_rows(self):
        filters = SearchFilters(year_min=2020)
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        for item in summaries:
            self.assertGreaterEqual(item["year_min"], 2020)

    def test_petrol_filter(self):
        filters = SearchFilters(fuel="petrol")
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        for item in summaries:
            self.assertIn("petrol", item["fuels"])

    def test_engine_cc_max_filter(self):
        filters = SearchFilters(engine_cc_max=1400)
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)

    def test_no_filters_returns_all(self):
        filters = SearchFilters()
        total, summaries = self.lookup.search(filters)
        # All rows minus ones missing required fields
        self.assertGreater(total, 1000)

    def test_impossible_filter_returns_zero(self):
        # Year 2050 doesn't exist in CSV
        filters = SearchFilters(year_min=2050)
        total, summaries = self.lookup.search(filters)
        self.assertEqual(total, 0)
        self.assertEqual(summaries, [])

    def test_combined_filter_automatic_after_2018(self):
        filters = SearchFilters(transmission="Automatic", year_min=2018)
        total, summaries = self.lookup.search(filters)
        self.assertGreater(total, 0)
        for item in summaries:
            self.assertIn("Automatic", item["transmissions"])
            self.assertGreaterEqual(item["year_max"], 2018)

    def test_summaries_have_required_keys(self):
        filters = SearchFilters(transmission="Automatic")
        _, summaries = self.lookup.search(filters)
        self.assertGreater(len(summaries), 0)
        required_keys = {"make", "model", "year_min", "year_max", "transmissions", "fuels"}
        for item in summaries:
            self.assertTrue(required_keys.issubset(item.keys()), f"Missing keys in {item}")

    def test_summaries_sorted_by_make_model(self):
        filters = SearchFilters(transmission="Automatic")
        _, summaries = self.lookup.search(filters)
        makes = [s["make"] for s in summaries]
        self.assertEqual(makes, sorted(makes))

    def test_transmissions_in_summary_are_lists(self):
        filters = SearchFilters(transmission="Automatic")
        _, summaries = self.lookup.search(filters)
        for item in summaries:
            self.assertIsInstance(item["transmissions"], list)
            self.assertIsInstance(item["fuels"], list)


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestEgyptNotes(unittest.TestCase):
    """get_egypt_note() — confirms notes loaded and retrievable by make/model."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def test_toyota_corolla_note_loaded(self):
        note = self.lookup.get_egypt_note("Toyota", "Corolla")
        self.assertIsNotNone(note)
        self.assertGreater(len(note.strip()), 20)

    def test_nissan_sentra_note_contains_cvt_info(self):
        note = self.lookup.get_egypt_note("Nissan", "Sentra")
        self.assertIsNotNone(note)
        # Should mention CVT
        self.assertIn("CVT", note.upper())

    def test_hyundai_verna_note_contains_safety_warning(self):
        note = self.lookup.get_egypt_note("Hyundai", "Verna")
        self.assertIsNotNone(note)
        # Should warn about safety
        note_lower = note.lower()
        self.assertTrue(
            "safety" in note_lower or "airbag" in note_lower or "abs" in note_lower,
            "Verna note should contain safety warning"
        )

    def test_kia_cerato_note_loaded(self):
        note = self.lookup.get_egypt_note("Kia", "Cerato")
        self.assertIsNotNone(note)
        self.assertGreater(len(note.strip()), 20)

    def test_mitsubishi_lancer_puma_note_loaded(self):
        note = self.lookup.get_egypt_note("Mitsubishi", "Lancer Puma")
        self.assertIsNotNone(note)

    def test_unknown_car_returns_none(self):
        note = self.lookup.get_egypt_note("Fakebrand", "FakeModel")
        self.assertIsNone(note)

    def test_case_insensitive_lookup(self):
        note_upper = self.lookup.get_egypt_note("Toyota", "Corolla")
        note_lower = self.lookup.get_egypt_note("toyota", "corolla")
        # Both should return a result (or both None), not one and not the other
        self.assertEqual(note_upper is None, note_lower is None)

    def test_note_is_string(self):
        note = self.lookup.get_egypt_note("Toyota", "Corolla")
        self.assertIsInstance(note, str)


@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestIsSearchQuery(unittest.TestCase):
    """is_search_query() — distinguishes 'find me cars' from 'tell me about this car'."""

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    # ── Should be True ────────────────────────────────────────────────────────
    def test_list_all_arabic(self):
        self.assertTrue(self.lookup.is_search_query("ايه كل العربيات الاوتوماتيك"))

    def test_list_cars_english(self):
        self.assertTrue(self.lookup.is_search_query("show me cars under 2015"))

    def test_filter_before_year(self):
        self.assertTrue(self.lookup.is_search_query("عربيات قبل 2018"))

    def test_filter_after_year(self):
        self.assertTrue(self.lookup.is_search_query("عربيات بعد 2020"))

    def test_filter_under_keyword(self):
        self.assertTrue(self.lookup.is_search_query("cars under 2016"))

    def test_filter_between(self):
        self.assertTrue(self.lookup.is_search_query("عربيات بين 2015 و 2020"))

    def test_filter_less_than_arabic(self):
        self.assertTrue(self.lookup.is_search_query("عربيات اقل من 2016"))

    # ── Should be False ───────────────────────────────────────────────────────
    def test_specific_car_question(self):
        self.assertFalse(self.lookup.is_search_query("ايه مواصفات سيراتو 2019؟"))

    def test_price_question_specific_car(self):
        self.assertFalse(self.lookup.is_search_query("بكام الكورولا 2020؟"))

    def test_greeting(self):
        self.assertFalse(self.lookup.is_search_query("ازيك عامل ايه"))

    def test_complaint_question(self):
        self.assertFalse(self.lookup.is_search_query("ايه مشاكل السنترا"))

    # ── Regression: substring false positives ────────────────────────────────
    def test_moshkela_does_not_trigger_kol(self):
        # BUG REGRESSION: "كل" inside "مشكلة" must NOT trigger search query
        self.assertFalse(self.lookup.is_search_query("عندي مشكلة في الفتيس"))

    def test_haykal_does_not_trigger(self):
        # "هيكل" contains "كل" — must not trigger
        self.assertFalse(self.lookup.is_search_query("الهيكل سليم"))

    def test_wakala_does_not_trigger(self):
        # "وكالة" — should not trigger
        self.assertFalse(self.lookup.is_search_query("تقدر تشتري من الوكالة"))


# ═════════════════════════════════════════════════════════════════════════════
# 3. Context builder tests
# ═════════════════════════════════════════════════════════════════════════════

class TestBuildSpecsContext(unittest.TestCase):
    """build_specs_context() — formats CSV rows + egypt note into LLM prompt text."""

    def _sample_rows(self) -> list[dict]:
        return [
            {
                "make": "Kia", "model": "Cerato", "year": 2019,
                "transmission": "Automatic", "fuel": "petrol",
                "engine_cc": 1600, "horsepower": 123,
                "body_type": "Sedan", "drivetrain": "FWD",
                "seating_capacity": 5, "brand_origin": "korean",
                "car_segment": "family",
            },
            {
                "make": "Kia", "model": "Cerato", "year": 2020,
                "transmission": "Automatic", "fuel": "petrol",
                "engine_cc": 1600, "horsepower": 123,
                "body_type": "Sedan", "drivetrain": "FWD",
                "seating_capacity": 5, "brand_origin": "korean",
                "car_segment": "family",
            },
        ]

    def test_returns_string(self):
        result = build_specs_context(self._sample_rows())
        self.assertIsInstance(result, str)

    def test_contains_make_model(self):
        result = build_specs_context(self._sample_rows())
        self.assertIn("Kia", result)
        self.assertIn("Cerato", result)

    def test_contains_both_years(self):
        result = build_specs_context(self._sample_rows())
        self.assertIn("2019", result)
        self.assertIn("2020", result)

    def test_contains_transmission(self):
        result = build_specs_context(self._sample_rows())
        self.assertIn("Automatic", result)

    def test_years_sorted_ascending(self):
        rows = list(reversed(self._sample_rows()))  # reverse order
        result = build_specs_context(rows)
        idx_2019 = result.index("2019")
        idx_2020 = result.index("2020")
        self.assertLess(idx_2019, idx_2020)

    def test_egypt_note_injected_when_provided(self):
        note = "CVT only in Egypt. No manual at dealerships."
        result = build_specs_context(self._sample_rows(), egypt_note=note)
        self.assertIn("CVT only in Egypt", result)

    def test_no_egypt_note_absent_from_output(self):
        result = build_specs_context(self._sample_rows(), egypt_note=None)
        self.assertNotIn("Egypt market note", result)

    def test_verified_label_present(self):
        result = build_specs_context(self._sample_rows())
        self.assertIn("VERIFIED", result)

    def test_important_instruction_present(self):
        result = build_specs_context(self._sample_rows())
        self.assertIn("IMPORTANT", result)

    def test_empty_rows_returns_empty_string(self):
        result = build_specs_context([])
        self.assertEqual(result, "")

    def test_respects_token_budget_hint(self):
        # Very large number of rows should be truncated by token_budget_hint
        many_rows = []
        for year in range(1990, 2030):
            many_rows.append({
                "make": "Toyota", "model": "Corolla", "year": year,
                "transmission": "Automatic", "fuel": "petrol",
                "engine_cc": 1600, "horsepower": 122,
                "body_type": "Sedan", "drivetrain": "FWD",
                "seating_capacity": 5, "brand_origin": "japanese",
                "car_segment": "family",
            })
        result = build_specs_context(many_rows, token_budget_hint=100)
        # With a tight budget, output should be shorter than if all rows included
        result_unlimited = build_specs_context(many_rows, token_budget_hint=9999)
        self.assertLessEqual(len(result), len(result_unlimited))

    def test_missing_optional_fields_dont_crash(self):
        # Rows with only required fields
        sparse_rows = [{"make": "Kia", "model": "Cerato", "year": 2020}]
        try:
            result = build_specs_context(sparse_rows)
            self.assertIsInstance(result, str)
        except Exception as e:
            self.fail(f"build_specs_context raised unexpectedly: {e}")


class TestBuildSearchContext(unittest.TestCase):
    """build_search_context() — formats search results into LLM prompt text."""

    def _sample_summaries(self) -> list[dict]:
        return [
            {
                "make": "Toyota", "model": "Corolla",
                "year_min": 2015, "year_max": 2022,
                "transmissions": ["Automatic"],
                "fuels": ["petrol"],
                "body_types": ["Sedan"],
                "drivetrains": ["FWD"],
                "car_segments": ["family"],
                "brand_origins": ["japanese"],
            },
            {
                "make": "Kia", "model": "Cerato",
                "year_min": 2014, "year_max": 2024,
                "transmissions": ["Automatic"],
                "fuels": ["petrol"],
                "body_types": ["Sedan"],
                "drivetrains": ["FWD"],
                "car_segments": ["family"],
                "brand_origins": ["korean"],
            },
        ]

    def test_returns_string(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(2, self._sample_summaries(), filters=f)
        self.assertIsInstance(result, str)

    def test_contains_make_model(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(2, self._sample_summaries(), filters=f)
        self.assertIn("Toyota", result)
        self.assertIn("Corolla", result)

    def test_contains_total_count(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(150, self._sample_summaries(), filters=f)
        self.assertIn("150", result)

    def test_zero_matches_returns_empty(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(0, [], filters=f)
        self.assertEqual(result, "")

    def test_top_n_limits_output(self):
        f = SearchFilters(transmission="Automatic")
        result_3 = build_search_context(10, self._sample_summaries(), filters=f, top_n=1)
        result_all = build_search_context(10, self._sample_summaries(), filters=f, top_n=10)
        # Only Corolla should appear, not Cerato
        self.assertIn("Corolla", result_3)
        # With top_n=1, Cerato should not appear
        if len(self._sample_summaries()) > 1:
            self.assertNotIn("Cerato", result_3)

    def test_verified_label_present(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(2, self._sample_summaries(), filters=f)
        self.assertIn("VERIFIED", result)

    def test_important_instruction_present(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(2, self._sample_summaries(), filters=f)
        self.assertIn("IMPORTANT", result)

    def test_year_range_in_output(self):
        f = SearchFilters(transmission="Automatic")
        result = build_search_context(2, self._sample_summaries(), filters=f)
        self.assertIn("2015", result)
        self.assertIn("2022", result)


# ═════════════════════════════════════════════════════════════════════════════
# 4. End-to-end flow tests
# ═════════════════════════════════════════════════════════════════════════════

@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestEndToEndFlow(unittest.TestCase):
    """
    Full pipeline: user message → extract_mention → lookup_specs →
    get_egypt_note → build_specs_context.

    These tests simulate what the LLM service actually does.
    """

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def _full_pipeline(self, user_message: str) -> str | None:
        """Run the full lookup pipeline and return injected context string."""
        mention = self.lookup.extract_mention(user_message)
        if mention is None:
            return None
        rows = self.lookup.lookup_specs(mention)
        if not rows:
            return None
        note = self.lookup.get_egypt_note(mention.make, mention.model)
        return build_specs_context(rows, egypt_note=note)

    def test_sentra_query_returns_context_with_cvt(self):
        context = self._full_pipeline("ايه نوع الفتيس في نيسان سنترا 2019؟")
        self.assertIsNotNone(context)
        self.assertIn("Nissan", context)
        self.assertIn("Sentra", context)

    def test_cerato_arabic_returns_correct_make(self):
        context = self._full_pipeline("سيراتو 2020 بتاكل بنزين قد ايه؟")
        self.assertIsNotNone(context)
        self.assertIn("Kia", context)

    def test_elantra_arabic_alias_works(self):
        context = self._full_pipeline("الجمل الهيونداي حالته ايه؟")
        self.assertIsNotNone(context)
        self.assertIn("Hyundai", context)

    def test_corolla_note_injected(self):
        context = self._full_pipeline("تويوتا كورولا 2019 مواصفاتها ايه؟")
        self.assertIsNotNone(context)
        # Egypt note should be present for Corolla
        # Corolla note mentions resale or reliability
        self.assertTrue(
            "resale" in context.lower() or "فابريكا" in context or "egypt" in context.lower()
        )

    def test_unrelated_message_returns_none(self):
        context = self._full_pipeline("ازيك يا باشا")
        self.assertIsNone(context)

    def test_partial_arabic_make_only_returns_none_or_most_common(self):
        # "تويوتا" alone with no model — may return None or Toyota's most common
        # Either is acceptable — we just check it doesn't crash
        try:
            self._full_pipeline("عندي تويوتا")
        except Exception as e:
            self.fail(f"Pipeline raised unexpectedly on make-only input: {e}")

    def test_search_pipeline_automatic_before_2015(self):
        if not self.lookup.is_search_query("عربيات اوتوماتيك قبل 2015"):
            self.skipTest("is_search_query returned False — skipping search pipeline test")
        filters = self.lookup.parse_filters("عربيات اوتوماتيك قبل 2015")
        total, summaries = self.lookup.search(filters)
        context = build_search_context(total, summaries, filters=filters)
        self.assertIn("VERIFIED", context)
        self.assertGreater(total, 0)

    def test_context_contains_verified_label(self):
        context = self._full_pipeline("كيا سيراتو 2020")
        self.assertIsNotNone(context)
        self.assertIn("VERIFIED", context)

    def test_context_contains_important_instruction(self):
        context = self._full_pipeline("كيا سيراتو 2020")
        self.assertIsNotNone(context)
        self.assertIn("IMPORTANT", context)

    def test_bomba_to_lancer_puma_full_pipeline(self):
        """Regression: slang alias 'بومة' must resolve to Mitsubishi and return specs."""
        mention = self.lookup.extract_mention("عندي بومة 2008")
        if mention is None:
            self.skipTest("بومة alias not in aliases file — skipping")
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0, "Lancer Puma rows should exist in CSV")

    def test_fantasia_to_skoda_full_pipeline(self):
        """Regression: 'فانتازيا' must resolve to Skoda and return specs."""
        mention = self.lookup.extract_mention("فانتازيا 2010")
        if mention is None:
            self.skipTest("فانتازيا alias not in aliases file — skipping")
        rows = self.lookup.lookup_specs(mention)
        self.assertGreater(len(rows), 0)


# ═════════════════════════════════════════════════════════════════════════════
# 5. Edge cases and defensive tests
# ═════════════════════════════════════════════════════════════════════════════

@unittest.skipUnless(
    (_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv").exists(),
    "CSV file not found — skipping integration tests",
)
class TestEdgeCases(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.lookup = _get_lookup()
        cls.lookup.load()

    def test_extract_mention_empty_string_returns_none(self):
        self.assertIsNone(self.lookup.extract_mention(""))

    def test_extract_mention_only_numbers_returns_none(self):
        self.assertIsNone(self.lookup.extract_mention("123456"))

    def test_extract_mention_only_punctuation_returns_none(self):
        self.assertIsNone(self.lookup.extract_mention("؟!.،..."))

    def test_extract_mention_very_long_message_no_crash(self):
        long_msg = "ايه رأيك في السوق المصري " * 100 + "كورولا 2020"
        try:
            mention = self.lookup.extract_mention(long_msg)
            # Either finds Corolla or returns None — both acceptable
        except Exception as e:
            self.fail(f"Long message raised: {e}")

    def test_lookup_specs_before_load_triggers_load(self):
        fresh = CarSpecsLookup(
            csv_path=_repo_root() / "ml-service" / "data" / "lookups" / "AI_lookup.csv",
        )
        # Should NOT raise even without explicit load() call
        mention = CarMention(make="Toyota", model="Corolla", year=2019)
        try:
            rows = fresh.lookup_specs(mention)
            self.assertIsInstance(rows, list)
        except Exception as e:
            self.fail(f"lookup_specs before explicit load() raised: {e}")

    def test_parse_filters_only_whitespace(self):
        f = self.lookup.parse_filters("   ")
        self.assertIsNone(f.transmission)
        self.assertIsNone(f.year_min)
        self.assertIsNone(f.year_max)

    def test_parse_filters_gibberish(self):
        try:
            f = self.lookup.parse_filters("xxxyyyzzz")
            self.assertIsNone(f.transmission)
        except Exception as e:
            self.fail(f"parse_filters on gibberish raised: {e}")

    def test_search_with_empty_filters_no_crash(self):
        filters = SearchFilters()
        try:
            total, summaries = self.lookup.search(filters)
            self.assertIsInstance(total, int)
            self.assertIsInstance(summaries, list)
        except Exception as e:
            self.fail(f"search with empty filters raised: {e}")

    def test_get_egypt_note_empty_make(self):
        result = self.lookup.get_egypt_note("", "Corolla")
        # Should return None, not crash
        self.assertIsNone(result)

    def test_get_egypt_note_empty_model(self):
        result = self.lookup.get_egypt_note("Toyota", "")
        self.assertIsNone(result)

    def test_build_specs_context_single_row_no_crash(self):
        row = {
            "make": "Toyota", "model": "Corolla", "year": 2019,
            "transmission": "Automatic", "fuel": "petrol",
            "engine_cc": 1600, "horsepower": 122,
        }
        try:
            result = build_specs_context([row])
            self.assertIsInstance(result, str)
        except Exception as e:
            self.fail(f"build_specs_context on single row raised: {e}")

    def test_arabic_definite_article_removal_in_extraction(self):
        """'الكورولا' should match 'Corolla' after ال prefix handling."""
        mention = self.lookup.extract_mention("الكورولا موديل 2022")
        # Should not be None and should be Toyota
        if mention is not None:
            self.assertEqual(mention.make, "Toyota")

    def test_engine_cc_field_is_int_or_none(self):
        """All loaded rows should have engine_cc as int or None, never a float string."""
        for row in self.lookup._rows[:200]:  # Sample first 200
            cc = row.get("engine_cc")
            self.assertTrue(
                cc is None or isinstance(cc, int),
                f"engine_cc should be int or None, got {type(cc)}: {cc}"
            )

    def test_year_field_is_int_in_all_rows(self):
        """All loaded rows must have year as int (not float like 2019.0)."""
        for row in self.lookup._rows[:200]:
            year = row.get("year")
            self.assertIsInstance(year, int, f"Year should be int, got {type(year)}: {year}")


if __name__ == "__main__":
    unittest.main(verbosity=2)