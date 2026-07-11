#!/usr/bin/env python3
"""Fix known issues in the car specs lookup CSV via a deterministic correction map.

- Safe by default: writes to a new output file.
- Optional in-place mode with automatic backup.

This is intentionally conservative: it only applies targeted overrides that you can
review and extend.

IMPORTANT: This script must run AFTER fix_lookups_make_model.py --apply.
It reads car_specs_lookup_full_cleaned.fixed.csv (not the original).
The pipeline order is:
  1. fix_lookups_make_model.py --apply
  2. fix_car_specs_lookup_full.py          ← this script
  3. fix_car_main_info_ev_fuel.py
  4. clean_impossible_model_years.py
  5. BACKEND.ipynb
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import os
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


_space_re = re.compile(r"\s+")


def norm_text(text: str) -> str:
    """Normalize text for matching (case-insensitive, diacritics-insensitive)."""
    text = _strip_diacritics(text)
    text = text.strip().lower()
    text = _space_re.sub(" ", text)
    return text


def parse_int(value: str | int | float | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    s = str(value).strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def parse_float(value: str | int | float | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return float(value)
    s = str(value).strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def format_float_4(value: float) -> str:
    return f"{value:.4f}"


@dataclass(frozen=True)
class Rule:
    id: str
    make: str | None = None
    model: str | None = None
    year: int | None = None
    year_range: tuple[int, int] | None = None
    only_if: Callable[[dict[str, str]], bool] | None = None
    updates: Mapping[str, Any] = None  # type: ignore[assignment]

    def matches(self, row: dict[str, str]) -> bool:
        if self.make is not None and norm_text(row.get("make", "")) != norm_text(self.make):
            return False
        if self.model is not None and norm_text(row.get("model", "")) != norm_text(self.model):
            return False

        y = parse_int(row.get("year"))
        if y is None:
            return False

        if self.year is not None and y != self.year:
            return False
        if self.year_range is not None:
            start, end = self.year_range
            if not (start <= y <= end):
                return False

        if self.only_if is not None and not self.only_if(row):
            return False

        return True


def _only_engine_cc_is_zero(row: dict[str, str]) -> bool:
    return parse_int(row.get("engine_cc")) == 0


def _only_engine_cc_hp(
    engine_cc: int | None = None,
    horsepower: int | None = None,
) -> Callable[[dict[str, str]], bool]:
    def _predicate(row: dict[str, str]) -> bool:
        if engine_cc is not None and parse_int(row.get("engine_cc")) != engine_cc:
            return False
        if horsepower is not None and parse_int(row.get("horsepower")) != horsepower:
            return False
        return True

    return _predicate


def _only_brand_market_share_le(max_value: float) -> Callable[[dict[str, str]], bool]:
    def _predicate(row: dict[str, str]) -> bool:
        v = parse_float(row.get("brand_market_share"))
        return v is not None and v <= max_value

    return _predicate


def _only_col_equals(col: str, expected: str) -> Callable[[dict[str, str]], bool]:
    def _predicate(row: dict[str, str]) -> bool:
        return norm_text(row.get(col, "")) == norm_text(expected)

    return _predicate


# ---------------------------------------------------------------------------
# Correction rules
# ---------------------------------------------------------------------------
# Notes:
# - Keep rules tight to avoid unintended edits.
# - Extend by appending additional Rule(...) entries.
# - Make/model values must match the CANONICAL form produced by
#   fix_lookups_make_model.py (e.g. "Changan" not "Chana", because
#   Chana is aliased to Changan during canonicalization).
# ---------------------------------------------------------------------------

RULES: list[Rule] = [
    Rule(
        id="deepal_s07_erev_generator_engine",
        make="Deepal",
        model="S 07",
        year_range=(2025, 2026),
        only_if=_only_engine_cc_is_zero,
        updates={"engine_cc": 1500},
    ),
    Rule(
        id="subaru_impreza_2009_egypt_spec",
        make="Subaru",
        model="Impreza",
        year=2009,
        updates={"engine_cc": 1498, "horsepower": 107},
    ),
    Rule(
        id="subaru_impreza_2005_2011_egypt_spec",
        make="Subaru",
        model="Impreza",
        year_range=(2005, 2011),
        only_if=_only_engine_cc_hp(engine_cc=2000, horsepower=154),
        updates={"engine_cc": 1498, "horsepower": 107},
    ),
    Rule(
        id="jetour_x90_plus_egypt_spec",
        make="Jetour",
        model="X90 Plus",
        year_range=(2024, 2026),
        updates={"engine_cc": 1598, "horsepower": 197, "drivetrain": "FWD"},
    ),
    # FIX: was make="Chana" — Chana is aliased to Changan by
    # fix_lookups_make_model.py, so the fixed CSV contains "Changan" only.
    Rule(
        id="changan_benni_egypt_spec",
        make="Changan",
        model="Benni",
        year_range=(2008, 2009),
        updates={"engine_cc": 1301, "horsepower": 86},
    ),
    Rule(
        id="skoda_octavia_a8_egypt_spec",
        make="Skoda",
        model="Octavia A8",
        year_range=(2024, 2026),
        updates={"engine_cc": 1395, "horsepower": 150},
    ),
    Rule(
        id="skoda_octavia_egypt_spec",
        make="Skoda",
        model="Octavia",
        year_range=(2024, 2026),
        updates={"engine_cc": 1395, "horsepower": 150},
    ),
    Rule(
        id="mercedes_c200_eqboost_output",
        make="Mercedes",
        model="C200",
        year=2020,
        updates={"horsepower": 197},
    ),
    Rule(
        id="mercedes_e300_eqboost_output",
        make="Mercedes",
        model="E300",
        year_range=(2020, 2021),
        only_if=_only_engine_cc_hp(horsepower=258),
        updates={"horsepower": 272},
    ),
    Rule(
        id="mercedes_gle450_fix_obviously_wrong_row",
        make="Mercedes",
        model="GLE450",
        year=2022,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=156),
        updates={
            "engine_cc": 2999,
            "horsepower": 362,
            "body_type": "SUV",
            "drivetrain": "4WD",
            "car_segment": "luxury_suv",
        },
    ),
    Rule(
        id="citroen_grand_c4_spacetourer_2016_thp",
        make="Citroën",
        model="Grand C4 Spacetourer",
        year=2016,
        updates={"engine_cc": 1598, "horsepower": 165},
    ),
    Rule(
        id="citroen_c4_grand_picasso_2016_thp",
        make="Citroën",
        model="C4 Grand Picasso",
        year=2016,
        updates={"engine_cc": 1598, "horsepower": 165},
    ),
    Rule(
        id="toyota_corolla_cross_body_type",
        make="Toyota",
        model="Corolla Cross",
        year_range=(2020, 2100),
        updates={"body_type": "Crossover", "car_segment": "crossover"},
    ),
    Rule(
        id="toyota_urban_cruiser_body_type",
        make="Toyota",
        model="Urban Cruiser",
        year_range=(2000, 2100),
        updates={"body_type": "Crossover", "car_segment": "crossover"},
    ),
    Rule(
        id="gac_brand_market_share_2026",
        make="GAC",
        year_range=(2024, 2100),
        updates={"brand_market_share": 0.0040},
    ),
    Rule(
        id="zeekr_brand_market_share_2026",
        make="Zeekr",
        year_range=(2023, 2100),
        only_if=_only_brand_market_share_le(0.0010),
        updates={"brand_market_share": 0.0035},
    ),
    # Segment mismatches (confirmed)
    Rule(
        id="segment_ds_ds7_luxury_suv",
        make="DS",
        model="DS7",
        year_range=(1900, 2100),
        only_if=_only_col_equals("car_segment", "executive"),
        updates={"car_segment": "luxury_suv"},
    ),
    Rule(
        id="segment_cupra_formentor_crossover",
        make="Cupra",
        model="Formentor",
        year_range=(1900, 2100),
        only_if=_only_col_equals("car_segment", "sport"),
        updates={"car_segment": "crossover"},
    ),
    Rule(
        id="segment_alfa_romeo_tonale_crossover",
        make="Alfa Romeo",
        model="Tonale",
        year_range=(1900, 2100),
        only_if=_only_col_equals("car_segment", "executive"),
        updates={"car_segment": "crossover"},
    ),
    Rule(
        id="segment_vw_beetle_sport",
        make="Volkswagen",
        model="Beetle",
        year_range=(1900, 2100),
        only_if=_only_col_equals("car_segment", "city"),
        updates={"car_segment": "sport"},
    ),

    # ------------------------------------------------------------------
    # Chery Tiggo — wrong-spec rows where a different car was merged in
    # The real Chery Tiggo is 1600cc/106hp/SUV/chinese/suv.
    # The 1400cc/130hp/Sedan/european/family rows are a different model
    # mis-assigned to "Tiggo" during lookup generation.
    # ------------------------------------------------------------------
    Rule(
        id="chery_tiggo_fix_wrong_spec_2019",
        make="Chery",
        model="Tiggo",
        year=2019,
        only_if=_only_engine_cc_hp(engine_cc=1400, horsepower=130),
        updates={
            "engine_cc": 1600, "horsepower": 106,
            "body_type": "SUV", "drivetrain": "FWD",
            "brand_origin": "chinese", "car_segment": "suv",
            "brand_market_share": 0.0253,
        },
    ),
    Rule(
        id="chery_tiggo_fix_wrong_spec_2022",
        make="Chery",
        model="Tiggo",
        year=2022,
        only_if=_only_engine_cc_hp(engine_cc=1400, horsepower=130),
        updates={
            "engine_cc": 1600, "horsepower": 106,
            "body_type": "SUV", "drivetrain": "FWD",
            "brand_origin": "chinese", "car_segment": "suv",
            "brand_market_share": 0.0253,
        },
    ),
    Rule(
        id="chery_tiggo_fix_wrong_spec_2023",
        make="Chery",
        model="Tiggo",
        year=2023,
        only_if=_only_engine_cc_hp(engine_cc=1400, horsepower=130),
        updates={
            "engine_cc": 1600, "horsepower": 106,
            "body_type": "SUV", "drivetrain": "FWD",
            "brand_origin": "chinese", "car_segment": "suv",
            "brand_market_share": 0.0253,
        },
    ),
    Rule(
        id="chery_tiggo_fix_wrong_spec_2024",
        make="Chery",
        model="Tiggo",
        year=2024,
        only_if=_only_engine_cc_hp(engine_cc=1400, horsepower=130),
        updates={
            "engine_cc": 1600, "horsepower": 106,
            "body_type": "SUV", "drivetrain": "FWD",
            "brand_origin": "chinese", "car_segment": "suv",
            "brand_market_share": 0.0253,
        },
    ),
    Rule(
        id="chery_tiggo_fix_wrong_spec_2025",
        make="Chery",
        model="Tiggo",
        year=2025,
        only_if=_only_engine_cc_hp(engine_cc=1400, horsepower=130),
        updates={
            "engine_cc": 1600, "horsepower": 106,
            "body_type": "SUV", "drivetrain": "FWD",
            "brand_origin": "chinese", "car_segment": "suv",
            "brand_market_share": 0.0253,
        },
    ),

    # ------------------------------------------------------------------
    # Daewoo Lanos — two conflicting spec variants in lookup
    # The standard Egypt-market Lanos is 1500cc/86hp/city.
    # The 1600cc/100hp/family variant is the less common Nubira-based trim.
    # Correct the 1600 variant to match the dominant 1500cc spec so that
    # a single listing does not produce two rows with different specs.
    # ------------------------------------------------------------------
    Rule(
        id="daewoo_lanos_fix_1600_variant_1997",
        make="Daewoo", model="Lanos", year=1997,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_1998",
        make="Daewoo", model="Lanos", year=1998,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_1999",
        make="Daewoo", model="Lanos", year=1999,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_2000",
        make="Daewoo", model="Lanos", year=2000,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_2001",
        make="Daewoo", model="Lanos", year=2001,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_2004",
        make="Daewoo", model="Lanos", year=2004,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),
    Rule(
        id="daewoo_lanos_fix_1600_variant_2006",
        make="Daewoo", model="Lanos", year=2006,
        only_if=_only_engine_cc_hp(engine_cc=1600, horsepower=100),
        updates={"engine_cc": 1500, "horsepower": 86, "car_segment": "city"},
    ),

    # ------------------------------------------------------------------
    # Chevrolet Cruze — wrong brand_origin and slight hp mismatch
    # The japanese/120hp variant is incorrect; Chevrolet is american.
    # ------------------------------------------------------------------
    Rule(
        id="chevrolet_cruze_fix_japanese_variant_2012",
        make="Chevrolet", model="Cruze", year=2012,
        only_if=_only_col_equals("brand_origin", "japanese"),
        updates={"horsepower": 124, "brand_origin": "american"},
    ),
    Rule(
        id="chevrolet_cruze_fix_japanese_variant_2014",
        make="Chevrolet", model="Cruze", year=2014,
        only_if=_only_col_equals("brand_origin", "japanese"),
        updates={"horsepower": 124, "brand_origin": "american"},
    ),

    # ------------------------------------------------------------------
    # Changan Benni — 1500cc/136hp/european variant is a different car
    # The real Benni is 1000cc/68hp/chinese. The 1500cc variant is likely
    # a different Changan model mis-assigned to Benni.
    # ------------------------------------------------------------------
    Rule(
        id="changan_benni_fix_wrong_spec_2015",
        make="Changan", model="Benni", year=2015,
        only_if=_only_engine_cc_hp(engine_cc=1500, horsepower=136),
        updates={
            "engine_cc": 1000, "horsepower": 68,
            "brand_origin": "chinese",
        },
    ),
    Rule(
        id="changan_benni_fix_wrong_spec_2016",
        make="Changan", model="Benni", year=2016,
        only_if=_only_engine_cc_hp(engine_cc=1500, horsepower=136),
        updates={
            "engine_cc": 1000, "horsepower": 68,
            "brand_origin": "chinese",
        },
    ),
]


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def apply_rules(
    rows: list[dict[str, str]],
    rules: Iterable[Rule],
) -> tuple[list[dict[str, str]], dict[str, int]]:
    counts: dict[str, int] = {}

    def bump(rule_id: str) -> None:
        counts[rule_id] = counts.get(rule_id, 0) + 1

    out: list[dict[str, str]] = []
    for row in rows:
        updated = dict(row)
        for rule in rules:
            if not rule.matches(updated):
                continue
            for col, value in (rule.updates or {}).items():
                if col not in updated:
                    continue
                if col in {"engine_cc", "horsepower", "seating_capacity", "year"}:
                    updated[col] = "" if value is None else str(int(value))
                elif col == "brand_market_share":
                    updated[col] = format_float_4(float(value))
                else:
                    updated[col] = "" if value is None else str(value)
            bump(rule.id)
        out.append(updated)

    return out, counts


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header")
        rows = list(reader)
        return list(reader.fieldnames), rows


def write_csv(
    path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def atomic_replace(src: Path, dst: Path) -> None:
    os.replace(src, dst)


def default_paths() -> tuple[Path, Path]:
    # This script lives in ml-service/scripts/cleaning; derive the ml-service root reliably.
    ml_service_root = Path(__file__).resolve().parents[2]

    # FIX: reads the fixed file produced by fix_lookups_make_model.py --apply,
    # NOT the original car_specs_lookup_full_cleaned.csv.
    input_path = (
        ml_service_root / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
    )
    # FIX: output uses .fixed.csv naming convention (dot, not underscore)
    # to stay consistent with the rest of the pipeline.
    output_path = (
        ml_service_root / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
    )
    return input_path, output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def dedup_exact(rows: list[dict[str, str]], key_cols: tuple[str, ...] = ("make", "model", "year")) -> tuple[list[dict[str, str]], int]:
    """Remove exact duplicate rows that share the same key columns and identical specs.

    After correction rules are applied, some rows may become identical.
    This pass keeps only the first occurrence of each unique key.
    """
    seen: set[tuple[str, ...]] = set()
    out: list[dict[str, str]] = []
    removed = 0
    for row in rows:
        key = tuple(norm_text(row.get(c, "")) if c in {"make", "model"} else str(row.get(c, "")) for c in key_cols)
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        out.append(row)
    return out, removed


def main(argv: list[str]) -> int:
    default_in, default_out = default_paths()

    parser = argparse.ArgumentParser(
        description="Apply deterministic spec corrections to the fixed car specs lookup CSV.",
        epilog=(
            "Run fix_lookups_make_model.py --apply first. "
            "This script operates on the .fixed.csv output, not the original."
        ),
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=default_in,
        help=f"Input CSV (default: {default_in})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_out,
        help=f"Output CSV (default: {default_out})",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite the input file (creates a timestamped .bak backup first)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write any files; just print a rule application summary",
    )

    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input file not found: {args.input}", file=sys.stderr)
        print(
            "Did you run fix_lookups_make_model.py --apply first?",
            file=sys.stderr,
        )
        return 2

    fieldnames, rows = read_csv(args.input)
    corrected, counts = apply_rules(rows, RULES)

    # Dedup exact duplicate rows after corrections
    deduped, dedup_removed = dedup_exact(corrected)

    total_changes = sum(counts.values())
    print(f"Input:  {args.input}")
    print(f"Rows:   {len(rows)}")
    print(f"Rule applications: {total_changes}")
    for rule_id, n in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        print(f"  - {rule_id}: {n}")
    print(f"Exact duplicates removed: {dedup_removed}")
    print(f"Final rows: {len(deduped)}")

    if args.dry_run:
        print("Dry run — no files written.")
        return 0

    if args.in_place:
        timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = args.input.with_suffix(args.input.suffix + f".{timestamp}.bak")
        tmp_out = args.input.with_suffix(args.input.suffix + ".tmp")

        shutil.copy2(args.input, backup_path)
        write_csv(tmp_out, fieldnames, deduped)
        atomic_replace(tmp_out, args.input)

        print(f"Backup written:   {backup_path}")
        print(f"Updated in place: {args.input}")
        return 0

    write_csv(args.output, fieldnames, deduped)
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))