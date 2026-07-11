# ML Service

This repository is currently trimmed down to the parts that support raw data inspection and cleaning.

## Current Scope

- `app/core/config.py` for project paths and data loading helpers
- `notebooks/01_EDA.ipynb` for exploratory analysis
- `notebooks/02_data_cleaning.ipynb` for cleaning work
- `src/data_cleaner.py` for the cleaning pipeline entry point

Everything else from the earlier end-to-end ML service plan has been removed to keep the project small and focused.

## Current Structure

```text
ml-service/
├── app/
│   └── core/
│       └── config.py
├── data/
├── docs/
│   ├── 01-SYSTEM-ARCHITECTURE.md
│   ├── 02-FEATURE-ENGINEERING.md
│   ├── 03-MODEL-STRATEGY.md
│   ├── 04-DEPLOYMENT-GUIDE.md
│   └── 05-RISK-MITIGATION.md
├── notebooks/
│   ├── 01_EDA.ipynb
│   └── 02_data_cleaning.ipynb
└── src/
	└── data_cleaner.py
```

## How To Work In This Repo

1. Update or extend the EDA notebook when you need to understand the dataset.
2. Keep cleaning logic in `src/data_cleaner.py`.
3. Use `app/core/config.py` for path resolution and loading raw or cleaned data.
4. Treat the docs in `docs/` as the target design for the broader ML service, even though the current codebase only implements the trimmed cleaning-focused slice.

## Notes

- The previous sprint plan was deleted on purpose.
- Training, serving, and deployment scaffolding were removed to avoid unnecessary complexity.
