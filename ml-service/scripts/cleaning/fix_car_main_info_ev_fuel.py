#!/usr/bin/env python3
"""Fix EV/hybrid fuel and transmission values in car listing CSVs.

Reusable cleaning stage — part of the incremental data pipeline.
Run on every new raw data snapshot to enforce correct fuel/transmission.

For confirmed pure EV models, enforce:
  - fuel = 'electric'
  - transmission = 'Automatic'

For confirmed hybrid models, enforce:
  - fuel = 'hybrid'
  - transmission = 'Automatic'

This prevents noisy seller/scraper inputs from polluting lookup-derived
features and confusing the pricing model.

Safe by default:
  - Writes to a new output file unless --in-place is provided.
  - --in-place creates a timestamped .bak copy.

Usage:
    python fix_car_main_info_ev_fuel.py --input FILE                    # dry-run
    python fix_car_main_info_ev_fuel.py --input FILE --in-place        # apply with backup
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
from pathlib import Path
from typing import Any


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def norm_text(text: Any) -> str:
    text = _strip_diacritics(str(text))
    return " ".join(text.strip().lower().split())


PURE_EV_MODELS: set[tuple[str, str]] = {
    # Tesla
    ("Tesla", "Model Y"),
    ("Tesla", "Model 3"),
    ("Tesla", "Model S"),
    ("Tesla", "Model X"),
    ("Tesla", "Cybertruck"),
    # Volkswagen
    ("Volkswagen", "ID4"),
    ("Volkswagen", "ID6"),
    # Audi
    ("Audi", "Q4 E-Tron"),
    # BMW — electric-only
    ("BMW", "I3"),
    ("BMW", "I4"),
    ("BMW", "I7"),
    ("BMW", "IX"),
    ("BMW", "IX1"),
    ("BMW", "IX3"),
    # Mercedes EQ series
    ("Mercedes", "EQS"),
    ("Mercedes", "EQS450"),
    ("Mercedes", "EQS580"),
    ("Mercedes", "EQE"),
    ("Mercedes", "EQE350"),
    ("Mercedes", "EQE500"),
    ("Mercedes", "EQA"),
    ("Mercedes", "EQA260"),
    ("Mercedes", "EQB"),
    ("Mercedes", "EQC"),
    # BYD pure EV
    ("BYD", "Seal"),
    ("BYD", "Han"),
    ("BYD", "Dolphin"),
    ("BYD", "Atto 3"),
    ("BYD", "Seagull"),
    ("BYD", "Ocean"),
    # Porsche
    ("Porsche", "Taycan"),
    # GMC
    ("GMC", "Hummer EV"),
    # BAIC
    ("BAIC", "EU5 Plus"),
    # MG electric
    ("MG", "Cyberster"),
    ("MG", "4"),
    ("MG", "Marvel R"),
    # Avatr
    ("Avatr", "07"),
    ("Avatr", "11"),
    ("Avatr", "12"),
    # Hyundai / Kia electric
    ("Hyundai", "Ioniq 5"),
    ("Hyundai", "Ioniq 6"),
    ("Kia", "EV6"),
    ("Kia", "EV9"),
}

# Hybrid models: enforce hybrid fuel + Automatic
HYBRID_MODELS: set[tuple[str, str]] = {
    ("BYD", "Song Plus DM-i"),
    ("BYD", "Han DM-i"),
    ("BYD", "Tang DM-i"),
    ("BYD", "Song Pro DM-i"),
}


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


def atomic_replace(src: Path, dst: Path) -> None:
    os.replace(src, dst)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Fix EV fuel/transmission values for pure EV models")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("ml-service/data/lookups/AI_lookup.fixed.csv"),
        help="Input CSV (default: ml-service/data/lookups/AI_lookup.fixed.csv)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output CSV (default: <input>.ev_fixed.csv)",
    )
    parser.add_argument("--in-place", action="store_true", help="Overwrite input (creates timestamped .bak)")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only; do not write")

    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input file not found: {args.input}", file=sys.stderr)
        return 2

    fieldnames, rows = read_csv(args.input)

    required = {"make", "model", "transmission", "fuel"}
    missing = required - set(fieldnames)
    if missing:
        raise ValueError(f"Missing required columns {sorted(missing)} in {args.input}")

    normalized_ev = {(norm_text(m), norm_text(md)) for (m, md) in PURE_EV_MODELS}
    normalized_hybrid = {(norm_text(m), norm_text(md)) for (m, md) in HYBRID_MODELS}

    changed_ev = 0
    changed_hybrid = 0
    changed_by_model: dict[str, int] = {}

    out_rows: list[dict[str, str]] = []
    for row in rows:
        make = norm_text(row.get("make", ""))
        model = norm_text(row.get("model", ""))

        if (make, model) in normalized_ev:
            needs = norm_text(row.get("fuel", "")) != "electric" or norm_text(row.get("transmission", "")) != "automatic"
            if needs:
                row = dict(row)
                row["fuel"] = "electric"
                row["transmission"] = "Automatic"
                changed_ev += 1
                key = f"{make} | {model}"
                changed_by_model[key] = changed_by_model.get(key, 0) + 1

        elif (make, model) in normalized_hybrid:
            needs = norm_text(row.get("fuel", "")) != "hybrid" or norm_text(row.get("transmission", "")) != "automatic"
            if needs:
                row = dict(row)
                row["fuel"] = "hybrid"
                row["transmission"] = "Automatic"
                changed_hybrid += 1
                key = f"{make} | {model}"
                changed_by_model[key] = changed_by_model.get(key, 0) + 1

        out_rows.append(row)

    summary = {
        "input": str(args.input),
        "rows_in": len(rows),
        "ev_rows_changed": changed_ev,
        "hybrid_rows_changed": changed_hybrid,
        "rows_changed_by_model": dict(sorted(changed_by_model.items(), key=lambda x: (-x[1], x[0]))),
    }

    if args.dry_run:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    if args.in_place:
        timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = args.input.with_suffix(args.input.suffix + f".{timestamp}.bak")
        tmp = args.input.with_suffix(args.input.suffix + ".tmp")
        shutil.copy2(args.input, backup)
        write_csv(tmp, fieldnames, out_rows)
        atomic_replace(tmp, args.input)
        print(f"Backup written: {backup}")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    output = args.output or args.input.with_suffix(args.input.suffix + ".ev_fixed.csv")
    write_csv(output, fieldnames, out_rows)
    print(json.dumps({**summary, "output": str(output)}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
