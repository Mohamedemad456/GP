from __future__ import annotations

import string
import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

import yaml

try:
    from rapidfuzz import fuzz, process  # type: ignore

    _RAPIDFUZZ_AVAILABLE = True
except Exception:  # pragma: no cover
    fuzz = None  # type: ignore
    process = None  # type: ignore
    _RAPIDFUZZ_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CarMention:
    make: str
    model: str
    year: int | None = None


@dataclass(frozen=True)
class SearchFilters:
    year_min: int | None = None
    year_max: int | None = None
    transmission: str | None = None  # Automatic/Manual
    fuel: str | None = None  # petrol/diesel/cng/hybrid/electric
    body_type: str | None = None  # Sedan/Hatchback/SUV/Crossover/MPV/Van
    drivetrain: str | None = None  # FWD/RWD/AWD/4WD
    engine_cc_max: int | None = None


_ARABIC_DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")


_PUNCTUATION_RE = re.compile(f"[{re.escape(string.punctuation + '؟،')}]")

def normalize_arabic(text: str) -> str:
    text = text.strip().lower()
    text = _PUNCTUATION_RE.sub(" ", text)
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    # Unify common letter variants
    text = re.sub(r"[إأآا]", "ا", text)
    text = text.replace("ى", "ي")
    text = text.replace("ؤ", "و").replace("ئ", "ي")
    text = text.replace("ة", "ه")
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_latin(text: str) -> str:
    text = text.strip().lower()
    text = _PUNCTUATION_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_text(text: str) -> str:
    # Cheap heuristic: if Arabic letters exist, apply Arabic normalization too.
    if re.search(r"[\u0600-\u06FF]", text or ""):
        return normalize_arabic(text)
    return normalize_latin(text)


def extract_year(text: str, min_year: int = 1990, max_year: int = 2030) -> int | None:
    # Also handles Arabic-Indic digits by normalizing them to Western digits.
    if not text:
        return None

    arabic_indic = "٠١٢٣٤٥٦٧٨٩"
    western = "0123456789"
    translation = str.maketrans({a: b for a, b in zip(arabic_indic, western)})
    s = str(text).translate(translation)

    matches = re.findall(r"(?<!\d)(\d{4})(?!\d)", s)
    for year_str in reversed(matches):
        try:
            year = int(year_str)
        except ValueError:
            continue
        if min_year <= year <= max_year:
            return year
    return None


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"nan", "none"}:
        return None
    try:
        # Covers values like "2024.0"
        return int(float(s))
    except ValueError:
        return None


def _canon_transmission(value: str | None) -> str | None:
    if not value:
        return None
    v = normalize_text(value)
    if any(k in v for k in ["auto", "automatic", "اوتومات", "اتومات", "اوتو", "cvt", "dct", "dsg"]):
        return "Automatic"
    if any(k in v for k in ["manual", "مانيو", "مانويل", "عادي", "mt"]):
        return "Manual"
    return None


def _canon_fuel(value: str | None) -> str | None:
    if not value:
        return None
    v = normalize_text(value)
    if "petrol" in v or "بنزين" in v or "gasoline" in v:
        return "petrol"
    if "diesel" in v or "سولار" in v:
        return "diesel"
    if "cng" in v or "غاز" in v:
        return "cng"
    if "hybrid" in v or "هايبرد" in v:
        return "hybrid"
    if "electric" in v or "كهرب" in v or "ev" in v:
        return "electric"
    return None


def _canon_body_type(value: str | None) -> str | None:
    if not value:
        return None
    v = normalize_text(value)
    mapping = {
        "sedan": ["sedan", "سيدان"],
        "hatchback": ["hatch", "هاتش"],
        "suv": ["suv", "دبابة", "جيپ", "جيب"],
        "crossover": ["crossover", "كروس"],
        "mpv": ["mpv"],
        "van": ["van", "ميكروباص", "فان"],
    }
    for canon, keywords in mapping.items():
        if any(k in v for k in keywords):
            # Keep the dataset casing style if possible
            return canon.upper() if canon == "suv" else canon.capitalize()
    return None


def _canon_drivetrain(value: str | None) -> str | None:
    if not value:
        return None
    
    v = normalize_text(value)
    
    if any(term in v for term in ["fwd", "دفع امامي"]):
        return "FWD"
        
    if any(term in v for term in ["rwd", "دفع خلفي"]):
        return "RWD"
        
    # AWD
    if "awd" in v:
        return "AWD"
        
    # 4WD: Add the Arabic standard for 4x4
    if any(term in v for term in ["4wd", "4x4", "دفع رباعي"]):
        return "4WD"
        
    return None

class CarSpecsLookup:
    def __init__(
        self,
        csv_path: Path,
        aliases_yaml_path: Path | None = None,
        egypt_market_notes_yaml_path: Path | None = None,
    ) -> None:
        self.csv_path = Path(csv_path)
        self.aliases_yaml_path = Path(aliases_yaml_path) if aliases_yaml_path else None
        self.egypt_market_notes_yaml_path = (
            Path(egypt_market_notes_yaml_path) if egypt_market_notes_yaml_path else None
        )

        self._rows: list[dict[str, Any]] = []
        self._by_make_model_year: dict[tuple[str, str, int], list[dict[str, Any]]] = {}
        self._by_make_model: dict[tuple[str, str], list[dict[str, Any]]] = {}
        # For fuzzy matching we compare normalized strings, and keep a mapping
        # back to (make_key, model_key) so we don't have to parse/split strings.
        self._make_model_candidates: list[str] = []
        self._make_model_candidate_map: dict[str, tuple[str, str]] = {}
        self._model_candidates: list[str] = []

        self._make_aliases: dict[str, str] = {}
        self._model_aliases: dict[str, str] = {}
        self._make_model_aliases: dict[str, str] = {}
        self._egypt_notes: dict[str, str] = {}

        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return

        if not self.csv_path.exists():
            raise FileNotFoundError(f"AI lookup CSV not found: {self.csv_path}")

        self._load_aliases()
        self._load_egypt_notes()

        with self.csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                make = (raw.get("make") or "").strip()
                model = (raw.get("model") or "").strip()
                year = _safe_int(raw.get("year"))

                if not make or not model or not year:
                    continue

                row: dict[str, Any] = dict(raw)
                row["make"] = make
                row["model"] = model
                row["year"] = year

                # Normalize a few fields for filter/search
                row["transmission"] = (raw.get("transmission") or "").strip()
                row["fuel"] = (raw.get("fuel") or "").strip()
                row["engine_cc"] = _safe_int(raw.get("engine_cc"))
                row["horsepower"] = _safe_int(raw.get("horsepower"))
                row["body_type"] = (raw.get("body_type") or "").strip()
                row["drivetrain"] = (raw.get("drivetrain") or "").strip()
                row["seating_capacity"] = _safe_int(raw.get("seating_capacity"))
                row["brand_origin"] = (raw.get("brand_origin") or "").strip()
                row["car_segment"] = (raw.get("car_segment") or "").strip()

                self._rows.append(row)

                make_key = normalize_latin(make)
                model_key = normalize_latin(model)

                self._by_make_model.setdefault((make_key, model_key), []).append(row)
                self._by_make_model_year.setdefault((make_key, model_key, year), []).append(row)

        # Candidates for fuzzy matching (normalized)
        # Use a delimiter that won't appear in normal user queries, but won't
        # break token_set_ratio too badly either.
        candidate_map: dict[str, tuple[str, str]] = {}
        for make_key, model_key in self._by_make_model.keys():
            label = f"{make_key} | {model_key}"
            candidate_map[label] = (make_key, model_key)

        self._make_model_candidate_map = candidate_map
        self._make_model_candidates = sorted(candidate_map.keys())
        self._model_candidates = sorted({model_key for (_, model_key) in self._by_make_model.keys()})

        self._loaded = True
        logger.info(
            "CarSpecsLookup loaded rows=%s make_models=%s",
            len(self._rows),
            len(self._make_model_candidates),
        )

    def _load_aliases(self) -> None:
        if not self.aliases_yaml_path or not self.aliases_yaml_path.exists():
            return

        with self.aliases_yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        aliases = data.get("aliases", {}) if isinstance(data, dict) else {}
        self._make_aliases = {
            normalize_arabic(str(k)): str(v)
            for k, v in (aliases.get("makes", {}) or {}).items()
        }
        self._model_aliases = {
            normalize_arabic(str(k)): str(v)
            for k, v in (aliases.get("models", {}) or {}).items()
        }
        self._make_model_aliases = {
            normalize_arabic(str(k)): str(v)
            for k, v in (aliases.get("make_models", {}) or {}).items()
        }

    def _load_egypt_notes(self) -> None:
        if not self.egypt_market_notes_yaml_path or not self.egypt_market_notes_yaml_path.exists():
            return

        with self.egypt_market_notes_yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        if not isinstance(data, dict):
            return

        # Supported YAML shapes:
        # 1) Preferred (current):
        #    toyota_corolla:
        #      notes: |
        #        ...
        # 2) Legacy wrapper:
        #    notes:
        #      toyota_corolla: "..."
        legacy = data.get("notes")
        if isinstance(legacy, dict):
            self._egypt_notes = {
                normalize_latin(str(k)): str(v).strip()
                for k, v in legacy.items()
                if str(v).strip()
            }
            return

        self._egypt_notes = {
            normalize_latin(str(k)): str(v.get("notes", "")).strip()
            for k, v in data.items()
            if isinstance(v, dict) and str(v.get("notes", "")).strip()
        }

    def get_egypt_note(self, make: str, model: str) -> str | None:
        key = normalize_latin(f"{make}_{model}".replace(" ", "_"))
        return self._egypt_notes.get(key)

    def _apply_aliases(self, query_norm: str) -> str:
        # Replace whole-word aliases when possible; also allow substring replacement for common cases.
        for alias, canonical in self._make_model_aliases.items():
            al_alias = f"ال{alias}"
            if al_alias in query_norm:
                return query_norm.replace(al_alias, normalize_text(canonical))
            if alias in query_norm:
                return query_norm.replace(alias, normalize_text(canonical))

        for alias, canonical in self._make_aliases.items():
            al_alias = f"ال{alias}"
            if al_alias in query_norm:
                query_norm = query_norm.replace(al_alias, normalize_text(canonical))
            if alias in query_norm:
                query_norm = query_norm.replace(alias, normalize_text(canonical))

        for alias, canonical in self._model_aliases.items():
            al_alias = f"ال{alias}"
            if al_alias in query_norm:
                query_norm = query_norm.replace(al_alias, normalize_text(canonical))
            if alias in query_norm:
                query_norm = query_norm.replace(alias, normalize_text(canonical))

        return query_norm

    def extract_mention(self, user_message: str, min_score: int = 85) -> CarMention | None:
        if not _RAPIDFUZZ_AVAILABLE:
            logger.warning("rapidfuzz not installed; car mention extraction disabled")
            return None

        self.load()

        year = extract_year(user_message)
        query_norm = normalize_text(user_message)
        query_norm = self._apply_aliases(query_norm)
        
        def get_best_candidates(candidates: list[str]) -> list[tuple[str, float]]:
            matches = process.extract(
                query_norm,
                candidates,
                scorer=fuzz.token_set_ratio,
                limit=None,
                score_cutoff=min_score
            )
            if not matches:
                return []
            best_score = matches[0][1]
            best_tuple = [(m[0], m[1]) for m in matches if m[1] == best_score]
            # Tie break by longest candidate string
            best_tuple.sort(key=lambda x: len(x[0]), reverse=True)
            return best_tuple

        # 1) Prefer matching make+model combo.
        best_make_models = get_best_candidates(self._make_model_candidates)
        if best_make_models:
            candidate, score = best_make_models[0]
            pair = self._make_model_candidate_map.get(str(candidate))
            if pair:
                make_key, model_key = pair
                rows = self._by_make_model.get((make_key, model_key), [])
                if rows:
                    return CarMention(make=rows[0]["make"], model=rows[0]["model"], year=year)

        # 2) Fallback: model-only match, then infer make via most common in dataset.
        best_models = get_best_candidates(self._model_candidates)
        if not best_models:
            return None

        model_candidate, model_score = best_models[0]
        model_key = normalize_latin(str(model_candidate))
        make_counts: dict[str, int] = {}
        for (make_key, m_key), rows in self._by_make_model.items():
            if m_key == model_key:
                make_counts[make_key] = make_counts.get(make_key, 0) + len(rows)

        if not make_counts:
            return None

        best_make_key = max(make_counts.items(), key=lambda kv: kv[1])[0]
        # Recover canonical make spelling from any row
        rows = self._by_make_model.get((best_make_key, model_key), [])
        if not rows:
            return None

        return CarMention(make=rows[0]["make"], model=rows[0]["model"], year=year)

    def lookup_specs(self, mention: CarMention) -> list[dict[str, Any]]:
        self.load()

        make_key = normalize_latin(mention.make)
        model_key = normalize_latin(mention.model)

        if mention.year is not None:
            rows = self._by_make_model_year.get((make_key, model_key, mention.year), [])
            if rows:
                return list(rows)

        return list(self._by_make_model.get((make_key, model_key), []))

    def is_search_query(self, user_message: str) -> bool:
        s = normalize_text(user_message)
        # Heuristic: if the user asks for "what cars"/"give me cars" or uses comparators.
        # IMPORTANT: some short triggers (e.g. "كل") must be matched as whole words;
        # substring matching would cause false positives like "مشكلة".
        word_triggers = [
            r"(?:^|\s)كل(?:$|\s)",
            r"(?:^|\s)cars(?:$|\s)",
            r"(?:^|\s)models(?:$|\s)",
        ]
        if any(re.search(p, s) for p in word_triggers):
            return True

        substring_triggers = [
            "ايه العربيات",
            "العربيات",
            "تحت",
            "اقل",
            "قبل",
            "بعد",
            "بين",
            "from",
            "to",
            "under",
            "before",
            "after",
            "between",
        ]
        return any(t in s for t in substring_triggers)

    def parse_filters(self, user_message: str) -> SearchFilters:
        s = normalize_text(user_message)

        year = extract_year(user_message)

        year_min: int | None = None
        year_max: int | None = None

        if year:
            if any(k in s for k in ["قبل", "before", "under", "تحت", "اقل من"]):
                year_max = year
            elif any(k in s for k in ["بعد", "after", "من بعد", "من"]):
                year_min = year

        transmission = None
        if any(k in s for k in ["اوتومات", "اتومات", "automatic", "auto", "cvt", "dct", "dsg"]):
            transmission = "Automatic"
        elif any(k in s for k in ["مانيو", "manual", "عادي", "mt", " مانوي"]):
            transmission = "Manual"

        fuel = _canon_fuel(s)
        body_type = _canon_body_type(s)
        drivetrain = _canon_drivetrain(s)

        engine_cc_max: int | None = None
        # Engine cc hint: look for patterns like "1600 سي سي" or "1600cc" or "<=1600".
        engine_match = re.search(r"(?<!\d)(\d{3,4})(?!\d)\s*(?:cc|c\.c\.|سي\s*سي|سى\s*سى)", s)
        if engine_match:
            engine_cc_max = _safe_int(engine_match.group(1))
        else:
            # If user says "تحت 1600" AND mentions engine/motor/cc nearby.
            if any(k in s for k in ["ماتور", "موتور", "engine", "cc", "سي سي", "سيسي"]):
                under_match = re.search(r"(?:تحت|اقل من|<=)\s*(\d{3,4})", s)
                if under_match:
                    engine_cc_max = _safe_int(under_match.group(1))

        return SearchFilters(
            year_min=year_min,
            year_max=year_max,
            transmission=transmission,
            fuel=fuel,
            body_type=body_type,
            drivetrain=drivetrain,
            engine_cc_max=engine_cc_max,
        )

    def search(self, filters: SearchFilters) -> tuple[int, list[dict[str, Any]]]:
        self.load()

        def _row_matches(row: dict[str, Any]) -> bool:
            y = _safe_int(row.get("year"))
            if y is None:
                return False
            if filters.year_min is not None and y < filters.year_min:
                return False
            if filters.year_max is not None and y > filters.year_max:
                return False

            if filters.transmission:
                canon = _canon_transmission(row.get("transmission"))
                if canon != filters.transmission:
                    return False

            if filters.fuel:
                canon_f = _canon_fuel(row.get("fuel"))
                if canon_f != filters.fuel:
                    return False

            if filters.body_type:
                bt = str(row.get("body_type") or "").strip()
                if bt and bt.lower() != filters.body_type.lower():
                    return False

            if filters.drivetrain:
                dt = str(row.get("drivetrain") or "").strip()
                if dt and dt.upper() != filters.drivetrain.upper():
                    return False

            if filters.engine_cc_max is not None:
                cc = _safe_int(row.get("engine_cc"))
                if cc is None or cc > filters.engine_cc_max:
                    return False

            return True

        matched = [r for r in self._rows if _row_matches(r)]
        total = len(matched)

        # Summarize by make+model
        summary: dict[tuple[str, str], dict[str, Any]] = {}
        for r in matched:
            mk = str(r.get("make") or "").strip()
            md = str(r.get("model") or "").strip()
            if not mk or not md:
                continue
            key = (mk, md)
            agg = summary.setdefault(
                key,
                {
                    "make": mk,
                    "model": md,
                    "year_min": None,
                    "year_max": None,
                    "transmissions": set(),
                    "fuels": set(),
                    "body_types": set(),
                    "drivetrains": set(),
                    "segments": set(),
                    "origins": set(),
                },
            )
            y = _safe_int(r.get("year"))
            if y is not None:
                agg["year_min"] = y if agg["year_min"] is None else min(agg["year_min"], y)
                agg["year_max"] = y if agg["year_max"] is None else max(agg["year_max"], y)
            t = _canon_transmission(r.get("transmission"))
            if t:
                agg["transmissions"].add(t)
            f = _canon_fuel(r.get("fuel"))
            if f:
                agg["fuels"].add(f)
            bt = str(r.get("body_type") or "").strip()
            if bt:
                agg["body_types"].add(bt)
            dt = str(r.get("drivetrain") or "").strip()
            if dt:
                agg["drivetrains"].add(dt)
            seg = str(r.get("car_segment") or "").strip()
            if seg:
                agg["segments"].add(seg)
            org = str(r.get("brand_origin") or "").strip()
            if org:
                agg["origins"].add(org)

        # Convert sets → sorted lists, and keep stable ordering
        out: list[dict[str, Any]] = []
        for agg in summary.values():
            out.append(
                {
                    "make": agg["make"],
                    "model": agg["model"],
                    "year_min": agg["year_min"],
                    "year_max": agg["year_max"],
                    "transmissions": sorted(agg["transmissions"]),
                    "fuels": sorted(agg["fuels"]),
                    "body_types": sorted(agg["body_types"]),
                    "drivetrains": sorted(agg["drivetrains"]),
                    "car_segments": sorted(agg["segments"]),
                    "brand_origins": sorted(agg["origins"]),
                }
            )

        out.sort(key=lambda d: (d["make"], d["model"]))
        return total, out


def format_filters(filters: SearchFilters) -> str:
    parts: list[str] = []
    if filters.year_min is not None:
        parts.append(f"year >= {filters.year_min}")
    if filters.year_max is not None:
        parts.append(f"year <= {filters.year_max}")
    if filters.transmission:
        parts.append(f"transmission={filters.transmission}")
    if filters.fuel:
        parts.append(f"fuel={filters.fuel}")
    if filters.body_type:
        parts.append(f"body_type={filters.body_type}")
    if filters.drivetrain:
        parts.append(f"drivetrain={filters.drivetrain}")
    if filters.engine_cc_max is not None:
        parts.append(f"engine_cc <= {filters.engine_cc_max}")
    return ", ".join(parts) if parts else "(no filters)"
