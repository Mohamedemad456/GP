#!/usr/bin/env python3
"""Parse a car listing title into (make, model) columns.

The raw Supabase table stores only `title` (e.g. "Toyota Corolla 2019").
This module extracts `make` and `model` from that string so the rest of
the cleaning pipeline can operate on structured columns.

Strategy:
  1. Normalize whitespace, strip trailing punctuation/bullet.
  2. Strip trailing 4-digit year.
  3. Match multi-word makes first (longest match wins, e.g. "Land Rover").
  4. Fall back to first word as make.
  5. Remaining words = model.
  6. Apply canonicalize_make() to normalize casing (e.g. "byd" → "BYD").

Multi-word makes are defined in MULTI_WORD_MAKES below — extend as needed.

Usage:
    from scripts.data.parse_title import parse_title, enrich_with_make_model
    df = enrich_with_make_model(df)  # adds 'make' and 'model' columns in-place
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.data.make_model_canonical import canonicalize_make, load_rules

# Multi-word makes — checked before single-word fallback (longest match wins)
MULTI_WORD_MAKES: list[str] = [
    "Land Rover",
    "Alfa Romeo",
    "Aston Martin",
    "Rolls Royce",
    "Great Wall",
    "Ssang Yong",
]

# Multi-word prefixes that map to a different canonical make name
# e.g. titles starting with "Range Rover" belong to make "Land Rover"
MULTI_WORD_MAKE_REMAPS: dict[str, str] = {
    "range rover": "Land Rover",
}

# Normalised lookup: lowercase-no-space → canonical casing
_MULTI_WORD_NORM: dict[str, str] = {
    re.sub(r"\s+", "", m.lower()): m for m in MULTI_WORD_MAKES
}
# Remap: normalised prefix → canonical make override
_REMAP_NORM: dict[str, str] = {
    re.sub(r"\s+", "", k): v for k, v in MULTI_WORD_MAKE_REMAPS.items()
}

_YEAR_SUFFIX_RE = re.compile(r"\s+\d{4}\s*$")
_EXTRA_PUNCT_RE = re.compile(r"[•\.,;:!?]+$")


def _clean_title(title: str) -> str:
    t = str(title).strip()
    t = _EXTRA_PUNCT_RE.sub("", t)
    t = re.sub(r"\s+", " ", t)
    return t


def parse_title(title: Any) -> tuple[str, str]:
    """Return (make, model) parsed from a title string.

    Returns ("", "") if title is null/empty.
    """
    if pd.isna(title) or str(title).strip() == "":
        return ("", "")

    t = _clean_title(title)

    # Strip trailing year (e.g. "Toyota Corolla 2019" → "Toyota Corolla")
    t_no_year = _YEAR_SUFFIX_RE.sub("", t).strip()
    if not t_no_year:
        t_no_year = t  # year-only title edge case

    words = t_no_year.split()
    if not words:
        return ("", "")

    # Try multi-word makes (up to 3 words, longest match first)
    for n in (3, 2):
        if len(words) >= n:
            candidate = " ".join(words[:n])
            key = re.sub(r"\s+", "", candidate.lower())
            if key in _REMAP_NORM:
                # e.g. "Range Rover" → make="Land Rover", model=rest+"Range Rover"
                canonical_make = _REMAP_NORM[key]
                model = candidate.title() + " " + " ".join(w.title() for w in words[n:])
                return (canonical_make, model.strip())
            if key in _MULTI_WORD_NORM:
                raw_make = _MULTI_WORD_NORM[key]
                model = " ".join(w.title() for w in words[n:])
                make = canonicalize_make(raw_make)
                return (make, model.strip())

    # Single-word make (most common case)
    raw_make = words[0].title()
    model = " ".join(w.title() for w in words[1:])
    make = canonicalize_make(raw_make)
    return (make, model.strip())


def enrich_with_make_model(df: pd.DataFrame) -> pd.DataFrame:
    """Add 'make' and 'model' columns derived from 'title'.

    Skips rows that already have both make and model populated.
    Operates on a copy and returns it.
    """
    if "title" not in df.columns:
        raise ValueError("DataFrame must have a 'title' column.")

    out = df.copy()

    already_have = (
        "make" in out.columns
        and "model" in out.columns
        and out["make"].notna().all()
        and out["model"].notna().all()
    )
    if already_have:
        return out

    parsed = out["title"].apply(parse_title)
    out["make"] = parsed.apply(lambda x: x[0])
    out["model"] = parsed.apply(lambda x: x[1])

    # Apply canonical casing via rules (handles aliases like "byd" → "BYD")
    # already done inside parse_title → canonicalize_make

    return out


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test title parsing on a CSV file.")
    parser.add_argument("csv", type=Path, help="CSV file with a 'title' column")
    parser.add_argument("--rows", type=int, default=20, help="Rows to show (default 20)")
    args = parser.parse_args()

    df_test = pd.read_csv(args.csv, nrows=args.rows * 5)
    df_test = enrich_with_make_model(df_test)
    print(df_test[["title", "make", "model"]].head(args.rows).to_string(index=False))
