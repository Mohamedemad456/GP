#!/usr/bin/env python3
"""Central version manager for data snapshots.

Tracks raw / cleaned / processed data versions via data/data_manifest.json.
Each version has a date + counter tag (e.g. 2026-05-24_001; 2026-05-24_002
for a same-day re-pull). This is the only file that knows the naming convention
and manifest location — no other script should hardcode version paths.

Design:
  - Date-based tags (not v1/v2) — self-documenting, naturally ordered
  - Fixed-path files (cars_with_make_model.csv, processed_data.csv) are always
    copies of the latest versioned file — backward compat for notebooks/API
  - Manifest is the truth; file system is just storage
  - Atomic manifest writes (write tmp → rename)

CLI:
    python version_manager.py seed             # register current files as initial version (dry-run)
    python version_manager.py seed --apply     # actually seed
    python version_manager.py list             # list all versions
    python version_manager.py current          # show current version details as JSON
    python version_manager.py rollback 2026-05-01         # dry-run rollback
    python version_manager.py rollback 2026-05-01 --apply # apply rollback
    python version_manager.py verify           # check all manifest files exist on disk
    python version_manager.py new-tag          # print the next available tag
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import shutil
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data"

MANIFEST_PATH = DATA_ROOT / "data_manifest.json"

RAW_SNAPSHOTS_DIR = DATA_ROOT / "raw" / "snapshots"
CLEANED_DIR = DATA_ROOT / "cleaned"
PROCESSED_VERSIONS_DIR = DATA_ROOT / "processed" / "versions"

CURRENT_RAW_PATH = DATA_ROOT / "raw" / "cars_with_make_model.csv"
CURRENT_PROCESSED_PATH = DATA_ROOT / "processed" / "processed_data.csv"


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class DataVersion:
    tag: str
    created_at: str
    raw_path: str
    cleaned_path: str
    processed_path: str
    raw_fingerprint: Optional[str] = None
    raw_rows: Optional[int] = None
    cleaned_rows: Optional[int] = None
    processed_rows: Optional[int] = None
    scraping_num: Optional[int] = None       # Supabase scraping round (1, 2, 3, …)
    model_trained_on: Optional[str] = None


@dataclass
class _Manifest:
    current_version: str
    versions: dict[str, DataVersion] = field(default_factory=dict)


def _tag_to_safe(tag: str) -> str:
    """Sanitise tag for use in filenames.

    New format  2026-05-24_001 → already safe (underscores are valid).
    Legacy format 2026-05-24.2 → 2026-05-24-2 (dots replaced for safety).
    """
    return tag.replace(".", "-")


def _rel(path: Path) -> str:
    """Return a project-root-relative path string (portable across machines)."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


# ── VersionManager ─────────────────────────────────────────────────────────────

class VersionManager:
    """Read / write data_manifest.json. Generate version tags. Resolve versioned paths."""

    def __init__(self, manifest_path: Path = MANIFEST_PATH) -> None:
        self.manifest_path = manifest_path
        self._manifest: Optional[_Manifest] = None

    # ── Manifest I/O ──────────────────────────────────────────────────────────

    def _load(self) -> _Manifest:
        if self._manifest is not None:
            return self._manifest
        if not self.manifest_path.exists():
            self._manifest = _Manifest(current_version="")
            return self._manifest
        with open(self.manifest_path) as f:
            raw = json.load(f)
        versions = {
            tag: DataVersion(**v)
            for tag, v in raw.get("versions", {}).items()
        }
        self._manifest = _Manifest(
            current_version=raw.get("current_version", ""),
            versions=versions,
        )
        return self._manifest

    def _save(self, manifest: _Manifest) -> None:
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "current_version": manifest.current_version,
            "versions": {tag: asdict(v) for tag, v in manifest.versions.items()},
        }
        tmp = self.manifest_path.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(payload, f, indent=2)
        tmp.replace(self.manifest_path)
        self._manifest = manifest

    # ── Version lifecycle ──────────────────────────────────────────────────────

    def next_tag(self) -> str:
        """Today's date tag with a 3-digit counter: YYYY-MM-DD_001, _002, etc.

        Each pull on the same day gets a unique tag so no version is ever
        silently overwritten.
        """
        m = self._load()
        base = dt.date.today().isoformat()
        seq = 1
        while f"{base}_{seq:03d}" in m.versions:
            seq += 1
        return f"{base}_{seq:03d}"

    def build_version(self, tag: str) -> DataVersion:
        """Construct a DataVersion with standard paths for a given tag (not yet registered)."""
        safe = _tag_to_safe(tag)
        return DataVersion(
            tag=tag,
            created_at=dt.datetime.now().isoformat(timespec="seconds"),
            raw_path=_rel(RAW_SNAPSHOTS_DIR / f"cars_raw_{safe}.csv"),
            cleaned_path=_rel(CLEANED_DIR / f"cars_cleaned_{safe}.csv"),
            processed_path=_rel(PROCESSED_VERSIONS_DIR / f"processed_{safe}.csv"),
        )

    def resolve(self, tag: str) -> DataVersion:
        """Return paths for a registered version tag. Raises KeyError if not found."""
        m = self._load()
        if tag not in m.versions:
            raise KeyError(f"Version '{tag}' not found in manifest")
        return m.versions[tag]

    def latest(self) -> Optional[DataVersion]:
        """Return the current version, or None if no versions registered."""
        m = self._load()
        if not m.current_version:
            return None
        return m.versions.get(m.current_version)

    def register(self, version: DataVersion) -> None:
        """Add version to manifest and set as current. Overwrites if tag exists."""
        m = self._load()
        m.versions[version.tag] = version
        m.current_version = version.tag
        self._save(m)

    def set_current(self, tag: str) -> None:
        """Point current_version to an existing tag (rollback)."""
        m = self._load()
        if tag not in m.versions:
            raise KeyError(f"Version '{tag}' not in manifest")
        m.current_version = tag
        self._save(m)

    def list_versions(self) -> list[DataVersion]:
        """All versions, newest-tag first."""
        return sorted(
            self._load().versions.values(),
            key=lambda v: v.tag,
            reverse=True,
        )

    # ── File helpers ──────────────────────────────────────────────────────────

    def ensure_dirs(self) -> None:
        """Create all versioned directories if they don't exist."""
        for d in [RAW_SNAPSHOTS_DIR, CLEANED_DIR, PROCESSED_VERSIONS_DIR]:
            d.mkdir(parents=True, exist_ok=True)

    def update_current_copies(self, version: DataVersion) -> None:
        """Copy versioned cleaned + processed files to fixed-path locations."""
        cleaned = Path(version.cleaned_path)
        if not cleaned.is_absolute():
            cleaned = PROJECT_ROOT / cleaned
        processed = Path(version.processed_path)
        if not processed.is_absolute():
            processed = PROJECT_ROOT / processed
        if cleaned.exists():
            shutil.copy2(cleaned, CURRENT_RAW_PATH)
        if processed.exists():
            shutil.copy2(processed, CURRENT_PROCESSED_PATH)

    def fingerprint_file(self, path: Path) -> str:
        """SHA-256 fingerprint of a file."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65_536), b""):
                h.update(chunk)
        return f"sha256:{h.hexdigest()}"

    @staticmethod
    def count_rows(path: Path) -> int:
        """Count data rows in a CSV (total lines minus header)."""
        with open(path, encoding="utf-8", errors="replace") as f:
            return max(0, sum(1 for _ in f) - 1)

    # ── Verification ──────────────────────────────────────────────────────────

    def verify(self) -> list[str]:
        """Check all registered versioned files exist on disk. Returns list of missing."""
        missing: list[str] = []
        for v in self._load().versions.values():
            for attr in ("raw_path", "cleaned_path", "processed_path"):
                p = Path(getattr(v, attr))
                if not p.exists():
                    missing.append(f"[{v.tag}] {attr}: {p}")
        return missing


# ── CLI commands ───────────────────────────────────────────────────────────────

def cmd_seed(args: argparse.Namespace) -> int:
    """Register current fixed-path files as the initial version."""
    if not CURRENT_RAW_PATH.exists():
        print(f"ERROR: raw file not found: {CURRENT_RAW_PATH}", file=sys.stderr)
        return 1
    if not CURRENT_PROCESSED_PATH.exists():
        print(f"ERROR: processed file not found: {CURRENT_PROCESSED_PATH}", file=sys.stderr)
        return 1

    vm = VersionManager()
    tag = args.tag or dt.date.today().isoformat()

    if tag in vm._load().versions:
        print(f"Version '{tag}' already exists. Use a different --tag.")
        return 1

    safe = _tag_to_safe(tag)
    raw_dest = RAW_SNAPSHOTS_DIR / f"cars_raw_{safe}.csv"
    cleaned_dest = CLEANED_DIR / f"cars_cleaned_{safe}.csv"
    processed_dest = PROCESSED_VERSIONS_DIR / f"processed_{safe}.csv"

    print(f"Seeding version: {tag}")
    print(f"  Source raw:       {CURRENT_RAW_PATH}")
    print(f"  Source processed: {CURRENT_PROCESSED_PATH}")
    print(f"  → Raw snapshot:   {raw_dest}")
    print(f"  → Cleaned:        {cleaned_dest}")
    print(f"  → Processed:      {processed_dest}")
    print(f"  → Manifest:       {MANIFEST_PATH}")

    if not args.apply:
        print("\nDry run — pass --apply to seed.")
        return 0

    vm.ensure_dirs()
    shutil.copy2(CURRENT_RAW_PATH, raw_dest)
    shutil.copy2(CURRENT_RAW_PATH, cleaned_dest)
    shutil.copy2(CURRENT_PROCESSED_PATH, processed_dest)

    fp = vm.fingerprint_file(raw_dest)
    raw_rows = vm.count_rows(raw_dest)
    cleaned_rows = vm.count_rows(cleaned_dest)
    processed_rows = vm.count_rows(processed_dest)

    version = DataVersion(
        tag=tag,
        created_at=dt.datetime.now().isoformat(timespec="seconds"),
        raw_path=_rel(raw_dest),
        cleaned_path=_rel(cleaned_dest),
        processed_path=_rel(processed_dest),
        raw_fingerprint=fp,
        raw_rows=raw_rows,
        cleaned_rows=cleaned_rows,
        processed_rows=processed_rows,
    )
    vm.register(version)

    print(f"\nDone: {raw_rows} raw rows, {cleaned_rows} cleaned rows, {processed_rows} processed rows")
    print(f"Manifest written → {MANIFEST_PATH}")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    vm = VersionManager()
    versions = vm.list_versions()
    if not versions:
        print("No versions registered.")
        return 0
    current = vm.latest()
    print(f"{'TAG':<20} {'CREATED':<22} {'RAW':>8} {'CLEANED':>8} {'PROCESSED':>10}  MODEL")
    print("-" * 84)
    for v in versions:
        marker = " ◀ current" if current and v.tag == current.tag else ""
        raw_r = str(v.raw_rows) if v.raw_rows is not None else "?"
        cln_r = str(v.cleaned_rows) if v.cleaned_rows is not None else "?"
        prc_r = str(v.processed_rows) if v.processed_rows is not None else "?"
        model = (v.model_trained_on or "—")[:20]
        print(f"{v.tag:<20} {v.created_at:<22} {raw_r:>8} {cln_r:>8} {prc_r:>10}  {model}{marker}")
    return 0


def cmd_current(args: argparse.Namespace) -> int:
    vm = VersionManager()
    v = vm.latest()
    if v is None:
        print("No current version set.")
        return 1
    print(json.dumps(asdict(v), indent=2))
    return 0


def cmd_rollback(args: argparse.Namespace) -> int:
    vm = VersionManager()
    tag = args.tag
    try:
        version = vm.resolve(tag)
    except KeyError:
        print(f"ERROR: Version '{tag}' not found.", file=sys.stderr)
        return 1
    print(f"Rolling back current → {tag}")
    print(f"  cleaned  → {version.cleaned_path}")
    print(f"  processed → {version.processed_path}")
    if not args.apply:
        print("Dry run — pass --apply to apply rollback.")
        return 0
    vm.set_current(tag)
    vm.update_current_copies(version)
    print(f"Done. Fixed-path files now point to version {tag}.")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    vm = VersionManager()
    missing = vm.verify()
    if not missing:
        versions = vm.list_versions()
        print(f"OK — all {len(versions)} version(s) have all files present.")
        return 0
    print(f"Missing {len(missing)} file(s):")
    for m in missing:
        print(f"  {m}")
    return 1


def cmd_new_tag(args: argparse.Namespace) -> int:
    print(VersionManager().next_tag())
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Data version manager for KARNA ML pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_seed = sub.add_parser("seed", help="Register current files as the initial version")
    p_seed.add_argument("--apply", action="store_true", help="Actually seed (default: dry-run)")
    p_seed.add_argument("--tag", help="Override version tag (default: today's date)")
    p_seed.set_defaults(func=cmd_seed)

    p_list = sub.add_parser("list", help="List all versions")
    p_list.set_defaults(func=cmd_list)

    p_current = sub.add_parser("current", help="Show current version as JSON")
    p_current.set_defaults(func=cmd_current)

    p_roll = sub.add_parser("rollback", help="Set current to an older version")
    p_roll.add_argument("tag", help="Version tag to roll back to")
    p_roll.add_argument("--apply", action="store_true", help="Actually apply rollback (default: dry-run)")
    p_roll.set_defaults(func=cmd_rollback)

    p_verify = sub.add_parser("verify", help="Check all manifest files exist on disk")
    p_verify.set_defaults(func=cmd_verify)

    p_newtag = sub.add_parser("new-tag", help="Print the next available version tag")
    p_newtag.set_defaults(func=cmd_new_tag)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
