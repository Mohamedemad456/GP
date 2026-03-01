"""
One-time script: extract `make` and `model` from the title column.

Reads  : data/raw/cars_raw.csv
Writes : data/raw/cars_with_make_model.csv  (+ .parquet + .json)

Approach:
  1. Comprehensive brand dictionary (AI knowledge of Egyptian market brands)
  2. Multi-word brands checked first (Land Rover, Alfa Romeo, …)
  3. Single-word brands checked next
  4. Model-only titles mapped to their brand (C180 → Mercedes, GLC → Mercedes, …)
  5. Junk prefixes stripped before matching
  6. Model = text between brand and trailing year

NO other column is modified — only `make` and `model` are added.
"""

import re
import pandas as pd
from pathlib import Path


# ── Known multi-word brands (check FIRST, order matters) ─────────────────────
MULTI_WORD_BRANDS = {
    "land rover":     "Land Rover",
    "alfa romeo":     "Alfa Romeo",
    "range rover":    "Range Rover",
    "great wall":     "Great Wall",
    "aston martin":   "Aston Martin",
    "rolls royce":    "Rolls Royce",
    "ssang yong":     "SsangYong",
    "ssangyong":      "SsangYong",
    "king long":      "King Long",
    "mini cooper":    "Mini",
    "rolls-royce":    "Rolls Royce",
}

# ── Single-word brand normalisation ──────────────────────────────────────────
# Maps lowercase first-word → canonical brand name
BRAND_MAP = {
    # ── Major global brands ──
    "mercedes":       "Mercedes",
    "mercedes-benz":  "Mercedes",
    "mercedes-c180":  "Mercedes",
    "mercedes-maybach":"Mercedes",
    "marcedes-benz":  "Mercedes",   # misspelling
    "merceds":        "Mercedes",   # misspelling
    "mercides":       "Mercedes",   # misspelling
    "hyundai":        "Hyundai",
    "kia":            "Kia",
    "renault":        "Renault",
    "chevrolet":      "Chevrolet",
    "chevorlate":     "Chevrolet",  # misspelling
    "fiat":           "Fiat",
    "bmw":            "BMW",
    "opel":           "Opel",
    "nissan":         "Nissan",
    "peugeot":        "Peugeot",
    "skoda":          "Skoda",
    "daewoo":         "Daewoo",
    "volkswagen":     "Volkswagen",
    "vw":             "Volkswagen",
    "toyota":         "Toyota",
    "mitsubishi":     "Mitsubishi",
    "ford":           "Ford",
    "audi":           "Audi",
    "honda":          "Honda",
    "porsche":        "Porsche",
    "mazda":          "Mazda",
    "subaru":         "Subaru",
    "volvo":          "Volvo",
    "jaguar":         "Jaguar",
    "chrysler":       "Chrysler",
    "dodge":          "Dodge",
    "jeep":           "Jeep",
    "jeeb":           "Jeep",       # misspelling
    "cadillac":       "Cadillac",
    "gmc":            "GMC",
    "lincoln":        "Lincoln",
    "buick":          "Buick",
    "tesla":          "Tesla",
    "lamborghini":    "Lamborghini",
    "bentley":        "Bentley",
    "maserati":       "Maserati",
    "ferrari":        "Ferrari",
    "bugatti":        "Bugatti",
    "hummer":         "Hummer",
    "infiniti":       "Infiniti",
    "lexus":          "Lexus",
    "mini":           "Mini",
    # minicooper handled in MODEL_TO_BRAND
    "smart":          "Smart",
    "lancia":         "Lancia",
    "oldsmobile":     "Oldsmobile",
    "polestar":       "Polestar",
    "seat":           "Seat",
    "cupra":          "Cupra",
    "daihatsu":       "Daihatsu",
    "suzuki":         "Suzuki",
    "isuzu":          "Isuzu",
    "tata":           "Tata",

    # ── Chinese brands ──
    "mg":             "MG",
    "chery":          "Chery",
    "byd":            "BYD",
    "geely":          "Geely",
    "changan":        "Changan",
    "jetour":         "Jetour",
    "haval":          "Haval",
    "baic":           "BAIC",
    "jac":            "JAC",
    "soueast":        "Soueast",
    "gac":            "GAC",
    "dongfeng":       "Dongfeng",
    "faw":            "FAW",
    "zotye":          "Zotye",
    "chana":          "Chana",
    "brilliance":     "Brilliance",
    "deepal":         "Deepal",
    "avatr":          "Avatr",
    "avatar":         "Avatr",
    "attto":          "Avatr",       # misspelling of Avatr
    "zeekr":          "Zeekr",
    "xpeng":          "XPeng",
    "xiaomi":         "Xiaomi",
    "tank":           "Tank",
    "forthing":       "Forthing",
    "exeed":          "Exeed",
    "domy":           "Domy",
    "aito":           "Aito",
    "canghe":         "Changhe",
    "changhe":        "Changhe",
    "hanteng":        "Hanteng",
    "arcfox":         "Arcfox",
    "vgv":            "VGV",
    "foton":          "Foton",
    "lynkco":         "Lynk & Co",
    "bestune":        "Bestune",
    "kenbo":          "Kenbo",
    "haima":          "Haima",
    "lifan":          "Lifan",
    "shineray":       "Shineray",

    # ── Egyptian market / other ──
    "speranza":       "Speranza",
    "proton":         "Proton",
    "lada":           "Lada",
    "saipa":          "Saipa",
    "mahindra":       "Mahindra",
    "ds":             "DS",
    "rox":            "Rox",
    "kgm":            "KGM",
    "senova":         "Senova",
    "kaiyi":          "Kaiyi",
    "keyton":         "Keyton",
    "kyc":            "KYC",
    "jmc":            "JMC",
    "zna":            "ZNA",
    "dfsk":           "DFSK",
    "lotus":          "Lotus",
    "abarth":         "Abarth",
    "citroën":        "Citroën",
    "citroen":        "Citroën",

    # ── Motorcycles / other vehicles ──
    "sym":            "SYM",
    "haojiang":       "Haojiang",
    "keeway":         "Keeway",
    "slingshot":      "Slingshot",

    # ── Labels that are actually brands for specific models ──
    "emgrand":        "Geely",       # Geely Emgrand
    "other":          "Other",
    "classic":        "Other",
}

# ── Model-only titles (first word is a model, not a brand) ───────────────────
# These titles start with a Mercedes model code, a Peugeot model, BMW model, etc.
MODEL_TO_BRAND = {
    # Mercedes model codes
    "c180":     ("Mercedes", "C180"),
    "c200":     ("Mercedes", "C200"),
    "e200":     ("Mercedes", "E200"),
    "e280":     ("Mercedes", "E280"),
    "e300":     ("Mercedes", "E300"),
    "e43":      ("Mercedes", "E43"),
    "gla":      ("Mercedes", "GLA"),
    "glc":      ("Mercedes", "GLC"),
    "glc200":   ("Mercedes", "GLC 200"),
    "gle":      ("Mercedes", "GLE"),
    "gle450":   ("Mercedes", "GLE 450"),
    "gls":      ("Mercedes", "GLS"),
    "gls580":   ("Mercedes", "GLS 580"),
    "cla":      ("Mercedes", "CLA"),
    "cla200":   ("Mercedes", "CLA 200"),
    "amg":      ("Mercedes", "AMG"),
    "a180":     ("Mercedes", "A180"),
    "slc-class":("Mercedes", "SLC-Class"),
    # BMW model codes
    "320":      ("BMW", "320"),
    "420":      ("BMW", "420"),
    "520":      ("BMW", "520"),
    "bmwx":     ("BMW", "X"),
    # Peugeot model numbers
    "307":      ("Peugeot", "307"),
    "508":      ("Peugeot", "508"),
    # Fiat model numbers
    "128":      ("Fiat", "128"),
    "122":      ("Fiat", "122"),
    "146":      ("Alfa Romeo", "146"),
    "110":      ("Fiat", "110"),
    "1400":     ("Fiat", "1400"),
    # Other model-only
    "tipo":     ("Fiat", "Tipo"),
    "golf":     ("Volkswagen", "Golf"),
    "passat":   ("Volkswagen", "Passat"),
    "sportage": ("Kia", "Sportage"),
    "countryman":("Mini", "Countryman"),
    "mg5":      ("MG", "5"),
    "q5":       ("Audi", "Q5"),
    "model":    ("Tesla", "Model"),
    "620":      ("Speranza",  "620"),
    "a30":      ("Chery",     "A30"),
    "a213":     ("Chery",     "A213"),
    "m70":      ("Keyton",    "M70"),
    "ds7":      ("DS",        "DS7"),
    "glc200":   ("Mercedes",  "GLC 200"),
    # Peugeot model numbers as first word
    "301":      ("Peugeot",   "301"),
    # Suzuki
    "alto":     ("Suzuki",    "Alto"),
    # Range Rover
    "vogue":    ("Range Rover", "Vogue"),
    # MiniCooper as one word
    "minicooper":("Mini",      "Cooper"),
    # Mercedes models that appear as first word in junk titles
    "e200":     ("Mercedes",  "E200"),
    "e280":     ("Mercedes",  "E280"),
    # DS models
    "ds7":      ("DS",        "DS7"),
}

# ── Known brand+model combos for titles that have extra junk ─────────────────
# Titles like "Rang Rover ..." → "Range Rover", "Y  - Tesla Model Y" → Tesla
JUNK_PREFIX_HINTS = {
    # title fragment (lowered) → (make, model)
    "rang rover":     ("Range Rover", None),
    "tesla model":    ("Tesla", None),
    "jeep grand":     ("Jeep", None),
    "jeep wrangler":  ("Jeep", None),
    "ford focus":     ("Ford", None),
    "peugeot 508":    ("Peugeot", None),
    "vw beetle":      ("Volkswagen", None),
    "bmw 320":        ("BMW", None),
    "logan":          ("Renault", None),
    "wrangler":       ("Jeep", None),
}


def extract_make_model(title: str) -> tuple[str, str]:
    """
    Given a raw title string, return (make, model).
    Uses brand dictionaries — no regex.
    """
    if not isinstance(title, str) or not title.strip():
        return ("Unknown", "Unknown")

    original = title.strip()
    # Remove leading junk characters
    cleaned = original
    while cleaned and cleaned[0] in "-—.·•‏  \t":
        cleaned = cleaned[1:]
    cleaned = cleaned.strip()
    if not cleaned:
        return ("Unknown", "Unknown")

    lower = cleaned.lower()

    # 1. Check multi-word brands first
    for key, brand in MULTI_WORD_BRANDS.items():
        if lower.startswith(key):
            rest = cleaned[len(key):].strip()
            # Remove separators like | / \
            while rest and rest[0] in "|/\\":
                rest = rest[1:]
            rest = rest.strip()
            model = _extract_model_from_rest(rest)
            # If multi-word brand itself contains the model (e.g. "Mini Cooper")
            if model == "Unknown":
                # Use the second word of the key as model if applicable
                key_parts = key.split()
                if len(key_parts) >= 2:
                    model = key_parts[-1].title()
            return (brand, model)

    # 2. Check if first word is a model-only code (no brand in title)
    first_word = lower.split()[0] if lower.split() else ""
    if first_word in MODEL_TO_BRAND:
        brand, known_model = MODEL_TO_BRAND[first_word]
        # The rest after the first word might have more model info
        rest = cleaned.split(None, 1)[1] if len(cleaned.split()) > 1 else ""
        if known_model:
            return (brand, known_model)
        model = _extract_model_from_rest(rest)
        return (brand, model if model else first_word)

    # 3. Check single-word brand map
    if first_word in BRAND_MAP:
        brand = BRAND_MAP[first_word]
        rest = cleaned.split(None, 1)[1] if len(cleaned.split()) > 1 else ""
        # Handle | and / separators after brand (e.g. "Citroën |  AX 1997")
        while rest and rest[0] in "|/\\":
            rest = rest[1:]
        rest = rest.strip()
        model = _extract_model_from_rest(rest)

        # Special case: brand was actually a model redirect
        if brand == "Geely" and first_word == "emgrand":
            return ("Geely", "Emgrand")

        return (brand, model if model else "Unknown")

    # 4. Check for brands hidden in the middle of junk titles
    for hint, (brand, _) in JUNK_PREFIX_HINTS.items():
        if hint in lower:
            # Find the hint position and extract from there
            idx = lower.index(hint)
            from_brand = cleaned[idx:]
            parts = from_brand.split()
            # How many words the brand takes up
            brand_words = len(brand.split())
            # How many words the hint takes up
            hint_words = len(hint.split())
            # Model words = words from hint that aren't brand + rest before year
            if hint_words > brand_words:
                # Hint contains model info (e.g. hint="tesla model", brand="Tesla")
                hint_model_part = " ".join(parts[brand_words:hint_words])
                rest = " ".join(parts[hint_words:])
                model = _extract_model_from_rest(rest)
                model = (hint_model_part + " " + model).strip() if model and model != "Unknown" else hint_model_part
            elif hint_words == brand_words and len(parts) > brand_words:
                # Single-word hint = brand name (e.g. hint="logan", brand="Renault")
                # The hint word itself is the model start
                model = _extract_model_from_rest(" ".join(parts))
                if model == "Unknown" or not model:
                    model = parts[0].title()
            else:
                model = _extract_model_from_rest(" ".join(parts[brand_words:]))
            return (brand, model if model and model != "Unknown" else "Unknown")

    # 5. Check if any known brand appears anywhere in the title
    for key, brand in BRAND_MAP.items():
        if key in lower.split():
            # Find position and extract
            words = cleaned.split()
            lower_words = [w.lower() for w in words]
            if key in lower_words:
                idx = lower_words.index(key)
                rest = " ".join(words[idx+1:])
                model = _extract_model_from_rest(rest)
                return (brand, model if model else "Unknown")

    # 5b. Check if any MODEL_TO_BRAND key appears anywhere in the title (not just first word)
    lower_words = [w.lower() for w in cleaned.split()]
    for key, (brand, known_model) in MODEL_TO_BRAND.items():
        if key in lower_words:
            return (brand, known_model if known_model else "Unknown")

    # 6. Last resort: first word = make, second word = model
    words = cleaned.split()
    make = words[0] if words else "Unknown"
    model = words[1] if len(words) > 1 else "Unknown"
    # Remove trailing year from model if it's a 4-digit number
    if model and len(model) == 4 and model.isdigit():
        model = "Unknown"

    # Catch garbage makes (single digits, symbols, pure numbers)
    if make and (len(make) <= 2 and not make.isalpha()) or make in ("4×4",):
        return ("Unknown", "Unknown")
    # "Land" alone is likely "Land Rover" truncated
    if make.lower() == "land":
        rest = " ".join(words[1:]) if len(words) > 1 else ""
        model_out = _extract_model_from_rest(rest)
        return ("Land Rover", model_out if model_out != "Unknown" else "Unknown")

    return (make, model)


def _extract_model_from_rest(rest: str) -> str:
    """
    Given the part of the title AFTER the brand, extract the model name.
    The model is everything before the trailing year and any extra descriptors.
    """
    if not rest or not rest.strip():
        return "Unknown"

    parts = rest.strip().split()
    # Find the trailing year (last 4-digit number that looks like 19xx or 20xx)
    year_idx = None
    for i in range(len(parts) - 1, -1, -1):
        p = parts[i]
        if len(p) == 4 and p.isdigit() and (p.startswith("19") or p.startswith("20")):
            year_idx = i
            break

    if year_idx is not None:
        model_parts = parts[:year_idx]
    else:
        model_parts = parts

    if not model_parts:
        return "Unknown"

    # The model is typically the first 1-3 words (before descriptors like AMG, Wakeel, etc.)
    # Common descriptors to stop at:
    stop_words = {
        "amg", "wakeel", "only", "km", "fully", "loaded", "gomrok-",
        "(gomrok-)", "all", "fabric", "night", "package", "package2024",
        "package2022", "first", "owner", "zeroooo", "mti", "suv", "1000km",
        "1,000", "exclusive", "avantgarde", "evngarde", "restored", "black",
        "white", "red", "blue", "silver", "grey", "gray", "buyers", "luxury",
        "attention", "sale", "—", "-", "for", "the", "sport", "4matic",
        "autobiography", "long", "50000km", "cc", "performance",
        "new", "mint", "well",
        # Engine / drivetrain descriptors (never part of model name)
        "gdi", "turbo", "tdi", "tsi", "tfsi", "cdi",
        "4wd", "awd", "fwd", "rwd",
        # Trim/condition descriptors
        "full", "facelift", "refresh",
    }

    model_tokens = []
    for p in model_parts:
        if p.lower() in stop_words:
            break
        # Also stop if it looks like "45k" (mileage descriptor)
        if p.lower().endswith("k") and p[:-1].isdigit():
            break
        # Stop at "88,000km" style
        if "km" in p.lower() and any(c.isdigit() for c in p):
            break
        model_tokens.append(p)

    if model_tokens:
        return " ".join(model_tokens)
    return model_parts[0] if model_parts else "Unknown"


def _normalize_make_model(make: str, model: str) -> tuple[str, str]:
    """
    Post-extraction normalization:
      1. Range Rover make → Land Rover (Range Rover is a Land Rover model line)
      2. Land Rover bare model names → fully qualified (Evoque → Range Rover Evoque)
      3. Mercedes: remove space between letter prefix and 3-digit code
         ("C 180" → "C180", "GLC 300" → "GLC300")
      4. Strip trailing trim descriptors that leaked past stop_words
    """
    # 1 & 2 ── Range Rover → Land Rover ──────────────────────────────────────
    if make == "Range Rover":
        # Prefix model with "Range Rover" if not already
        if model and model != "Unknown" and not model.lower().startswith("range rover"):
            model = "Range Rover " + model
        elif not model or model == "Unknown":
            model = "Range Rover"
        make = "Land Rover"

    if make == "Land Rover":
        _lv_bare = {"evoque": "Range Rover Evoque",
                    "velar":  "Range Rover Velar",
                    "sport":  "Range Rover Sport"}
        if model.lower() in _lv_bare:
            model = _lv_bare[model.lower()]

    # 3 ── Mercedes letter+space+number normalisation ─────────────────────────
    # "C 180" → "C180", "GLC 300" → "GLC300", "E 200" → "E200"
    if make == "Mercedes":
        model = re.sub(r'\b([A-Z]+) (\d{3}(?:[\+i]?)\b)', r'\1\2', model)
        # Capitalise first char if it snuck through lowercase (e.g. "c180" → "C180")
        if model and model[0].islower():
            model = model[0].upper() + model[1:]

    # 4 ── Strip trailing trim descriptors ────────────────────────────────────
    _TRIM_SUFFIXES = (
        " Turbo GDI", " turbo gdi", " Turbo gdi",
        " GDI", " gdi",
        " Turbo", " turbo",
        " TDI", " TSI", " TFSI", " CDI",
        " Full Options", " Full-Options", " Full options",
        " Facelift", " facelift",
    )
    for sfx in _TRIM_SUFFIXES:
        if model.endswith(sfx):
            candidate = model[: -len(sfx)].strip()
            if candidate:          # don't wipe out the whole model name
                model = candidate
            break

    return make, model


# ── Extract make and model for every row ─────────────────────────────────────

if __name__ == "__main__":
    raw_parquet = Path("data/raw/cars_raw.parquet")
    raw_csv = Path("data/raw/cars_raw.csv")
    if raw_parquet.exists():
        df = pd.read_parquet(raw_parquet)
    else:
        df = pd.read_csv(raw_csv)
    print(f"Loaded {len(df)} rows")

    print("Extracting make and model...")
    makes = []
    models = []
    for title in df["title"]:
        m, mo = extract_make_model(title)
        m, mo = _normalize_make_model(m, mo)
        makes.append(m)
        models.append(mo)
    df["make"] = makes
    df["model"] = models

    # ── Reorder: put make and model right after title ────────────────────────
    cols = list(df.columns)
    title_idx = cols.index("title")
    cols.remove("make")
    cols.remove("model")
    cols = cols[:title_idx+1] + ["make", "model"] + cols[title_idx+1:]
    df = df[cols]

    # ── Save ─────────────────────────────────────────────────────────────────
    out_csv = Path("data/raw/cars_with_make_model.csv")
    out_parquet = Path("data/raw/cars_with_make_model.parquet")

    df.to_csv(out_csv, index=False)
    df.to_parquet(out_parquet, index=False)

    print(f"\nSaved {len(df)} rows to:")
    print(f"  CSV     → {out_csv}")
    print(f"  Parquet → {out_parquet}")

    # ── Quick stats ──────────────────────────────────────────────────────────
    print(f"\nUnique makes: {df['make'].nunique()}")
    print(f"Unique models: {df['model'].nunique()}")
    print(f"\nMake distribution (top 30):")
    print(df['make'].value_counts().head(30).to_string())
    print(f"\n'Unknown' makes: {(df['make'] == 'Unknown').sum()}")
    print(f"'Unknown' models: {(df['model'] == 'Unknown').sum()}")

    # Show some samples
    print("\n=== Sample extractions ===")
    samples = df.sample(20, random_state=42)[["title", "make", "model"]]
    for _, row in samples.iterrows():
        print(f"  {row['title']:<60s} → {row['make']:<15s} | {row['model']}")
