from __future__ import annotations

from typing import Any

from app.services.car_lookup import SearchFilters, format_filters


def _display_transmission(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    low = v.lower()
    if low == "cvt":
        return "CVT"
    if low == "dsg":
        return "DSG"
    if low == "dct":
        return "DCT"
    if low == "automatic":
        return "Automatic"
    if low == "manual":
        return "Manual"
    return v


def _display_fuel(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    low = v.lower()
    mapping = {
        "petrol": "Petrol",
        "gasoline": "Petrol",
        "diesel": "Diesel",
        "hybrid": "Hybrid",
        "electric": "Electric",
        "ev": "Electric",
        "cng": "CNG",
    }
    return mapping.get(low, v)


def build_specs_context(
    rows: list[dict[str, Any]],
    egypt_note: str | None = None,
    token_budget_hint: int = 320,
) -> str:
    if not rows:
        return ""

    make = str(rows[0].get("make") or "").strip()
    model = str(rows[0].get("model") or "").strip()

    lines: list[str] = []
    lines.append("VERIFIED SPECS (from our lookup dataset snapshot):")
    lines.append(f"Car: {make} {model}")

    # Sort by year
    sorted_rows = sorted(rows, key=lambda r: int(r.get("year") or 0))

    for r in sorted_rows:
        year = r.get("year")
        transmission = _display_transmission((r.get("transmission") or "").strip())
        fuel = _display_fuel((r.get("fuel") or "").strip())
        engine_cc = r.get("engine_cc")
        horsepower = r.get("horsepower")
        body_type = (r.get("body_type") or "").strip()
        drivetrain = (r.get("drivetrain") or "").strip()
        seats = r.get("seating_capacity")
        origin = (r.get("brand_origin") or "").strip()
        segment = (r.get("car_segment") or "").strip()

        specs_bits: list[str] = []
        if engine_cc is not None:
            specs_bits.append(f"{engine_cc}cc")
        if horsepower is not None:
            specs_bits.append(f"{horsepower}hp")
        if transmission:
            specs_bits.append(transmission)
        if fuel:
            specs_bits.append(fuel)
        if body_type:
            specs_bits.append(body_type)
        if drivetrain:
            specs_bits.append(drivetrain)
        if seats is not None:
            specs_bits.append(f"{seats} seats")
        if origin:
            specs_bits.append(origin)
        if segment:
            specs_bits.append(segment)

        specs_text = ", ".join(specs_bits) if specs_bits else "(no specs fields)"
        lines.append(f"- {year}: {specs_text}")

        # Cheap guardrail: keep it short.
        if len("\n".join(lines)) > token_budget_hint * 4:
            break

    if egypt_note:
        lines.append("Egypt market note (curated):")
        lines.append(f"- {egypt_note}")

    lines.append("IMPORTANT: Use ONLY the verified specs above when stating specs. If the user asks for a spec not shown above, say it is not available in the lookup and ask a clarifying question.")

    return "\n".join(lines).strip()


def build_search_context(
    total_matches: int,
    summaries: list[dict[str, Any]],
    filters: SearchFilters,
    top_n: int = 10,
) -> str:
    if total_matches <= 0:
        return ""

    lines: list[str] = []
    lines.append("VERIFIED SEARCH RESULTS (from our lookup dataset snapshot):")
    lines.append(f"Applied filters: {format_filters(filters)}")
    lines.append(f"Total matching rows: {total_matches}")
    lines.append(f"Showing up to {top_n} make/model examples:")

    for item in summaries[:top_n]:
        make = item.get("make")
        model = item.get("model")
        y_min = item.get("year_min")
        y_max = item.get("year_max")
        transmissions = "/".join(item.get("transmissions") or [])
        fuels = "/".join(item.get("fuels") or [])
        body_types = "/".join(item.get("body_types") or [])

        meta_bits: list[str] = []
        if y_min and y_max:
            meta_bits.append(f"{y_min}-{y_max}")
        if transmissions:
            meta_bits.append(transmissions)
        if fuels:
            meta_bits.append(fuels)
        if body_types:
            meta_bits.append(body_types)

        meta = ", ".join(meta_bits)
        lines.append(f"- {make} {model}: {meta}")

    lines.append("IMPORTANT: These are only examples from the lookup snapshot. Ask the user to narrow by budget, year range, body type, and location if they want recommendations.")
    return "\n".join(lines).strip()
