## Plan: Canonical Make/Model + Lookup Fix Pipeline

Unify make/model strings (casing, spacing, aliases), fix a curated allowlist of wrong make↔model pairs, and keep `car_specs_lookup_full_cleaned.csv` + `AI_lookup.csv` + backend JSON outputs consistent. Recommended approach: add one reusable canonicalization module + one “fix + validate + report” helper script, then wire it into the notebook flow so future snapshots don’t reintroduce the same inconsistencies.

**Steps**
1. Inventory current artifacts and their roles (no edits yet)
   1. Confirm current lookup inputs/outputs:
      - `ml-service/data/lookups/car_specs_lookup_full_cleaned.csv` (spec enrichment)
      - `ml-service/data/lookups/AI_lookup.csv` (make/model/year + fuel/transmission + most specs)
      - `ml-service/data/lookups/main_car_info_for_backend.json` and `ml-service/data/lookups/make_model_backend.json` (backend seed)
      - Notebook `ml-service/data/lookups/BACKEND.ipynb` (currently only converts a CSV → JSON + make/model JSON)
      - Notebook `ml-service/notebooks/02_data_cleaning.ipynb` exports `AI_lookup.csv` and merges processed data with `settings.load_data("lookup")`
   2. Re-run an expanded audit across *all* three datasets (AI_lookup, car_specs, make_model_backend) to produce:
      - exact duplicates vs backend-normalized duplicates
      - make normalization collisions (e.g., `BMW` vs `Bmw`)
      - within-make model collisions (e.g., `CRV` vs `Cr V`)
      - cross-make collisions (schema concern)
      - “model equals known make” flags (captures Claude items like `Maruti`, `Saipa` showing up as model)
      - mismatches between `AI_lookup.csv` and `car_specs_lookup_full_cleaned.csv` for the same `(make, model, year)` (engine_cc/hp/body/drivetrain/seats)

2. Define canonicalization + correction rules (data-driven, easy to maintain)
   1. Add a single rules file (YAML/JSON) under `ml-service/data/lookups/` to keep business decisions out of code. Suggested sections:
      - `make_aliases`: maps normalized variants → canonical make (VW→Volkswagen, Bmw/bmw→BMW, Chana→Changan, KGM→SsangYong). Canonical targets decided: `Changan` and `SsangYong` (Egypt market is dominated by SsangYong-era vehicles).
      - `model_aliases_by_make`: per-make mapping for common formatting variants (Honda: `crv`, `cr v` → `CR-V`; MG: `rx5`, `rx 5` → `RX5`; Nissan `xtrail`→`X-Trail`, etc.)
      - `wrong_pair_fixes_allowlist`: explicit (make, model) → (make, model) reassignment for the high-confidence wrong rows (Toyota/Cruze, VW/Tiggo, Fiat/Jetta, Fiat/Polo, Ford/Echo, Suzuki/Fit, Hyundai/X3, etc.)
      - `valid_exceptions`: do not flag/auto-fix these entries (Chevrolet/Daewoo Lanos, Seat/Cupra Leon, Fiat/Shahin, Fiat/Dogan and Fiat/Petra (keep pending domain review), Speranza/Chery QQ). Note: KGM→SsangYong aliasing will intentionally collapse KGM/SsangYong `Torres` to `SsangYong / Torres`; this should not be treated as an error.
      - Concrete `wrong_pair_fixes_allowlist` entries to include (confirmed wrong assignments):
        - `Toyota / Cruze` → `Chevrolet / Cruze`
        - `Volkswagen / Tiggo` → `Chery / Tiggo`
        - `Ford / Echo` → `Toyota / Echo`
        - `Fiat / Polo` → `Volkswagen / Polo`
        - `Fiat / Jetta` → `Volkswagen / Jetta`
        - `Suzuki / Fit` → `Honda / Fit`
        - `Mini / Benni` → `Changan / Benni`
      - Concrete “flag for deletion” entries (do not auto-reassign; remove from backend seed and exclude from fixed outputs unless quarantined):
        - `Hyundai / X3`
        - `Mercedes / A1`
        - `Hyundai / A1`
        - `Chevrolet / 300`
        - `Kia / Saipa` (Saipa is a make, not a model)
        - `Suzuki / Maruti` (Maruti is a brand, not a model)
      - New suspicious rows to add to the report output (manual review required before Phase 2):
        - `Renault / Rainbow`
        - `Skoda / Fantasia` (possibly meant `Skoda / Fabia`)
        - `Suzuki / Rio` and `Daihatsu / Rio` (Rio is typically a Kia model)

   2. Decide canonical style rules:
      - Make casing: keep “brand official casing” (BMW, MG, DS) via make_aliases.
      - Model casing: title-case words but preserve known alphanumerics (RX5, DS7, iX1). Keep hyphens where common (CR-V, X-Trail, D-Max) unless backend forbids.

3. Add the new helper (one script) + a small shared library (reused everywhere)
   1. New shared library module (example name): `ml-service/src/make_model_canonical.py`
      - `norm_key(text)` for robust matching (diacritics, whitespace collapse, punctuation strategy)
      - `canonicalize_make(make)` using `make_aliases`
      - `canonicalize_model(make, model)` using `model_aliases_by_make` + safe formatting rules
      - `canonicalize_pair(make, model)` returns (canonical_make, canonical_model) plus “what changed” metadata
   2. New helper script (example name): `ml-service/src/fix_lookups_make_model.py`
      - Inputs: `car_specs_lookup_full_cleaned.csv`, `AI_lookup.csv`, and optionally `make_model_backend.json` + `main_car_info_for_backend.json`
      - Modes:
        - `--report` (default): generate a detailed MD/CSV report of issues + proposed fixes, no file writes
        - `--apply`: write fixed versions to new *_fixed files (and optional `--in-place` with timestamped .bak like existing scripts)
      - Fix order (important):
        1) canonicalize make/model (aliases + formatting)
        2) apply allowlisted wrong-pair reassignments
        3) recompute duplicates after backend-normalization; if conflicts differ in specs, emit a “merge conflict” section instead of guessing
        4) validate columns/ranges (engine_cc/hp/seats/year/market_share + enum sets for drivetrain/body_type/origin/segment)
      - Outputs (on apply):
        - `car_specs_lookup_full_cleaned.fixed.csv`
        - `AI_lookup.fixed.csv`
        - `main_car_info_for_backend.csv` (derived from `AI_lookup.fixed.csv` with columns `make,model,year,fuel,transmission`) — this is the required input for `ml-service/data/lookups/BACKEND.ipynb`

4. Keep existing deterministic spec fixes, but run them at the right time
   1. Continue using `ml-service/src/fix_car_specs_lookup_full.py` for the confirmed Egypt-spec corrections (engine_cc/hp/body_type/drivetrain/segment/market share).
   2. Ensure ordering is consistent:
      - First: make/model canonicalization (so rules match the canonical values)
      - Then: `fix_car_specs_lookup_full.py` (spec overrides)
      - Then: `ml-service/src/clean_impossible_model_years.py` for ghost-year removal/flagging
      - Finally: validate and export
   3. For fuel/transmission normalization, either:
      - repoint `ml-service/src/fix_car_main_info_ev_fuel.py` to operate on `AI_lookup.csv` (since `car_main_info.csv` doesn’t currently exist), OR
      - generate `car_main_info.csv` explicitly from AI_lookup and then run the existing script.

5. Wire it into the notebook workflow (prevents reintroducing errors)
   1. Update `ml-service/notebooks/02_data_cleaning.ipynb`:
      - After `lookup = settings.load_data("lookup")`: canonicalize lookup keys (or load a pre-fixed lookup)
      - Before `df = df.merge(lookup, on=["make","model","year"], how="left")`: canonicalize `df` make/model to match lookup
      - Before exporting `AI_lookup.csv`: run canonicalization + wrong-pair allowlist fixes so drop_duplicates happens on canonical keys
   2. Keep `ml-service/data/lookups/BACKEND.ipynb`, but decouple it from raw/uncleaned inputs:
      - It must read `AI_lookup.fixed.csv` (not the original `AI_lookup.csv`).
      - It must read `car_specs_lookup_full_cleaned.fixed.csv` (not the original `car_specs_lookup_full_cleaned.csv`).
      - Add a top markdown cell stating the dependency: run `fix_lookups_make_model.py --apply` before executing this notebook.
      - The helper `--apply` step must generate `main_car_info_for_backend.csv`; BACKEND.ipynb must read that fixed CSV (or regenerate it deterministically from `AI_lookup.fixed.csv`) before producing `main_car_info_for_backend.json` and `make_model_backend.json`.

6. Verification (must-pass checks before backend seeding)
   1. Make/model uniqueness checks:
      - No duplicates after backend-normalization for `(make, model)` within the same canonical make.
      - No make normalization collisions (BMW/Bmw/etc.) remain.
   2. Cross-file consistency checks:
      - For any `(make, model, year)` present in both AI_lookup and car_specs: engine_cc/hp/body/drivetrain/seats match (or are explicitly explained by a rule).
   3. Sanity checks:
      - engine_cc within a plausible range; hp within plausible range; seats within 1–9 (or a configured range); brand_market_share within [0,1].
      - Enumerated columns only contain approved values.
   4. Backend artifacts:
      - Regenerated `make_model_backend.json` and main info JSON load cleanly and are deterministic (stable ordering, stable casing).


**Execution Phases**
- Phase 1 — Rules and Report Only:
  - Write the YAML rules file (`make_aliases`, `model_aliases_by_make`, `wrong_pair_fixes_allowlist`, `valid_exceptions`) including the alias decisions `KGM` → `SsangYong` and `Chana` → `Changan`.
  - Write `ml-service/src/make_model_canonical.py` with `norm_key`, `canonicalize_make`, and `canonicalize_model`.
  - Write `ml-service/tests/test_make_model_canonical.py` and verify all tests pass.
  - Write `ml-service/src/fix_lookups_make_model.py` with `--report` mode only (no file writes).
  - Run `--report` against all three source files and verify it surfaces all known issues from the audit (including the new suspicious rows list).
  - Do not proceed to Phase 2 until the report output is reviewed and confirmed correct.
- Phase 2 — Apply and Validate:
  - Implement `--apply` mode in the helper script.
  - Run `--apply` and verify the fixed output files contain no backend-normalized duplicates.
  - Verify `main_car_info_for_backend.csv` is generated correctly for `ml-service/data/lookups/BACKEND.ipynb`.
- Phase 3 — Notebook Wiring:
  - Wire canonicalization into `ml-service/notebooks/02_data_cleaning.ipynb` at two points: after loading `lookup`, and before exporting `AI_lookup.csv`.
  - Update `ml-service/data/lookups/BACKEND.ipynb` to read from fixed output files, and add the dependency note at the top.
  - Full end-to-end run: notebook → helper → BACKEND.ipynb → seed scratch DB → confirm no uniqueness violations.

**Deferred: Model Hierarchy / Granularity Problem**
The file mixes model families with specific generations, engine variants, and trim levels. Examples: `BMW 3 Series` alongside `BMW 316`, `318`, `318i`, `320`, `320i`, `330`, `340`. Mercedes `GLC` alongside `GLC200`, `GLC300`, `GLC43`. Hyundai `Elantra` alongside `Elantra AD`, `Elantra HD`, `Elantra MD`, `Elantra CN7`.

This problem is explicitly deferred and will not be addressed in this pipeline phase. Reason: resolving it requires a product/business decision on whether the platform wants model-family granularity or variant-level granularity.

What the current pipeline WILL do: it will not merge or collapse these rows. It will leave them as distinct entries. It will NOT treat `BMW 318i` and `BMW 320i` as duplicates.

What must be documented: add a comment in `ml-service/src/make_model_canonical.py` and in the YAML rules file noting that model hierarchy normalization is explicitly out of scope and must be handled in a future dedicated pass.

**Known Limitation: Source Data Is Not Ground Truth**
`car_specs_lookup_full_cleaned.csv` contains the same wrong make/model assignments and inconsistencies present in other artifacts. The pipeline will apply canonicalization and the wrong-pair allowlist to clean make/model strings, and will apply spec range validation to catch out-of-bounds values. However, it cannot reliably detect a wrong spec value that falls within a plausible range (for example, an `engine_cc` value of `1600` assigned to a car whose actual engine is `2000cc` will pass validation and remain incorrect).

This limitation is accepted for the current phase. The cleaning pipeline improves the data significantly but does not guarantee spec correctness at the row level. Future phases may address this with a reference spec database cross-check.

**Testing: Canonical Module**
Before the canonical module is used in any pipeline run, add `ml-service/tests/test_make_model_canonical.py` with (at minimum) the following cases, and require them to pass.

- `norm_key` tests:
  - `norm_key("BMW")` → `"bmw"`
  - `norm_key("  Cr V ")` → `"crv"`
  - `norm_key("X-Trail")` → `"xtrail"`
  - `norm_key("RX5")` → `"rx5"`
- `canonicalize_make` tests:
  - `canonicalize_make("Chana")` → `"Changan"`
  - `canonicalize_make("KGM")` → `"SsangYong"`
  - `canonicalize_make("BMW")` → `"BMW"`
  - `canonicalize_make("bmw")` → `"BMW"`
- `canonicalize_model` tests:
  - `canonicalize_model("Honda", "Cr V")` → `"CRV"` (or the chosen canonical form; must be consistent with `model_aliases_by_make`)
  - `canonicalize_model("MG", "Rx5")` → `"RX5"`
  - `canonicalize_model("Suzuki", "Grand vitara")` → `"Grand Vitara"`
  - `canonicalize_model("Toyota", "Cruze")` → raises or returns a flagged result (because the correct fix requires a make reassignment via the wrong-pair allowlist)
  - `canonicalize_model("BMW", "320i")` → `"320i"`

Use either `unittest` or `pytest` (both are acceptable), but these tests must pass before Phase 2 or Phase 3 changes.

**Relevant files**
- `ml-service/data/lookups/car_specs_lookup_full_cleaned.csv` — primary specs lookup to fix + validate
- `ml-service/data/lookups/AI_lookup.csv` — source for fuel/transmission + cross-check for specs consistency
- `ml-service/data/lookups/make_model_backend.json` — backend seed list to rebuild after canonicalization
- `ml-service/data/lookups/main_car_info_for_backend.json` — backend seed main-info to rebuild
- `ml-service/notebooks/02_data_cleaning.ipynb` — generates `AI_lookup.csv` and merges with lookup; must apply canonicalization before merge/export
- `ml-service/data/lookups/BACKEND.ipynb` — kept as the backend-export notebook; must read only fixed outputs and emit `main_car_info_for_backend.json` + `make_model_backend.json` (with an explicit dependency note cell at the top)
- `ml-service/src/fix_car_specs_lookup_full.py` — keep deterministic spec overrides; run after canonicalization
- `ml-service/src/clean_impossible_model_years.py` — keep ghost-year removal; run after canonicalization/spec fixes
- `ml-service/src/fix_car_main_info_ev_fuel.py` — reuse but repoint to actual main-info source (AI_lookup or generated car_main_info.csv)
- `ml-service/docs/08-MAKE-MODEL-BACKEND-AUDIT.md` — update to include Claude-found issues + new cross-file checks

**Verification**
1. Run the new helper in report-only mode to confirm:
   - all planned changes are surfaced (no silent edits)
   - conflicts are listed, not auto-merged
2. Run the helper in apply mode and confirm:
   - backend-normalized duplicates are eliminated (Honda CRV variants, MG RX5 variants, plus any make casing duplicates)
   - allowlisted wrong-pair fixes are applied and listed in the report
3. Rerun the lookup merge portion of `02_data_cleaning.ipynb` and confirm the join produces minimal missing lookup fields.
4. Rebuild backend JSON outputs (either via helper or BACKEND.ipynb) and re-seed in a scratch DB to confirm no uniqueness violations.

**Decisions**
- Canonicalize make aliases into one make (you selected this).
- Auto-fix wrong make↔model rows only via a curated allowlist (you selected this).
- `car_specs_lookup_full_cleaned.csv` must be fixed (not treated as ground truth); the notebook is part of the root cause, so we wire canonicalization into `02_data_cleaning.ipynb`.
- Canonical make targets: `KGM` is an alias of `SsangYong`, and `Chana` is an alias of `Changan`.
- `ml-service/data/lookups/BACKEND.ipynb` is kept, but it must consume only fixed outputs from `fix_lookups_make_model.py --apply`.


**Further Considerations**
1. Canonical targets decided: `KGM` → `SsangYong` and `Chana` → `Changan`; record these in the YAML and treat them as potential breaking changes if downstream systems expect the old makes.
2. If backend currently enforces global uniqueness on model name, recommend changing to `UNIQUE(make_id, normalized_model_name)` to avoid false “duplicates” for common model codes like X7/A5/500.
