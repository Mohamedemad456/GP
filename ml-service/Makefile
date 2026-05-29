# KARNA ML Service — Pipeline Commands
#
# ── Typical workflow for a new scraping round ─────────────────────────────────
#
#   1. Pull data from Supabase (replace N with the scraping round number):
#        make pull SCRAPING_NUM=N
#
#   2. Run the full pipeline on the pulled file:
#        make pipeline RAW=data/raw/cars_raw_vNNN.csv APPLY=1
#
#   That's it. The pipeline auto-assigns a tag like 2026-06-01_001.
#
# ── Other useful commands ──────────────────────────────────────────────────────
#   make pipeline APPLY=1 FORCE=1     # re-run even if raw data fingerprint unchanged
#   make pipeline RAW=<path> APPLY=1  # specify raw file explicitly
#   make pipeline TAG=2026-06-01 APPLY=1  # explicit version tag
#   make versions                     # list all data versions
#   make version-current              # show current version as JSON
#   make version-verify               # check all manifest files exist on disk
#   make rollback TAG=2026-05-24_001  # dry-run rollback
#   make rollback TAG=2026-05-24_001 APPLY=1  # apply rollback
#   make clean-report                 # read-only cleaning report on current raw file
#   make next-tag                     # print next available version tag

PYTHON      := python3
PIPELINE    := scripts/cleaning/data_pipeline.py
VM          := scripts/cleaning/version_manager.py
DATA_LOADER := scripts/data/data_loader.py

# Defaults
RAW         ?= data/raw/cars_with_make_model.csv
TAG         ?=
APPLY       ?=
FORCE       ?=
SCRAPING_NUM ?=

# Build flags only when set
_APPLY_FLAG := $(if $(APPLY),--apply,)
_TAG_FLAG   := $(if $(TAG),--tag $(TAG),)
_FORCE_FLAG := $(if $(FORCE),--force,)

.PHONY: pull pipeline pipeline-skip-clean pipeline-skip-process \
        versions version-current version-verify rollback next-tag \
        clean-report consistency-check consistency-check-save \
        combine help

## ── Data loading (Supabase pull) ──────────────────────────────────────────────

pull: ## Pull raw data from Supabase: make pull SCRAPING_NUM=2
ifndef SCRAPING_NUM
	$(error SCRAPING_NUM is required. Usage: make pull SCRAPING_NUM=2)
endif
	$(PYTHON) $(DATA_LOADER) --scraping-num $(SCRAPING_NUM) --csv

## ── Data pipeline ─────────────────────────────────────────────────────────────

_SCRAPING_FLAG := $(if $(SCRAPING_NUM),--scraping-num $(SCRAPING_NUM),)

pipeline: ## Full versioned pipeline: clean + process + register version
	$(PYTHON) $(PIPELINE) $(_APPLY_FLAG) --raw $(RAW) $(_TAG_FLAG) $(_FORCE_FLAG) $(_SCRAPING_FLAG)

pipeline-skip-clean: ## Process only (skip cleaning — raw already clean)
	$(PYTHON) $(PIPELINE) $(_APPLY_FLAG) --raw $(RAW) $(_TAG_FLAG) $(_FORCE_FLAG) $(_SCRAPING_FLAG) --skip-clean

pipeline-skip-process: ## Clean only (no processed output)
	$(PYTHON) $(PIPELINE) $(_APPLY_FLAG) --raw $(RAW) $(_TAG_FLAG) $(_FORCE_FLAG) $(_SCRAPING_FLAG) --skip-process

clean-report: ## Read-only report on current raw file (no writes)
	$(PYTHON) scripts/cleaning/clean_raw_data_pipeline.py --mode report --input $(RAW)

consistency-check: ## Check all registered versions are combinable
	$(PYTHON) scripts/cleaning/check_version_consistency.py

consistency-check-save: ## Check versions and write consistency_report.csv
	$(PYTHON) scripts/cleaning/check_version_consistency.py --save

combine: ## Combine processed versions → training_data.csv (EXCLUDE=snapshot_one to skip)
	$(PYTHON) scripts/cleaning/combine_versions.py --apply $(if $(EXCLUDE),--exclude $(EXCLUDE),)

## ── Version management ────────────────────────────────────────────────────────

versions: ## List all data versions
	$(PYTHON) $(VM) list

version-current: ## Show current version details as JSON
	$(PYTHON) $(VM) current

version-verify: ## Check all manifest files exist on disk
	$(PYTHON) $(VM) verify

next-tag: ## Print the next available version tag
	$(PYTHON) $(VM) new-tag

rollback: ## Rollback to TAG= (add APPLY=1 to apply)
ifndef TAG
	$(error TAG is required. Usage: make rollback TAG=2026-05-24 [APPLY=1])
endif
	$(PYTHON) $(VM) rollback $(TAG) $(_APPLY_FLAG)

## ── Help ──────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo ""
	@echo "  KARNA ML Pipeline Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-28s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Variables:"
	@echo "    RAW=<path>          Input raw CSV (default: data/raw/cars_with_make_model.csv)"
	@echo "    TAG=<tag>           Version tag   (default: auto YYYY-MM-DD_NNN)"
	@echo "    APPLY=1             Execute — without this flag, commands are dry-run"
	@echo "    FORCE=1             Re-run even if raw data fingerprint is unchanged"
	@echo "    SCRAPING_NUM=<N>    Supabase scraping round (required for pull, optional for pipeline)"
	@echo ""

.DEFAULT_GOAL := help
