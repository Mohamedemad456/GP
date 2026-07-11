#!/usr/bin/env python3
"""
Model Version Manager — Interactive CLI
========================================
Manages model versions and active model selection for the ML pricing engine.

Versioning scheme:
  - v<major>.<minor>.0
  - Major bumps on architecture changes or retraining on new data
  - Minor auto-increments for each new model within the same major version

Usage:
  python cli/manage_models.py                  # Interactive menu
  python cli/manage_models.py status           # Show current status
  python cli/manage_models.py activate         # Choose model to activate
  python cli/manage_models.py bump-major       # Bump to next major version
  python cli/manage_models.py register         # Register a new model
  python cli/manage_models.py history          # Show version history
"""

import json
import sys
import datetime as dt
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent  # cli/ -> ml-service/
REGISTRY_PATH = PROJECT_ROOT / "models" / "model_registry.json"

# ---------------------------------------------------------------------------
# Registry I/O
# ---------------------------------------------------------------------------

def load_registry() -> dict[str, Any]:
    if not REGISTRY_PATH.exists():
        return {
            "schema_version": "2.0",
            "active_model_id": None,
            "active_version": None,
            "promoted_at": None,
            "models": {},
        }
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry: dict[str, Any]) -> None:
    allowed_top_keys = {
        "schema_version", "active_model_id", "active_version",
        "promoted_at", "models",
    }
    registry.setdefault("schema_version", "2.0")
    cleaned = {k: v for k, v in registry.items() if k in allowed_top_keys}
    cleaned.setdefault("models", {})
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Registry saved → {REGISTRY_PATH}")


# ---------------------------------------------------------------------------
# Version helpers
# ---------------------------------------------------------------------------

def parse_version(version_str: str) -> tuple[int, int, int]:
    """Parse 'v1.2.0' or '1.2.0' → (1, 2, 0)"""
    v = version_str.lstrip("v")
    parts = v.split(".")
    major = int(parts[0]) if len(parts) > 0 else 1
    minor = int(parts[1]) if len(parts) > 1 else 0
    patch = int(parts[2]) if len(parts) > 2 else 0
    return (major, minor, patch)


def format_version(major: int, minor: int, patch: int = 0) -> str:
    return f"v{major}.{minor}.{patch}"


def get_current_major(registry: dict) -> int:
    """Get the highest major version from all models in the registry."""
    models = registry.get("models", {})
    if not models:
        return 1
    max_major = 0
    for info in models.values():
        ver = info.get("version", "v1.0.0")
        major, _, _ = parse_version(ver)
        if major > max_major:
            max_major = major
    return max_major if max_major > 0 else 1


def get_next_minor(registry: dict, major: int) -> int:
    """Get the next available minor version for a given major."""
    models = registry.get("models", {})
    max_minor = -1
    for info in models.values():
        ver = info.get("version", "v0.0.0")
        m, minor, _ = parse_version(ver)
        if m == major and minor > max_minor:
            max_minor = minor
    return max_minor + 1


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_status():
    """Display the current model registry status."""
    reg = load_registry()
    active_id = reg.get("active_model_id")
    active_ver = reg.get("active_version")
    promoted = reg.get("promoted_at", "N/A")
    current_major = get_current_major(reg)

    print("\n" + "=" * 65)
    print("  MODEL REGISTRY STATUS")
    print("=" * 65)
    print(f"  Current Major Version : v{current_major}")
    print(f"  Active Model          : {active_id or 'None'}")
    print(f"  Active Version        : {active_ver or 'None'}")
    print(f"  Promoted At           : {promoted}")
    print("-" * 65)

    models = reg.get("models", {})
    if not models:
        print("  No models registered.")
    else:
        print(f"  {'#':<3} {'Model ID':<40} {'Version':<10} {'Stage':<12} {'MAPE%':<8}")
        print("  " + "-" * 62)
        for i, (mid, info) in enumerate(models.items(), 1):
            ver = info.get("version", "?")
            stage = info.get("stage", "?")
            mape = info.get("metrics", {}).get("MAPE_pct", "N/A")
            marker = " ◀ ACTIVE" if mid == active_id else ""
            print(f"  {i:<3} {mid:<40} {ver:<10} {stage:<12} {mape:<8}{marker}")

    print("=" * 65 + "\n")


def cmd_activate():
    """Interactively choose which model to set as active."""
    reg = load_registry()
    models = reg.get("models", {})

    if not models:
        print("\n✗ No models registered. Register a model first.")
        return

    active_id = reg.get("active_model_id")

    print("\n" + "-" * 65)
    print("  SELECT MODEL TO ACTIVATE")
    print("-" * 65)

    model_list = list(models.items())
    for i, (mid, info) in enumerate(model_list, 1):
        ver = info.get("version", "?")
        stage = info.get("stage", "?")
        framework = info.get("framework", "?")
        mape = info.get("metrics", {}).get("MAPE_pct", "N/A")
        marker = " ◀ CURRENT" if mid == active_id else ""
        print(f"  [{i}] {mid}")
        print(f"      Version: {ver} | Framework: {framework} | MAPE: {mape}%{marker}")

    print(f"\n  [0] Cancel")
    print("-" * 65)

    while True:
        try:
            choice = input("\n  Enter your choice (number): ").strip()
            if choice == "0":
                print("  Cancelled.")
                return
            idx = int(choice) - 1
            if 0 <= idx < len(model_list):
                break
            print(f"  Please enter a number between 0 and {len(model_list)}")
        except (ValueError, KeyboardInterrupt):
            print("\n  Cancelled.")
            return

    chosen_id, chosen_info = model_list[idx]

    if chosen_id == active_id:
        print(f"\n  '{chosen_id}' is already the active model.")
        return

    # Archive current active model
    if active_id and active_id in models:
        models[active_id]["stage"] = "archived"

    # Promote chosen model
    models[chosen_id]["stage"] = "production"
    reg["active_model_id"] = chosen_id
    reg["active_version"] = chosen_info.get("version", "unknown")
    reg["promoted_at"] = dt.datetime.now(dt.timezone.utc).isoformat()

    save_registry(reg)
    print(f"  ✓ Model '{chosen_id}' is now ACTIVE (version {chosen_info.get('version')})")
    print("  ⚠ Restart the ML service for changes to take effect.\n")


def cmd_bump_major():
    """Bump to the next major version (for architecture changes or new data)."""
    reg = load_registry()
    current_major = get_current_major(reg)
    new_major = current_major + 1

    print("\n" + "-" * 65)
    print("  MAJOR VERSION BUMP")
    print("-" * 65)
    print(f"  Current major version: v{current_major}")
    print(f"  New major version:     v{new_major}")
    print()
    print("  Use this when:")
    print("    • Model architecture has significantly changed")
    print("    • Retrained on new, time-relevant data")
    print("    • Feature engineering was overhauled")
    print("-" * 65)

    confirm = input(f"\n  Confirm bump to v{new_major}? [y/N]: ").strip().lower()
    if confirm not in ("y", "yes"):
        print("  Cancelled.")
        return

    # Archive all current models (they belong to old major version)
    models = reg.get("models", {})
    for mid, info in models.items():
        if info.get("stage") == "production":
            info["stage"] = "archived"

    reg["active_model_id"] = None
    reg["active_version"] = None
    reg["promoted_at"] = None

    save_registry(reg)
    print(f"\n  ✓ Major version bumped to v{new_major}")
    print(f"  → Next model you register will be v{new_major}.0.0")
    print("  → Register and activate a new model to resume predictions.\n")


def cmd_register():
    """Interactively register a new model into the registry."""
    reg = load_registry()
    current_major = get_current_major(reg)
    next_minor = get_next_minor(reg, current_major)
    next_version = format_version(current_major, next_minor)

    print("\n" + "-" * 65)
    print("  REGISTER NEW MODEL")
    print("-" * 65)
    print(f"  Auto-assigned version: {next_version}")
    print("-" * 65)

    try:
        model_id = input("  Model ID (unique name, e.g. 'xgboost_v2_retrained'): ").strip()
        if not model_id:
            print("  Cancelled — model ID is required.")
            return

        if model_id in reg.get("models", {}):
            print(f"  ✗ Model '{model_id}' already exists in registry.")
            return

        framework = input("  Framework (sklearn/XGBoost/LightGBM/ensemble): ").strip() or "sklearn"
        pkl_path = input("  Pickle path (relative to ml-service/, e.g. models/pickles/my_model.joblib): ").strip()
        if not pkl_path:
            print("  Cancelled — pkl_path is required.")
            return
        meta_path = input("  Metadata JSON path (or press Enter to skip): ").strip() or ""
        source_notebook = input("  Source notebook (or press Enter to skip): ").strip() or None

        # Metrics
        print("\n  Enter metrics (press Enter to skip each):")
        metrics = {}
        for metric_name in ["MAPE_pct", "MAE", "RMSE", "R2", "Within_10pct", "Within_15pct"]:
            val = input(f"    {metric_name}: ").strip()
            if val:
                try:
                    metrics[metric_name] = float(val)
                except ValueError:
                    pass

        # Confirm
        print(f"\n  Summary:")
        print(f"    ID:        {model_id}")
        print(f"    Version:   {next_version}")
        print(f"    Framework: {framework}")
        print(f"    Pickle:    {pkl_path}")
        if metrics:
            print(f"    Metrics:   {metrics}")

        confirm = input("\n  Register this model? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("  Cancelled.")
            return

        models = reg.setdefault("models", {})
        models[model_id] = {
            "model_id": model_id,
            "framework": framework,
            "version": next_version,
            "stage": "candidate",
            "pkl_path": pkl_path,
            "meta_path": meta_path,
            "metrics": metrics,
            "artifacts": {},
            "source_notebook": source_notebook,
            "registered_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }

        save_registry(reg)
        print(f"\n  ✓ Model '{model_id}' registered as {next_version} (stage: candidate)")

        # Ask if they want to activate it immediately
        activate_now = input("  Activate this model now? [y/N]: ").strip().lower()
        if activate_now in ("y", "yes"):
            # Re-load in case save changed things
            reg = load_registry()
            models = reg.get("models", {})
            prev_id = reg.get("active_model_id")
            if prev_id and prev_id in models:
                models[prev_id]["stage"] = "archived"
            models[model_id]["stage"] = "production"
            reg["active_model_id"] = model_id
            reg["active_version"] = next_version
            reg["promoted_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
            save_registry(reg)
            print(f"  ✓ Model '{model_id}' is now ACTIVE.\n")
        else:
            print(f"  Model registered but NOT active. Use 'activate' to promote it.\n")

    except KeyboardInterrupt:
        print("\n  Cancelled.")
        return


def cmd_history():
    """Show version history of all registered models."""
    reg = load_registry()
    models = reg.get("models", {})

    if not models:
        print("\n  No models in registry.\n")
        return

    # Group by major version
    versions: dict[int, list] = {}
    for mid, info in models.items():
        ver = info.get("version", "v1.0.0")
        major, minor, patch = parse_version(ver)
        versions.setdefault(major, []).append((minor, patch, mid, info))

    print("\n" + "=" * 65)
    print("  VERSION HISTORY")
    print("=" * 65)

    for major in sorted(versions.keys()):
        print(f"\n  ── v{major}.x ──")
        entries = sorted(versions[major], key=lambda x: (x[0], x[1]))
        for minor, patch, mid, info in entries:
            stage = info.get("stage", "?")
            registered = info.get("registered_at", "?")[:10]
            framework = info.get("framework", "?")
            mape = info.get("metrics", {}).get("MAPE_pct", "?")
            print(f"    v{major}.{minor}.{patch}  {mid}")
            print(f"           Framework: {framework} | MAPE: {mape}% | Stage: {stage} | Registered: {registered}")

    print("\n" + "=" * 65 + "\n")


def cmd_interactive_menu():
    """Main interactive menu."""
    while True:
        print("\n" + "=" * 65)
        print("  KARNA ML — MODEL VERSION MANAGER")
        print("=" * 65)
        print("  [1] Status        — View current registry state")
        print("  [2] Activate      — Choose which model to use")
        print("  [3] Register      — Add a new model")
        print("  [4] Bump Major    — New major version (new data / architecture)")
        print("  [5] History       — Version timeline")
        print("  [0] Exit")
        print("=" * 65)

        try:
            choice = input("\n  Enter choice: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n  Bye!")
            break

        if choice == "1":
            cmd_status()
        elif choice == "2":
            cmd_activate()
        elif choice == "3":
            cmd_register()
        elif choice == "4":
            cmd_bump_major()
        elif choice == "5":
            cmd_history()
        elif choice == "0":
            print("\n  Bye!")
            break
        else:
            print("  Invalid choice. Try again.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    if not args:
        cmd_interactive_menu()
    elif args[0] == "status":
        cmd_status()
    elif args[0] == "activate":
        cmd_activate()
    elif args[0] in ("bump-major", "bump"):
        cmd_bump_major()
    elif args[0] == "register":
        cmd_register()
    elif args[0] == "history":
        cmd_history()
    else:
        print(f"Unknown command: {args[0]}")
        print("Available: status, activate, bump-major, register, history")
        sys.exit(1)


if __name__ == "__main__":
    main()
