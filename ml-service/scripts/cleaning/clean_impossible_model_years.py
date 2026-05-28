#!/usr/bin/env python3
"""Remove or flag impossible (make, model, year) combinations.

Reusable cleaning stage — part of the incremental data pipeline.
Run on every new raw data snapshot to enforce model-year validity.

"Data ghosts" originate from seller input / scraping errors where a listing
year predates the model's real-world production or postdates its end.

Rules:
  - ModelYearRule: (make, model) → min_year / max_year bounds
  - ConditionalDropRule: (make, model, fuel|transmission) → drop mislabeled rows

Examples:
  - Audi Q4 E-Tron cannot exist before 2021.
  - Chevrolet Avalanche: 2002–2013 only; diesel or Manual = mislabeled → drop.
  - Fiat 127 cannot exist after 1983.

This script is conservative and rule-driven: it only acts on (make, model)
pairs listed in `MIN_MODEL_YEAR` and `CONDITIONAL_DROPS`.

Usage:
    python clean_impossible_model_years.py --input FILE --mode report   # read-only
    python clean_impossible_model_years.py --input FILE --mode apply    # apply fixes
    python clean_impossible_model_years.py --input FILE --action flag   # flag instead of drop
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def norm_text(text: str) -> str:
    text = _strip_diacritics(str(text))
    return " ".join(text.strip().lower().split())


def parse_year(value: Any) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    try:
        # Handles things like "2013.0" in raw CSVs.
        return int(float(s))
    except ValueError:
        return None


@dataclass(frozen=True)
class ModelYearRule:
    make: str
    model: str
    min_year: int | None = None
    max_year: int | None = None

    @property
    def key(self) -> tuple[str, str]:
        return (norm_text(self.make), norm_text(self.model))


@dataclass(frozen=True)
class ConditionalDropRule:
    """Drop a row if make/model match AND a specific fuel or transmission matches."""
    make: str
    model: str
    fuel: str | None = None
    transmission: str | None = None

    def matches(self, make_norm: str, model_norm: str, row: dict) -> bool:
        if norm_text(self.make) != make_norm or norm_text(self.model) != model_norm:
            return False
        if self.fuel is not None and norm_text(str(row.get("fuel", ""))) != norm_text(self.fuel):
            return False
        if self.transmission is not None and norm_text(str(row.get("transmission", ""))) != norm_text(self.transmission):
            return False
        return True


def _is_year_invalid(year: int | None, rule: "ModelYearRule | None") -> bool:
    """Return True if year violates the rule's min/max bounds."""
    if year is None or rule is None:
        return False
    if rule.min_year is not None and year < rule.min_year:
        return True
    if rule.max_year is not None and year > rule.max_year:
        return True
    return False


# ── Priority 1: Confirmed dirty data (high-MAPE culprits) ──────────────────
# ── Priority 2: Conditional drops (fuel/transmission mislabels) ────────────
# ── Priority 3: EV/new models with clear production start years ────────────
MIN_MODEL_YEAR: list[ModelYearRule] = [
    # Original rules
    ModelYearRule(make="Audi", model="Q4 E-Tron", min_year=2021),
    ModelYearRule(make="Tesla", model="Model Y", min_year=2020),
    ModelYearRule(make="BMW", model="IX1", min_year=2022),
    ModelYearRule(make="BYD", model="Destroyer 05", min_year=2022),
    ModelYearRule(make="MG", model="Cyberster", min_year=2023),
    ModelYearRule(make="Chery", model="Tiggo 8 Pro Max", min_year=2024),
    ModelYearRule(make="Kia", model="Xceed", min_year=2020),

    # Priority 1 — Confirmed 100% dirty (MAPE > 50%)
    ModelYearRule(make="Chevrolet", model="Avalanche", min_year=2002, max_year=2013),
    ModelYearRule(make="Ford", model="Bronco Raptor", min_year=2021),
    ModelYearRule(make="Hyundai", model="Excel", max_year=1994),
    ModelYearRule(make="Fiat", model="127", max_year=1983),
    ModelYearRule(make="Fiat", model="128", max_year=1985),
    ModelYearRule(make="Fiat", model="131", max_year=1984),

    # Priority 3 — EV and new-generation models with confirmed min years
    ModelYearRule(make="Tesla", model="Model 3", min_year=2017),
    ModelYearRule(make="Tesla", model="Model S", min_year=2012),
    ModelYearRule(make="Tesla", model="Model X", min_year=2015),
    ModelYearRule(make="BYD", model="Seal", min_year=2022),
    ModelYearRule(make="BYD", model="Han", min_year=2020),
    ModelYearRule(make="BYD", model="Dolphin", min_year=2021),
    ModelYearRule(make="BYD", model="Atto 3", min_year=2022),
    ModelYearRule(make="BYD", model="Song Plus", min_year=2020),
    ModelYearRule(make="Hyundai", model="Ioniq 5", min_year=2021),
    ModelYearRule(make="Hyundai", model="Ioniq 6", min_year=2022),
    ModelYearRule(make="Kia", model="EV6", min_year=2021),
    ModelYearRule(make="Chery", model="Tiggo 9", min_year=2024),
    ModelYearRule(make="Chery", model="Arrizo 5 Plus", min_year=2021),
    ModelYearRule(make="MG", model="4", min_year=2022),
    ModelYearRule(make="MG", model="Marvel R", min_year=2021),
    ModelYearRule(make="Jetour", model="Dashing", min_year=2022),
    ModelYearRule(make="Jetour", model="X70 Plus", min_year=2020),
    ModelYearRule(make="Geely", model="Coolray", min_year=2019),
    ModelYearRule(make="Geely", model="Starray", min_year=2022),
    ModelYearRule(make="BAIC", model="X55", min_year=2019),
]

# Priority 2 — Conditional drops: valid year range but wrong fuel/transmission
CONDITIONAL_DROPS: list[ConditionalDropRule] = [
    ConditionalDropRule(make="Chevrolet", model="Avalanche", fuel="diesel"),
    ConditionalDropRule(make="Chevrolet", model="Avalanche", transmission="Manual"),
]


def rules_to_map(rules: list[ModelYearRule]) -> dict[tuple[str, str], "ModelYearRule"]:
    return {r.key: r for r in rules}


def load_extra_rules_json(path: Path) -> list[ModelYearRule]:
    """Load additional rules from JSON.

    Format:
    [
      {"make": "Audi", "model": "Q4 E-Tron", "min_year": 2021},
      {"make": "Hyundai", "model": "Excel", "max_year": 1994},
      {"make": "Chevrolet", "model": "Avalanche", "min_year": 2002, "max_year": 2013},
      ...
    ]
    At least one of min_year or max_year must be provided.
    """

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Rules JSON must be a list of objects")

    rules: list[ModelYearRule] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        make = item.get("make")
        model = item.get("model")
        min_year = item.get("min_year")
        max_year = item.get("max_year")
        if make is None or model is None:
            continue
        if min_year is None and max_year is None:
            continue
        rules.append(ModelYearRule(
            make=str(make),
            model=str(model),
            min_year=int(min_year) if min_year is not None else None,
            max_year=int(max_year) if max_year is not None else None,
        ))

    return rules


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError(f"CSV has no header: {path}")
        return list(reader.fieldnames), list(reader)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def find_col(fieldnames: list[str], requested: str | None, fallback: str) -> str:
    if requested:
        if requested not in fieldnames:
            raise ValueError(f"Column '{requested}' not found. Available: {fieldnames}")
        return requested
    if fallback in fieldnames:
        return fallback
    # Try common variants
    candidates = {
        fallback,
        fallback.lower(),
        fallback.upper(),
        fallback.replace("_", ""),
        fallback.replace("_", " "),
    }
    for name in fieldnames:
        if norm_text(name) in {norm_text(c) for c in candidates}:
            return name
    raise ValueError(f"Could not infer '{fallback}' column. Available: {fieldnames}")


def clean_file(
    input_path: Path,
    output_path: Path,
    *,
    make_col: str | None = None,
    model_col: str | None = None,
    year_col: str | None = None,
    action: str = "drop",
    rules: dict[tuple[str, str], "ModelYearRule"],
    conditional_drops: list["ConditionalDropRule"] | None = None,
) -> dict[str, Any]:
    fieldnames, rows = read_csv(input_path)

    make_col = find_col(fieldnames, make_col, "make")
    model_col = find_col(fieldnames, model_col, "model")
    year_col = find_col(fieldnames, year_col, "year")

    cond_drops = conditional_drops or []

    out_rows: list[dict[str, str]] = []
    invalid: list[dict[str, str]] = []
    cond_dropped: list[dict[str, str]] = []

    for row in rows:
        make = norm_text(row.get(make_col, ""))
        model = norm_text(row.get(model_col, ""))
        year = parse_year(row.get(year_col))

        # Check conditional drops first (fuel/transmission mislabels)
        if any(cd.matches(make, model, row) for cd in cond_drops):
            cond_dropped.append(row)
            continue

        rule = rules.get((make, model))
        is_invalid = _is_year_invalid(year, rule)

        if is_invalid:
            invalid.append(row)
            if action == "drop":
                continue
            if action == "clamp":
                row = dict(row)
                clamp_to = rule.min_year if rule and rule.min_year is not None else (rule.max_year if rule else year)
                row[year_col] = str(clamp_to)
            # action == "flag" handled below

        if action == "flag":
            row = dict(row)
            row["is_impossible_year"] = "1" if is_invalid else "0"
            # Report the active bound for the flag
            if rule:
                row["min_valid_year"] = str(rule.min_year) if rule.min_year is not None else ""
                row["max_valid_year"] = str(rule.max_year) if rule.max_year is not None else ""
            else:
                row["min_valid_year"] = ""
                row["max_valid_year"] = ""

        out_rows.append(row)

    out_fieldnames = list(fieldnames)
    if action == "flag":
        if "is_impossible_year" not in out_fieldnames:
            out_fieldnames.append("is_impossible_year")
        if "min_valid_year" not in out_fieldnames:
            out_fieldnames.append("min_valid_year")
        if "max_valid_year" not in out_fieldnames:
            out_fieldnames.append("max_valid_year")

    write_csv(output_path, out_fieldnames, out_rows)

    # Summaries
    by_rule: dict[tuple[str, str], int] = {}
    for row in invalid:
        make = norm_text(row.get(make_col, ""))
        model = norm_text(row.get(model_col, ""))
        by_rule[(make, model)] = by_rule.get((make, model), 0) + 1

    return {
        "input": str(input_path),
        "output": str(output_path),
        "rows_in": len(rows),
        "rows_out": len(out_rows),
        "invalid_year": len(invalid),
        "conditional_dropped": len(cond_dropped),
        "invalid_by_rule": {
            f"{k[0]} | {k[1]}": v for k, v in sorted(by_rule.items(), key=lambda x: (-x[1], x[0]))
        },
        "columns": {"make": make_col, "model": model_col, "year": year_col},
    }


def atomic_replace(src: Path, dst: Path) -> None:
    os.replace(src, dst)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Clean impossible model-year combinations")
    parser.add_argument("--input", type=Path, required=True, help="Input CSV path")
    parser.add_argument("--output", type=Path, help="Output CSV path (default: <input>.cleaned.csv)")
    parser.add_argument("--in-place", action="store_true", help="Overwrite input (creates timestamped .bak)")
    parser.add_argument(
        "--action",
        choices=["drop", "flag", "clamp"],
        default="drop",
        help="What to do with invalid rows (default: drop)",
    )
    parser.add_argument("--make-col", type=str, help="Make column name (default: infer 'make')")
    parser.add_argument("--model-col", type=str, help="Model column name (default: infer 'model')")
    parser.add_argument("--year-col", type=str, help="Year column name (default: infer 'year')")
    parser.add_argument(
        "--extra-rules-json",
        type=Path,
        help="Optional JSON file with extra rules (list of {make, model, min_year})",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print summary only; do not write")

    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input file not found: {args.input}", file=sys.stderr)
        return 2

    rules = list(MIN_MODEL_YEAR)
    if args.extra_rules_json:
        rules.extend(load_extra_rules_json(args.extra_rules_json))

    rules_map = rules_to_map(rules)
    cond_drops = list(CONDITIONAL_DROPS)

    output = args.output
    if output is None:
        output = args.input.with_suffix(args.input.suffix + ".cleaned.csv")

    if args.dry_run:
        summary = clean_file(
            args.input,
            output,
            make_col=args.make_col,
            model_col=args.model_col,
            year_col=args.year_col,
            action=args.action,
            rules=rules_map,
            conditional_drops=cond_drops,
        )
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    if args.in_place:
        timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = args.input.with_suffix(args.input.suffix + f".{timestamp}.bak")
        tmp_out = args.input.with_suffix(args.input.suffix + ".tmp")

        shutil.copy2(args.input, backup_path)
        summary = clean_file(
            args.input,
            tmp_out,
            make_col=args.make_col,
            model_col=args.model_col,
            year_col=args.year_col,
            action=args.action,
            rules=rules_map,
            conditional_drops=cond_drops,
        )
        atomic_replace(tmp_out, args.input)
        print(f"Backup written: {backup_path}")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    summary = clean_file(
        args.input,
        output,
        make_col=args.make_col,
        model_col=args.model_col,
        year_col=args.year_col,
        action=args.action,
        rules=rules_map,
        conditional_drops=cond_drops,
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
