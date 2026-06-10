"""Threshold-only promotion gate logic."""

from __future__ import annotations

from scripts.retrain.contracts import GateResult

# Default thresholds for Milestone 2.
# These are intentionally conservative for a first retrain module.
DEFAULT_THRESHOLDS = {
    "max_holdout_mape_pct": 15.0,
    "min_holdout_r2": 0.80,
    "min_holdout_within_15pct": 70.0,
    "max_cv_mape_pct": 15.0,
    "max_supported_pct_above_30pct": 10.0,  # % of supported combos with MAPE > 30%
    "max_supported_pct_above_50pct": 2.0,   # % of supported combos with MAPE > 50%
}


def check_gate(
    holdout_metrics: dict,
    cv_metrics: dict,
    diag_summary: dict,
    thresholds: dict | None = None,
) -> GateResult:
    """Evaluate a run against threshold-only promotion rules.

    Returns one of:
    - promote: all thresholds met
    - candidate_only: training succeeded but some thresholds missed
    - reject: catastrophic failure or hard-floor breach
    """
    thresholds = thresholds or DEFAULT_THRESHOLDS
    reasons: list[str] = []

    # Holdout checks
    if "MAPE_pct" in holdout_metrics:
        if holdout_metrics["MAPE_pct"] > thresholds["max_holdout_mape_pct"]:
            reasons.append(
                f"Holdout MAPE {holdout_metrics['MAPE_pct']:.2f}% exceeds threshold "
                f"{thresholds['max_holdout_mape_pct']}%"
            )
    if "R2" in holdout_metrics:
        if holdout_metrics["R2"] < thresholds["min_holdout_r2"]:
            reasons.append(
                f"Holdout R2 {holdout_metrics['R2']:.4f} below threshold "
                f"{thresholds['min_holdout_r2']}"
            )
    if "Within_15pct" in holdout_metrics:
        if holdout_metrics["Within_15pct"] < thresholds["min_holdout_within_15pct"]:
            reasons.append(
                f"Holdout Within_15pct {holdout_metrics['Within_15pct']:.2f}% below threshold "
                f"{thresholds['min_holdout_within_15pct']}%"
            )

    # CV checks
    if cv_metrics and "MAPE_pct" in cv_metrics:
        if cv_metrics["MAPE_pct"] > thresholds["max_cv_mape_pct"]:
            reasons.append(
                f"CV MAPE {cv_metrics['MAPE_pct']:.2f}% exceeds threshold "
                f"{thresholds['max_cv_mape_pct']}%"
            )

    # Supported-combo tail checks
    if "pct_above_30pct" in diag_summary:
        if diag_summary["pct_above_30pct"] > thresholds["max_supported_pct_above_30pct"]:
            reasons.append(
                f"Supported combos >30% MAPE share {diag_summary['pct_above_30pct']:.2f}% exceeds "
                f"threshold {thresholds['max_supported_pct_above_30pct']}%"
            )
    if "pct_above_50pct" in diag_summary:
        if diag_summary["pct_above_50pct"] > thresholds["max_supported_pct_above_50pct"]:
            reasons.append(
                f"Supported combos >50% MAPE share {diag_summary['pct_above_50pct']:.2f}% exceeds "
                f"threshold {thresholds['max_supported_pct_above_50pct']}%"
            )

    # Hard reject: completely unusable metrics
    if "MAPE_pct" in holdout_metrics and holdout_metrics["MAPE_pct"] > 50.0:
        reasons.append("Holdout MAPE > 50% — catastrophic model failure")
        return GateResult(
            outcome="reject",
            passed=False,
            reasons=reasons,
        )

    if reasons:
        return GateResult(
            outcome="candidate_only",
            passed=False,
            reasons=reasons,
        )

    return GateResult(
        outcome="promote",
        passed=True,
        reasons=["All thresholds passed"],
    )
