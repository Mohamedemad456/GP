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

from app.services.explainability.market_stats import bucket_against_quantiles, get_market_stats


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
    "toyota": "Toyota dominates Egyptian resale thanks to legendary parts availability, low workshop costs, and strong brand trust across all governorates.",
    "hyundai": "Hyundai has one of the widest service networks in Egypt, with locally assembled models holding value well due to affordable spare parts.",
    "kia": "Kia benefits from the El-Nasr Automotive partnership and competitive pricing; newer models are gaining resale strength.",
    "nissan": "Nissan has a solid Egyptian presence; models like Sunny and Sentra are popular for fleet and family use, with parts widely available.",
    "bmw": "BMW carries a strong premium image in Egypt, but independent workshop costs and parts import duties can weigh on resale for older models.",
    "mercedes": "Mercedes-Benz is the benchmark for luxury in Egypt; well-maintained units hold value, but repair costs can be steep outside authorised centres.",
    "audi": "Audi is a niche premium choice in Egypt; buyers value condition highly because spare parts and specialist servicing can be expensive.",
    "chevrolet": "Chevrolet's Egyptian history (Optra, Lanos, Aveo) keeps parts cheap and service accessible, but model reputation varies significantly.",
    "mg": "MG is gaining market share in Egypt with competitive pricing and features, but long-term resale data is still developing.",
    "chery": "Chery offers value-for-money in the Egyptian market; resale depends heavily on model reputation and available after-sales support.",
    "geely": "Geely is growing in Egypt, backed by Ghabbour Auto; buyers weigh newer features against developing resale confidence.",
    "byd": "BYD is at the forefront of Egypt's emerging EV market; resale depends on battery health and the expanding charging network.",
    "fiat": "Fiat (especially 128 NE and Tipo) has deep roots in Egypt; older models are cheap to maintain but newer ones face stiffer competition.",
    "mitsubishi": "Mitsubishi Lancer and Pajero are well-known in Egypt; parts are accessible but model-dependent depreciation applies.",
    "suzuki": "Suzuki is popular for compact city cars in Egypt; affordability and low running costs support demand.",
    "peugeot": "Peugeot has a loyal niche in Egypt; 301 and 508 are common, with parts availability depending on generation.",
    "renault": "Renault has a growing presence; Megane and Duster are well-known, but resale can be softer than Japanese rivals.",
    "volkswagen": "Volkswagen carries a European-quality perception in Egypt; parts are pricier than Asian competitors, affecting resale for high-mileage units.",
    "jeep": "Jeep's rugged image appeals in Egypt for desert and off-road use; Wrangler and Grand Cherokee have cult followings.",
    "skoda": "Skoda Octavia is a popular fleet and family choice in Egypt; German engineering at a more accessible price point.",
    "seat": "SEAT shares VW-group parts, making service accessible in Egypt; Leon and Ibiza offer European feel at a mid-range price.",
    "opel": "Opel Astra and Corsa have a loyal Egyptian following; parts are affordable but model freshness affects resale.",
    "honda": "Honda Civic and Accord enjoy strong resale in Egypt, backed by reliability perception and reasonable parts costs.",
    "mazda": "Mazda is a niche favourite in Egypt; driving dynamics appeal to enthusiasts, though parts can be slightly harder to source.",
    "subaru": "Subaru Impreza has a dedicated Egyptian following; AWD appeal is niche but loyal, with specialist workshops available.",
    "volvo": "Volvo is respected for safety in Egypt, but a smaller service network and pricier parts affect resale on older models.",
    "porsche": "Porsche is ultra-premium in Egypt; condition and service history are paramount, and the buyer pool is small but willing.",
    "land rover": "Land Rover has a strong off-road image in Egypt, but high maintenance costs can pressure resale on older units.",
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
        base = (
            "This is a very recent model year — still within or near the official warranty period. "
            "Buyers expect near-showroom condition, original paint, and full agency service records. "
            "Customs and import duties on recent-year cars are at their highest, which supports stronger resale."
        )
    elif age <= 5:
        base = (
            "This is a relatively recent model year. First-owner resale tends to be strong in this window, "
            "especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
        )
    elif age <= 10:
        base = (
            "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. "
            "Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
        )
    elif age <= 15:
        base = (
            "This is an older model year. Depreciation is well advanced, and buyers focus heavily on mechanical soundness, "
            "rust (especially underbody in coastal cities), and whether major components like the gearbox and AC have been replaced."
        )
    else:
        base = (
            "This is a very old model year. In the Egyptian market, very old cars can still hold niche value (e.g. classic Fiat 128, old Land Cruisers), "
            "but most buyers will expect significant wear and negotiate accordingly. Full inspection and documented repairs are critical."
        )

    desc = f"{base}"
    return desc, "condition_and_age"


def _explain_mileage(value, direction: str) -> tuple[str, str]:
    km = _safe_float(value)
    stats = get_market_stats()
    bucket = bucket_against_quantiles(km, stats.mileage_km)
    typical = _typicality_phrase(bucket)

    if km is None:
        base = "Mileage is unknown; Egyptian buyers typically discount unlisted mileage, assuming higher-than-average use."
    elif km < 30_000:
        base = (
            "Very low mileage for the Egyptian market, suggesting light use — possibly a second car or weekend-only driving. "
            "Buyers will verify this against the service book and tyre/brake wear."
        )
    elif km < 80_000:
        base = (
            "Mileage is in a healthy range for the Egyptian market. This is typical for a car used mainly in-city "
            "(Cairo, Alexandria) without heavy intercity driving. Service history and consumable condition still matter."
        )
    elif km < 150_000:
        base = (
            "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or "
            "ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, "
            "and possibly engine mounts may need attention."
        )
    else:
        base = (
            "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. "
            "Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented."
        )

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
        base = "Annual mileage is unknown; usage intensity is harder to assess, and buyers may assume heavier use."
    elif kpy < 7_000:
        base = (
            "Annual mileage is low, suggesting the car was lightly used — perhaps a weekend car or short neighbourhood commute. "
            "This is a positive signal in the Egyptian market, where traffic-heavy cities can rack up kilometres quickly."
        )
    elif kpy < 15_000:
        base = (
            "Annual mileage is typical for an Egyptian daily driver — regular in-city commuting in Cairo, Giza, or Alexandria. "
            "At this rate, normal scheduled maintenance should keep the car in good shape."
        )
    elif kpy < 25_000:
        base = (
            "Annual mileage is high, suggesting daily intercity use, long commutes (e.g. 6th of October – Nasr City), or "
            "ride-sharing/fleet duty. Suspension, brakes, and transmission may have seen accelerated wear."
        )
    else:
        base = (
            "Annual mileage is very high, typical of heavy commercial use, long-haul driving (Cairo–Aswan corridor), or "
            "ride-sharing fleets. Buyers will inspect drivetrain and chassis components closely."
        )

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "usage_and_wear"


def _explain_transmission(value, direction: str) -> tuple[str, str]:
    t = _norm_lower(value) or "unknown"

    if "cvt" in t:
        base = (
            "CVT gearboxes are valued for smooth, fuel-efficient driving in Cairo’s heavy traffic. "
            "However, Egyptian buyers are cautious about CVT longevity — service records and fluid changes matter."
        )
    elif "dsg" in t or "dct" in t or "dual" in t:
        base = (
            "DSG/dual-clutch gearboxes offer quick shifts and European driving feel, but Egyptian stop-and-go traffic "
            "can stress the clutch pack. Buyers pay close attention to shudder, hesitation, and mechatronics service history."
        )
    elif "auto" in t:
        base = (
            "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion "
            "makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
        )
    elif "manual" in t:
        base = (
            "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian "
            "private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
        )
    else:
        base = "Transmission type affects driving comfort and strongly influences buyer demand in Egypt’s congested cities."

    desc = f"{base}"
    return desc, "comfort_and_resale"


def _explain_drivetrain(value, direction: str, raw_row: dict) -> tuple[str, str]:
    d = _norm_lower(value) or "unknown"
    body = _norm_lower(raw_row.get("body_type"))
    segment = _norm_lower(raw_row.get("car_segment"))

    if d in {"awd", "4wd"}:
        base = (
            "AWD/4WD is valued in Egypt for desert trips, Sahel road conditions, and the perceived ruggedness it adds to SUVs. "
            "However, it increases fuel consumption and drivetrain maintenance costs, which price-conscious buyers factor in."
        )
    elif d == "rwd":
        base = (
            "RWD is common in premium and performance cars (BMW 3-Series, Mustang). In Egypt, it appeals to driving enthusiasts "
            "but can be trickier on wet roads and costs more to maintain (differential, driveshaft) than FWD alternatives."
        )
    elif d == "fwd":
        base = (
            "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. "
            "It’s what most Egyptian buyers expect in the economy and family segments."
        )
    else:
        base = "Drivetrain affects traction, fuel economy, and maintenance costs — all key buyer considerations in Egypt."

    ctx = None
    if body and "suv" in body:
        ctx = "For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
    elif segment and segment in {"luxury", "premium"}:
        ctx = "In Egypt’s premium segment, drivetrain choice signals the car’s intended use and influences buyer expectations."

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
        base = "Horsepower is unknown; buyers cannot easily gauge performance or compare with similar listings."
    elif hp < 90:
        base = (
            "Lower horsepower suits city economy driving (Suzuki Alto, Chery QQ class). Adequate for Cairo traffic, "
            "but may feel strained on the Cairo–Alexandria Desert Road or when fully loaded."
        )
    elif hp < 140:
        base = (
            "Moderate horsepower covers the Egyptian market’s mainstream sweet spot — enough for daily commuting "
            "and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class."
        )
    elif hp < 200:
        base = (
            "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. "
            "In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4)."
        )
    else:
        base = (
            "Very high horsepower signals premium or performance positioning (BMW 5-series, Mustang, V8 SUVs). "
            "Egyptian buyers in this bracket expect strong condition, and sellers can command a premium, but fuel and insurance costs are higher."
        )

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
        base = "Engine size is unknown; running costs and customs classification are harder to assess."
    elif cc < 1300:
        base = (
            "Smaller engines (under 1,300 cc) fall in the lowest Egyptian customs duty bracket, making them cheaper to import. "
            "They offer excellent fuel economy for city driving, but may lack power for highway overtaking when loaded."
        )
    elif cc < 1800:
        base = (
            "Mid-range engine size (1,300–1,800 cc) is the Egyptian market’s mainstream. It balances daily usability "
            "with manageable fuel and licensing costs — the bulk of Hyundai, Kia, and Nissan sales fall here."
        )
    elif cc < 2500:
        base = (
            "Larger engines (1,800–2,500 cc) enter higher customs duty tiers and carry increased fuel and annual licensing costs. "
            "They suit buyers who need the extra power for SUVs, family touring, or towing, but resale narrows to those who accept the running costs."
        )
    else:
        base = (
            "Very large engines (2,500+ cc) attract the highest customs duties and licensing fees in Egypt. "
            "They’re typically found in premium/performance models and full-size SUVs, where buyers expect strong condition "
            "and accept higher fuel bills in exchange for capability and status."
        )

    parts = [base]
    if typical:
        parts.append(typical)
    return " ".join(parts), "performance_and_cost"


def _explain_fuel(value, direction: str) -> tuple[str, str]:
    f = _norm_lower(value) or "unknown"

    if f == "petrol":
        base = (
            "Petrol (benzine) is the standard in Egypt with universal availability at every petrol station. "
            "Octane 92 is most common; some higher-spec engines require Octane 95, which costs more and is less available outside major cities."
        )
    elif f in {"cng", "natural gas", "gas"}:
        base = (
            "Natural gas (CNG) is popular in Egypt for dramatically lower fuel costs, especially among taxi and ride-share drivers. "
            "Resale depends on cylinder certification (annual inspection), proper installation quality, and whether the conversion is factory or aftermarket."
        )
    elif f == "hybrid":
        base = (
            "Hybrids benefit from fuel savings in Cairo/Alexandria stop-and-go traffic. Egypt offers reduced customs duties on hybrids, "
            "which supports value. Buyers will check the hybrid battery health and whether it has been replaced or reconditioned."
        )
    elif f == "diesel":
        base = (
            "Diesel is efficient for long-distance and heavy-load use, but diesel passenger cars are a niche in Egypt. "
            "Specialist servicing, injector condition, and DPF health (on newer models) are key buyer concerns. "
            "Diesel fuel is subsidised but availability of Euro-spec diesel varies outside main cities."
        )
    elif f == "electric":
        base = (
            "Electric vehicles are emerging in Egypt, supported by new government incentives and zero customs duties. "
            "Resale value heavily depends on battery state-of-health, access to charging infrastructure (still concentrated in Cairo/Giza), "
            "and whether the car was imported or officially distributed."
        )
    else:
        base = "Fuel type influences running costs, supply availability, and buyer demand patterns across the Egyptian market."

    desc = f"{base}"
    return desc, "running_costs"


def _explain_body_type(value, direction: str) -> tuple[str, str]:
    bt = _norm_lower(value) or "unknown"

    if "suv" in bt:
        base = (
            "SUVs are among the most sought-after body styles in Egypt, valued for family space, road presence, "
            "and the ability to handle Egypt’s varied road surfaces. Models like Tucson, RAV4, and Sportage dominate this segment."
        )
    elif "crossover" in bt:
        base = (
            "Crossovers are Egypt’s fastest-growing segment — buyers get a higher driving position and modern styling "
            "with car-like fuel economy. Popular choices include Creta, C3 Aircross, and Bayon."
        )
    elif "sedan" in bt:
        base = (
            "Sedans remain the backbone of the Egyptian car market, used for daily commuting and family transport. "
            "Demand depends heavily on brand reputation, trim level, and whether the model is locally assembled."
        )
    elif "hatch" in bt:
        base = (
            "Hatchbacks are practical for Cairo’s tight streets and parking. They’re valued for fuel efficiency and "
            "manoeuvrability, though some Egyptian buyers perceive them as less prestigious than sedans."
        )
    elif "mpv" in bt:
        base = (
            "MPVs serve larger Egyptian families who need 7+ seats for daily use. Models like Avanza and Carnival "
            "are popular; condition of the third-row seating and AC effectiveness are common buyer checkpoints."
        )
    elif "van" in bt:
        base = (
            "Vans serve a specialised market in Egypt — microbus transport, cargo delivery, and large-family use. "
            "Demand is commercial-driven, and buyers focus on mechanical reliability and payload capacity."
        )
    elif "pickup" in bt:
        base = (
            "Pickups are valued in Egypt for utility, construction work, and rural use. Toyota Hilux and Mitsubishi L200 "
            "are benchmarks; condition, drivetrain, and towing capacity are the main buyer concerns."
        )
    elif "coupe" in bt:
        base = (
            "Coupes are a niche, lifestyle-oriented choice in Egypt. The buyer pool is smaller, so resale depends "
            "heavily on brand cachet, condition, and whether the car appeals to the enthusiast community."
        )
    elif "convertible" in bt:
        base = (
            "Convertibles are rare in Egypt’s dusty, hot climate. Rarity can work for or against value — "
            "collectors may pay more, but the general buyer pool is very small. Roof mechanism and interior condition are critical."
        )
    else:
        base = "Body type shapes buyer expectations around practicality, comfort, and prestige in the Egyptian market."

    desc = f"{base}"
    return desc, "segment_and_demand"


def _explain_car_segment(value, direction: str) -> tuple[str, str]:
    seg = _norm_lower(value) or "unknown"

    if seg in {"luxury"}:
        base = (
            "Luxury-segment cars carry a premium in Egypt, but the buyer pool is smaller and highly condition-sensitive. "
            "Full agency service history, original paint, and working electronics are expected. Examples: Mercedes E/S-Class, BMW 7-Series."
        )
    elif seg in {"luxury_suv"}:
        base = (
            "Luxury SUVs (GLE, X5, Range Rover) are aspirational in Egypt. Buyers accept high running costs but demand "
            "impeccable condition. Depreciation can be steep once warranty expires due to expensive maintenance."
        )
    elif seg in {"executive"}:
        base = (
            "Executive-segment cars (Camry, Passat, Accord) balance comfort, features, and reasonable costs. "
            "In Egypt, this segment is popular with professionals and holds value well when condition is good."
        )
    elif seg in {"sport"}:
        base = (
            "Sport-segment cars attract enthusiast buyers in Egypt. Accident-free history, original drivetrain, and "
            "documented performance maintenance (brakes, suspension) are critical to resale value."
        )
    elif seg in {"suv"}:
        base = (
            "The SUV segment is one of the strongest in Egypt’s market, driven by family demand, road presence, "
            "and the ability to handle varied road conditions. Condition, features, and brand loyalty dominate pricing."
        )
    elif seg in {"crossover"}:
        base = (
            "Crossovers are Egypt’s fastest-growing segment, offering SUV-like practicality with sedan-like economy. "
            "Competition is fierce (Creta, Tucson, Sportage), so features and condition differentiate pricing."
        )
    elif seg in {"mpv"}:
        base = (
            "MPV-segment demand in Egypt is driven by large families needing 7+ seats. Condition of rear seating, "
            "AC performance, and mechanical reliability are top buyer priorities."
        )
    elif seg in {"van"}:
        base = (
            "Van-segment demand is largely commercial in Egypt (microbus, delivery). Buyers focus on mechanical "
            "reliability, payload, and total cost of ownership over premium features."
        )
    elif seg in {"truck"}:
        base = (
            "Truck-segment vehicles in Egypt serve utility, agriculture, and construction. Resale is driven by "
            "durability reputation (Hilux, L200), drivetrain condition, and documented usage history."
        )
    elif seg in {"family"}:
        base = (
            "Family-segment cars are the volume heart of Egypt’s market (Elantra, Cerato, Sentra). Buyers prioritise "
            "reliability, low running costs, and parts availability over premium features."
        )
    elif seg in {"city", "economy"}:
        base = (
            "City/economy cars (i10, Picanto, Alto) are valued for rock-bottom running costs and easy city parking. "
            "In Egypt, this segment is price-sensitive; small differences in condition can shift buyer interest."
        )
    else:
        base = "Segment shapes buyer expectations, competitor comparisons, and perceived value in the Egyptian market."

    desc = f"{base}"
    return desc, "segment_and_demand"


def _explain_brand_origin(value, direction: str) -> tuple[str, str]:
    origin = _norm_lower(value) or "unknown"

    if origin == "japanese":
        base = (
            "Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, "
            "backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
        )
    elif origin == "korean":
        base = (
            "Korean brands (Hyundai, Kia) are among the top sellers in Egypt, with strong local assembly "
            "and dealer networks. Resale values have climbed steadily, approaching Japanese-brand levels in popular models."
        )
    elif origin in {"german"}:
        base = (
            "German brands (BMW, Mercedes, VW, Audi) carry a strong premium and engineering image in Egypt. "
            "However, parts import duties and specialist workshop costs mean buyers factor in higher ownership expenses, "
            "especially as the car ages."
        )
    elif origin in {"european"}:
        base = (
            "European brands (Peugeot, Renault, Fiat, SEAT, Skoda) occupy a mid-range niche in Egypt. "
            "They’re often appreciated for build quality and features, but parts availability and cost can vary by brand."
        )
    elif origin == "chinese":
        base = (
            "Chinese brands (MG, Chery, Geely, BYD) are rapidly growing in Egypt with competitive pricing, modern features, "
            "and expanding dealer networks. Resale confidence is improving but still trails Japanese and Korean brands for most buyers."
        )
    elif origin == "american":
        base = (
            "American brands (Chevrolet, Jeep, Ford) have a mixed reputation in Egypt. Chevrolet benefits from local assembly history, "
            "while Jeep has cult SUV appeal. Resale is model-dependent, with parts availability varying by generation."
        )
    else:
        base = "Brand origin influences Egyptian buyer expectations around reliability, parts costs, and long-term ownership confidence."

    desc = f"{base}"
    return desc, "brand_and_resale"


def _explain_location(value, direction: str) -> tuple[str, str]:
    loc = _norm_lower(value) or "unknown"

    if loc in {"cairo", "giza", "6th of october", "new cairo", "heliopolis", "nasr city", "maadi", "zamalek", "dokki", "mohandessin"}:
        base = (
            "Cairo/Giza is Egypt’s largest and most liquid car market, with the highest supply and demand. "
            "Prices tend to set the benchmark; buyers have the widest selection and strongest negotiating leverage."
        )
    elif loc in {"alexandria", "alex"}:
        base = (
            "Alexandria is Egypt’s second-largest car market. Coastal humidity can affect underbody rust, "
            "which savvy buyers inspect. Demand patterns are slightly different from Cairo, with some models more popular locally."
        )
    elif loc in {"mansoura", "tanta", "zagazig", "damanhour", "damietta", "kafr el sheikh"}:
        base = (
            "Delta-region cities have active local markets, but selection is narrower than Cairo. "
            "Prices can be slightly lower, though popular models still command national-level pricing."
        )
    elif loc in {"aswan", "luxor", "sohag", "asyut", "minya", "qena", "beni suef"}:
        base = (
            "Upper Egypt markets have lower supply and fewer dealership options. Buyers may travel to Cairo for better selection, "
            "which can create a slight discount for local listings but also limits the buyer pool."
        )
    elif loc in {"hurghada", "sharm el sheikh", "dahab", "marsa alam", "el gouna"}:
        base = (
            "Tourist/Red Sea cities have a specialised car market, with demand from hospitality workers and tourism businesses. "
            "Salt air and desert conditions can accelerate exterior wear, which buyers check closely."
        )
    elif loc in {"ismailia", "suez", "port said"}:
        base = (
            "Canal-zone cities have a distinct market influenced by port proximity and free-zone activity. "
            "Some imported cars enter through Port Said, and local pricing can reflect logistical advantages."
        )
    else:
        base = (
            "Location affects local supply and demand, buyer pool size, and regional preferences. "
            "Cars in major cities typically sell faster but face more competition."
        )

    return base, "market_dynamics"


def _explain_seating_capacity(value, direction: str) -> tuple[str, str]:
    seats = _safe_float(value)
    if seats is None:
        base = "Seating capacity is unknown; Egyptian family buyers especially care about this for daily and weekend use."
    elif seats >= 7:
        base = (
            "7+ seats are highly valued in Egypt, where larger families and extended-family outings are common. "
            "Models like Avanza, Carnival, and Fortuner command a premium when third-row condition and AC reach are good."
        )
    elif seats <= 4:
        base = (
            "Fewer than 5 seats is typical for small city cars and coupes. In Egypt, this limits the buyer pool "
            "to singles, couples, or second-car buyers — fine for city commuting but less appealing for family use."
        )
    else:
        base = (
            "Standard 5-seat capacity suits most Egyptian family needs for daily commuting and short trips. "
            "Buyers compare interior space, comfort, and boot size within this common configuration."
        )

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

    # Optional, lightweight make note — only on brand_origin where the specific brand
    # context complements the generic origin explanation (e.g. "Toyota … Japanese brands …").
    # Avoided on engine_cc / car_segment / fuel / location where it reads as disconnected.
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
