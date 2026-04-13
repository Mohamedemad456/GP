#!/usr/bin/env python3
"""Fix known issues in the car specs lookup CSV via a deterministic correction map.

- Safe by default: writes to a new output file.
- Optional in-place mode with automatic backup.

This is intentionally conservative: it only applies targeted overrides that you can
review and extend.
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


def _only_engine_cc_hp(engine_cc: int | None = None, horsepower: int | None = None) -> Callable[[dict[str, str]], bool]:
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


# Targeted correction map based on the issues described in your review thread.
# Notes:
# - Keep rules tight to avoid unintended edits.
# - Extend by appending additional Rule(...) entries.
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
    Rule(
        id="chana_benni_egypt_spec",
        make="Chana",
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
        updates={"engine_cc": 2999, "horsepower": 362, "body_type": "SUV", "drivetrain": "4WD", "car_segment": "luxury_suv"},
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
]


def apply_rules(rows: list[dict[str, str]], rules: Iterable[Rule]) -> tuple[list[dict[str, str]], dict[str, int]]:
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


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def atomic_replace(src: Path, dst: Path) -> None:
    os.replace(src, dst)


def default_paths() -> tuple[Path, Path]:
    # This script lives in ml-service/src; derive the ml-service root reliably.
    ml_service_root = Path(__file__).resolve().parents[1]
    # The canonical, production-ready lookup is the cleaned file.
    input_path = ml_service_root / "data" / "lookups" / "car_specs_lookup_full_cleaned.csv"
    output_path = ml_service_root / "data" / "lookups" / "car_specs_lookup_full_cleaned_fixed.csv"
    return input_path, output_path


def main(argv: list[str]) -> int:
    default_in, default_out = default_paths()

    parser = argparse.ArgumentParser(description="Apply deterministic corrections to the car specs lookup CSV")
    parser.add_argument("--input", type=Path, default=default_in, help=f"Input CSV (default: {default_in})")
    parser.add_argument("--output", type=Path, default=default_out, help=f"Output CSV (default: {default_out})")
    parser.add_argument("--in-place", action="store_true", help="Overwrite the input file (creates a .bak backup)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write any files; just print a summary")

    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input file not found: {args.input}", file=sys.stderr)
        return 2

    fieldnames, rows = read_csv(args.input)
    corrected, counts = apply_rules(rows, RULES)

    total_changes = sum(counts.values())
    print(f"Rows: {len(rows)}")
    print(f"Rule applications: {total_changes}")
    for rule_id, n in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        print(f"  - {rule_id}: {n}")

    if args.dry_run:
        return 0

    if args.in_place:
        timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = args.input.with_suffix(args.input.suffix + f".{timestamp}.bak")
        tmp_out = args.input.with_suffix(args.input.suffix + ".tmp")

        # Backup original (copy, don't move)
        shutil.copy2(args.input, backup_path)

        # Write corrected to temp then move into place
        write_csv(tmp_out, fieldnames, corrected)
        atomic_replace(tmp_out, args.input)
        print(f"Backup written: {backup_path}")
        print(f"Updated in place: {args.input}")
        return 0

    write_csv(args.output, fieldnames, corrected)
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
