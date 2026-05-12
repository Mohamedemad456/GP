"""factor_expert.py

Deterministic, expert-style explanations for SHAP price factors.

Goals:
- Keep SHAP `direction` as the source of truth.
- Avoid exposing raw currency contributions (no EGP deltas).
- Provide short, user-facing explanations grounded in Egyptian-market intuition.
- Best-effort: unknown factors get a safe generic explanation.

This module is intentionally rule-based, testable, and offline.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np

from app.services.market_stats import bucket_against_quantiles, get_market_stats


@dataclass(frozen=True)
class ExpertExplanation:
    factor: str
    direction: str
    description: str
    evidence: str | None = None
    category: str | None = None


def _norm_str(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s or None


def _norm_lower(val) -> str | None:
    s = _norm_str(val)
    return s.lower() if s else None


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
    except Exception:
        return None
    if not np.isfinite(f):
        return None
    return f


def _format_value(factor: str, value) -> str:
    if value is None:
        return "unknown"
    try:
        if isinstance(value, (float, np.floating)) and np.isnan(value):
            return "unknown"
    except Exception:
        pass

    if factor == "mileage_km":
        f = _safe_float(value)
        return f"{f:,.0f} km" if f is not None else f"{value} km"
    if factor == "mileage_per_year":
        f = _safe_float(value)
        return f"{f:,.0f} km/yr" if f is not None else f"{value} km/yr"
    if factor == "engine_cc":
        f = _safe_float(value)
        return f"{f:,.0f} cc" if f is not None else f"{value} cc"
    if factor == "horsepower":
        f = _safe_float(value)
        return f"{f:,.0f} hp" if f is not None else f"{value} hp"
    if factor == "year":
        f = _safe_float(value)
        return str(int(f)) if f is not None else str(value)

    return str(value)


def _closing(direction: str) -> str:
    # Deprecated: previously appended a verbose, repetitive direction sentence.
    # Kept for backward compatibility with any external callers, but no longer used.
    if direction == "positive":
        return ""
    return ""


def _model_treatment(direction: str) -> str:
    # Deprecated: previously used as part of the verbose closing sentence.
    return ""


def _typicality_phrase(bucket: str | None) -> str | None:
    if bucket is None:
        return None
    if bucket == "low":
        return "This is lower than what is typical in the data."
    if bucket == "typical":
        return "This is within the typical range in the data."
    if bucket == "high":
        return "This is higher than what is typical in the data."
    if bucket == "very_high":
        return "This is very high compared with typical listings in the data."
    return None


# ── Make/model notes (lightweight, optional) ─────────────────────────────────

_MAKE_NOTES: dict[str, str] = {
    "toyota": "Toyota is common in Egypt, and service/parts availability often influence resale.",
    "hyundai": "Hyundai is widely serviced in Egypt; trims and condition often drive resale.",
    "kia": "Kia has broad service coverage; trims and condition often drive resale.",
    "nissan": "Nissan is common; condition and maintenance history are often important to buyers.",
    "bmw": "BMW is premium; buyers tend to be sensitive to maintenance history and condition.",
    "mercedes": "Mercedes is premium; buyers tend to be sensitive to maintenance history and condition.",
    "audi": "Audi is premium; buyers tend to be sensitive to maintenance history and condition.",
    "chevrolet": "Chevrolet demand can be model-dependent; condition and serviceability often matter.",
}


def _maybe_make_note(make: str | None) -> str | None:
    m = _norm_lower(make)
    if not m:
        return None
    return _MAKE_NOTES.get(m)


# ── Per-factor rules ─────────────────────────────────────────────────────────


def _explain_year(value, direction: str) -> tuple[str, str]:
    year = _safe_float(value)
    if year is None:
        desc = "Model year is unknown."
        return desc, "condition_and_age"

    current_year = datetime.now().year
    age = max(current_year - int(year), 0)

    if age <= 2:
        base = "This is a very recent model year, so buyers often expect newer condition and updated features."
    elif age <= 5:
        base = "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
    elif age <= 10:
        base = "This is a mid-age model year; condition and maintenance history become more important to buyers."
    elif age <= 15:
        base = "This is an older model year, so depreciation and expected maintenance risk are more relevant to buyers."
    else:
        base = "This is a very old model year; inspections and maintenance history matter a lot to buyers."

    desc = f"{base}"
    return desc, "condition_and_age"


def _explain_mileage(value, direction: str) -> tuple[str, str]:
    km = _safe_float(value)
    stats = get_market_stats()
    bucket = bucket_against_quantiles(km, stats.mileage_km)
    typical = _typicality_phrase(bucket)

    if km is None:
        base = "Mileage is unknown; buyers often price in uncertainty about wear and maintenance."
    elif km < 30_000:
        base = "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior."
    elif km < 80_000:
        base = "Mileage is in a generally good range; condition and service history still matter a lot."
    elif km < 150_000:
        base = "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs."
    else:
        base = "Mileage is very high, which can raise buyer concern about wear and future maintenance."

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "usage_and_wear"


def _explain_mileage_per_year(value, direction: str) -> tuple[str, str]:
    kpy = _safe_float(value)
    stats = get_market_stats()
    bucket = bucket_against_quantiles(kpy, stats.mileage_per_year)
    typical = _typicality_phrase(bucket)

    if kpy is None:
        base = "Annual mileage is unknown; usage intensity is harder to infer."
    elif kpy < 7_000:
        base = "Annual mileage is low, which often suggests lighter usage and potentially less wear per year."
    elif kpy < 15_000:
        base = "Annual mileage is in a normal range for daily use; condition and service history are key."
    elif kpy < 25_000:
        base = "Annual mileage is high, which may suggest intensive daily use and faster wear."
    else:
        base = "Annual mileage is very high, which may suggest intensive use (long commuting or frequent trips)."

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "usage_and_wear"


def _explain_transmission(value, direction: str) -> tuple[str, str]:
    t = _norm_lower(value) or "unknown"

    if "cvt" in t:
        base = "CVT gearboxes are often appreciated for smooth driving in city traffic, but long-term condition and servicing matter."
    elif "dsg" in t or "dct" in t or "dual" in t:
        base = "DSG/dual-clutch gearboxes can feel quick and efficient, but clutch and mechatronics condition and servicing quality matter."
    elif "auto" in t:
        base = "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
    elif "manual" in t:
        base = "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
    else:
        base = "Transmission type influences driving comfort and buyer demand."

    desc = f"{base}"
    return desc, "comfort_and_resale"


def _explain_drivetrain(value, direction: str, raw_row: dict) -> tuple[str, str]:
    d = _norm_lower(value) or "unknown"
    body = _norm_lower(raw_row.get("body_type"))
    segment = _norm_lower(raw_row.get("car_segment"))

    if d in {"awd", "4wd"}:
        base = "AWD/4WD can add appeal for SUVs and rough-road use, but it may increase fuel and maintenance costs."
    elif d == "rwd":
        base = "RWD can be valued in some premium or performance-oriented cars, though running costs can be higher."
    elif d == "fwd":
        base = "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
    else:
        base = "Drivetrain affects traction, running costs, and how buyers perceive the car's use case."

    # Add a tiny bit of context without overriding SHAP direction
    ctx = None
    if body and "suv" in body:
        ctx = "For SUVs, drivetrain choices can influence perceived capability and resale."
    elif segment and segment in {"luxury", "premium"}:
        ctx = "In premium segments, drivetrain can influence buyer expectations."

    parts = [base]
    if ctx:
        parts.append(ctx)
    return " ".join(parts), "capability_and_cost"


def _explain_horsepower(value, direction: str) -> tuple[str, str]:
    hp = _safe_float(value)
    stats = get_market_stats()
    bucket = bucket_against_quantiles(hp, stats.horsepower)
    typical = _typicality_phrase(bucket)

    if hp is None:
        base = "Horsepower is unknown; performance expectations are harder to infer."
    elif hp < 90:
        base = "Lower horsepower usually aligns with economy-focused driving, but may feel underpowered in larger cars."
    elif hp < 140:
        base = "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs."
    elif hp < 200:
        base = "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims."
    else:
        base = "Very high horsepower can signal premium/performance positioning, but running costs may be higher."

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "performance"


def _explain_engine_cc(value, direction: str, raw_row: dict) -> tuple[str, str]:
    cc = _safe_float(value)

    fuel = _norm_lower((raw_row or {}).get("fuel"))
    if fuel == "electric":
        base = (
            "This listing is electric; engine displacement (cc) is not a true mechanical attribute for pure EVs. "
            "If `engine_cc` appears influential here, it is likely acting as a catalog/data proxy rather than a real engine spec."
        )
        return base, "performance_and_cost"

    stats = get_market_stats()
    bucket = bucket_against_quantiles(cc, stats.engine_cc)
    typical = _typicality_phrase(bucket)

    if cc is None:
        base = "Engine size is unknown; running costs and performance are harder to infer."
    elif cc < 1300:
        base = "Smaller engines tend to support fuel economy and lower running costs, but may reduce performance appeal."
    elif cc < 1800:
        base = "Mid-size engines balance daily usability with reasonable running costs."
    elif cc < 2500:
        base = "Larger engines can support stronger performance, but fuel, licensing, and maintenance costs may be higher."
    else:
        base = "Very large engines can indicate premium/performance positioning, but buyers may factor in higher running costs."

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "performance_and_cost"


def _explain_fuel(value, direction: str) -> tuple[str, str]:
    f = _norm_lower(value) or "unknown"

    if f == "petrol":
        base = "Petrol is the standard option with wide service availability and familiar maintenance."
    elif f == "cng":
        base = "CNG can reduce running costs, but buyers often care about installation quality, cylinder inspection, and refueling convenience."
    elif f == "hybrid":
        base = "Hybrids can be valued for fuel economy in heavy traffic, but battery and system condition matters to buyers."
    elif f == "diesel":
        base = "Diesel can be efficient for long-distance use, but demand and maintenance considerations vary by model."
    elif f == "electric":
        base = "Electric cars can reduce running costs, but charging access and battery condition strongly affect buyer confidence."
    else:
        base = "Fuel type influences running costs, buyer demand, and maintenance expectations."

    desc = f"{base}"
    return desc, "running_costs"


def _explain_body_type(value, direction: str) -> tuple[str, str]:
    bt = _norm_lower(value) or "unknown"

    if "suv" in bt:
        base = "SUV body styles are often in demand for family space and road presence."
    elif "crossover" in bt:
        base = "Crossovers are popular for a higher driving position with car-like comfort and running costs."
    elif "sedan" in bt:
        base = "Sedans are common for family and daily commuting, with demand depending on make/model and trim."
    elif "hatch" in bt:
        base = "Hatchbacks can be practical in city driving and parking, often valued for efficiency."
    elif "mpv" in bt:
        base = "MPVs focus on passenger space and practicality, which can matter a lot for family use."
    elif "van" in bt:
        base = "Vans can be valued for passenger or cargo practicality, but buyer demand can be more specialized."
    elif "pickup" in bt:
        base = "Pickups are often valued for utility and durability, with demand depending on condition and usage history."
    elif "coupe" in bt:
        base = "Coupes are a niche style choice; demand can depend on brand, performance, and overall condition."
    elif "convertible" in bt:
        base = "Convertibles are niche in Egypt; condition, roof mechanism health, and rarity can influence demand."
    else:
        base = "Body type affects practicality, buyer demand, and typical use cases."

    desc = f"{base}"
    return desc, "segment_and_demand"


def _explain_car_segment(value, direction: str) -> tuple[str, str]:
    seg = _norm_lower(value) or "unknown"

    if seg in {"luxury"}:
        base = "Luxury segments are positioned higher, but buyers are sensitive to condition, options, and maintenance history."
    elif seg in {"luxury_suv"}:
        base = "Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs."
    elif seg in {"executive"}:
        base = "Executive segments emphasize comfort and features; condition and service history often drive resale." 
    elif seg in {"sport"}:
        base = "Sport segments are valued for performance and image, but buyers are often sensitive to accident history and maintenance." 
    elif seg in {"suv"}:
        base = "SUV segments are often in demand for family use and road presence, with prices driven by condition and features." 
    elif seg in {"crossover"}:
        base = "Crossover segments are popular for practicality and comfort, often balancing space with manageable running costs." 
    elif seg in {"mpv"}:
        base = "MPV segments are primarily valued for space and practicality, especially for larger families." 
    elif seg in {"van"}:
        base = "Van segments can have specialized demand for passenger or cargo use, depending on condition and purpose." 
    elif seg in {"truck"}:
        base = "Truck segments are often valued for utility; condition and usage intensity can strongly affect resale." 
    elif seg in {"family"}:
        base = "Family segments are usually priced on practicality, reliability, and running costs."
    elif seg in {"city", "economy"}:
        base = "City/economy segments are valued for affordability and efficiency rather than premium positioning."
    else:
        base = "Segment affects how buyers compare alternatives and what they expect from the car."

    desc = f"{base}"
    return desc, "segment_and_demand"


def _explain_brand_origin(value, direction: str) -> tuple[str, str]:
    origin = _norm_lower(value) or "unknown"

    if origin in {"japanese", "korean"}:
        base = "Japanese/Korean brands are often associated with perceived reliability and parts availability in Egypt."
    elif origin in {"german", "european"}:
        base = "European brands can have a premium image, but buyers often price in higher maintenance costs."
    elif origin in {"chinese"}:
        base = "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network."
    elif origin in {"american"}:
        base = "American brands are model-dependent; demand often depends on parts availability and common service experience."
    else:
        base = "Brand origin can influence buyer expectations around reliability, parts, and maintenance costs."

    desc = f"{base}"
    return desc, "brand_and_resale"


def _explain_location(value, direction: str) -> tuple[str, str]:
    base = "Location can affect demand, supply, and buyer preferences between cities and regions."
    desc = f"{base}"
    return desc, "market_dynamics"


def _explain_seating_capacity(value, direction: str) -> tuple[str, str]:
    seats = _safe_float(value)
    if seats is None:
        base = "Seating capacity is unknown; practicality is harder to compare."
    elif seats >= 7:
        base = "Higher seating capacity can increase family practicality for larger households or frequent passengers."
    elif seats <= 4:
        base = "Lower seating capacity can reduce family practicality, but may be normal for small city cars."
    else:
        base = "Seating capacity influences practicality for families and daily use."

    desc = f"{base}"
    return desc, "practicality"


def explain_factor(
    *,
    factor: str,
    value,
    direction: str,
    make: str | None = None,
    model: str | None = None,
    raw_row: dict | None = None,
) -> dict:
    """Convert a SHAP factor row into an expert-style explanation.

    Args:
        factor: feature name (e.g. 'mileage_km')
        value: feature value
        direction: 'positive' or 'negative' (source of truth)
        make/model: optional context (used only for gentle notes)
        raw_row: full feature row dict for context

    Returns:
        dict with at least: factor, direction, description.
        Also includes (optional): evidence, category.
    """

    raw_row = raw_row or {}

    if direction not in {"positive", "negative"}:
        direction = "positive" if str(direction).lower().startswith("p") else "negative"

    evidence = f"{factor}: {_format_value(factor, value)}"

    # Use canonical make/model from raw_row when available
    make_ctx = _norm_str(raw_row.get("make")) or _norm_str(make)
    model_ctx = _norm_str(raw_row.get("model")) or _norm_str(model)

    category = None

    if factor == "year":
        desc, category = _explain_year(value, direction)
    elif factor == "mileage_km":
        desc, category = _explain_mileage(value, direction)
    elif factor == "mileage_per_year":
        desc, category = _explain_mileage_per_year(value, direction)
    elif factor == "transmission":
        desc, category = _explain_transmission(value, direction)
    elif factor == "drivetrain":
        desc, category = _explain_drivetrain(value, direction, raw_row)
    elif factor == "horsepower":
        desc, category = _explain_horsepower(value, direction)
    elif factor == "engine_cc":
        desc, category = _explain_engine_cc(value, direction, raw_row)
    elif factor == "fuel":
        desc, category = _explain_fuel(value, direction)
    elif factor == "body_type":
        desc, category = _explain_body_type(value, direction)
    elif factor == "car_segment":
        desc, category = _explain_car_segment(value, direction)
    elif factor == "brand_origin":
        desc, category = _explain_brand_origin(value, direction)
    elif factor == "location":
        desc, category = _explain_location(value, direction)
    elif factor == "seating_capacity":
        desc, category = _explain_seating_capacity(value, direction)
    else:
        val_str = _format_value(factor, value)
        desc = (
            f"{factor} is {val_str}. This feature can influence buyer preferences and running costs; "
            f"direction can vary by context and interactions."
        )
        category = "other"

    # Optional, lightweight make note (kept minimal to avoid repeating across every factor)
    make_note = _maybe_make_note(make_ctx)
    if make_note and make_ctx and model_ctx and factor in {"brand_origin"}:
        desc = f"{make_note} {desc}"

    out = ExpertExplanation(
        factor=factor,
        direction=direction,
        description=desc,
        evidence=evidence,
        category=category,
    )

    # Return as dict to match the existing pipeline.
    return {
        "factor": out.factor,
        "direction": out.direction,
        "description": out.description,
        "evidence": out.evidence,
        "category": out.category,
    }
