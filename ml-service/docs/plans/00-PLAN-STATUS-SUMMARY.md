# Plan Status Summary — Current Implementation State

> **Last updated**: 2026-06-09

---

## Status Legend

- **Done** — implemented and verified
- **Partial** — some important parts are implemented, but the original plan is not fully complete
- **Done — Rejected** — completed as an experiment, but intentionally not shipped to production
- **Not Started / Deferred** — not yet implemented, or explicitly deprioritized

---

## Plan-by-Plan Status

| # | Plan | Status | Evidence |
|---|------|--------|----------|
| 1 | Data Cleaning & Quality | Done | Implementation notes exist; 01-IMPLEMENTATION-NOTES.md |
| 2 | Feature Engineering V2 | Done — Rejected | Implementation notes exist; 02-IMPLEMENTATION-NOTES.md |
| 3 | Retrain CLI / Runner | Done | Implementation notes created now; 03-IMPLEMENTATION-NOTES.md |
| 4 | Model V2 Training | Done | Frozen 07c recipe implemented in retrain runner; original Plan 4 items intentionally skipped: Optuna re-tuning and price-tier sample weighting |
| 5 | Confidence System & Fallback | Partial | Per-MM MAPE works; dynamic thresholds and fallback routing not implemented |
| 6 | CQR Calibration | Done — Rejected | Implementation notes exist; 06-IMPLEMENTATION-NOTES.md |
| 7 | API & Service Updates | Partial | Health endpoint enriched; ensemble prediction and SHAP work; some schema items missing |
| 8 | Evaluation & Metrics | Partial | All operational exports work; drift monitoring not implemented; presentation notebook deferred |
| 9 | Testing & Hardening | Partial | Manual E2E verification done; automated integration tests not yet written |

---

## Critical Path Items That Are Actually Done

### Production-ready and verified

| Capability | Status |
|---|---|
| Reproducible retrain runner | Done |
| 5-quantile ensemble training | Done |
| Holdout + CV evaluation | Done |
| Artifact export (pickles, metadata, metrics) | Done |
| Registry integration + promotion | Done |
| Training history append | Done |
| Cache mechanism for fast reruns | Done |
| Versioned metrics folders | Done |
| Serving compatibility (lower/median/upper aliases) | Done |
| Model promoted to active production | Done |
| API predictions working in container | Done |
| SHAP explanations for ensemble | Done |
| Per-make-model MAPE diagnostics | Done |

---

## Remaining Gaps by Plan

### Plan 4 — Model V2 Training (Done)

What was implemented:
- 07c frozen recipe in the retrain runner
- 5-quantile XGB + LGBM ensemble with 55/45 weights
- `price_egp_log` target, `price_stratified` split

What was intentionally skipped from the original Plan 4 draft:
- sample weighting by price tier — rejected during 07c evaluation (no improvement)
- full Optuna re-tuning — frozen 07c params used instead (simpler, reproducible)
- CQR integration into production artifact — evaluated separately in Plan 6 and rejected

These are not gaps; they were deliberate simplifications that shipped faster without sacrificing quality.

### Plan 5 — Confidence System & Fallback (Partial)

What exists:
- per-make-model MAPE diagnostics loaded at startup
- confidence label uses per-car MAPE, not global MAPE
- negotiation range computed from per-car MAPE

What is not implemented:
- `very_low` confidence label
- dynamic MAPE thresholds recalibrated per retrain
- model version fallback routing for missing combos
- CQR integration into confidence/intervals

### Plan 7 — API & Service Updates (Partial)

What exists:
- ensemble model loading in `model_state.py`
- 5-quantile artifact handling with aliases
- ensemble SHAP explainer
- health endpoint reports model version, framework, diagnostics loaded, explainer ready
- prediction endpoint works with V2 ensemble
- negotiation range leak fix in `_build_response`
- CVT/DSG descriptions in `factor_expert.py` (partial — schemas may need updates)

What is not implemented:
- schema validation accepting CVT/DSG/Tiptronic transmission values explicitly
- feature builder sync test against training notebook
- direction validation in `factor_expert.py` descriptions

### Plan 8 — Evaluation & Metrics (Partial)

What exists:
- all operational metric exports (global, per-tier, per-make, per-make-model)
- summary JSON
- `make_model_mape.csv`

What is not implemented:
- drift baseline (`feature_distribution_baseline.json`)
- drift report per run
- presentation notebook / plots
- V1 vs V2 comparison harness

### Plan 9 — Testing & Hardening (Partial)

What exists:
- unit tests for feature builder normalization
- unit tests for ensemble explainer robust trim
- manual end-to-end verification script (`/tmp/e2e_test.py`)

What is not implemented:
- automated integration test that starts the service and hits the API
- feature sync test comparing inference vs training outputs
- data pipeline schema validation test
- automated gate outcome tests (candidate_only, reject)

---

## Overall Assessment

The **critical path for production deployment is complete**.

The V2 ensemble model (`v2_2026-06-03_008`, version `v2.1.0`) is:
- trained
- evaluated
- registered
- promoted to active
- serving predictions through the API
- producing SHAP explanations
- using per-make-model MAPE for confidence

Remaining work is around:
- automated tests (Plan 9)
- evaluation presentation outputs (Plan 8 visualizations)
- data drift monitoring (Plan 8 drift)
- confidence system polish (Plan 5 missing features)

None of these are blocking the model from being in production.
