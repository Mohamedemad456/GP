"""
Usage:
1. Install dependencies: pip install pandas rapidfuzz python-bidi
   (rapidfuzz optional; code falls back to difflib if not installed)
2. Adjust INPUT_CSV and column names if needed.
3. Run once to build dictionary, then use translate_arabic_series() in your pipeline.
"""

import re
import json
import unicodedata
from pathlib import Path
from collections import defaultdict

import pandas as pd

# Optional fuzzy library
try:
    from rapidfuzz import process, fuzz # type: ignore
    _HAS_RAPIDFUZZ = True
except Exception:
    from difflib import get_close_matches
    _HAS_RAPIDFUZZ = False

# ---------- Config ----------
INPUT_CSV = "data/dubizzle_cars_english.csv"   # path to your CSV
ARABIC_COL_CANDIDATES = ["title_ar", "arabic_title", "title_arabic", "title"]  # try these
ENGLISH_COL_CANDIDATES = ["title_en", "english_title", "title_english", "title"]  # try these
DICT_OUT = "scripts/arabic_to_english_dict.json"
CHUNKSIZE = 20000
FUZZY_THRESHOLD = 80  # percent for rapidfuzz; for difflib it's ratio-like
# ----------------------------

# ---------- Normalizers ----------
_arabic_tashkeel_re = re.compile(
    "[" +
    "\u0610-\u061A" +  # Arabic signs
    "\u064B-\u065F" +  # Harakat
    "\u06D6-\u06ED" +  # Additional marks
    "]"
)

def strip_tashkeel(text: str) -> str:
    if not isinstance(text, str):
        return text
    return _arabic_tashkeel_re.sub("", text)

def normalize_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    s = text.strip()
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[^\w\s\-\u0600-\u06FF]", " ", s)  # keep Arabic block and word chars, hyphen
    s = re.sub(r"\s+", " ", s)
    s = s.lower()
    s = strip_tashkeel(s)
    return s

# common slang/abbrev mapping (extend as needed)
SLANG_MAP = {
    "bmw": "bmw",
    "بي ام دبليو": "bmw",
    "مرسيدس": "mercedes",
    "مرسيدس بنز": "mercedes",
    "مرسيدس-بنز": "mercedes",
    "تويوتا": "toyota",
    "هيونداي": "hyundai",
    "هيونداي-": "hyundai",
    "نيسان": "nissan",
    "كيا": "kia",
    "شيفروليه": "chevrolet",
    # add more mappings you observe in your data
}

def apply_slang_map_ar(ar_text: str) -> str:
    t = normalize_text(ar_text)
    for k, v in SLANG_MAP.items():
        if k in t:
            t = t.replace(k, v)
    return t

# ---------- English parsing ----------
_year_re = re.compile(r"\b(19[5-9]\d|20[0-4]\d|20[5-9]\d)\b")  # years 1950-2099 (adjust if needed)

def parse_english_title_to_make_model_year(title: str):
    """
    Heuristic parsing: tries to extract year (4-digit), then split remaining into make and model.
    Returns (make, model, year) as strings (empty if not found).
    """
    if not isinstance(title, str) or not title.strip():
        return "", "", ""
    t = title.strip()
    # normalize separators
    t = re.sub(r"[_/\\|]+", " ", t)
    # find year
    year_match = _year_re.search(t)
    year = year_match.group(0) if year_match else ""
    if year:
        t_no_year = t.replace(year, "").strip()
    else:
        t_no_year = t
    # split by common separators or by first token as make
    parts = re.split(r"[-:–—]| {2,}|,", t_no_year)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        # fallback: split by whitespace
        tokens = t_no_year.split()
        if len(tokens) >= 2:
            make = tokens[0]
            model = " ".join(tokens[1:])
        else:
            make = t_no_year
            model = ""
    else:
        # assume first part contains make and model; try to split first token as make
        first = parts[0]
        tokens = first.split()
        if len(tokens) >= 2:
            make = tokens[0]
            model = " ".join(tokens[1:])
        else:
            # if only one token, try second part as model
            make = first
            model = parts[1] if len(parts) > 1 else ""
    # final cleanup
    make = re.sub(r"\s+", "-", make.strip())
    model = re.sub(r"\s+", "-", model.strip())
    year = year.strip()
    # lower-case and remove stray punctuation
    make = re.sub(r"[^\w\-]", "", make).lower()
    model = re.sub(r"[^\w\-]", "", model).lower()
    return make, model, year

def format_make_model_year(make, model, year):
    parts = [p for p in [make, model, year] if p]
    return "-".join(parts) if parts else ""

# ---------- Build dictionary from CSV ----------
def build_dictionary_from_csv(csv_path: str,
                              arabic_col: str = None,
                              english_col: str = None,
                              chunksize: int = CHUNKSIZE):
    """
    Streams CSV, finds Arabic-English pairs, builds mapping {normalized_ar: formatted_en}.
    Returns mapping dict.
    """
    csv_path = Path(csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"{csv_path} not found")

    # try to detect columns if not provided
    sample = pd.read_csv(csv_path, nrows=5)
    cols = list(sample.columns)
    if arabic_col is None:
        arabic_col = next((c for c in cols if c.lower() in ARABIC_COL_CANDIDATES), None)
    if english_col is None:
        english_col = next((c for c in cols if c.lower() in ENGLISH_COL_CANDIDATES and c != arabic_col), None)

    if arabic_col is None:
        # fallback: assume first column is Arabic
        arabic_col = cols[0]
    if english_col is None:
        # fallback: try second column or same as arabic if english was converted in file
        english_col = cols[1] if len(cols) > 1 else cols[0]

    mapping = {}  # normalized_ar -> formatted_en
    seen_pairs = set()
    # stream
    for chunk in pd.read_csv(csv_path, chunksize=chunksize, dtype=str, keep_default_na=False):
        if arabic_col not in chunk.columns or english_col not in chunk.columns:
            # try to find columns by heuristics
            continue
        for ar_raw, en_raw in zip(chunk[arabic_col].fillna(""), chunk[english_col].fillna("")):
            if not ar_raw and not en_raw:
                continue
            ar_norm = apply_slang_map_ar(ar_raw)
            ar_norm = normalize_text(ar_norm)
            en_norm = normalize_text(en_raw)
            if not en_norm:
                continue
            # parse english into make-model-year
            make, model, year = parse_english_title_to_make_model_year(en_raw)
            formatted = format_make_model_year(make, model, year)
            if not formatted:
                # fallback to cleaned english
                formatted = re.sub(r"\s+", "-", en_norm).strip("-")
            key = ar_norm
            if key and key not in mapping:
                mapping[key] = formatted
            # also store raw pair for later manual review
            seen_pairs.add((ar_raw, en_raw))
    return mapping

# ---------- Fuzzy lookup ----------
def fuzzy_lookup(ar_text: str, mapping: dict, threshold: int = FUZZY_THRESHOLD):
    ar_norm = normalize_text(apply_slang_map_ar(ar_text))
    if not ar_norm:
        return ""
    if ar_norm in mapping:
        return mapping[ar_norm]
    keys = list(mapping.keys())
    if _HAS_RAPIDFUZZ:
        match = process.extractOne(ar_norm, keys, scorer=fuzz.token_sort_ratio)
        if match and match[1] >= threshold:
            return mapping[match[0]]
        else:
            return ""
    else:
        # difflib fallback
        candidates = get_close_matches(ar_norm, keys, n=1, cutoff=threshold/100.0)
        if candidates:
            return mapping[candidates[0]]
        return ""

# ---------- Main translation function for pipeline ----------
def translate_arabic_series(ar_series, mapping, threshold=FUZZY_THRESHOLD):
    """
    Input: pandas Series of Arabic titles (strings).
    Output: pandas Series of English formatted titles (make-model-year).
    """
    def _translate_cell(x):
        if not isinstance(x, str) or not x.strip():
            return ""
        # direct normalized match
        ar_norm = normalize_text(apply_slang_map_ar(x))
        if ar_norm in mapping:
            return mapping[ar_norm]
        # fuzzy
        res = fuzzy_lookup(x, mapping, threshold=threshold)
        if res:
            return res
        # last resort: attempt to transliterate/parse numbers and return cleaned ascii
        cleaned = re.sub(r"[^\w\s\-\u0600-\u06FF]", " ", x)
        cleaned = normalize_text(cleaned)
        cleaned = re.sub(r"\s+", "-", cleaned)
        return cleaned  # not ideal but avoids blanks
    return ar_series.apply(_translate_cell)

# ---------- Save / Load dictionary ----------
def save_mapping(mapping: dict, out_path: str = DICT_OUT):
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

def load_mapping(path: str = DICT_OUT):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------- Example run ----------
if __name__ == "__main__":
    # Build dictionary (streaming)
    print("Building dictionary from CSV (streaming)...")
    mapping = build_dictionary_from_csv(INPUT_CSV)
    print(f"Built mapping with {len(mapping)} entries. Saving to {DICT_OUT}")
    save_mapping(mapping, DICT_OUT)

    # # Example: translate a CSV column and save result
    # df = pd.read_csv(INPUT_CSV, dtype=str, keep_default_na=False)
    # # detect arabic column name heuristically
    # ar_col = next((c for c in df.columns if c.lower() in ARABIC_COL_CANDIDATES), df.columns[0])
    # df["english_title_mmy"] = translate_arabic_series(df[ar_col], mapping)
    # df.to_csv("translated_output.csv", index=False)
    # print("Saved translated_output.csv")
