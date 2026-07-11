#!/usr/bin/env python3
"""Versioned data pipeline — clean and process a raw snapshot.

Wraps clean_raw_data_pipeline.py and generate_processed_data.py to produce
immutable versioned output files, registered in data/data_manifest.json.

Workflow:
  1. Determine version tag: YYYY-MM-DD_{scraping_num:03d} when scraping_num is
     known (e.g. 2026-06-03_008 for round 8), else YYYY-MM-DD_001/_002/… counter
  2. Fingerprint check — skip if raw data is unchanged since last version
     (use --force to bypass)
  3. Copy raw → data/raw/snapshots/cars_raw_YYYY-MM-DD_NNN.csv  (immutable)
  4. Copy raw → data/cleaned/cars_cleaned_YYYY-MM-DD_NNN.csv    (will be cleaned)
  5. Run clean_raw_data_pipeline.py --apply on the cleaned copy
  6. Run generate_processed_data.py --apply on the cleaned copy → versioned processed file
  7. Register version in data/data_manifest.json
  8. Copy latest versioned files to fixed-path locations (backward compat)

Usage:
    python data_pipeline.py                                     # dry-run (show plan only)
    python data_pipeline.py --apply                             # full pipeline on current raw
    python data_pipeline.py --apply --raw <path>                # specify raw input
    python data_pipeline.py --apply --tag 2026-05-24_001        # explicit version tag
    python data_pipeline.py --apply --skip-clean                # skip cleaning stage
    python data_pipeline.py --apply --skip-process              # cleaning only
    python data_pipeline.py --apply --raw <path> --force        # re-run even if unchanged

Typical new-round workflow (or use `make pull` / `make pipeline`):
    python scripts/data/data_loader.py --scraping-num 3 --csv
    python scripts/cleaning/data_pipeline.py --apply --raw data/raw/cars_raw_vNNN.csv
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = PROJECT_ROOT / "data" / "logs"
RUN_LOG_DIR = LOG_DIR / "runs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _resolve_path(path_str: str) -> Path:
    """Resolve a manifest path (relative or absolute) to an absolute Path."""
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p

from scripts.cleaning.version_manager import (
    CURRENT_RAW_PATH,
    DataVersion,
    VersionManager,
)

# Logger (will be configured in main() after args are parsed)
_pipeline_log = logging.getLogger("data_pipeline")
_CURRENT_LOG_PATH: Path | None = None
_CURRENT_RUN_ID: str | None = None

LOOKUP_PATH = PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
CLEANING_SCRIPT = PROJECT_ROOT / "scripts" / "cleaning" / "clean_raw_data_pipeline.py"
PROCESSING_SCRIPT = PROJECT_ROOT / "scripts" / "cleaning" / "generate_processed_data.py"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _setup_logging() -> None:
    """Console + file logger. Sets global run ID and log path for summaries."""
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    global _CURRENT_LOG_PATH, _CURRENT_RUN_ID
    _CURRENT_RUN_ID = ts
    _CURRENT_LOG_PATH = LOG_DIR / f"pipeline_{ts}.log"
    fh = logging.FileHandler(_CURRENT_LOG_PATH, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(message)s"))
    _pipeline_log.setLevel(logging.INFO)
    _pipeline_log.handlers = []
    _pipeline_log.addHandler(fh)
    _pipeline_log.addHandler(sh)


def _save_json(path: Path, payload: dict) -> None:
    """Atomic JSON write (tmp → rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    tmp.replace(path)


def _write_run_summary(summary: dict) -> Path | None:
    """Write structured run summary JSON to data/logs/runs/."""
    if _CURRENT_RUN_ID is None:
        return None
    summary_path = RUN_LOG_DIR / f"pipeline_{_CURRENT_RUN_ID}.json"
    _save_json(summary_path, summary)
    return summary_path


def _extract_scraping_num(raw_path: Path) -> int | None:
    """Auto-detect scraping_num from filename like cars_raw_v001.csv → 1."""
    import re
    m = re.search(r"_v0*(\d+)$", raw_path.stem)
    return int(m.group(1)) if m else None


def _run(cmd: list[str], desc: str) -> int:
    """Print and run a command. Returns exit code."""
    _pipeline_log.info("")
    _pipeline_log.info("[%s]", desc)
    _pipeline_log.info("  $ %s", " ".join(str(c) for c in cmd))
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    return result.returncode


# ── Main pipeline ──────────────────────────────────────────────────────────────

def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def run_pipeline(
    raw_path: Path,
    tag: str | None = None,
    apply: bool = False,
    skip_clean: bool = False,
    skip_process: bool = False,
    force: bool = False,
    scraping_num: int | None = None,
) -> int:
    """Run versioned clean + process pipeline on a raw CSV file.
    Writes a structured JSON run summary to data/logs/runs/ on every exit.
    """
    vm = VersionManager()
    summary: dict = {
        "run_id": _CURRENT_RUN_ID,
        "kind": "data_pipeline",
        "status": "unknown",
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
        "log_path": str(_CURRENT_LOG_PATH) if _CURRENT_LOG_PATH else None,
        "tag": tag,
        "raw_path": str(raw_path),
        "scraping_num": scraping_num,
        "skip_clean": skip_clean,
        "skip_process": skip_process,
        "force": force,
        "fingerprint_unchanged": False,
        "stages": {},
        "error": None,
    }

    # Auto-detect scraping_num from raw filename FIRST so it can drive the tag
    if scraping_num is None:
        auto_sn = _extract_scraping_num(raw_path)
        if auto_sn is not None:
            scraping_num = auto_sn
            summary["scraping_num"] = scraping_num
            _pipeline_log.info("Auto-detected scraping_num=%d from filename", scraping_num)

    if tag is None:
        if scraping_num is not None:
            # Tag suffix = scraping round number → 2026-06-03_008 for round 8
            tag = f"{dt.date.today().isoformat()}_{scraping_num:03d}"
            _pipeline_log.info("Tag derived from scraping_num=%d: %s", scraping_num, tag)
        else:
            tag = vm.next_tag()
    summary["tag"] = tag

    version = vm.build_version(tag)

    _pipeline_log.info("=" * 60)
    _pipeline_log.info("  Version tag:   %s", tag)
    _pipeline_log.info("  Raw input:     %s", raw_path)
    _pipeline_log.info("  Scraping num:  %s", scraping_num)
    _pipeline_log.info("  Raw snapshot:  %s", version.raw_path)
    _pipeline_log.info("  Cleaned:       %s", version.cleaned_path)
    _pipeline_log.info("  Processed:     %s", version.processed_path)
    _pipeline_log.info("  Manifest:      %s", _rel(vm.manifest_path))
    _pipeline_log.info("=" * 60)

    if not raw_path.exists():
        _pipeline_log.error("Raw file not found: %s", raw_path)
        summary["status"] = "failed"
        summary["error"] = f"Raw file not found: {raw_path}"
        summary["exit_code"] = 1
        _write_run_summary(summary)
        return 1

    # ── Fingerprint check ──────────────────────────────────────────────────────
    new_fp = vm.fingerprint_file(raw_path)
    latest = vm.latest()
    if latest and latest.raw_fingerprint == new_fp and not force:
        _pipeline_log.info("Raw data unchanged since version %s. Nothing to do.", latest.tag)
        _pipeline_log.info("  (Use --force or FORCE=1 with make to re-run anyway.)")
        summary["status"] = "skipped"
        summary["fingerprint_unchanged"] = True
        summary["last_version_tag"] = latest.tag
        summary["exit_code"] = 0
        _write_run_summary(summary)
        return 0

    if not apply:
        _pipeline_log.info("Dry run — pass --apply to execute the pipeline.")
        summary["status"] = "dry_run"
        summary["raw_fingerprint"] = new_fp
        summary["exit_code"] = 0
        _write_run_summary(summary)
        return 0

    # ── 1. Create directories ──────────────────────────────────────────────────
    vm.ensure_dirs()

    # ── 2. Copy raw to immutable snapshot ─────────────────────────────────────
    raw_dest = _resolve_path(version.raw_path)
    shutil.copy2(raw_path, raw_dest)
    _pipeline_log.info("Copied raw snapshot → %s", raw_dest)

    raw_rows = vm.count_rows(raw_dest)
    summary["stages"]["raw_snapshot"] = {
        "path": _rel(raw_dest),
        "rows": raw_rows,
    }

    # ── 3. Copy raw to cleaned (this copy will be modified in-place) ───────────
    cleaned_dest = _resolve_path(version.cleaned_path)
    if skip_clean and cleaned_dest.exists():
        _pipeline_log.info("Cleaning skipped — using existing cleaned file: %s", cleaned_dest)
    else:
        shutil.copy2(raw_dest, cleaned_dest)
        _pipeline_log.info("Copied to cleaned:  → %s", cleaned_dest)

    # ── 4. Clean ──────────────────────────────────────────────────────────────
    cleaned_rows: int | None = None
    clean_rc = 0
    if not skip_clean:
        clean_rc = _run(
            [sys.executable, str(CLEANING_SCRIPT), "--apply", "--input", str(cleaned_dest)],
            desc="Stage 1–4: Cleaning",
        )
        if clean_rc != 0:
            _pipeline_log.error("Cleaning script exited with code %d", clean_rc)
            summary["status"] = "failed"
            summary["error"] = f"Cleaning script exited with code {clean_rc}"
            summary["stages"]["clean"] = {"exit_code": clean_rc, "skipped": False}
            summary["exit_code"] = clean_rc
            _write_run_summary(summary)
            return clean_rc
        cleaned_rows = vm.count_rows(cleaned_dest)
        _pipeline_log.info("Cleaned rows: %s", cleaned_rows)
    else:
        cleaned_rows = vm.count_rows(cleaned_dest)
        _pipeline_log.info("Cleaning skipped.")
    summary["stages"]["clean"] = {
        "exit_code": clean_rc,
        "skipped": skip_clean,
        "rows": cleaned_rows,
    }

    # ── 5. Process ────────────────────────────────────────────────────────────
    processed_dest = _resolve_path(version.processed_path)
    processed_dest.parent.mkdir(parents=True, exist_ok=True)
    processed_rows: int | None = None
    process_rc = 0

    if not skip_process:
        process_cmd = [
            sys.executable, str(PROCESSING_SCRIPT),
            "--apply",
            "--raw", str(cleaned_dest),
            "--output", str(processed_dest),
            "--version-tag", tag,
        ]
        if scraping_num is not None:
            process_cmd += ["--scraping-num", str(scraping_num)]
        process_rc = _run(process_cmd, desc="Stage 5–9: Processing")
        if process_rc != 0:
            _pipeline_log.error("Processing script exited with code %d", process_rc)
            summary["status"] = "failed"
            summary["error"] = f"Processing script exited with code {process_rc}"
            summary["stages"]["process"] = {"exit_code": process_rc, "skipped": False}
            summary["exit_code"] = process_rc
            _write_run_summary(summary)
            return process_rc
        processed_rows = vm.count_rows(processed_dest)
        _pipeline_log.info("Processed rows: %s", processed_rows)
    else:
        _pipeline_log.info("Processing skipped.")
    summary["stages"]["process"] = {
        "exit_code": process_rc,
        "skipped": skip_process,
        "rows": processed_rows,
    }

    # ── 6. Register version in manifest ───────────────────────────────────────
    version.raw_fingerprint = new_fp
    version.raw_rows = raw_rows
    version.cleaned_rows = cleaned_rows
    version.processed_rows = processed_rows
    version.scraping_num = scraping_num
    vm.register(version)
    _pipeline_log.info("Registered version %s in manifest.", tag)
    summary["manifest_registered"] = True
    summary["raw_fingerprint"] = new_fp

    # ── 7. Update fixed-path copies (backward compat) ─────────────────────────
    vm.update_current_copies(version)
    _pipeline_log.info("Updated fixed-path copies:")
    _pipeline_log.info("  cars_with_make_model.csv → (from %s)", version.cleaned_path)
    _pipeline_log.info("  processed_data.csv       → (from %s)", version.processed_path)
    summary["fixed_paths_updated"] = True
    summary["fixed_paths"] = {
        "cars_with_make_model.csv": _rel(_resolve_path(version.cleaned_path)),
        "processed_data.csv": _rel(_resolve_path(version.processed_path)),
    }

    _pipeline_log.info("=" * 60)
    _pipeline_log.info("  Pipeline complete: version %s", tag)
    _pipeline_log.info("  %s raw → %s cleaned → %s processed", raw_rows, cleaned_rows, processed_rows)
    if raw_rows and cleaned_rows and raw_rows > 0:
        dedup_dropped = raw_rows - cleaned_rows
        dedup_pct = 100.0 * dedup_dropped / raw_rows
        _pipeline_log.info(
            "  Note: %s rows removed in cleaning (%.0f%% of raw) — "
            "mostly within-round duplicates (same listing scraped on multiple dates).",
            dedup_dropped, dedup_pct,
        )
    _pipeline_log.info("=" * 60)

    summary["status"] = "success"
    summary["row_counts"] = {
        "raw": raw_rows,
        "cleaned": cleaned_rows,
        "processed": processed_rows,
    }
    summary["exit_code"] = 0
    summary_path = _write_run_summary(summary)
    if summary_path is not None:
        _pipeline_log.info("Run summary JSON → %s", summary_path)
    return 0


# ── CLI ────────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Versioned data pipeline: clean + process a raw snapshot.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python data_pipeline.py                          # dry-run\n"
            "  python data_pipeline.py --apply                  # full pipeline\n"
            "  python data_pipeline.py --apply --tag 2026-05-24_001 # explicit tag\n"
            "  python data_pipeline.py --apply --skip-clean     # process only\n"
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute pipeline (default: dry-run)",
    )
    parser.add_argument(
        "--raw",
        type=Path,
        default=CURRENT_RAW_PATH,
        help=f"Input raw CSV (default: {CURRENT_RAW_PATH})",
    )
    parser.add_argument(
        "--tag",
        help="Override version tag (default: today's date, e.g. 2026-05-24)",
    )
    parser.add_argument(
        "--skip-clean",
        action="store_true",
        help="Skip cleaning stage (raw is already clean)",
    )
    parser.add_argument(
        "--skip-process",
        action="store_true",
        help="Skip processing stage (cleaning only)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run even if raw data fingerprint is unchanged.",
    )
    parser.add_argument(
        "--scraping-num",
        type=int,
        default=None,
        help="Supabase scraping round number for this snapshot (e.g. 1, 2, 3).",
    )
    args = parser.parse_args(argv)
    _setup_logging()
    _pipeline_log.info("=== Data Pipeline (%s) ===", "APPLY" if args.apply else "DRY-RUN")
    return run_pipeline(
        raw_path=args.raw,
        tag=args.tag,
        apply=args.apply,
        skip_clean=args.skip_clean,
        skip_process=args.skip_process,
        force=args.force,
        scraping_num=args.scraping_num,
    )


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
