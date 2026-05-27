from __future__ import annotations

import re
import string
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RULES_PATH = PROJECT_ROOT / "src" / "config" / "canonical_rules.yaml"

_SPACE_RE = re.compile(r"\s+")
_REMOVE_CHARS = str.maketrans("", "", string.punctuation + " ")


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def norm_key(text: Any) -> str:
    text = _strip_diacritics(str(text))
    text = _SPACE_RE.sub(" ", text.strip().lower())
    return text.translate(_REMOVE_CHARS)


@lru_cache(maxsize=4)
def load_rules(rules_path: str | Path | None = None) -> dict[str, Any]:
    path = Path(rules_path) if rules_path is not None else DEFAULT_RULES_PATH
    if not path.exists():
        raise FileNotFoundError(f"Canonical rules file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data


def canonicalize_make(make: Any, rules: dict[str, Any] | None = None) -> str:
    make_text = "" if make is None else str(make).strip()
    rules_data = rules if rules is not None else load_rules()
    aliases = rules_data.get("make_aliases", {}) or {}
    normalized_aliases = {norm_key(k): v for k, v in aliases.items()}
    return str(normalized_aliases.get(norm_key(make_text), make_text))


def canonicalize_model(make: Any, model: Any, rules: dict[str, Any] | None = None) -> str:
    model_text = "" if model is None else str(model).strip()
    rules_data = rules if rules is not None else load_rules()
    canonical_make = canonicalize_make(make, rules_data)
    aliases_by_make = rules_data.get("model_aliases_by_make", {}) or {}
    make_aliases = aliases_by_make.get(canonical_make, {}) or {}
    normalized_aliases = {norm_key(k): v for k, v in make_aliases.items()}
    return str(normalized_aliases.get(norm_key(model_text), model_text))


def canonicalize_pair(make: Any, model: Any, rules: dict[str, Any] | None = None) -> dict[str, Any]:
    make_text = "" if make is None else str(make).strip()
    model_text = "" if model is None else str(model).strip()
    rules_data = rules if rules is not None else load_rules()
    canonical_make = canonicalize_make(make_text, rules_data)
    canonical_model = canonicalize_model(canonical_make, model_text, rules_data)
    return {
        "canonical_make": canonical_make,
        "canonical_model": canonical_model,
        "make_changed": canonical_make != make_text,
        "model_changed": canonical_model != model_text,
    }
